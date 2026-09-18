/* =====================================================================
   PDF IMPORT — best-effort extraction of transactions from a bank
   statement PDF. Rewritten to handle real-world statements that use:
     - dates written out ("17 de set. de 2026"), not just "17/09/2026"
     - separate "Valores descontados" / "Valores recebidos" / "Saldo"
       columns instead of one signed amount
     - multi-line descriptions (name wraps to a second line, followed
       by "De:", "Instituição:", "Tipo:", "Referência..." metadata)
   It also tries to guess a sensible category per line and flags likely
   internal movements (paying your own card invoice, self-transfers)
   so they start unchecked — but NOTHING is ever imported without the
   person reviewing and confirming first.
   ===================================================================== */

const PdfImport = {
  ready: false,

  ensureWorker(){
    if(this.ready) return;
    if(window.pdfjsLib){
      pdfjsLib.GlobalWorkerOptions.workerSrc = "https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/legacy/build/pdf.worker.min.js";
      this.ready = true;
    }
  },

  norm(s){
    return String(s||"").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"");
  },

  MESES_MAP: {jan:1,fev:2,mar:3,abr:4,mai:5,jun:6,jul:7,ago:8,set:9,out:10,nov:11,dez:12},

  // ------------------------------------------------------------- entry UI
  openPicker(){
    UI.openModal(`
      <div class="modal-head"><h3>Importar extrato (PDF)</h3><button class="icon-btn" id="closePdf"><i data-lucide="x"></i></button></div>
      <div class="modal-body">
        <p style="font-size:12.5px; color:var(--ink-soft);">
          Funciona melhor com extratos em texto (não escaneados/fotografados). O app reconhece datas por
          extenso ou numéricas e colunas de débito/crédito/saldo. O layout varia entre bancos, então o
          resultado é uma sugestão — você revisa e edita antes de confirmar a importação.
        </p>
        <div class="field">
          <label>Arquivo PDF</label>
          <input type="file" id="pdfFile" accept="application/pdf"/>
        </div>
        <div id="pdfStatus" style="font-size:12.5px; color:var(--ink-soft);"></div>
      </div>
    `, { onMount(root){
      root.querySelector("#closePdf").onclick = ()=>UI.closeModal();
      root.querySelector("#pdfFile").addEventListener("change", async (e)=>{
        const file = e.target.files[0]; if(!file) return;
        const status = root.querySelector("#pdfStatus");
        status.textContent = "Lendo o PDF...";
        try{
          const rows = await PdfImport.parseFile(file);
          UI.closeModal();
          PdfImport.showReview(rows);
        }catch(err){
          console.error(err);
          status.textContent = "Não consegui ler esse PDF. Confira se ele não está protegido por senha ou é uma imagem escaneada.";
        }
      });
    }});
  },

  // ------------------------------------------------------ PDF -> rows
  async parseFile(file){
    this.ensureWorker();
    if(!window.pdfjsLib) throw new Error("pdf.js não carregou (verifique sua conexão)");
    const buf = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({data: buf}).promise;

    let accountHolderName = null;
    const allCandidates = [];

    for(let p=1; p<=pdf.numPages; p++){
      const page = await pdf.getPage(p);
      const content = await page.getTextContent();

      // group text items into visual rows by y, tokens sorted left-to-right
      const rowsMap = {};
      content.items.forEach(item=>{
        const y = Math.round(item.transform[5]/2)*2;
        (rowsMap[y] = rowsMap[y]||[]).push({x:item.transform[4], str:item.str});
      });
      const rows = Object.keys(rowsMap).map(Number).sort((a,b)=>b-a)
        .map(y => ({ y, tokens: rowsMap[y].sort((a,b)=>a.x-b.x) }))
        .filter(r => r.tokens.some(t=>t.str.trim()));

      if(p===1 && !accountHolderName) accountHolderName = this.guessAccountHolderName(rows);

      allCandidates.push(...this.extractPageCandidates(rows));
    }

    return this.applySmartDefaults(allCandidates, accountHolderName);
  },

  // Looks for a standalone, all-caps "Full Name" line near the top of page 1
  // (very common right under the bank logo on Brazilian statements). Used
  // only to flag likely self-transfers — never blocks anything from being
  // imported, just defaults it unchecked.
  guessAccountHolderName(rows){
    const deny = /revolut|extrato|resumo|saldo|pendente|transa[cç][aã]o|banco|cr[eé]dito|s\.?a\.?$|ltda/i;
    for(const row of rows.slice(0, 25)){
      const text = row.tokens.map(t=>t.str).join(" ").trim();
      if(/^[A-ZÀ-ÖØ-Þ\s]{6,60}$/.test(text) && text.split(/\s+/).length>=2 && !deny.test(text)){
        return text;
      }
    }
    return null;
  },

  parseDateAtStart(rowText){
    const extenso = rowText.match(/^(\d{1,2})\s+de\s+([a-zç]{3,4})\.?\s+de\s+(\d{4})/i);
    if(extenso){
      const mes = this.MESES_MAP[this.norm(extenso[2]).slice(0,3)];
      if(mes){
        const day = extenso[1].padStart(2,"0"), month = String(mes).padStart(2,"0");
        return { iso: `${extenso[3]}-${month}-${day}`, matchLen: extenso[0].length };
      }
    }
    const numeric = rowText.match(/^(\d{2})\/(\d{2})(?:\/(\d{2,4}))?/);
    if(numeric){
      let year = numeric[3] || Store.state.settings.selectedYm.split("-")[0];
      if(String(year).length===2) year = "20"+year;
      return { iso: `${year}-${numeric[2]}-${numeric[1]}`, matchLen: numeric[0].length };
    }
    return null;
  },

  MONEY_RE: /^-?R?\$?\d{1,3}(?:\.\d{3})*,\d{2}$/,
  META_PREFIX_RE: /^(de:|instituicao:|instituição:|tipo:|referencia|referência|para:|cartao:|cartão:|taxa:|cnpj|cpf)/i,

  // merges a lone "R$" token with the number that follows it (some PDFs split them)
  mergeCurrencyTokens(tokens){
    const out = [];
    for(let i=0;i<tokens.length;i++){
      const t = tokens[i];
      if(/^r\$?$/i.test(t.str.trim()) && tokens[i+1] && /^\d/.test(tokens[i+1].str.trim())){
        out.push({x:t.x, str: t.str.trim()+tokens[i+1].str.trim()});
        i++;
      } else out.push(t);
    }
    return out;
  },

  extractPageCandidates(rows){
    const candidates = [];
    let colX = {}; // { descontado, recebido, saldo } -> x position from the current table's header

    for(let i=0; i<rows.length; i++){
      const tokens = this.mergeCurrencyTokens(rows[i].tokens);
      const rawText = tokens.map(t=>t.str).join(" ").replace(/\s+/g," ").trim();
      const normText = this.norm(rawText);

      // header row: (re)establish column x-positions for whichever table comes next
      if(normText.includes("data") && (normText.includes("descontados") || normText.includes("recebidos"))){
        colX = {};
        tokens.forEach(t=>{
          const n = this.norm(t.str);
          if(n.includes("descontados")) colX.descontado = t.x;
          if(n.includes("recebidos")) colX.recebido = t.x;
          if(n === "saldo" || n === "saldo:" ) colX.saldo = t.x;
        });
        continue;
      }

      const dateInfo = this.parseDateAtStart(rawText);
      if(!dateInfo) continue; // continuation/metadata row — handled via look-back merge below

      const moneyTokens = tokens.filter(t => this.MONEY_RE.test(t.str.trim()));
      if(!moneyTokens.length) continue;

      let value = null, type = null;
      const hasCols = colX.descontado!==undefined || colX.recebido!==undefined;
      if(hasCols){
        // classify each money token by nearest known column, ignore "saldo"
        for(const mt of moneyTokens){
          const dists = [];
          if(colX.descontado!==undefined) dists.push(["Despesa", Math.abs(mt.x-colX.descontado)]);
          if(colX.recebido!==undefined) dists.push(["Receita", Math.abs(mt.x-colX.recebido)]);
          if(colX.saldo!==undefined) dists.push(["saldo", Math.abs(mt.x-colX.saldo)]);
          dists.sort((a,b)=>a[1]-b[1]);
          const nearest = dists[0];
          if(nearest && nearest[0]!=="saldo" && value===null){
            value = this.toNumber(mt.str); type = nearest[0];
          }
        }
      }
      if(value===null){
        // no usable column context — fall back to "first amount on the line is
        // the transaction value, extra numbers are a running balance"
        value = this.toNumber(moneyTokens[0].str);
        type = /recebid|deposit|sal[aá]rio|reembolso|estorno|rendimento/.test(this.norm(rawText)) ? "Receita" : "Despesa";
      }
      if(!value || value<=0) continue;

      // description = row text minus the date prefix and any money substrings
      let desc = rawText.slice(dateInfo.matchLen).trim();
      moneyTokens.forEach(mt=>{ desc = desc.replace(mt.str, ""); });
      desc = desc.replace(/\s+/g," ").trim();

      // pull in short continuation lines (name wraps to next row) — stop at
      // metadata (De:/Instituição:/Tipo:/...), a new date, or another amount
      let merged = 0;
      for(let j=i+1; j<rows.length && merged<2; j++){
        const nextText = this.mergeCurrencyTokens(rows[j].tokens).map(t=>t.str).join(" ").trim();
        if(!nextText) continue;
        if(this.parseDateAtStart(nextText)) break;
        if(this.META_PREFIX_RE.test(nextText)) break;
        if(/\d{1,3}(?:\.\d{3})*,\d{2}/.test(nextText)) break;
        if(this.norm(nextText).includes("descontados") || this.norm(nextText).includes("recebidos")) break;
        desc = (desc + " " + nextText).trim();
        merged++;
      }
      if(!desc) desc = "Lançamento importado";

      candidates.push({ date: dateInfo.iso, description: desc.slice(0,90), value, type });
    }
    return candidates;
  },

  toNumber(str){
    return parseFloat(String(str).replace(/^-?R\$?/i,"").replace(/\./g,"").replace(",",".")) || 0;
  },

  INTERNAL_NOISE_RE: /pagamento do cart[aã]o de cr[eé]dito|contas? remuneradas?|juros pagos|security deposit|transfer[eê]ncia de fundos exceden/i,

  applySmartDefaults(rows, accountHolderName){
    const holderNorm = accountHolderName ? this.norm(accountHolderName) : null;
    return rows.map(r=>{
      const cat = this.inferCategory(r.description, r.type);
      let include = true, note = "";
      if(this.INTERNAL_NOISE_RE.test(r.description)){
        include = false; note = "Provável movimentação interna (fatura/reserva), não um gasto real";
      } else if(holderNorm && this.norm(r.description).includes(holderNorm)){
        include = false; note = "Provável transferência para você mesmo";
      }
      return { ...r, category: cat.category, subcategory: cat.subcategory, include, note };
    });
  },

  // Best-effort category guess from common Brazilian merchant/keyword patterns,
  // falling back to the app's own category/subcategory names first.
  inferCategory(description, type){
    const lower = this.norm(description);
    const S = Store.state;

    if(type === "Receita"){
      const hit = S.categories.receita.find(c=>lower.includes(this.norm(c)) && !/outros/i.test(c));
      if(hit) return {category:hit, subcategory:""};
      if(/sal[aá]rio/.test(lower)) return {category: S.categories.receita.find(c=>/sal[aá]rio/i.test(c)) || "Outros", subcategory:""};
      if(/freela/.test(lower)) return {category: S.categories.receita.find(c=>/freela/i.test(c)) || "Outros", subcategory:""};
      if(/reembolso|estorno/.test(lower)) return {category: S.categories.receita.find(c=>/reembolso/i.test(c)) || "Outros", subcategory:""};
      // unclear source (e.g. a generic Pix from a named person) — "Outros" is
      // an honest default; never silently guess "Salário" for random income.
      return {category: S.categories.receita.find(c=>/outros/i.test(c)) || S.categories.receita[S.categories.receita.length-1] || "Outros", subcategory:""};
    }

    let best = null;
    Object.entries(S.categories.despesa).forEach(([cat,subs])=>{
      subs.forEach(sub=>{
        if(sub.length>=4 && lower.includes(this.norm(sub)) && (!best || sub.length>best.sub.length)) best = {cat, sub};
      });
    });
    if(best) return {category:best.cat, subcategory:best.sub};
    const catHit = Object.keys(S.categories.despesa).find(c=>lower.includes(this.norm(c)));
    if(catHit) return {category:catHit, subcategory:""};

    const dict = [
      [/mercad|supermerc|atacad|hortifruti|sacol[aã]o|acougue|padari|panifica|adega|distribuidora/, ["Alimentação","Mercado"]],
      [/restaurant|lanchonet|pastel|pizzari|hamburg|burger|subway|churrasc|espetinho/, ["Alimentação","Restaurante"]],
      [/ifood|rappi|uber ?eats|delivery/, ["Alimentação","Delivery"]],
      [/sorveteria|cacau|doceria|confeitaria|bombom|chocolate|oxxo/, ["Alimentação","Outros"]],
      [/farma|drogaria|drogasil|panvel/, ["Saúde","Farmácia"]],
      [/academia|smartfit|bodytech|crossfit|pilates/, ["Saúde","Academia"]],
      [/hospital|cl[ií]nica|laborat[oó]rio|dentista|odonto/, ["Saúde","Consultas"]],
      [/posto|combust[ií]vel|shell|ipiranga|petrobras/, ["Transporte","Combustível"]],
      [/\buber\b|99app|99pop|\btaxi\b/, ["Transporte","Uber"]],
      [/estacionamento|zona azul/, ["Transporte","Estacionamento"]],
      [/ped[aá]gio|sem parar|conectcar/, ["Transporte","Pedágio"]],
      [/cinema|multiplex|cinemark/, ["Lazer","Cinema"]],
      [/netflix|spotify|disney|hbo|deezer|amazon prime/, ["Lazer","Streaming"]],
      [/livraria|papelaria/, ["Educação","Materiais"]],
      [/faculdade|universidade|udemy|\balura\b/, ["Educação","Cursos"]],
      [/\bloja\b|magazine|shopping|cal[cç]ad|\bmoda\b|boutique/, ["Pessoal","Roupas"]],
      [/aluguel|imobili[aá]ria/, ["Moradia","Aluguel"]],
      [/condom[ií]nio/, ["Moradia","Condomínio"]],
      [/energia|eletropaulo|cpfl|\benel\b/, ["Moradia","Energia"]],
      [/sanasa|sabesp|copasa|\b[aá]gua\b/, ["Moradia","Água"]],
      [/\bnet\b|\bvivo\b|\bclaro\b|\btim\b|internet|telefonica/, ["Moradia","Internet"]],
      [/\bseguro\b/, ["Transporte","Seguro"]],
      [/igreja|d[ií]zimo/, ["Pessoal","Presentes"]],
    ];
    for(const [re, cat] of dict){ if(re.test(lower)) return {category:cat[0], subcategory:cat[1]}; }
    return {category:"Pessoal", subcategory:"Outros"};
  },

  // ------------------------------------------------------- review screen
  showReview(rows){
    if(rows.length===0){
      UI.toast("Não encontrei linhas com data e valor nesse PDF. Talvez seja um extrato escaneado (imagem).", {error:true});
      return;
    }
    const S = Store.state;
    const catOptions = (type)=> type==="Receita" ? S.categories.receita : Object.keys(S.categories.despesa);
    const includedCount = rows.filter(r=>r.include).length;

    const html = `
      <div class="modal-head"><h3>Revisar importação (${rows.length} encontrados, ${includedCount} pré-selecionados)</h3><button class="icon-btn" id="closeReview"><i data-lucide="x"></i></button></div>
      <div class="modal-body" style="max-height:60vh; overflow-y:auto;">
        <p style="font-size:12px; color:var(--ink-faint);">Categoria já sugerida automaticamente — confira antes de importar. Linhas que parecem movimentação interna (fatura do cartão, reservas, transferência para você mesmo) já vêm desmarcadas.</p>
        <table style="font-size:12.5px;">
          <thead><tr><th></th><th>Data</th><th>Descrição</th><th>Tipo</th><th>Categoria</th><th>Valor</th></tr></thead>
          <tbody id="reviewBody">
            ${rows.map((r,i)=>`
              <tr data-i="${i}">
                <td><input type="checkbox" class="r-include" ${r.include?'checked':''}/></td>
                <td><input type="date" class="r-date" value="${r.date}" style="width:130px;"/></td>
                <td>
                  <input type="text" class="r-desc" value="${escapeHtml(r.description)}" style="width:180px;"/>
                  ${r.note ? `<div style="font-size:10.5px; color:var(--gold); margin-top:2px;">${escapeHtml(r.note)}</div>` : ""}
                </td>
                <td>
                  <select class="r-type">
                    <option value="Despesa" ${r.type==='Despesa'?'selected':''}>Despesa</option>
                    <option value="Receita" ${r.type==='Receita'?'selected':''}>Receita</option>
                  </select>
                </td>
                <td><select class="r-cat">${catOptions(r.type).map(c=>`<option ${c===r.category?'selected':''}>${c}</option>`).join("")}</select></td>
                <td><input type="number" step="0.01" class="r-value" value="${r.value}" style="width:90px;"/></td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>
      <div class="modal-foot">
        <button class="btn btn-secondary btn-block" id="cancelReview">Cancelar</button>
        <button class="btn btn-primary btn-block" id="confirmImport">Importar selecionados</button>
      </div>
    `;
    UI.openModal(html, { size:"lg", onMount(root){
      root.querySelector("#closeReview").onclick = ()=>UI.closeModal();
      root.querySelector("#cancelReview").onclick = ()=>UI.closeModal();

      root.querySelectorAll("tbody tr").forEach(tr=>{
        tr.querySelector(".r-type").addEventListener("change",(e)=>{
          const sel = tr.querySelector(".r-cat");
          sel.innerHTML = catOptions(e.target.value).map(c=>`<option>${c}</option>`).join("");
        });
      });

      root.querySelector("#confirmImport").onclick = ()=>{
        let count = 0;
        root.querySelectorAll("tbody tr").forEach(tr=>{
          if(!tr.querySelector(".r-include").checked) return;
          const type = tr.querySelector(".r-type").value;
          Store.addTransaction({
            type, description: tr.querySelector(".r-desc").value.trim() || "Lançamento importado",
            value: Number(tr.querySelector(".r-value").value)||0,
            date: tr.querySelector(".r-date").value, dueDate: tr.querySelector(".r-date").value,
            category: tr.querySelector(".r-cat").value, subcategory: "",
            accountId: (S.accounts[0]||{}).id || null, paymentMethod:"Débito", cardId:null,
            status:"Pago", fixed:false, notes:"Importado de extrato PDF",
            installments:1, installmentNum:1, groupId:null,
          });
          count++;
        });
        UI.closeModal();
        UI.toast(`${count} lançamento(s) importado(s).`);
        App.rerender();
      };
    }});
  },
};
