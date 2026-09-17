/* =====================================================================
   STORE — single source of truth. Persists to localStorage. All pages
   read through selectors here so everything reacts to the same data.
   ===================================================================== */

const STORAGE_KEY = "nortem_finance_v1";

const Store = {
  state: null,
  listeners: [],
  cloud: { enabled:false, client:null, userId:null, userEmail:null, saveTimer:null },

  // ------------------------------------------------------------- cloud setup
  initCloudClient(){
    if(window.SUPABASE_URL && window.SUPABASE_ANON_KEY && window.supabase){
      this.cloud.enabled = true;
      this.cloud.client = window.supabase.createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY);
    }
  },

  async loadFromCloud(){
    const { data, error } = await this.cloud.client
      .from("app_state").select("data").eq("user_id", this.cloud.userId).maybeSingle();
    if(error) throw error;
    if(data && data.data){
      this.state = this.normalize(data.data);
    } else {
      this.state = this.seed(); // first login for this account: start from the demo data
      await this.saveToCloud();
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(this.state));
  },

  async saveToCloud(){
    if(!this.cloud.enabled || !this.cloud.userId) return;
    try{
      const { error } = await this.cloud.client.from("app_state").upsert({
        user_id: this.cloud.userId, data: this.state, updated_at: new Date().toISOString(),
      });
      if(error) console.error("Falha ao salvar na nuvem:", error);
    }catch(err){ console.error("Falha ao salvar na nuvem:", err); }
  },

  // ---------------------------------------------------------------- init
  // Local-mode only (no Supabase configured). Cloud mode is bootstrapped
  // by Auth.boot() -> onLoggedIn() -> loadFromCloud() instead.
  init(){
    const raw = localStorage.getItem(STORAGE_KEY);
    if(raw){
      try{ this.state = this.normalize(JSON.parse(raw)); return; }
      catch(e){ console.warn("Falha ao ler dados salvos, recriando seed.", e); }
    }
    this.state = this.seed();
    this.persist();
  },

  // Fills in any missing top-level keys so imported/older backups never crash the app.
  normalize(data){
    const blank = {
      profile:{name:"Você"},
      settings:{theme:"light", ruleNecessidades:0.5, ruleDesejos:0.3, ruleInvestimentos:0.2, demo:false, selectedYm: ymKey(todayStr())},
      accounts:[], cards:[], categoryGroups:this.defaultCategoryGroups(), budgets:this.defaultBudgets(),
      categories:this.defaultCategories(),
      transactions:[], debts:[], investments:[], goals:[],
      assistant:{apiKey:"", model:"claude-haiku-4-5-20251001", messages:[]},
    };
    return {
      profile: {...blank.profile, ...(data.profile||{})},
      settings: {...blank.settings, ...(data.settings||{})},
      accounts: data.accounts || [],
      cards: data.cards || [],
      categoryGroups: {...blank.categoryGroups, ...(data.categoryGroups||{})},
      budgets: {...blank.budgets, ...(data.budgets||{})},
      categories: {
        despesa: {...blank.categories.despesa, ...((data.categories||{}).despesa||{})},
        receita: (data.categories && data.categories.receita) || blank.categories.receita,
      },
      transactions: data.transactions || [],
      debts: data.debts || [],
      investments: data.investments || [],
      goals: data.goals || [],
      assistant: {...blank.assistant, ...(data.assistant||{}), messages: (data.assistant && data.assistant.messages) || []},
    };
  },

  persist(){
    localStorage.setItem(STORAGE_KEY, JSON.stringify(this.state));
    this.emit();
    if(this.cloud.enabled && this.cloud.userId){
      clearTimeout(this.cloud.saveTimer);
      this.cloud.saveTimer = setTimeout(()=>this.saveToCloud(), 500);
    }
  },

  on(fn){ this.listeners.push(fn); },
  emit(){ this.listeners.forEach(fn => fn()); },

  // ------------------------------------------------------------ defaults
  defaultCategoryGroups(){
    return {
      "Moradia":"Necessidades","Alimentação":"Necessidades","Transporte":"Necessidades","Saúde":"Necessidades",
      "Lazer":"Desejos","Pessoal":"Desejos","Educação":"Investimentos","Financeiro":"Investimentos"
    };
  },
  defaultBudgets(){
    return {"Moradia":1500,"Alimentação":800,"Transporte":400,"Saúde":250,"Lazer":300,"Educação":200,"Financeiro":150,"Pessoal":250};
  },
  defaultCategories(){
    // Deep copy so callers never mutate the shared defaults by accident.
    const despesa = {};
    Object.entries(DEFAULT_DESPESA_CATS).forEach(([k,v])=>{ despesa[k] = [...v]; });
    return { despesa, receita: [...DEFAULT_RECEITA_CATS] };
  },

  // ------------------------------------------------------------ seed data
  seed(){
    const acc = { corrente: uid("acc"), poupanca: uid("acc"), carteira: uid("acc") };
    const card = { nubank: uid("card"), inter: uid("card") };
    const accounts = [
      {id:acc.corrente, name:"Conta Corrente", bank:"Banco X", type:"Conta corrente", initialBalance:1000},
      {id:acc.poupanca, name:"Poupança", bank:"Banco Y", type:"Poupança", initialBalance:500},
      {id:acc.carteira, name:"Carteira", bank:"—", type:"Carteira/dinheiro", initialBalance:50},
    ];
    const cards = [
      {id:card.nubank, name:"Nubank", bank:"Nu Pagamentos", limit:3000, closingDay:5, dueDay:12, flag:"Mastercard"},
      {id:card.inter, name:"Inter", bank:"Banco Inter", limit:2000, closingDay:20, dueDay:27, flag:"Visa"},
    ];

    const tx = [];
    const push = (date,type,desc,cat,sub,accountId,paymentMethod,cardId,status,fixed,value,extra={}) => {
      tx.push({ id: uid("tx"), date, type, description:desc, category:cat, subcategory:sub,
        accountId: accountId||null, paymentMethod, cardId: cardId||null, status, fixed,
        value, installments:1, installmentNum:1, groupId:null, dueDate: extra.dueDate||date,
        notes: extra.notes||"" });
    };

    // three months of realistic history: Julho, Agosto, Setembro/2026
    const months = [
      {y:2026,m:7}, {y:2026,m:8}, {y:2026,m:9}
    ];
    months.forEach(({y,m}, idx) => {
      const mm = String(m).padStart(2,"0");
      const d = (day)=>`${y}-${mm}-${String(day).padStart(2,"0")}`;
      const salario = 4500 + idx*50;
      push(d(1),"Receita","Salário","Salário","Salário",acc.corrente,"Transferência",null,"Pago",true,salario);
      push(d(3),"Despesa","Aluguel","Moradia","Aluguel",acc.corrente,"Boleto",null,"Pago",true,1200);
      push(d(4),"Despesa","Energia elétrica","Moradia","Energia",acc.corrente,"Débito",null,"Pago",true,175+idx*5);
      push(d(5),"Despesa","Internet","Moradia","Internet",acc.corrente,"Débito",null,"Pago",true,99.9);
      push(d(6),"Despesa","Compras do mês","Alimentação","Mercado",acc.corrente,"Débito",null,"Pago",false,560+idx*30);
      push(d(8),"Despesa","Ifood","Alimentação","Delivery",acc.corrente,"Crédito",card.nubank,"Pago",false,65+idx*8);
      push(d(9),"Despesa","Gasolina","Transporte","Combustível",acc.corrente,"Crédito",card.nubank,"Pago",false,230);
      push(d(12),"Despesa","Academia","Saúde","Academia",acc.corrente,"Débito",null,"Pago",true,99.9);
      push(d(13),"Despesa","Cinema","Lazer","Cinema",acc.carteira,"Dinheiro",null,"Pago",false,60);
      push(d(15),"Receita","Freelance design","Renda extra","Freelance",acc.corrente,"PIX",null,"Pago",false,idx===2?600:350);
      push(d(18),"Despesa","Roupas","Pessoal","Roupas",acc.corrente,"Crédito",card.inter,"Pago",false,150);
      if(idx===2){
        push(d(15),"Despesa","Farmácia","Saúde","Farmácia",acc.corrente,"Débito",null,"Pago",false,45);
        push(d(20),"Despesa","Anuidade cartão","Financeiro","Anuidade",acc.corrente,"Débito",card.nubank,"Pendente",true,35, {dueDate:d(25)});
        push(d(22),"Despesa","Curso de Python","Educação","Cursos",acc.corrente,"PIX",null,"Pago",false,150);
      }
    });

    // Parcelamento de exemplo: notebook 12x, comprado em setembro/2026
    const groupId = uid("grp");
    const parcelValue = 100;
    for(let i=0;i<12;i++){
      const dt = addMonths("2026-09-10", i);
      tx.push({
        id: uid("tx"), date: "2026-09-10", type:"Despesa", description:"Notebook novo (12x)",
        category:"Financeiro", subcategory:"Investimentos", accountId:null, paymentMethod:"Crédito",
        cardId: card.nubank, status: i===0 ? "Pago" : "Pendente", fixed:false,
        value: parcelValue, installments:12, installmentNum:i+1, groupId, dueDate: dt, notes:"Compra parcelada"
      });
    }

    const debts = [
      {id:uid("debt"), creditor:"Banco Y — Empréstimo pessoal", type:"Empréstimo", originalValue:6000,
        installmentsTotal:24, installmentsPaid:8, installmentValue:280, interest:0.019, dueDate:"2026-10-05"}
    ];

    const investments = [
      {id:uid("inv"), date:"2026-09-15", institution:"Banco X", name:"CDB 110% CDI", type:"CDB",
        invested:2000, contributions:200, withdrawals:0, currentValue:2350},
      {id:uid("inv"), date:"2026-09-10", institution:"XP", name:"Tesouro Selic 2029", type:"Tesouro Direto",
        invested:1500, contributions:0, withdrawals:0, currentValue:1580},
    ];

    const goals = [
      {id:uid("goal"), icon:"🛟", name:"Reserva de emergência", target:9000, current:3600, deadlineMonths:12, createdAt:"2026-06-01"},
      {id:uid("goal"), icon:"✈️", name:"Viagem de férias", target:4000, current:800, deadlineMonths:8, createdAt:"2026-07-01"},
    ];

    return {
      profile: { name: "Vitor" },
      settings: { theme:"light", ruleNecessidades:0.5, ruleDesejos:0.3, ruleInvestimentos:0.2, demo:true, selectedYm: "2026-09" },
      accounts, cards,
      categoryGroups: this.defaultCategoryGroups(),
      budgets: this.defaultBudgets(),
      categories: this.defaultCategories(),
      transactions: tx,
      debts, investments, goals,
      assistant: { apiKey:"", model:"claude-haiku-4-5-20251001", messages: [] },
    };
  },

  resetToBlank(){
    this.state = {
      profile: { name: this.state.profile.name || "Você" },
      settings: { theme: this.state.settings.theme, ruleNecessidades:0.5, ruleDesejos:0.3, ruleInvestimentos:0.2, demo:false, selectedYm: ymKey(todayStr()) },
      accounts: [], cards: [],
      categoryGroups: this.defaultCategoryGroups(),
      budgets: this.defaultBudgets(),
      categories: this.defaultCategories(),
      transactions: [], debts: [], investments: [], goals: [],
      assistant: { apiKey: this.state.assistant?.apiKey || "", model: this.state.assistant?.model || "claude-haiku-4-5-20251001", messages: [] },
    };
    this.persist();
  },

  replaceAll(data){ this.state = this.normalize(data); this.persist(); },

  // ---------------------------------------------------------------- CRUD
  addTransaction(t){
    if(t.installments > 1 && !t.groupId){
      const groupId = uid("grp");
      const baseValue = t.value;
      const rows = [];
      for(let i=0;i<t.installments;i++){
        rows.push({ ...t, id: uid("tx"), groupId, installmentNum: i+1,
          date: i===0 ? t.date : addMonths(t.date, i),
          dueDate: addMonths(t.dueDate || t.date, i),
          status: i===0 ? t.status : "Pendente", value: baseValue });
      }
      this.state.transactions.push(...rows);
    } else {
      this.state.transactions.push({ ...t, id: uid("tx"), groupId: t.groupId||null });
    }
    this.persist();
  },
  updateTransaction(id, patch){
    const i = this.state.transactions.findIndex(t=>t.id===id);
    if(i>-1){ this.state.transactions[i] = {...this.state.transactions[i], ...patch}; this.persist(); }
  },
  deleteTransaction(id, wholeGroup=false){
    const t = this.state.transactions.find(t=>t.id===id);
    if(!t) return;
    if(wholeGroup && t.groupId){
      this.state.transactions = this.state.transactions.filter(x=>x.groupId!==t.groupId);
    } else {
      this.state.transactions = this.state.transactions.filter(x=>x.id!==id);
    }
    this.persist();
  },
  duplicateTransaction(id){
    const t = this.state.transactions.find(t=>t.id===id);
    if(!t) return;
    this.state.transactions.push({...t, id:uid("tx"), groupId:null, installments:1, installmentNum:1, date: todayStr(), status:"Pendente"});
    this.persist();
  },

  addAccount(a){ this.state.accounts.push({...a, id:uid("acc")}); this.persist(); },
  updateAccount(id, patch){ const i=this.state.accounts.findIndex(a=>a.id===id); if(i>-1){ this.state.accounts[i]={...this.state.accounts[i],...patch}; this.persist(); } },
  deleteAccount(id){ this.state.accounts = this.state.accounts.filter(a=>a.id!==id); this.persist(); },

  addCard(c){ this.state.cards.push({...c, id:uid("card")}); this.persist(); },
  updateCard(id, patch){ const i=this.state.cards.findIndex(c=>c.id===id); if(i>-1){ this.state.cards[i]={...this.state.cards[i],...patch}; this.persist(); } },
  deleteCard(id){ this.state.cards = this.state.cards.filter(c=>c.id!==id); this.persist(); },

  addDebt(d){ this.state.debts.push({...d, id:uid("debt")}); this.persist(); },
  updateDebt(id, patch){ const i=this.state.debts.findIndex(d=>d.id===id); if(i>-1){ this.state.debts[i]={...this.state.debts[i],...patch}; this.persist(); } },
  deleteDebt(id){ this.state.debts = this.state.debts.filter(d=>d.id!==id); this.persist(); },

  addInvestment(inv){ this.state.investments.push({...inv, id:uid("inv")}); this.persist(); },
  updateInvestment(id, patch){ const i=this.state.investments.findIndex(v=>v.id===id); if(i>-1){ this.state.investments[i]={...this.state.investments[i],...patch}; this.persist(); } },
  deleteInvestment(id){ this.state.investments = this.state.investments.filter(v=>v.id!==id); this.persist(); },

  addGoal(g){ this.state.goals.push({...g, id:uid("goal"), createdAt: todayStr()}); this.persist(); },
  updateGoal(id, patch){ const i=this.state.goals.findIndex(g=>g.id===id); if(i>-1){ this.state.goals[i]={...this.state.goals[i],...patch}; this.persist(); } },
  deleteGoal(id){ this.state.goals = this.state.goals.filter(g=>g.id!==id); this.persist(); },
  contributeGoal(id, amount){ const g=this.state.goals.find(g=>g.id===id); if(g){ g.current = Math.max(0, g.current+amount); this.persist(); } },

  setBudget(cat, value){ this.state.budgets[cat] = value; this.persist(); },
  setSelectedYm(ym){ this.state.settings.selectedYm = ym; this.persist(); },
  updateSettings(patch){ this.state.settings = {...this.state.settings, ...patch}; this.persist(); },
  updateProfile(patch){ this.state.profile = {...this.state.profile, ...patch}; this.persist(); },

  // ------------------------------------------------------- category CRUD
  addDespesaCategory(name){
    name = (name||"").trim(); if(!name || this.state.categories.despesa[name]) return false;
    this.state.categories.despesa[name] = [];
    this.state.categoryGroups[name] = "Necessidades";
    if(!(name in this.state.budgets)) this.state.budgets[name] = 0;
    this.persist(); return true;
  },
  renameDespesaCategory(oldName, newName){
    newName = (newName||"").trim();
    if(!newName || oldName===newName || !this.state.categories.despesa[oldName] || this.state.categories.despesa[newName]) return false;
    this.state.categories.despesa[newName] = this.state.categories.despesa[oldName];
    delete this.state.categories.despesa[oldName];
    if(this.state.categoryGroups[oldName]){ this.state.categoryGroups[newName] = this.state.categoryGroups[oldName]; delete this.state.categoryGroups[oldName]; }
    if(oldName in this.state.budgets){ this.state.budgets[newName] = this.state.budgets[oldName]; delete this.state.budgets[oldName]; }
    this.state.transactions.forEach(t=>{ if(t.category===oldName) t.category = newName; });
    this.persist(); return true;
  },
  deleteDespesaCategory(name){
    if(!this.state.categories.despesa[name]) return false;
    delete this.state.categories.despesa[name];
    delete this.state.categoryGroups[name];
    delete this.state.budgets[name];
    // transactions keep their historical category text even if the category was removed from the list
    this.persist(); return true;
  },
  addSubcategory(cat, sub){
    sub = (sub||"").trim();
    if(!this.state.categories.despesa[cat] || !sub || this.state.categories.despesa[cat].includes(sub)) return false;
    this.state.categories.despesa[cat].push(sub);
    this.persist(); return true;
  },
  renameSubcategory(cat, oldSub, newSub){
    newSub = (newSub||"").trim();
    const list = this.state.categories.despesa[cat]; if(!list) return false;
    const i = list.indexOf(oldSub); if(i<0 || !newSub || list.includes(newSub)) return false;
    list[i] = newSub;
    this.state.transactions.forEach(t=>{ if(t.category===cat && t.subcategory===oldSub) t.subcategory = newSub; });
    this.persist(); return true;
  },
  deleteSubcategory(cat, sub){
    const list = this.state.categories.despesa[cat]; if(!list) return false;
    this.state.categories.despesa[cat] = list.filter(s=>s!==sub);
    this.persist(); return true;
  },
  addReceitaCategory(name){
    name = (name||"").trim(); if(!name || this.state.categories.receita.includes(name)) return false;
    this.state.categories.receita.push(name);
    this.persist(); return true;
  },
  renameReceitaCategory(oldName, newName){
    newName = (newName||"").trim();
    const list = this.state.categories.receita;
    const i = list.indexOf(oldName); if(i<0 || !newName || list.includes(newName)) return false;
    list[i] = newName;
    this.state.transactions.forEach(t=>{ if(t.type==="Receita" && t.category===oldName) t.category = newName; });
    this.persist(); return true;
  },
  deleteReceitaCategory(name){
    this.state.categories.receita = this.state.categories.receita.filter(c=>c!==name);
    this.persist(); return true;
  },

  // ------------------------------------------------------- assistant / chat
  setAssistantSettings(patch){ this.state.assistant = {...this.state.assistant, ...patch}; this.persist(); },
  addChatMessage(role, text){
    this.state.assistant.messages.push({ role, text, at: new Date().toISOString() });
    // keep a generous but bounded history so the browser storage never grows unbounded
    if(this.state.assistant.messages.length > 200){
      this.state.assistant.messages = this.state.assistant.messages.slice(-200);
    }
    this.persist();
  },
  clearChat(){ this.state.assistant.messages = []; this.persist(); },

  // ============================================================ SELECTORS
  monthTransactions(ym){
    return this.state.transactions.filter(t => ymKey(t.date) === ym);
  },

  totalsForMonth(ym){
    const txs = this.monthTransactions(ym);
    const sum = (pred) => txs.filter(pred).reduce((a,t)=>a+Number(t.value||0),0);
    const receita = sum(t=>t.type==="Receita");
    const despesa = sum(t=>t.type==="Despesa");
    const fixas = sum(t=>t.type==="Despesa" && t.fixed);
    const variaveis = despesa - fixas;
    const pagas = sum(t=>t.type==="Despesa" && t.status==="Pago");
    const pendentes = despesa - pagas;
    const saldo = receita - despesa;
    const pctRenda = receita>0 ? despesa/receita : 0;
    return {receita, despesa, fixas, variaveis, pagas, pendentes, saldo, pctRenda};
  },

  categoryBreakdown(ym, tipo="Despesa"){
    const txs = this.monthTransactions(ym).filter(t=>t.type===tipo);
    const cats = tipo==="Despesa" ? Object.keys(this.state.categories.despesa) : this.state.categories.receita;
    const receita = this.totalsForMonth(ym).receita;
    const rows = cats.map(cat => {
      const valor = txs.filter(t=>t.category===cat).reduce((a,t)=>a+Number(t.value||0),0);
      return { categoria: cat, valor, pct: receita>0 ? valor/receita : 0 };
    });
    return rows.sort((a,b)=>b.valor-a.valor);
  },

  budgetStatus(ym){
    const breakdown = this.categoryBreakdown(ym, "Despesa");
    return breakdown.map(row => {
      const orcamento = Number(this.state.budgets[row.categoria] || 0);
      const gasto = row.valor;
      const saldo = orcamento - gasto;
      const pctUsed = orcamento>0 ? gasto/orcamento : (gasto>0 ? 999 : 0);
      return { categoria: row.categoria, orcamento, gasto, saldo, pctUsed };
    });
  },

  last12MonthsSeries(refYm){
    const [ry, rm] = refYm.split("-").map(Number);
    const out = [];
    for(let i=11;i>=0;i--){
      const dt = new Date(ry, rm-1-i, 1);
      const ym = `${dt.getFullYear()}-${String(dt.getMonth()+1).padStart(2,"0")}`;
      const t = this.totalsForMonth(ym);
      out.push({ ym, label: MESES_ABR_PT[dt.getMonth()], ...t });
    }
    return out;
  },

  // Stable, chronological list of months for the global month picker — always
  // anchored to the real calendar date, never to whatever is currently selected
  // (that was the bug: recentring on the selection made older months vanish).
  availableMonths(){
    const dates = this.state.transactions.map(t=>t.date).filter(Boolean).sort();
    const earliest = dates.length ? ymKey(dates[0]) : addMonths(todayStr(),-11).slice(0,7);
    // The list must reach far enough forward to cover scheduled items and future
    // installments — otherwise those months can't be selected in the picker.
    const dueDates = this.state.transactions.map(t=>t.dueDate||t.date).filter(Boolean).sort();
    const latestDue = dueDates.length ? ymKey(dueDates[dueDates.length-1]) : "";
    const horizon = addMonths(todayStr(), 2).slice(0,7);
    const end = latestDue > horizon ? latestDue : horizon;
    const startYm = earliest < end ? earliest : end;
    let months = [];
    let cursor = startYm;
    let guard = 0;
    while(cursor <= end && guard < 400){
      months.push(cursor);
      cursor = addMonths(cursor+"-01",1).slice(0,7);
      guard++;
    }
    // also make sure the currently selected month is never missing from the list
    // (e.g. right after importing a backup with a different date range)
    const sel = this.state.settings.selectedYm;
    if(sel && !months.includes(sel)) months.push(sel);
    return months.sort();
  },

  accountBalance(accountId){
    const acc = this.state.accounts.find(a=>a.id===accountId);
    if(!acc) return 0;
    const txs = this.state.transactions.filter(t=>t.accountId===accountId);
    const receitas = txs.filter(t=>t.type==="Receita").reduce((a,t)=>a+Number(t.value||0),0);
    const despesas = txs.filter(t=>t.type==="Despesa").reduce((a,t)=>a+Number(t.value||0),0);
    return Number(acc.initialBalance||0) + receitas - despesas;
  },

  accountsTotal(){
    return this.state.accounts.reduce((a,acc)=>a+this.accountBalance(acc.id),0);
  },

  cardUtilization(cardId, ym){
    const card = this.state.cards.find(c=>c.id===cardId);
    if(!card) return {limite:0, utilizado:0, disponivel:0, faturaAtual:0, proximaFatura:0};
    const txs = this.state.transactions.filter(t=>t.cardId===cardId && t.type==="Despesa");
    const abertas = txs.filter(t=>t.status!=="Pago");
    const utilizado = abertas.reduce((a,t)=>a+Number(t.value||0),0);
    const faturaAtual = abertas.filter(t=>ymKey(t.dueDate||t.date)===ym).reduce((a,t)=>a+Number(t.value||0),0);
    const nextYm = addMonths(ym+"-01",1).slice(0,7);
    const proximaFatura = abertas.filter(t=>ymKey(t.dueDate||t.date)===nextYm).reduce((a,t)=>a+Number(t.value||0),0);
    return { limite: Number(card.limit||0), utilizado, disponivel: Number(card.limit||0)-utilizado, faturaAtual, proximaFatura };
  },

  installmentPurchases(){
    const groups = {};
    this.state.transactions.filter(t=>t.groupId).forEach(t=>{
      groups[t.groupId] = groups[t.groupId] || [];
      groups[t.groupId].push(t);
    });
    return Object.values(groups).map(rows=>{
      rows.sort((a,b)=>a.installmentNum-b.installmentNum);
      const paid = rows.filter(r=>r.status==="Pago").length;
      const restante = rows.filter(r=>r.status!=="Pago").reduce((a,r)=>a+Number(r.value||0),0);
      const next = rows.find(r=>r.status!=="Pago") || rows[rows.length-1];
      return {
        groupId: rows[0].groupId, description: rows[0].description, cardId: rows[0].cardId,
        total: rows.length, paid, current: next.installmentNum, valorParcela: rows[0].value,
        restante, rows
      };
    });
  },

  debtsSummary(){
    const rows = this.state.debts.map(d=>{
      const restanteParcelas = Math.max(0, d.installmentsTotal - d.installmentsPaid);
      const valorAtual = restanteParcelas * Number(d.installmentValue||0);
      const totalPago = d.installmentsPaid * Number(d.installmentValue||0);
      return {...d, restanteParcelas, valorAtual, totalPago};
    });
    const totalOriginal = rows.reduce((a,d)=>a+Number(d.originalValue||0),0);
    const totalPago = rows.reduce((a,d)=>a+d.totalPago,0);
    const totalRestante = rows.reduce((a,d)=>a+d.valorAtual,0);
    const pctQuitado = (totalPago+totalRestante)>0 ? totalPago/(totalPago+totalRestante) : 0;
    return { rows, totalOriginal, totalPago, totalRestante, pctQuitado };
  },

  investmentsSummary(){
    const rows = this.state.investments;
    const totalInvestido = rows.reduce((a,v)=>a+Number(v.invested||0)+Number(v.contributions||0)-Number(v.withdrawals||0),0);
    const totalAtual = rows.reduce((a,v)=>a+Number(v.currentValue||0),0);
    const totalRendimentos = totalAtual - totalInvestido;
    const rentabilidade = totalInvestido>0 ? totalRendimentos/totalInvestido : 0;
    return { rows, totalInvestido, totalAtual, totalRendimentos, rentabilidade };
  },
  aportesNoMes(ym){
    return this.state.investments.filter(v=>ymKey(v.date)===ym).reduce((a,v)=>a+Number(v.contributions||0),0);
  },

  goalsList(){
    return this.state.goals.map(g=>{
      const remaining = Math.max(0, g.target - g.current);
      const pctConcluido = g.target>0 ? clamp(g.current/g.target,0,1) : 0;
      const mensalNecessario = g.deadlineMonths>0 ? remaining/g.deadlineMonths : remaining;
      return {...g, remaining, pctConcluido, mensalNecessario};
    });
  },

  patrimonioLiquido(){
    const inv = this.investmentsSummary();
    const dv = this.debtsSummary();
    return this.accountsTotal() + inv.totalAtual - dv.totalRestante;
  },

  // ---- health score (0-100), 5 named factors, transparent & documented ----
  healthScore(ym){
    const t = this.totalsForMonth(ym);
    const dv = this.debtsSummary();
    const inv = this.investmentsSummary();
    const budgets = this.budgetStatus(ym).filter(b=>b.orcamento>0);
    const series = this.last12MonthsSeries(ym).filter(m=>m.receita>0 || m.despesa>0);
    const mediaDespesas = series.length ? series.reduce((a,m)=>a+m.despesa,0)/series.length : t.despesa;

    const fGastos = clamp(100 - Math.max(0,(t.pctRenda-0.5))*200, 0, 100);

    const reservaGoal = this.state.goals.find(g=>/reserva/i.test(g.name));
    const fReserva = reservaGoal
      ? clamp(reservaGoal.current/Math.max(1,reservaGoal.target)*100,0,100)
      : clamp((this.accountsTotal()/Math.max(1, mediaDespesas*3))*100,0,100);

    const fDividas = clamp(100 - (dv.totalRestante/Math.max(1, t.receita*12))*100, 0, 100);

    const fInvest = clamp((inv.totalAtual/Math.max(1, t.receita*12*0.2))*100, 0, 100);

    const fOrcamento = budgets.length
      ? clamp(budgets.reduce((a,b)=>a+clamp(100-Math.max(0,(b.pctUsed-1))*100,0,100),0)/budgets.length,0,100)
      : 70;

    const score = Math.round((fGastos+fReserva+fDividas+fInvest+fOrcamento)/5);
    let label, tone;
    if(score<40){label="Crítica"; tone="coral";}
    else if(score<60){label="Atenção"; tone="gold";}
    else if(score<75){label="Moderada"; tone="gold";}
    else if(score<90){label="Boa"; tone="green";}
    else {label="Excelente"; tone="green";}

    return { score, label, tone, factors: [
      {key:"gastos", label:"Controle de gastos", value: Math.round(fGastos)},
      {key:"reserva", label:"Reserva", value: Math.round(fReserva)},
      {key:"dividas", label:"Dívidas", value: Math.round(fDividas)},
      {key:"investimentos", label:"Investimentos", value: Math.round(fInvest)},
      {key:"orcamento", label:"Orçamento", value: Math.round(fOrcamento)},
    ]};
  },

  // ---- insights: short computed sentences, based on real deltas ----
  insights(ym){
    const out = [];
    const t = this.totalsForMonth(ym);
    const prevYm = addMonths(ym+"-01",-1).slice(0,7);
    const prevT = this.totalsForMonth(prevYm);
    const cats = this.categoryBreakdown(ym,"Despesa");
    const prevCats = this.categoryBreakdown(prevYm,"Despesa");

    if(cats[0] && cats[0].valor>0){
      const prevVal = (prevCats.find(c=>c.categoria===cats[0].categoria)||{valor:0}).valor;
      if(prevVal>0){
        const delta = (cats[0].valor-prevVal)/prevVal;
        if(Math.abs(delta) >= 0.08){
          out.push({ icon: delta>0?"trending-up":"trending-down",
            text: `Seus gastos com ${cats[0].categoria} ${delta>0?"aumentaram":"caíram"} ${pct(Math.abs(delta))} em relação ao mês anterior.` });
        }
      }
    }
    const budgets = this.budgetStatus(ym).filter(b=>b.orcamento>0);
    const tightest = budgets.sort((a,b)=>b.pctUsed-a.pctUsed)[0];
    if(tightest && tightest.pctUsed>=0.8){
      out.push({ icon:"alert-triangle", text: `Você já utilizou ${pct(tightest.pctUsed)} do orçamento de ${tightest.categoria}.` });
    }
    const goals = this.goalsList().sort((a,b)=>b.pctConcluido-a.pctConcluido);
    if(goals[0] && goals[0].pctConcluido<1){
      out.push({ icon:"target", text: `Faltam ${money(goals[0].remaining)} para você atingir a meta "${goals[0].name}".` });
    }
    const inv = this.investmentsSummary();
    if(inv.totalInvestido>0){
      out.push({ icon:"trending-up", text: `Seus investimentos acumulam ${pct(inv.rentabilidade)} de rentabilidade, totalizando ${money(inv.totalAtual)}.` });
    }
    if(t.saldo !== 0){
      out.push({ icon: t.saldo>=0 ? "piggy-bank" : "alert-circle",
        text: t.saldo>=0 ? `Você economizou ${money(t.saldo)} este mês.` : `Suas despesas superaram as receitas em ${money(-t.saldo)} este mês.` });
    }
    return out.slice(0,5);
  },

  alerts(ym){
    const out = [];
    this.state.cards.forEach(card=>{
      const u = this.cardUtilization(card.id, ym);
      if(u.faturaAtual>0){
        const due = `${ym}-${String(card.dueDay).padStart(2,"0")}`;
        const dleft = daysUntil(due);
        if(dleft!==null && dleft>=0 && dleft<=5){
          out.push({tone:"warn", icon:"credit-card", text:`A fatura do cartão ${card.name} (${money(u.faturaAtual)}) vence em ${dleft} dia(s).`});
        }
      }
      if(u.limite>0 && u.utilizado/u.limite>0.9){
        out.push({tone:"danger", icon:"alert-triangle", text:`O cartão ${card.name} está com ${pct(u.utilizado/u.limite)} do limite utilizado.`});
      }
    });
    this.budgetStatus(ym).forEach(b=>{
      if(b.orcamento>0 && b.pctUsed>1){
        out.push({tone:"danger", icon:"alert-circle", text:`Você ultrapassou o orçamento de ${b.categoria}.`});
      }
    });
    this.state.accounts.forEach(acc=>{
      const bal = this.accountBalance(acc.id);
      if(bal < 500 && bal >= 0){
        out.push({tone:"warn", icon:"wallet", text:`O saldo de ${acc.name} está abaixo de R$ 500.`});
      } else if(bal < 0){
        out.push({tone:"danger", icon:"wallet", text:`A conta ${acc.name} está com saldo negativo.`});
      }
    });
    this.goalsList().forEach(g=>{
      if(g.pctConcluido>=1){
        out.push({tone:"good", icon:"party-popper", text:`Você atingiu sua meta "${g.name}"! 🎉`});
      }
    });
    return out;
  },

  // ---- forecast: baseline fixed avg + already-scheduled transactions ----
  forecast(nMonths=3){
    // Always forward-looking from the real current date — deliberately NOT tied
    // to the global month picker (which is for reviewing a given month), since
    // "next months" only makes sense counted from today.
    const ym = ymKey(todayStr());
    const hist = this.last12MonthsSeries(ym).filter(m=>m.receita>0 || m.despesa>0).slice(-3);
    const baseFixed = hist.length ? hist.reduce((a,m)=>a+m.fixas,0)/hist.length : 0;
    const baseReceita = hist.length ? hist.reduce((a,m)=>a+m.receita,0)/hist.length : 0;
    const out = [];
    for(let i=1;i<=nMonths;i++){
      const fYm = addMonths(ym+"-01", i).slice(0,7);
      const [fy,fm] = fYm.split("-").map(Number);
      const actual = this.totalsForMonth(fYm);
      const actualNonFixedDespesa = actual.despesa - actual.fixas;
      const previstoDespesa = baseFixed + actualNonFixedDespesa;
      const previstoReceita = Math.max(baseReceita, actual.receita);
      out.push({ ym: fYm, label: `${MESES_PT[fm-1]}`, receita: previstoReceita, despesa: previstoDespesa,
        saldo: previstoReceita - previstoDespesa });
    }
    return out;
  },

  // ---- long-range history for the AI assistant's "memory" (up to 5 years) ----
  longHistorySeries(maxMonths=60){
    if(this.state.transactions.length===0) return [];
    const dates = this.state.transactions.map(t=>t.date).sort();
    const firstYm = ymKey(dates[0]);
    const endYm = this.state.settings.selectedYm;
    let months = [];
    let cursor = firstYm;
    let guard = 0;
    while(cursor <= endYm && guard < 1000){
      months.push(cursor);
      cursor = addMonths(cursor+"-01",1).slice(0,7);
      guard++;
    }
    if(months.length > maxMonths) months = months.slice(-maxMonths);
    return months.map(ym=>{
      const t = this.totalsForMonth(ym);
      return { ym, ...t };
    });
  },

  // ---- compact text summary of the whole financial picture, used as the
  // AI assistant's context so it can answer questions with real numbers
  // without needing the entire transaction history sent every time ----
  financialContextSummary(){
    const ym = this.state.settings.selectedYm;
    const t = this.totalsForMonth(ym);
    const health = this.healthScore(ym);
    const budgets = this.budgetStatus(ym).filter(b=>b.orcamento>0);
    const debts = this.debtsSummary();
    const inv = this.investmentsSummary();
    const goals = this.goalsList();
    const history = this.longHistorySeries(60);
    const historyLines = history.map(m=>`${m.ym}: receita ${money(m.receita)}, despesa ${money(m.despesa)}, saldo ${money(m.saldo)}`).join("\n");

    return [
      `Perfil: ${this.state.profile.name}.`,
      `Mês de referência selecionado no app: ${ym}.`,
      `Resumo do mês: receita ${money(t.receita)}, despesa ${money(t.despesa)}, saldo ${money(t.saldo)}, ${pct(t.pctRenda)} da renda comprometida.`,
      `Saúde financeira: ${health.score}/100 (${health.label}). Fatores: ${health.factors.map(f=>`${f.label} ${f.value}%`).join(", ")}.`,
      budgets.length ? `Orçamentos definidos: ${budgets.map(b=>`${b.categoria} ${money(b.gasto)}/${money(b.orcamento)} (${pct(b.orcamento?b.gasto/b.orcamento:0)})`).join("; ")}.` : `Nenhum orçamento definido ainda.`,
      `Dívidas: total original ${money(debts.totalOriginal)}, restante ${money(debts.totalRestante)}, ${pct(debts.pctQuitado)} quitado.`,
      `Investimentos: valor atual ${money(inv.totalAtual)}, rendimento acumulado ${money(inv.totalRendimentos)} (${pct(inv.rentabilidade)}).`,
      goals.length ? `Metas: ${goals.map(g=>`${g.name} ${money(g.current)}/${money(g.target)} (${pct(g.pctConcluido)})`).join("; ")}.` : `Nenhuma meta cadastrada.`,
      `Patrimônio líquido: ${money(this.patrimonioLiquido())}.`,
      history.length ? `Histórico mensal disponível (${history.length} meses, de ${history[0].ym} até ${history[history.length-1].ym}):\n${historyLines}` : ``,
    ].filter(Boolean).join("\n");
  },
};
