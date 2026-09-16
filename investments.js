/* =====================================================================
   INVESTMENTS VIEW
   ===================================================================== */

const InvestmentsView = {
  render(container){
    const S = Store.state;
    const ym = S.settings.selectedYm;
    const sum = Store.investmentsSummary();
    const aportes = Store.aportesNoMes(ym);

    container.innerHTML = `
      <div class="section-head" style="margin-top:0;">
        <h2>Investimentos</h2>
        <button class="btn btn-secondary btn-sm" id="addInvBtn"><i data-lucide="plus"></i>Novo investimento</button>
      </div>

      <div class="grid-4">
        <div class="card"><div class="card-title">Patrimônio investido</div><div style="font-family:var(--font-display); font-size:21px; font-weight:700;">${money(sum.totalAtual)}</div></div>
        <div class="card"><div class="card-title">Aportes no mês</div><div style="font-family:var(--font-display); font-size:21px; font-weight:700;">${money(aportes)}</div></div>
        <div class="card"><div class="card-title">Rendimentos</div><div style="font-family:var(--font-display); font-size:21px; font-weight:700; color:var(--accent-strong)">${money(sum.totalRendimentos)}</div></div>
        <div class="card"><div class="card-title">Rentabilidade acumulada</div><div style="font-family:var(--font-display); font-size:21px; font-weight:700;">${pct(sum.rentabilidade)}</div></div>
      </div>

      <div class="chart-card" style="margin-top:16px;">
        <div class="chart-head"><h3>Evolução patrimonial</h3></div>
        <div class="chart-wrap"><canvas id="investChart"></canvas></div>
      </div>

      <div class="section-head"><h2>Meus investimentos</h2></div>
      ${sum.rows.length===0 ? `<div class="empty-state"><i data-lucide="trending-up"></i><h4>Nenhum investimento cadastrado</h4><p>Adicione seus investimentos para acompanhar rentabilidade e evolução.</p></div>` : `
      <div class="table-card">
        <table>
          <thead><tr><th>Investimento</th><th>Tipo</th><th>Instituição</th><th>Aportado</th><th style="text-align:right;">Valor atual</th><th></th></tr></thead>
          <tbody>
            ${sum.rows.map(v=>{
              const aportado = Number(v.invested||0)+Number(v.contributions||0)-Number(v.withdrawals||0);
              return `
              <tr data-id="${v.id}">
                <td data-label="Investimento"><b>${escapeHtml(v.name)}</b></td>
                <td data-label="Tipo">${v.type}</td>
                <td data-label="Instituição">${escapeHtml(v.institution)}</td>
                <td data-label="Aportado">${money(aportado)}</td>
                <td data-label="Valor atual" style="text-align:right; font-weight:600;">${money(v.currentValue)}</td>
                <td><div class="row-actions">
                  <button class="icon-btn btn-edit-i"><i data-lucide="pencil"></i></button>
                  <button class="icon-btn btn-del-i"><i data-lucide="trash-2"></i></button>
                </div></td>
              </tr>`;
            }).join("")}
          </tbody>
        </table>
      </div>`}
    `;

    document.getElementById("addInvBtn").onclick = ()=>this.openModal();
    container.querySelectorAll("tbody tr").forEach(tr=>{
      const id = tr.dataset.id;
      tr.querySelector(".btn-edit-i").onclick = ()=>this.openModal(S.investments.find(v=>v.id===id));
      tr.querySelector(".btn-del-i").onclick = ()=>{
        UI.confirm("Essa ação não pode ser desfeita.", ()=>{ Store.deleteInvestment(id); UI.toast("Investimento excluído."); App.rerender(); }, {title:"Excluir investimento"});
      };
    });

    Charts.renderInvestEvolution("investChart", sum.rows);
  },

  openModal(existing=null){
    const v = existing || {date:todayStr(), institution:"", name:"", type:"CDB", invested:0, contributions:0, withdrawals:0, currentValue:0};
    const types = ["CDB","Tesouro Direto","Fundo","Ações","ETF","Criptomoedas","Poupança","Outros"];
    UI.openModal(`
      <div class="modal-head"><h3>${existing?"Editar investimento":"Novo investimento"}</h3><button class="icon-btn" id="closeI"><i data-lucide="x"></i></button></div>
      <div class="modal-body">
        <div class="field"><label>Nome</label><input id="i_name" value="${escapeHtml(v.name)}" placeholder="Ex: CDB 110% CDI"/></div>
        <div class="field-row">
          <div class="field"><label>Instituição</label><input id="i_inst" value="${escapeHtml(v.institution)}"/></div>
          <div class="field"><label>Tipo</label><select id="i_type">${types.map(t=>`<option ${t===v.type?'selected':''}>${t}</option>`).join("")}</select></div>
        </div>
        <div class="field-row">
          <div class="field"><label>Valor investido (R$)</label><input type="number" id="i_invested" value="${v.invested}"/></div>
          <div class="field"><label>Aportes (R$)</label><input type="number" id="i_contrib" value="${v.contributions}"/></div>
        </div>
        <div class="field-row">
          <div class="field"><label>Resgates (R$)</label><input type="number" id="i_withdraw" value="${v.withdrawals}"/></div>
          <div class="field"><label>Valor atual (R$)</label><input type="number" id="i_current" value="${v.currentValue}"/></div>
        </div>
        <div class="field"><label>Data</label><input type="date" id="i_date" value="${v.date}"/></div>
      </div>
      <div class="modal-foot">
        <button class="btn btn-secondary btn-block" id="cancelI">Cancelar</button>
        <button class="btn btn-primary btn-block" id="saveI">Salvar</button>
      </div>
    `, { onMount(root){
      root.querySelector("#closeI").onclick = ()=>UI.closeModal();
      root.querySelector("#cancelI").onclick = ()=>UI.closeModal();
      root.querySelector("#saveI").onclick = ()=>{
        const payload = {
          name: root.querySelector("#i_name").value.trim() || "Investimento",
          institution: root.querySelector("#i_inst").value,
          type: root.querySelector("#i_type").value,
          invested: Number(root.querySelector("#i_invested").value)||0,
          contributions: Number(root.querySelector("#i_contrib").value)||0,
          withdrawals: Number(root.querySelector("#i_withdraw").value)||0,
          currentValue: Number(root.querySelector("#i_current").value)||0,
          date: root.querySelector("#i_date").value || todayStr(),
        };
        if(existing){ Store.updateInvestment(existing.id, payload); UI.toast("Investimento atualizado."); }
        else { Store.addInvestment(payload); UI.toast("Investimento adicionado."); }
        UI.closeModal(); App.rerender();
      };
    }});
  }
};
