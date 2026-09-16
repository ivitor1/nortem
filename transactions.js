/* =====================================================================
   TRANSACTIONS VIEW — "Lançamentos"
   ===================================================================== */

const TransactionsView = {
  filters: { search:"", period:"month", category:"", accountId:"", cardId:"", type:"", status:"" },

  applyParams(params){
    if(params && params.category){ this.filters.category = params.category; }
  },

  getRows(){
    const S = Store.state;
    let rows = [...S.transactions];
    const f = this.filters;
    if(f.period==="month"){
      rows = rows.filter(t=>ymKey(t.date)===S.settings.selectedYm);
    }
    if(f.search){
      const q = f.search.toLowerCase();
      rows = rows.filter(t => t.description.toLowerCase().includes(q) || (t.notes||"").toLowerCase().includes(q));
    }
    if(f.category) rows = rows.filter(t=>t.category===f.category);
    if(f.accountId) rows = rows.filter(t=>t.accountId===f.accountId);
    if(f.cardId) rows = rows.filter(t=>t.cardId===f.cardId);
    if(f.type) rows = rows.filter(t=>t.type===f.type);
    if(f.status) rows = rows.filter(t=>t.status===f.status);
    return rows.sort((a,b)=> b.date.localeCompare(a.date));
  },

  render(container, params){
    this.applyParams(params);
    const S = Store.state;
    const rows = this.getRows();
    const f = this.filters;
    const accName = (id)=> (S.accounts.find(a=>a.id===id)||{}).name || "—";
    const cardName = (id)=> (S.cards.find(c=>c.id===id)||{}).name || "—";
    const allCats = [...Object.keys(S.categories.despesa), ...S.categories.receita];

    container.innerHTML = `
      <div class="section-head" style="margin-top:0;"><h2>Lançamentos</h2></div>

      <div class="table-card">
        <div class="table-toolbar">
          <div class="search-box"><i data-lucide="search"></i><input id="txSearch" placeholder="Pesquisar por descrição..." value="${escapeHtml(f.search)}"/></div>
          <select class="filter-select" id="fPeriod">
            <option value="month" ${f.period==='month'?'selected':''}>Mês selecionado</option>
            <option value="all" ${f.period==='all'?'selected':''}>Todo o período</option>
          </select>
          <select class="filter-select" id="fType"><option value="">Tipo</option>${["Receita","Despesa","Transferência"].map(x=>`<option ${f.type===x?'selected':''}>${x}</option>`).join("")}</select>
          <select class="filter-select" id="fCategory"><option value="">Categoria</option>${allCats.map(x=>`<option ${f.category===x?'selected':''}>${x}</option>`).join("")}</select>
          <select class="filter-select" id="fAccount"><option value="">Conta</option>${S.accounts.map(a=>`<option value="${a.id}" ${f.accountId===a.id?'selected':''}>${escapeHtml(a.name)}</option>`).join("")}</select>
          <select class="filter-select" id="fCard"><option value="">Cartão</option>${S.cards.map(c=>`<option value="${c.id}" ${f.cardId===c.id?'selected':''}>${escapeHtml(c.name)}</option>`).join("")}</select>
          <select class="filter-select" id="fStatus"><option value="">Status</option>${["Pago","Pendente","Agendado"].map(x=>`<option ${f.status===x?'selected':''}>${x}</option>`).join("")}</select>
          ${(f.category||f.accountId||f.cardId||f.type||f.status||f.search) ? `<button class="btn btn-ghost btn-sm" id="clearFilters"><i data-lucide="x"></i>Limpar</button>` : ""}
        </div>

        ${rows.length === 0 ? `
          <div class="empty-state">
            <i data-lucide="inbox"></i>
            <h4>Nenhum lançamento encontrado</h4>
            <p>Tente ajustar os filtros ou adicione seu primeiro lançamento.</p>
          </div>
        ` : `
        <table>
          <thead><tr>
            <th>Data</th><th>Descrição</th><th>Categoria</th><th>Conta</th><th>Pagamento</th><th>Status</th><th style="text-align:right;">Valor</th><th></th>
          </tr></thead>
          <tbody>
            ${rows.map(t=>`
              <tr data-id="${t.id}">
                <td data-label="Data">${fmtDate(t.date)}</td>
                <td data-label="Descrição" class="cell-desc"><b>${escapeHtml(t.description)}</b>${t.installments>1?`<span class="sub">Parcela ${t.installmentNum}/${t.installments}</span>`:""}</td>
                <td data-label="Categoria">${t.category}${t.subcategory?` · <span style="color:var(--ink-soft)">${t.subcategory}</span>`:""}</td>
                <td data-label="Conta">${t.cardId ? `💳 ${cardName(t.cardId)}` : accName(t.accountId)}</td>
                <td data-label="Pagamento">${t.paymentMethod}${t.fixed?` <span class="badge fixed">fixo</span>`:""}</td>
                <td data-label="Status"><span class="badge ${t.status==='Pago'?'paid':t.status==='Pendente'?'pending':'scheduled'}">${t.status}</span></td>
                <td data-label="Valor" style="text-align:right;" class="${t.type==='Receita'?'amount-pos':'amount-neg'}">${t.type==='Receita'?'+':t.type==='Despesa'?'−':''} ${money(t.value)}</td>
                <td>
                  <div class="row-actions">
                    <button class="icon-btn btn-edit" title="Editar"><i data-lucide="pencil"></i></button>
                    <button class="icon-btn btn-dup" title="Duplicar"><i data-lucide="copy"></i></button>
                    <button class="icon-btn btn-del" title="Excluir"><i data-lucide="trash-2"></i></button>
                  </div>
                </td>
              </tr>
            `).join("")}
          </tbody>
        </table>`}
      </div>
    `;

    // wire toolbar
    document.getElementById("txSearch").oninput = debounce((e)=>{ this.filters.search = e.target.value; App.rerender(); }, 250);
    document.getElementById("fPeriod").onchange = (e)=>{ this.filters.period = e.target.value; App.rerender(); };
    document.getElementById("fType").onchange = (e)=>{ this.filters.type = e.target.value; App.rerender(); };
    document.getElementById("fCategory").onchange = (e)=>{ this.filters.category = e.target.value; App.rerender(); };
    document.getElementById("fAccount").onchange = (e)=>{ this.filters.accountId = e.target.value; App.rerender(); };
    document.getElementById("fCard").onchange = (e)=>{ this.filters.cardId = e.target.value; App.rerender(); };
    document.getElementById("fStatus").onchange = (e)=>{ this.filters.status = e.target.value; App.rerender(); };
    document.getElementById("clearFilters")?.addEventListener("click", ()=>{
      this.filters = { search:"", period:"month", category:"", accountId:"", cardId:"", type:"", status:"" };
      App.rerender();
    });

    // row actions
    container.querySelectorAll("tbody tr").forEach(tr=>{
      const id = tr.dataset.id;
      tr.querySelector(".btn-edit").onclick = ()=>{
        const tx = S.transactions.find(x=>x.id===id);
        UI.openTransactionModal(tx);
      };
      tr.querySelector(".btn-dup").onclick = ()=>{
        Store.duplicateTransaction(id);
        UI.toast("Lançamento duplicado.");
        App.rerender();
      };
      tr.querySelector(".btn-del").onclick = ()=>{
        const tx = S.transactions.find(x=>x.id===id);
        const isGroup = tx && tx.groupId;
        UI.confirm(
          isGroup ? "Este lançamento faz parte de uma compra parcelada. Deseja excluir apenas esta parcela ou todas?" : "Essa ação não pode ser desfeita.",
          ()=>{ Store.deleteTransaction(id, false); UI.toast("Lançamento excluído."); App.rerender(); },
          { title:"Excluir lançamento", confirmLabel: isGroup ? "Excluir só esta" : "Excluir" }
        );
      };
    });
  }
};
