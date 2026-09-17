/* =====================================================================
   PDF IMPORT — best-effort extraction of transactions from a bank
   statement PDF. Statement layouts vary a lot between banks, so this
   never auto-imports silently: it always shows an editable review
   table first, and the person confirms what actually gets added.
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

  openPicker(){
    UI.openModal(`
      <div class="modal-head"><h3>Importar extrato (PDF)</h3><button class="icon-btn" id="closePdf"><i data-lucide="x"></i></button></div>
      <div class="modal-body">
        <p style="font-size:12.5px; color:var(--ink-soft);">
          Funciona melhor com extratos em texto (não escaneados/fotografados). O layout varia entre
          bancos, então o resultado é uma sugestão — você revisa e edita antes de confirmar a importação.
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

  async parseFile(file){
    this.ensureWorker();
    if(!window.pdfjsLib) throw new Error("pdf.js não carregou (verifique sua conexão)");
    const buf = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({data: buf}).promise;
    const lines = [];
    for(let p=1; p<=pdf.numPages; p++){
      const page = await pdf.getPage(p);
      const content = await page.getTextContent();
      const rows = {};
      content.items.forEach(item=>{
        const y = Math.round(item.transform[5]/2)*2; // small tolerance for items on the same visual line
        (rows[y] = rows[y]||[]).push({x:item.transform[4], str:item.str});
      });
      Object.keys(rows).map(Number).sort((a,b)=>b-a).forEach(y=>{
        const line = rows[y].sort((a,b)=>a.x-b.x).map(i=>i.str).join(" ").replace(/\s+/g," ").trim();
        if(line) lines.push(line);
      });
    }
    return this.linesToCandidates(lines);
  },

  linesToCandidates(lines){
    const DATE_RE = /\b(\d{2})\/(\d{2})(?:\/(\d{2,4}))?\b/;
    const VALUE_RE = /(-)?\s?R?\$?\s?(\d{1,3}(?:\.\d{3})*,\d{2}|\d+,\d{2})\s*(D|C)?\s*$/i;
    const defaultYear = Store.state.settings.selectedYm.split("-")[0];
    const out = [];
    lines.forEach(line=>{
      const dm = line.match(DATE_RE);
      const vm = line.match(VALUE_RE);
      if(!dm || !vm) return;
      let year = dm[3] || defaultYear;
      if(String(year).length===2) year = "20"+year;
      const date = `${year}-${dm[2]}-${dm[1]}`;
      if(isNaN(new Date(date).getTime())) return;
      const isNeg = !!vm[1] || (vm[3]||"").toUpperCase()==="D";
      const value = parseFloat(vm[2].replace(/\./g,"").replace(",","."));
      if(!value || value<=0) return;
      let description = line.replace(dm[0],"").replace(vm[0],"").replace(/\s+/g," ").trim();
      if(!description) description = "Lançamento importado";
      out.push({
        date, description: description.slice(0,80),
        value, type: isNeg ? "Despesa" : "Receita",
        include: true,
      });
    });
    return out;
  },

  showReview(rows){
    if(rows.length===0){
      UI.toast("Não encontrei linhas com data e valor nesse PDF. Talvez seja um extrato escaneado (imagem).", {error:true});
      return;
    }
    const S = Store.state;
    const catOptions = (type)=> type==="Receita" ? S.categories.receita : Object.keys(S.categories.despesa);

    const html = `
      <div class="modal-head"><h3>Revisar importação (${rows.length} encontrados)</h3><button class="icon-btn" id="closeReview"><i data-lucide="x"></i></button></div>
      <div class="modal-body" style="max-height:60vh; overflow-y:auto;">
        <p style="font-size:12px; color:var(--ink-faint);">Confira tipo, categoria e valor de cada linha antes de importar — a leitura automática pode errar.</p>
        <table style="font-size:12.5px;">
          <thead><tr><th></th><th>Data</th><th>Descrição</th><th>Tipo</th><th>Categoria</th><th>Valor</th></tr></thead>
          <tbody id="reviewBody">
            ${rows.map((r,i)=>`
              <tr data-i="${i}">
                <td><input type="checkbox" class="r-include" ${r.include?'checked':''}/></td>
                <td><input type="date" class="r-date" value="${r.date}" style="width:130px;"/></td>
                <td><input type="text" class="r-desc" value="${escapeHtml(r.description)}" style="width:180px;"/></td>
                <td>
                  <select class="r-type">
                    <option value="Despesa" ${r.type==='Despesa'?'selected':''}>Despesa</option>
                    <option value="Receita" ${r.type==='Receita'?'selected':''}>Receita</option>
                  </select>
                </td>
                <td><select class="r-cat">${catOptions(r.type).map(c=>`<option>${c}</option>`).join("")}</select></td>
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
