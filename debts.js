/* =====================================================================
   DEBTS VIEW — "Minhas dívidas"
   ===================================================================== */

const DebtsView = {
  render(container){
    const S = Store.state;
    const summary = Store.debtsSummary();

    container.innerHTML = `
      <div class="section-head" style="margin-top:0;">
        <h2>Minhas dívidas</h2>
        <button class="btn btn-secondary btn-sm" id="addDebtBtn"><i data-lucide="plus"></i>Nova dívida</button>
      </div>

      <div class="grid-3">
        <div class="card"><div class="card-title">Total da dívida</div><div style="font-family:var(--font-display); font-size:22px; font-weight:700;">${money(summary.totalOriginal)}</div></div>
        <div class="card"><div class="card-title">Total pago</div><div style="font-family:var(--font-display); font-size:22px; font-weight:700; color:var(--accent-strong)">${money(summary.totalPago)}</div></div>
        <div class="card"><div class="card-title">Total restante</div><div style="font-family:var(--font-display); font-size:22px; font-weight:700; color:var(--coral)">${money(summary.totalRestante)}</div></div>
      </div>

      <div class="card" style="margin-top:16px;">
        <div style="display:flex; justify-content:space-between; font-size:13px; margin-bottom:8px;">
          <span>Progresso de quitação</span><b>${pct(summary.pctQuitado)}</b>
        </div>
        <div class="progress green"><span style="width:${summary.pctQuitado*100}%"></span></div>
      </div>

      <div class="section-head"><h2>Detalhamento</h2></div>
      ${summary.rows.length===0 ? `<div class="empty-state"><i data-lucide="trending-down"></i><h4>Nenhuma dívida cadastrada</h4><p>Ótimo sinal — ou basta adicionar aqui se você tiver alguma.</p></div>` : `
      <div class="table-card">
        <table>
          <thead><tr><th>Credor</th><th>Original</th><th>Restante</th><th>Parcela</th><th>Parcelas restantes</th><th>Vencimento</th><th></th></tr></thead>
          <tbody>
            ${summary.rows.map(d=>`
              <tr data-id="${d.id}">
                <td data-label="Credor"><b>${escapeHtml(d.creditor)}</b><span class="sub" style="display:block;color:var(--ink-soft);font-size:12px;">${d.type}</span></td>
                <td data-label="Original">${money(d.originalValue)}</td>
                <td data-label="Restante" style="font-weight:600;">${money(d.valorAtual)}</td>
                <td data-label="Parcela">${money(d.installmentValue)}</td>
                <td data-label="Restantes">${d.restanteParcelas}/${d.installmentsTotal}</td>
                <td data-label="Vencimento">${fmtDate(d.dueDate)}</td>
                <td><div class="row-actions">
                  <button class="icon-btn btn-pay" title="Registrar parcela paga"><i data-lucide="check"></i></button>
                  <button class="icon-btn btn-edit-d" title="Editar"><i data-lucide="pencil"></i></button>
                  <button class="icon-btn btn-del-d" title="Excluir"><i data-lucide="trash-2"></i></button>
                </div></td>
              </tr>`).join("")}
          </tbody>
        </table>
      </div>`}
    `;

    document.getElementById("addDebtBtn").onclick = ()=>this.openModal();
    container.querySelectorAll("tbody tr").forEach(tr=>{
      const id = tr.dataset.id;
      const d = S.debts.find(x=>x.id===id);
      tr.querySelector(".btn-pay").onclick = ()=>{
        if(d.installmentsPaid < d.installmentsTotal){
          Store.updateDebt(id, {installmentsPaid: d.installmentsPaid+1});
          UI.toast("Parcela registrada como paga.");
          App.rerender();
        }
      };
      tr.querySelector(".btn-edit-d").onclick = ()=>this.openModal(d);
      tr.querySelector(".btn-del-d").onclick = ()=>{
        UI.confirm("Essa ação não pode ser desfeita.", ()=>{ Store.deleteDebt(id); UI.toast("Dívida excluída."); App.rerender(); }, {title:"Excluir dívida"});
      };
    });
  },

  openModal(existing=null){
    const d = existing || {creditor:"", type:"Empréstimo", originalValue:0, installmentsTotal:1, installmentsPaid:0, installmentValue:0, interest:0, dueDate: todayStr()};
    UI.openModal(`
      <div class="modal-head"><h3>${existing?"Editar dívida":"Nova dívida"}</h3><button class="icon-btn" id="closeD"><i data-lucide="x"></i></button></div>
      <div class="modal-body">
        <div class="field"><label>Credor</label><input id="d_creditor" value="${escapeHtml(d.creditor)}" placeholder="Ex: Banco Y — Empréstimo"/></div>
        <div class="field"><label>Tipo</label><input id="d_type" value="${escapeHtml(d.type)}" placeholder="Empréstimo, financiamento..."/></div>
        <div class="field-row">
          <div class="field"><label>Valor original (R$)</label><input type="number" id="d_original" value="${d.originalValue}"/></div>
          <div class="field"><label>Valor da parcela (R$)</label><input type="number" id="d_installValue" value="${d.installmentValue}"/></div>
        </div>
        <div class="field-row">
          <div class="field"><label>Nº de parcelas</label><input type="number" id="d_total" value="${d.installmentsTotal}"/></div>
          <div class="field"><label>Parcelas já pagas</label><input type="number" id="d_paid" value="${d.installmentsPaid}"/></div>
        </div>
        <div class="field-row">
          <div class="field"><label>Juros a.m. (%)</label><input type="number" step="0.1" id="d_interest" value="${(d.interest*100).toFixed(1)}"/></div>
          <div class="field"><label>Próximo vencimento</label><input type="date" id="d_due" value="${d.dueDate}"/></div>
        </div>
      </div>
      <div class="modal-foot">
        <button class="btn btn-secondary btn-block" id="cancelD">Cancelar</button>
        <button class="btn btn-primary btn-block" id="saveD">Salvar</button>
      </div>
    `, { onMount(root){
      root.querySelector("#closeD").onclick = ()=>UI.closeModal();
      root.querySelector("#cancelD").onclick = ()=>UI.closeModal();
      root.querySelector("#saveD").onclick = ()=>{
        const payload = {
          creditor: root.querySelector("#d_creditor").value.trim() || "Credor",
          type: root.querySelector("#d_type").value,
          originalValue: Number(root.querySelector("#d_original").value)||0,
          installmentValue: Number(root.querySelector("#d_installValue").value)||0,
          installmentsTotal: Number(root.querySelector("#d_total").value)||1,
          installmentsPaid: Number(root.querySelector("#d_paid").value)||0,
          interest: (Number(root.querySelector("#d_interest").value)||0)/100,
          dueDate: root.querySelector("#d_due").value || todayStr(),
        };
        if(existing){ Store.updateDebt(existing.id, payload); UI.toast("Dívida atualizada."); }
        else { Store.addDebt(payload); UI.toast("Dívida adicionada."); }
        UI.closeModal(); App.rerender();
      };
    }});
  }
};
