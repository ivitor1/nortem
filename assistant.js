/* =====================================================================
   ASSISTANT — floating chat that can (a) add transactions directly from
   plain text, and (b) answer financial questions, either with a real
   Claude API call (if the person added their own API key in
   Configurações) or with a rule-based fallback that still uses their
   real data.
   ===================================================================== */

const Assistant = {
  isOpen: false,
  busy: false,
  aiAvailable: null, // null = unknown yet, true/false after first attempt

  // ------------------------------------------------------------ lifecycle
  init(){
    document.getElementById("assistantFab").addEventListener("click", ()=>this.open());
    document.getElementById("closeAssistant").addEventListener("click", ()=>this.close());
    document.getElementById("assistantBackdrop").addEventListener("click", ()=>this.close());
    const input = document.getElementById("assistantInput");
    input.addEventListener("keydown", (e)=>{
      if(e.key==="Enter" && !e.shiftKey){ e.preventDefault(); this.handleSend(); }
    });
    input.addEventListener("input", ()=>{
      input.style.height = "auto";
      input.style.height = Math.min(120, input.scrollHeight) + "px";
    });
    document.getElementById("assistantSend").addEventListener("click", ()=>this.handleSend());

    document.getElementById("assistantAttach").addEventListener("click", ()=>document.getElementById("assistantPdfInput").click());
    document.getElementById("assistantPdfInput").addEventListener("change", (e)=>this.handlePdfAttach(e));
  },

  async handlePdfAttach(e){
    const file = e.target.files[0];
    e.target.value = ""; // allow attaching the same file again later
    if(!file) return;
    Store.addChatMessage("user", `📎 ${file.name}`);
    this.renderMessages();
    this.renderMessages(null, true); // typing indicator while it parses
    try{
      const rows = await PdfImport.parseFile(file);
      const included = rows.filter(r=>r.include).length;
      if(rows.length === 0){
        Store.addChatMessage("assistant", "Não encontrei linhas com data e valor nesse PDF. Pode ser um extrato escaneado (imagem) em vez de texto.");
      } else {
        Store.addChatMessage("assistant",
          `Encontrei **${rows.length} lançamentos** nesse extrato — já pré-selecionei ${included} (deixei de fora o que parecia fatura de cartão ou transferência para você mesmo, e sugeri uma categoria para cada um). Abri a tela de revisão para você conferir e confirmar.`);
      }
      this.renderMessages();
      if(rows.length) PdfImport.showReview(rows);
    }catch(err){
      console.error(err);
      Store.addChatMessage("assistant", "Não consegui ler esse PDF — confira se ele não está protegido por senha ou é uma imagem escaneada.");
      this.renderMessages();
    }
  },

  open(){
    this.isOpen = true;
    document.getElementById("assistantPanel").hidden = false;
    document.getElementById("assistantBackdrop").hidden = false;
    requestAnimationFrame(()=>document.getElementById("assistantPanel").classList.add("open"));
    this.updateModeTag();
    this.renderMessages();
    initIcons();
    setTimeout(()=>document.getElementById("assistantInput").focus(), 200);
  },
  close(){
    this.isOpen = false;
    document.getElementById("assistantPanel").classList.remove("open");
    document.getElementById("assistantBackdrop").hidden = true;
    setTimeout(()=>{ document.getElementById("assistantPanel").hidden = true; }, 200);
  },
  updateModeTag(){
    const tag = document.getElementById("assistantModeTag");
    if(this.aiAvailable === true){ tag.textContent = "IA conectada"; tag.className = "assistant-mode on"; }
    else if(this.aiAvailable === false){ tag.textContent = "modo básico"; tag.className = "assistant-mode"; }
    else { tag.textContent = "assistente"; tag.className = "assistant-mode"; }
  },

  // ------------------------------------------------------------- sending
  handleSend(){
    const input = document.getElementById("assistantInput");
    const text = input.value.trim();
    if(!text || this.busy) return;
    input.value = ""; input.style.height = "auto";
    this.send(text);
  },

  async send(text){
    Store.addChatMessage("user", text);
    this.renderMessages();

    // 1) try to interpret it as a direct transaction ("gastei 45 no mercado hoje")
    const parsed = this.parseCommand(text);
    if(parsed && parsed.confidence === "high"){
      Store.addTransaction(parsed.payload);
      const added = Store.state.transactions[Store.state.transactions.length-1];
      const line = `✅ Registrei: **${parsed.payload.type}** de ${money(parsed.payload.value)} em ${parsed.payload.category}${parsed.payload.subcategory ? " ("+parsed.payload.subcategory+")" : ""}, ${fmtDate(parsed.payload.date)}.`;
      Store.addChatMessage("assistant", line);
      this.renderMessages(added.id);
      App.rerender();
      this.checkDailyLimitAfterAdd(parsed.payload);
      return;
    }
    if(parsed && parsed.confidence === "low"){
      Store.addChatMessage("assistant", `Entendi que é ${parsed.payload.type==='Despesa'?'uma despesa':'uma receita'} de ${money(parsed.payload.value)}, mas não tenho certeza da categoria. Abri o formulário já preenchido — só confirmar a categoria e salvar.`);
      this.renderMessages();
      UI.openTransactionModal(null, { draft: parsed.payload });
      return;
    }

    // 2) otherwise, treat as a question / conversation — always try the
    // shared AI first (works automatically, no key needed from the person
    // using the app); if it's not configured or fails, fall back gracefully.
    this.busy = true;
    this.renderMessages(null, true); // show typing indicator
    let reply;
    try{
      reply = await this.callAI(text);
      this.aiAvailable = true;
    }catch(err){
      this.aiAvailable = false;
      if(err.message !== "not_configured") console.warn("Assistant AI error:", err);
      reply = this.ruleBasedReply(text);
    }
    this.busy = false;
    Store.addChatMessage("assistant", reply);
    this.renderMessages();
    this.updateModeTag();
  },

  checkDailyLimitAfterAdd(payload){
    if(payload.type !== "Despesa" || payload.date !== todayStr()) return;
    const check = Store.todaySpendingCheck();
    if(check.enabled && check.over && Store.state.settings.dailyLimitAlertedDate !== todayStr()){
      Store.updateSettings({dailyLimitAlertedDate: todayStr()});
      UI.showDailyLimitPopup(check);
    }
  },



  undoTransaction(id){
    Store.deleteTransaction(id, false);
    Store.addChatMessage("assistant", "Prontinho, desfiz esse lançamento.");
    this.renderMessages();
    App.rerender();
  },

  // -------------------------------------------------------- rendering
  renderMessages(justAddedTxId, showTyping){
    const box = document.getElementById("assistantMessages");
    const msgs = Store.state.assistant.messages;
    box.innerHTML = msgs.length ? msgs.map((m,i)=>this.bubble(m, i===msgs.length-1 && justAddedTxId)).join("")
      : `<div class="assistant-empty">
           <i data-lucide="sparkles"></i>
           <p><b>${greeting().text}${Store.state.profile.name?", "+escapeHtml(Store.state.profile.name):""}!</b> Posso registrar seus gastos
           e te orientar sobre suas finanças. Comece por aqui:</p>
           <div class="assistant-chips">
             <button class="a-chip" data-q="como estou?">📊 Como estou?</button>
             <button class="a-chip" data-q="onde estou gastando?">🔍 Onde estou gastando?</button>
             <button class="a-chip" data-q="quanto posso gastar?">💵 Quanto posso gastar?</button>
             <button class="a-chip" data-q="e minhas dívidas?">📉 E minhas dívidas?</button>
             <button class="a-chip" data-q="como estão minhas metas?">🎯 Minhas metas</button>
             <button class="a-chip" data-q="previsão dos próximos meses">📆 Previsão</button>
           </div>
           <p style="margin-top:14px; font-size:12px; color:var(--ink-faint);">Ou me conte um gasto: <i>"gastei 45 no mercado hoje"</i> — ou clique no 📎 para importar um extrato em PDF.</p>
         </div>`;
    if(showTyping){
      box.insertAdjacentHTML("beforeend", `<div class="msg assistant typing" id="typingBubble"><span></span><span></span><span></span></div>`);
    }
    initIcons();
    box.scrollTop = box.scrollHeight;

    box.querySelectorAll(".a-chip").forEach(chip=>{
      chip.onclick = ()=>this.send(chip.dataset.q);
    });

    if(justAddedTxId){
      const undoBtn = box.querySelector(`[data-undo="${justAddedTxId}"]`);
      if(undoBtn) undoBtn.onclick = ()=>this.undoTransaction(justAddedTxId);
    }
  },

  bubble(m, withUndo){
    const isUser = m.role === "user";
    const text = escapeHtml(m.text)
      .replace(/\*\*(.+?)\*\*/g,"<b>$1</b>")
      .replace(/_(.+?)_/g,"<i>$1</i>")
      .replace(/\n/g,"<br>");
    return `<div class="msg ${isUser?'user':'assistant'}">
      <div class="msg-bubble">${text}${withUndo ? `<button class="msg-undo" data-undo="${withUndo}">Desfazer</button>` : ""}</div>
    </div>`;
  },

  // ==================================================== COMMAND PARSING
  parseCommand(text){
    const lower = text.toLowerCase();
    const isQuestion = /\?|quanto|qual|quais|como|por que|porque|quando|onde|posso|devo/.test(lower.split(" ").slice(0,3).join(" ")) && !/^(gastei|paguei|comprei|recebi|ganhei)/.test(lower.trim());
    if(isQuestion) return null;

    const DESPESA_VERBS = ["gastei","paguei","comprei","desembolsei","saiu","torrei"];
    const RECEITA_VERBS = ["recebi","ganhei","entrou","caiu","faturei"];
    let type = null;
    if(DESPESA_VERBS.some(v=>lower.includes(v))) type = "Despesa";
    else if(RECEITA_VERBS.some(v=>lower.includes(v))) type = "Receita";
    if(!type) return null;

    const value = this.extractValue(text);
    if(!value || value<=0) return null;

    const date = this.extractDate(lower);
    const S = Store.state;
    let category = "", subcategory = "", matched = false;

    if(type === "Despesa"){
      const candidates = [];
      Object.entries(S.categories.despesa).forEach(([cat,subs])=>{
        subs.forEach(sub=>{ if(lower.includes(sub.toLowerCase())) candidates.push({cat, sub, len:sub.length}); });
      });
      if(candidates.length){
        candidates.sort((a,b)=>b.len-a.len);
        category = candidates[0].cat; subcategory = candidates[0].sub; matched = true;
      } else {
        const synonyms = { "gasolina":["Transporte","Combustível"], "luz":["Moradia","Energia"], "conta de luz":["Moradia","Energia"],
          "agua":["Moradia","Água"], "água":["Moradia","Água"], "condominio":["Moradia","Condomínio"], "condomínio":["Moradia","Condomínio"],
          "roupa":["Pessoal","Roupas"], "sapato":["Pessoal","Calçados"], "tenis":["Pessoal","Calçados"], "presente":["Pessoal","Presentes"],
          "remedio":["Saúde","Farmácia"], "remédio":["Saúde","Farmácia"], "medico":["Saúde","Consultas"], "médico":["Saúde","Consultas"],
          "gym":["Saúde","Academia"], "viagem":["Lazer","Viagens"], "netflix":["Lazer","Streaming"], "spotify":["Lazer","Streaming"] };
        for(const key in synonyms){ if(lower.includes(key)){ [category,subcategory] = synonyms[key]; matched = true; break; } }
        if(!matched){
          const catHit = Object.keys(S.categories.despesa).find(c=>lower.includes(c.toLowerCase()));
          if(catHit){ category = catHit; matched = true; }
        }
      }
    } else {
      const catHit = S.categories.receita.find(c=>lower.includes(c.toLowerCase()));
      if(catHit){ category = catHit; matched = true; }
      else if(lower.includes("salário") || lower.includes("salario")){ category = S.categories.receita.includes("Salário") ? "Salário" : S.categories.receita[0]; matched = true; }
    }

    let description = text
      .replace(/r\$\s*[\d.,]+/ig,"")
      .replace(/\b\d+(?:[.,]\d{1,2})?\b/g,"")
      .replace(new RegExp(DESPESA_VERBS.concat(RECEITA_VERBS).join("|"),"ig"),"")
      .replace(/\b(hoje|ontem|reais|de|em|no|na|com|do|da)\b/ig," ")
      .replace(/\s+/g," ").trim();
    if(!description) description = category || (type==="Despesa" ? "Despesa" : "Receita");
    description = description.charAt(0).toUpperCase() + description.slice(1);

    const paymentMethod = /cart[aã]o|cr[eé]dito/.test(lower) ? "Crédito" : "Débito";
    const payload = {
      type, description, value, date, dueDate: date,
      category: category || (type==="Despesa" ? "Pessoal" : (S.categories.receita[0]||"Outros")),
      // uma compra no crédito não fica presa a uma conta — o dinheiro só sai
      // dela quando a fatura é paga (em Cartões), não no momento da compra.
      subcategory, accountId: paymentMethod==="Crédito" ? null : ((S.accounts[0]||{}).id || null),
      paymentMethod,
      // compra no crédito só "some" do limite do cartão quando a fatura é paga —
      // então nasce Pendente; qualquer outra forma de pagamento nasce Paga.
      cardId: null, status: paymentMethod==="Crédito" ? "Pendente" : "Pago",
      fixed:false, notes:"", installments:1, installmentNum:1, groupId:null,
    };
    if(payload.paymentMethod === "Crédito"){
      const cardHit = S.cards.find(c=>lower.includes(c.name.toLowerCase()));
      if(cardHit) payload.cardId = cardHit.id;
    }

    return { confidence: matched ? "high" : "low", payload };
  },

  extractValue(text){
    let m = text.match(/r\$\s*([\d]{1,3}(?:\.\d{3})*(?:,\d{1,2})?|\d+(?:,\d{1,2})?)/i);
    if(!m) m = text.match(/(\d+(?:[.,]\d{1,2})?)\s*(?:reais|conto)\b/i);
    if(!m) m = text.match(/\b(\d+(?:[.,]\d{1,2})?)\b/);
    if(!m) return null;
    let raw = m[1];
    if(/,\d{1,2}$/.test(raw)) raw = raw.replace(/\./g,"").replace(",",".");
    else raw = raw.replace(/,/g,"");
    return parseFloat(raw);
  },

  extractDate(lower){
    if(lower.includes("hoje")) return todayStr();
    if(lower.includes("ontem")) return addDays(todayStr(), -1);
    const m = lower.match(/\b(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\b/);
    if(m){
      const day = m[1].padStart(2,"0"), month = m[2].padStart(2,"0");
      let year = m[3] || new Date().getFullYear();
      if(String(year).length===2) year = "20"+year;
      return `${year}-${month}-${day}`;
    }
    return todayStr();
  },

  // ============================================== RULE-BASED FALLBACK
  // Works with zero configuration. Instead of one-line lookups, this now
  // gives actual guidance: it reads the person's real numbers, finds what's
  // off, and says what to do about it.
  ruleBasedReply(text){
    const lower = text.toLowerCase();
    const ym = Store.state.settings.selectedYm;
    const mesNome = MESES_PT[Number(ym.split("-")[1])-1];
    const t = Store.totalsForMonth(ym);
    const prevYm = addMonths(ym+"-01",-1).slice(0,7);
    const prevT = Store.totalsForMonth(prevYm);
    const cats = Store.categoryBreakdown(ym,"Despesa").filter(c=>c.valor>0);
    const budgets = Store.budgetStatus(ym).filter(b=>b.orcamento>0);
    const debts = Store.debtsSummary();
    const inv = Store.investmentsSummary();
    const goals = Store.goalsList();
    const health = Store.healthScore(ym);
    const taxaPoupanca = t.receita>0 ? t.saldo/t.receita : 0;

    // ---------- "como estou?" / diagnóstico geral ----------
    if(/como (estou|est[aã]o|vai|anda)|diagn[oó]stico|an[aá]lise|resumo|situa[cç][aã]o|me ajuda|por onde come[cç]o/.test(lower)){
      return this.fullDiagnosis(ym);
    }

    // ---------- saldo / quanto posso gastar ----------
    if(/sald|dispon[ií]vel|quanto (tenho|sobrou|posso gastar)/.test(lower)){
      const hoje = new Date();
      const diasNoMes = new Date(Number(ym.split("-")[0]), Number(ym.split("-")[1]), 0).getDate();
      const diaAtual = ymKey(todayStr())===ym ? hoje.getDate() : diasNoMes;
      const diasRestantes = Math.max(1, diasNoMes - diaAtual);
      let r = `Em ${mesNome} seu saldo está em **${money(t.saldo)}** — você comprometeu ${pct(t.pctRenda)} da renda.`;
      if(t.saldo > 0 && ymKey(todayStr())===ym){
        r += `\n\nFaltam ${diasRestantes} dias para fechar o mês, então dá para gastar cerca de **${money(t.saldo/diasRestantes)} por dia** sem entrar no vermelho.`;
      }
      if(t.pendentes > 0){
        r += `\n\n⚠️ Atenção: ainda há ${money(t.pendentes)} em contas pendentes que vão sair desse saldo.`;
      }
      if(t.saldo < 0){
        r += `\n\nComo o saldo está negativo, o caminho mais rápido costuma ser olhar as categorias variáveis (as que dá para cortar no curto prazo): ${cats.filter(c=>["Alimentação","Lazer","Pessoal"].includes(c.categoria)).map(c=>`${c.categoria} (${money(c.valor)})`).join(", ") || "nenhuma registrada"}.`;
      }
      return r;
    }

    // ---------- onde estou gastando / cortar gastos ----------
    if(/gast(ei|os|o total|ando)|onde.*(dinheiro|gast)|cortar|economizar|reduzir|diminuir/.test(lower)){
      if(!cats.length) return `Ainda não há despesas registradas em ${mesNome}. Me conte um gasto (ex: "gastei 50 no mercado") que eu registro.`;
      let r = `Em ${mesNome} você gastou **${money(t.despesa)}**. Seus três maiores gastos:\n\n`;
      cats.slice(0,3).forEach((c,i)=>{
        r += `${i+1}. **${c.categoria}** — ${money(c.valor)} (${pct(t.receita>0?c.valor/t.receita:0)} da renda)\n`;
      });
      // where the money actually leaked vs last month
      const subiu = cats.map(c=>{
        const ant = (Store.categoryBreakdown(prevYm,"Despesa").find(x=>x.categoria===c.categoria)||{valor:0}).valor;
        return ant>0 ? {cat:c.categoria, delta:(c.valor-ant)/ant, diff:c.valor-ant} : null;
      }).filter(x=>x && x.delta>0.15).sort((a,b)=>b.diff-a.diff);
      if(subiu.length){
        r += `\n📈 Subiu em relação a ${MESES_PT[Number(prevYm.split("-")[1])-1]}: ${subiu.slice(0,2).map(s=>`${s.cat} (+${pct(s.delta)}, ${money(s.diff)} a mais)`).join(" e ")}. É aí que costuma estar o ganho mais fácil.`;
      }
      const estourados = budgets.filter(b=>b.pctUsed>1);
      if(estourados.length) r += `\n\n🔴 Fora do orçamento: ${estourados.map(b=>`${b.categoria} (${money(b.gasto-b.orcamento)} acima)`).join(", ")}.`;
      r += `\n\nUma forma prática de cortar: escolha **uma** categoria variável dessa lista e defina um teto em Orçamentos. Cortar 20% de um gasto grande rende mais que cortar 50% de vários pequenos.`;
      return r;
    }

    // ---------- orçamento ----------
    if(/or[cç]amento|limite|teto/.test(lower)){
      if(!budgets.length) return `Você ainda não definiu orçamentos. Sugestão para começar com base no seu mês: ${cats.slice(0,3).map(c=>`${c.categoria} ~${money(Math.ceil(c.valor*0.9/50)*50)}`).join(", ")} — um teto 10% abaixo do gasto atual costuma ser realista sem ser sofrido. Configure em Orçamentos.`;
      const ordenado = [...budgets].sort((a,b)=>b.pctUsed-a.pctUsed);
      let r = `Como estão seus orçamentos em ${mesNome}:\n\n`;
      ordenado.slice(0,5).forEach(b=>{
        const icone = b.pctUsed>1 ? "🔴" : b.pctUsed>=0.7 ? "🟡" : "🟢";
        r += `${icone} **${b.categoria}** — ${money(b.gasto)} de ${money(b.orcamento)} (${pct(b.pctUsed)})\n`;
      });
      const pior = ordenado[0];
      if(pior.pctUsed>1) r += `\nVocê passou ${money(pior.gasto-pior.orcamento)} do orçamento de ${pior.categoria}. Vale checar se o teto está irreal ou se foi um gasto pontual — orçamento que estoura todo mês só gera culpa, não controle.`;
      else if(pior.pctUsed>=0.7) r += `\n${pior.categoria} está em ${pct(pior.pctUsed)} — dá para segurar o resto do mês.`;
      else r += `\nTudo dentro do previsto. 👏`;
      return r;
    }

    // ---------- dívidas ----------
    if(/d[ií]vida|empr[eé]stimo|financiamento|parcelad|dever|devo/.test(lower)){
      if(!debts.rows.length) return "Você não tem dívidas cadastradas. 🎉 Se tiver alguma fora do app, vale cadastrar em Dívidas para acompanhar a quitação.";
      let r = `Você tem **${money(debts.totalRestante)}** em dívidas a pagar (${pct(debts.pctQuitado)} já quitado do total original de ${money(debts.totalOriginal)}).\n\n`;
      const porJuros = [...debts.rows].sort((a,b)=>(b.interest||0)-(a.interest||0));
      porJuros.slice(0,3).forEach(d=>{
        r += `• **${d.creditor}** — ${money(d.valorAtual)} restantes, ${d.restanteParcelas} parcelas de ${money(d.installmentValue)}${d.interest?` (${pct(d.interest,1)} a.m.)`:""}\n`;
      });
      const cara = porJuros[0];
      if(cara && cara.interest>0){
        r += `\n💡 Se sobrar dinheiro para adiantar parcelas, priorize **${cara.creditor}** — é a de juros mais altos, então cada real adiantado ali economiza mais do que em qualquer outra.`;
      }
      const comprometido = debts.rows.reduce((a,d)=>a+Number(d.installmentValue||0),0);
      if(t.receita>0){
        const pctDiv = comprometido/t.receita;
        r += `\n\nSuas parcelas somam ${money(comprometido)}/mês = ${pct(pctDiv)} da sua renda.`;
        if(pctDiv>0.3) r += ` Isso está acima do patamar que costuma ser considerado saudável (~30%) — vale avaliar renegociação antes de assumir qualquer nova dívida.`;
        else r += ` Está num patamar administrável.`;
      }
      return r;
    }

    // ---------- investimentos ----------
    if(/investi|patrim[oô]nio|rend|aplicar|onde colocar|tesouro|cdb|a[cç][oõ]es|renda fixa/.test(lower)){
      let r = "";
      if(inv.totalAtual>0){
        r += `Seus investimentos somam **${money(inv.totalAtual)}**, com ${money(inv.totalRendimentos)} de rendimento (${pct(inv.rentabilidade)}). Patrimônio líquido total: ${money(Store.patrimonioLiquido())}.\n\n`;
      } else {
        r += `Você ainda não tem investimentos cadastrados.\n\n`;
      }
      const reserva = goals.find(g=>/reserva|emerg/i.test(g.name));
      const gastoMedio = t.despesa || 1;
      if(reserva && reserva.pctConcluido < 1){
        r += `📌 Antes de pensar em rentabilidade, o consenso é completar a reserva de emergência: falta ${money(reserva.remaining)} para a sua. Reserva costuma ficar em algo com liquidez diária (Tesouro Selic ou CDB 100%+ do CDI com resgate imediato), não em algo que rende mais mas trava o dinheiro.\n\n`;
      } else if(!reserva){
        r += `📌 Se ainda não tem reserva de emergência, esse costuma ser o primeiro passo — a referência comum é de 3 a 6 meses de despesas, o que no seu caso daria algo entre ${money(gastoMedio*3)} e ${money(gastoMedio*6)}. Crie como meta na página Metas.\n\n`;
      }
      if(debts.totalRestante > 0){
        const juroMax = Math.max(...debts.rows.map(d=>d.interest||0));
        if(juroMax > 0.015){
          r += `⚠️ Você tem dívida com juros de ${pct(juroMax,1)} ao mês. Quitar isso costuma render mais (garantido) do que qualquer investimento conservador — é raro um investimento seguro bater juros de dívida.\n\n`;
        }
      }
      if(taxaPoupanca > 0){
        r += `Você está conseguindo guardar ${money(t.saldo)}/mês (${pct(taxaPoupanca)} da renda). Aportando isso de forma consistente, em 12 meses seriam ${money(t.saldo*12)} sem contar rendimento.`;
      }
      r += `\n\n_Isso é orientação educativa geral, não recomendação personalizada de investimento._`;
      return r;
    }

    // ---------- metas ----------
    if(/meta|objetivo|juntar|guardar|sonho|comprar/.test(lower)){
      if(!goals.length) return `Você não tem metas cadastradas. Uma boa primeira meta é a reserva de emergência (3 a 6 meses de despesa — no seu caso, ~${money((t.despesa||0)*3)}). Crie na página Metas e eu acompanho o progresso.`;
      let r = "Suas metas:\n\n";
      goals.forEach(g=>{
        const barra = "█".repeat(Math.round(g.pctConcluido*10)) + "░".repeat(10-Math.round(g.pctConcluido*10));
        r += `**${g.name}** ${barra} ${pct(g.pctConcluido)}\nFaltam ${money(g.remaining)} · precisa de ${money(g.mensalNecessario)}/mês\n\n`;
      });
      const total = goals.reduce((a,g)=>a+g.mensalNecessario,0);
      if(t.saldo>0 && total>t.saldo){
        r += `⚠️ Somadas, suas metas pedem ${money(total)}/mês, mas você está sobrando ${money(t.saldo)}/mês. Ou estica o prazo de alguma, ou prioriza uma de cada vez — tentar tudo junto costuma acabar em nenhuma.`;
      } else if(t.saldo>0){
        r += `✅ Você sobra ${money(t.saldo)}/mês e suas metas pedem ${money(total)}/mês — está no ritmo.`;
      }
      return r;
    }

    // ---------- saúde financeira ----------
    if(/sa[uú]de financeira|score|nota|pontua/.test(lower)){
      const fraco = [...health.factors].sort((a,b)=>a.value-b.value)[0];
      const forte = [...health.factors].sort((a,b)=>b.value-a.value)[0];
      const acoes = {
        "Controle de gastos":"reduzir o percentual da renda comprometido — hoje em "+pct(t.pctRenda)+". Comece pela maior categoria variável.",
        "Reserva":"construir/completar a reserva de emergência. Mesmo valores pequenos e constantes mudam esse indicador.",
        "Dívidas":"reduzir o saldo devedor, priorizando a dívida de juros mais altos.",
        "Investimentos":"começar a aportar com regularidade, ainda que pouco — consistência pesa mais que valor aqui.",
        "Orçamento":"definir (ou ajustar) tetos por categoria em Orçamentos e respeitá-los.",
      };
      return `Sua saúde financeira está em **${health.score}/100 — ${health.label}**.\n\n${health.factors.map(f=>`${f.value>=70?"🟢":f.value>=40?"🟡":"🔴"} ${f.label}: ${f.value}%`).join("\n")}\n\n💪 Ponto forte: ${forte.label}.\n🎯 Onde focar agora: **${fraco.label}** — ${acoes[fraco.label]||"melhorar esse indicador."}`;
    }

    // ---------- cartões ----------
    if(/cart[aã]o|fatura|limite do cart/.test(lower)){
      const S = Store.state;
      if(!S.cards.length) return "Você não tem cartões cadastrados. Cadastre em Cartões para acompanhar fatura e limite.";
      let r = "Seus cartões:\n\n";
      S.cards.forEach(c=>{
        const u = Store.cardUtilization(c.id, ym);
        const usoPct = u.limite>0 ? u.utilizado/u.limite : 0;
        r += `${usoPct>0.9?"🔴":usoPct>=0.7?"🟡":"🟢"} **${c.name}** — fatura ${money(u.faturaAtual)} · ${pct(usoPct)} do limite usado · vence dia ${c.dueDay}\n`;
      });
      const parcelas = Store.installmentPurchases();
      if(parcelas.length){
        const totalRest = parcelas.reduce((a,p)=>a+p.restante,0);
        r += `\n📆 Você tem ${parcelas.length} compra(s) parcelada(s), com ${money(totalRest)} ainda por vir nas próximas faturas. Isso já está considerado na Previsão.`;
      }
      return r;
    }

    // ---------- previsão / futuro ----------
    if(/previs[aã]o|pr[oó]xim|futuro|vai sobrar|fechar o m[eê]s/.test(lower)){
      const f = Store.forecast(3);
      let r = "Projeção dos próximos meses:\n\n";
      f.forEach(m=>{
        r += `${m.saldo>=0?"🟢":"🔴"} **${m.label}** — entra ${money(m.receita)}, sai ${money(m.despesa)} → saldo ${money(m.saldo)}\n`;
      });
      const apertado = f.find(m=>m.saldo<0);
      if(apertado) r += `\n⚠️ ${apertado.label} aparece no vermelho. Dá tempo de se preparar: antecipar uma receita, segurar um gasto grande ou evitar novos parcelamentos que caiam nesse mês.`;
      else r += `\n✅ Nenhum mês no vermelho na projeção.`;
      return r;
    }

    // ---------- dicas gerais ----------
    if(/dica|conselho|como (investir|poupar|economizar)|orienta|sugest/.test(lower)){
      return this.fullDiagnosis(ym);
    }

    // ---------- fallback ----------
    return `Posso te ajudar com:\n\n• **Registrar gastos** — é só dizer: "gastei 60 no mercado"\n• **📎 Importar extrato em PDF** — clique no clipe ao lado da caixa de texto\n• **"como estou?"** — diagnóstico completo das suas finanças\n• **"onde estou gastando?"** — seus maiores gastos e onde cortar\n• **"quanto posso gastar?"** — saldo e limite diário\n• **"e minhas dívidas?"** — qual priorizar\n• **"como estão minhas metas?"** • **"previsão"** • **"cartões"** • **"saúde financeira"**\n\nPara conversar de forma totalmente livre, dá para ligar a IA completa em Configurações → Assistente com IA.`;
  },

  // Full proactive read of the person's situation, with prioritised advice.
  fullDiagnosis(ym){
    const mesNome = MESES_PT[Number(ym.split("-")[1])-1];
    const t = Store.totalsForMonth(ym);
    const health = Store.healthScore(ym);
    const cats = Store.categoryBreakdown(ym,"Despesa").filter(c=>c.valor>0);
    const budgets = Store.budgetStatus(ym).filter(b=>b.orcamento>0);
    const debts = Store.debtsSummary();
    const inv = Store.investmentsSummary();
    const goals = Store.goalsList();
    const taxaPoupanca = t.receita>0 ? t.saldo/t.receita : 0;

    if(t.receita===0 && t.despesa===0){
      return `Ainda não há lançamentos em ${mesNome}, então não consigo analisar de verdade.\n\nComece me contando seus gastos conforme acontecem — ex: "gastei 50 no mercado", "recebi 3000 de salário". Assim que tiver alguns lançamentos, me pergunte "como estou?" que eu faço a análise completa.`;
    }

    let r = `**Seu retrato em ${mesNome}**\n\n`;
    r += `Entrou ${money(t.receita)}, saiu ${money(t.despesa)} → ${t.saldo>=0?`sobrou **${money(t.saldo)}**`:`faltou **${money(-t.saldo)}**`}.\n`;
    r += `Saúde financeira: **${health.score}/100 (${health.label})**.\n\n`;

    // build prioritised, situation-aware advice
    const acoes = [];
    if(t.saldo < 0){
      acoes.push(`🔴 **Você gastou mais do que ganhou este mês.** Essa é a prioridade zero — antes de metas ou investimentos. Comece cortando na maior categoria variável: ${cats.filter(c=>["Alimentação","Lazer","Pessoal","Transporte"].includes(c.categoria)).slice(0,1).map(c=>`${c.categoria} (${money(c.valor)})`)[0] || "revise os gastos do mês"}.`);
    }
    const jurosAltos = debts.rows.filter(d=>(d.interest||0) > 0.015);
    if(jurosAltos.length){
      acoes.push(`🔴 **Dívida cara ativa:** ${jurosAltos[0].creditor} a ${pct(jurosAltos[0].interest,1)} ao mês. Quitar isso rende mais, garantido, que praticamente qualquer investimento conservador.`);
    }
    const reserva = goals.find(g=>/reserva|emerg/i.test(g.name));
    if(!reserva){
      acoes.push(`🟡 **Sem reserva de emergência cadastrada.** É o que evita que um imprevisto vire dívida. Referência: 3 a 6 meses de despesa → ~${money(t.despesa*3)} a ${money(t.despesa*6)}. Crie em Metas.`);
    } else if(reserva.pctConcluido < 0.5){
      acoes.push(`🟡 **Reserva de emergência em ${pct(reserva.pctConcluido)}.** Faltam ${money(reserva.remaining)}. Guardar ${money(reserva.mensalNecessario)}/mês fecha no prazo que você definiu.`);
    }
    const estourados = budgets.filter(b=>b.pctUsed>1);
    if(estourados.length){
      acoes.push(`🟡 **Orçamento estourado em ${estourados.map(b=>b.categoria).join(", ")}** (${money(estourados.reduce((a,b)=>a+(b.gasto-b.orcamento),0))} acima no total). Vale checar se o teto é realista ou se foi gasto pontual.`);
    }
    if(!budgets.length && cats.length){
      acoes.push(`🟡 **Nenhum orçamento definido.** Sem teto, fica difícil perceber o excesso antes do fim do mês. Comece por ${cats[0].categoria}, sua maior despesa (${money(cats[0].valor)}).`);
    }
    if(t.saldo > 0 && taxaPoupanca < 0.1){
      acoes.push(`🟡 **Você guarda ${pct(taxaPoupanca)} da renda.** É positivo, mas abaixo dos 10–20% que costumam ser a referência. Aumentar em 5 pontos já daria ${money(t.receita*0.05)}/mês a mais.`);
    }
    if(t.saldo > 0 && taxaPoupanca >= 0.2 && inv.totalAtual === 0){
      acoes.push(`🟢 **Você sobra ${pct(taxaPoupanca)} da renda mas não tem investimento cadastrado.** Dinheiro parado em conta perde para a inflação — vale ao menos algo com liquidez diária.`);
    }

    if(acoes.length){
      r += `**No que focar agora** (em ordem de prioridade):\n\n` + acoes.slice(0,3).map((a,i)=>`${i+1}. ${a}`).join("\n\n");
    } else {
      r += `✅ **Nada crítico aparece nos seus números.** Você gasta menos do que ganha, guarda ${pct(taxaPoupanca)} da renda e não há orçamento estourado. O próximo passo natural é aumentar aportes ou antecipar metas.`;
    }

    r += `\n\n_Pergunte "onde estou gastando?", "e minhas dívidas?" ou "previsão" para eu detalhar qualquer um desses pontos._`;
    return r;
  },

  // ==================================== SHARED AI (server-side proxy) ====
  // Talks to /api/assistant instead of any AI provider directly — this
  // means no API key ever touches the browser, and it works automatically
  // for every visitor as long as whoever deployed the app configured ONE
  // key server-side (see api/assistant.js). If that isn't set up yet, this
  // throws "not_configured" and send() falls back to ruleBasedReply.
  async callAI(userText){
    const S = Store.state;
    const context = Store.financialContextSummary();
    const system = `Você é o assistente financeiro do app Nortem, conversando em português do Brasil.

Como você age:
- Direto, caloroso e prático. Fala como uma pessoa que entende de finanças conversando com um amigo, não como um manual.
- Usa os números reais do usuário (abaixo) na resposta — cite valores concretos em vez de falar genérico.
- Não só informa: **orienta**. Diga o que os números significam e qual o próximo passo concreto.
- Quando houver vários problemas, priorize: dívida cara > gastar mais do que ganha > reserva de emergência > orçamento > investir mais.
- Conciso: poucos parágrafos curtos ou uma lista. Use **negrito** nos pontos-chave.
- Se faltar dado para responder bem, diga qual informação falta e como cadastrar no app.
- Sobre investimentos: dê orientação educativa geral e deixe claro que não é recomendação personalizada. Nunca indique ativo específico para comprar.
- Nunca invente números que não estão nos dados abaixo.

O app tem as páginas: Dashboard, Lançamentos, Orçamentos, Cartões, Contas, Dívidas, Investimentos, Metas, Previsão e Configurações. Você pode orientar o usuário a usá-las.
Você também consegue registrar lançamentos: se o usuário disser algo como "gastei 50 no mercado", isso é processado automaticamente antes de chegar até você.

DADOS FINANCEIROS REAIS DO USUÁRIO:
${context}`;

    const history = S.assistant.messages.slice(-12).map(m=>({ role: m.role==="assistant"?"assistant":"user", content: m.text }));

    const res = await fetch("/api/assistant", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ system, messages: history.length ? history : [{role:"user", content:userText}] }),
    });

    if(!res.ok){
      const errBody = await res.json().catch(()=>({}));
      throw new Error(errBody?.error || `HTTP ${res.status}`);
    }
    const data = await res.json();
    return data.reply || "Não recebi uma resposta de texto da IA agora.";
  },
};

document.addEventListener("DOMContentLoaded", ()=>Assistant.init());

