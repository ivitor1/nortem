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
    const hasKey = !!Store.state.assistant.apiKey;
    tag.textContent = hasKey ? "IA completa" : "modo básico";
    tag.className = "assistant-mode" + (hasKey ? " on" : "");
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
      return;
    }
    if(parsed && parsed.confidence === "low"){
      Store.addChatMessage("assistant", `Entendi que é ${parsed.payload.type==='Despesa'?'uma despesa':'uma receita'} de ${money(parsed.payload.value)}, mas não tenho certeza da categoria. Abri o formulário já preenchido — só confirmar a categoria e salvar.`);
      this.renderMessages();
      UI.openTransactionModal(null, { draft: parsed.payload });
      return;
    }

    // 2) otherwise, treat as a question / conversation
    this.busy = true;
    this.renderMessages(null, true); // show typing indicator
    let reply;
    if(Store.state.assistant.apiKey){
      try{
        reply = await this.callClaude(text);
      }catch(err){
        console.warn("Assistant API error:", err);
        reply = `Não consegui falar com a IA agora (${err.message || "erro de conexão"}). Respondendo em modo básico:\n\n` + this.ruleBasedReply(text);
      }
    } else {
      reply = this.ruleBasedReply(text);
    }
    this.busy = false;
    Store.addChatMessage("assistant", reply);
    this.renderMessages();
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
           <p><b>Oi${Store.state.profile.name?", "+escapeHtml(Store.state.profile.name):""}!</b> Pode me contar um gasto direto
           (ex: "paguei 89 de internet hoje") que eu já registro, ou perguntar algo sobre suas finanças.</p>
         </div>`;
    if(showTyping){
      box.insertAdjacentHTML("beforeend", `<div class="msg assistant typing" id="typingBubble"><span></span><span></span><span></span></div>`);
    }
    initIcons();
    box.scrollTop = box.scrollHeight;

    if(justAddedTxId){
      const undoBtn = box.querySelector(`[data-undo="${justAddedTxId}"]`);
      if(undoBtn) undoBtn.onclick = ()=>this.undoTransaction(justAddedTxId);
    }
  },

  bubble(m, withUndo){
    const isUser = m.role === "user";
    const text = escapeHtml(m.text).replace(/\*\*(.+?)\*\*/g,"<b>$1</b>").replace(/\n/g,"<br>");
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

    const payload = {
      type, description, value, date, dueDate: date,
      category: category || (type==="Despesa" ? "Pessoal" : (S.categories.receita[0]||"Outros")),
      subcategory, accountId: (S.accounts[0]||{}).id || null,
      paymentMethod: /cart[aã]o|cr[eé]dito/.test(lower) ? "Crédito" : "Débito",
      cardId: null, status: "Pago", fixed:false, notes:"", installments:1, installmentNum:1, groupId:null,
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
  ruleBasedReply(text){
    const lower = text.toLowerCase();
    const ym = Store.state.settings.selectedYm;
    const t = Store.totalsForMonth(ym);

    if(/sald|dispon[ií]vel|quanto (tenho|sobrou|posso gastar)/.test(lower)){
      return `Seu saldo em ${MESES_PT[Number(ym.split("-")[1])-1]} é de ${money(t.saldo)} (${pct(t.pctRenda)} da renda já comprometida).`;
    }
    if(/gast(ei|os|o total)/.test(lower)){
      const cats = Store.categoryBreakdown(ym,"Despesa").filter(c=>c.valor>0);
      const top = cats[0];
      return `Você gastou ${money(t.despesa)} este mês.${top?` A maior categoria foi ${top.categoria}, com ${money(top.valor)}.`:""}`;
    }
    if(/or[cç]amento/.test(lower)){
      const bs = Store.budgetStatus(ym).filter(b=>b.orcamento>0).sort((a,b)=>b.pctUsed-a.pctUsed);
      if(!bs.length) return "Você ainda não definiu orçamentos por categoria — dá pra configurar em Orçamentos.";
      const worst = bs[0];
      return `A categoria mais próxima do limite é ${worst.categoria}: ${pct(worst.pctUsed)} do orçamento de ${money(worst.orcamento)} já usado.`;
    }
    if(/d[ií]vida/.test(lower)){
      const d = Store.debtsSummary();
      if(!d.rows.length) return "Você não tem dívidas cadastradas. 🎉";
      return `Suas dívidas somam ${money(d.totalRestante)} restantes, de um total original de ${money(d.totalOriginal)} (${pct(d.pctQuitado)} já quitado).`;
    }
    if(/investi|patrim[oô]nio|rend/.test(lower)){
      const inv = Store.investmentsSummary();
      return `Seus investimentos valem hoje ${money(inv.totalAtual)}, com ${money(inv.totalRendimentos)} de rendimento acumulado (${pct(inv.rentabilidade)}). Seu patrimônio líquido total é ${money(Store.patrimonioLiquido())}.`;
    }
    if(/meta/.test(lower)){
      const goals = Store.goalsList();
      if(!goals.length) return "Você ainda não tem metas cadastradas — crie uma na página Metas.";
      return goals.map(g=>`${g.name}: ${pct(g.pctConcluido)} (faltam ${money(g.remaining)})`).join(" · ");
    }
    if(/sa[uú]de financeira|score/.test(lower)){
      const h = Store.healthScore(ym);
      return `Sua saúde financeira está em ${h.score}/100 (${h.label}). Ponto mais fraco: ${[...h.factors].sort((a,b)=>a.value-b.value)[0].label}.`;
    }
    if(/dica|conselho|como (investir|poupar|economizar)/.test(lower)){
      const tips = [
        "Uma prática comum é manter uma reserva de emergência equivalente a 3–6 meses de despesas, em algo líquido como Tesouro Selic ou CDB com liquidez diária.",
        "Revisar assinaturas recorrentes (streaming, apps) a cada poucos meses costuma liberar uma graninha sem sacrifício.",
        "A regra 50/30/20 (configurável em Configurações) é um bom ponto de partida para organizar necessidades, desejos e investimentos.",
        "Pagar dívidas com juros altos (cartão, cheque especial) antes de investir costuma valer mais a pena do que buscar rentabilidade.",
      ];
      return tips[Math.floor(Math.random()*tips.length)] + "\n\n(Isso é uma dica geral, não uma recomendação de investimento personalizada.)";
    }
    return `Posso registrar gastos direto (ex: "gastei 60 no mercado") ou responder sobre saldo, orçamento, dívidas, investimentos, metas e saúde financeira. Para respostas mais livres e personalizadas, adicione sua chave de API em Configurações → Assistente com IA.`;
  },

  // ==================================================== REAL CLAUDE API
  async callClaude(userText){
    const S = Store.state;
    const context = Store.financialContextSummary();
    const system = `Você é o assistente financeiro do app Nortem, conversando em português do Brasil de forma direta, calorosa e prática.
Use os dados reais abaixo quando forem relevantes para a resposta. Se a pergunta for sobre investimentos específicos,
dê informação educativa geral e deixe claro que não é uma recomendação personalizada. Seja conciso (poucos parágrafos ou uma lista curta).

DADOS FINANCEIROS DO USUÁRIO:
${context}`;

    const history = S.assistant.messages.slice(-12).map(m=>({ role: m.role==="assistant"?"assistant":"user", content: m.text }));

    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": S.assistant.apiKey,
        "anthropic-version": "2023-06-01",
        "anthropic-dangerous-direct-browser-access": "true",
      },
      body: JSON.stringify({
        model: S.assistant.model || "claude-haiku-4-5-20251001",
        max_tokens: 700,
        system,
        messages: history.length ? history : [{role:"user", content:userText}],
      }),
    });

    if(!res.ok){
      const errBody = await res.json().catch(()=>({}));
      throw new Error(errBody?.error?.message || `HTTP ${res.status}`);
    }
    const data = await res.json();
    const text = (data.content||[]).filter(b=>b.type==="text").map(b=>b.text).join("\n").trim();
    return text || "Não recebi uma resposta de texto da IA agora.";
  },
};

document.addEventListener("DOMContentLoaded", ()=>Assistant.init());
