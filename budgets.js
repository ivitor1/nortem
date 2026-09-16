/* =====================================================================
   BUDGETS VIEW — "Orçamentos"
   ===================================================================== */

const BudgetsView = {
  render(container){
    const ym = Store.state.settings.selectedYm;
    const rows = Store.budgetStatus(ym);

    container.innerHTML = `
      <div class="section-head" style="margin-top:0;">
        <h2>Orçamentos — ${MESES_PT[Number(ym.split('-')[1])-1]} ${ym.split('-')[0]}</h2>
      </div>
      <div class="grid-3">
        ${rows.map(r=>{
          const pctUsed = r.orcamento>0 ? clamp(r.gasto/r.orcamento,0,1.4) : 0;
          const tone = progressTone(r.orcamento>0 ? r.gasto/r.orcamento : 0);
          const pillClass = statusPillClass(r.orcamento>0 ? r.gasto/r.orcamento : 0);
          const pillLabel = r.orcamento===0 ? "Sem orçamento" : pillClass==="over" ? "🔴 Acima" : pillClass==="warn" ? "🟡 Atenção" : "🟢 Normal";
          return `
          <div class="card budget-card" data-cat="${escapeHtml(r.categoria)}">
            <div class="b-head">
              <b>${r.categoria}</b>
              <button class="icon-btn btn-edit-budget" title="Editar orçamento"><i data-lucide="pencil"></i></button>
            </div>
            <div class="progress ${tone}"><span style="width:${clamp(pctUsed*100,0,100)}%"></span></div>
            <div class="b-nums">
              <span>${money(r.gasto)} gasto</span>
              <span>${money(r.orcamento)} orçado</span>
            </div>
            <div style="display:flex; justify-content:space-between; align-items:center;">
              <span style="font-size:12.5px; color:var(--ink-soft);">${r.saldo>=0? money(r.saldo)+" restantes" : money(-r.saldo)+" acima"}</span>
              <span class="status-pill ${pillClass}">${pillLabel}</span>
            </div>
          </div>`;
        }).join("")}
      </div>
    `;

    container.querySelectorAll(".btn-edit-budget").forEach(btn=>{
      btn.onclick = (e)=>{
        const cat = e.target.closest(".budget-card").dataset.cat;
        const current = Store.state.budgets[cat] || 0;
        UI.openModal(`
          <div class="modal-head"><h3>Orçamento — ${cat}</h3><button class="icon-btn" id="closeB"><i data-lucide="x"></i></button></div>
          <div class="modal-body">
            <div class="field"><label>Valor mensal (R$)</label><input type="number" id="budgetVal" min="0" step="10" value="${current}"/></div>
          </div>
          <div class="modal-foot">
            <button class="btn btn-secondary btn-block" id="cancelB">Cancelar</button>
            <button class="btn btn-primary btn-block" id="saveB">Salvar</button>
          </div>
        `, { onMount(root){
          root.querySelector("#closeB").onclick = ()=>UI.closeModal();
          root.querySelector("#cancelB").onclick = ()=>UI.closeModal();
          root.querySelector("#saveB").onclick = ()=>{
            Store.setBudget(cat, Number(root.querySelector("#budgetVal").value)||0);
            UI.closeModal(); UI.toast("Orçamento atualizado."); App.rerender();
          };
        }});
      };
    });
  }
};
