/* =====================================================================
   ACCOUNTS VIEW — "Minhas contas"
   ===================================================================== */

const AccountsView = {
  icons: { "Conta corrente":"landmark", "Conta digital":"smartphone", "Poupança":"piggy-bank", "Conta de investimentos":"trending-up", "Carteira/dinheiro":"wallet" },

  render(container){
    const S = Store.state;
    const total = Store.accountsTotal();

    container.innerHTML = `
      <div class="section-head" style="margin-top:0;">
        <h2>Minhas contas</h2>
        <button class="btn btn-secondary btn-sm" id="addAccBtn"><i data-lucide="plus"></i>Nova conta</button>
      </div>

      <div class="card" style="margin-bottom:20px; display:flex; justify-content:space-between; align-items:center;">
        <div>
          <div class="card-title">Patrimônio líquido</div>
          <div style="font-family:var(--font-display); font-size:26px; font-weight:700;">${money(Store.patrimonioLiquido())}</div>
        </div>
        <div style="text-align:right; color:var(--ink-soft); font-size:12.5px;">Contas + Investimentos − Dívidas</div>
      </div>

      ${S.accounts.length===0 ? `<div class="empty-state"><i data-lucide="wallet"></i><h4>Nenhuma conta cadastrada</h4><p>Cadastre suas contas para ver o saldo consolidado.</p></div>` : `
      <div class="grid-3">
        ${S.accounts.map(a=>{
          const bal = Store.accountBalance(a.id);
          return `
          <div class="card account-card" data-acc="${a.id}">
            <div class="acc-icon"><i data-lucide="${this.icons[a.type]||'wallet'}"></i></div>
            <div style="flex:1;">
              <div class="acc-name">${escapeHtml(a.name)} · ${escapeHtml(a.bank||"")}</div>
              <div class="acc-value num">${money(bal)}</div>
            </div>
            <div style="display:flex; flex-direction:column; gap:4px;">
              <button class="icon-btn btn-edit-acc" title="Editar"><i data-lucide="pencil"></i></button>
              <button class="icon-btn btn-del-acc" title="Remover"><i data-lucide="trash-2"></i></button>
            </div>
          </div>`;
        }).join("")}
      </div>
      <div style="margin-top:14px; text-align:right; font-size:13px; color:var(--ink-soft);">Total distribuído entre contas: <b style="color:var(--ink)">${money(total)}</b></div>
      `}
    `;

    document.getElementById("addAccBtn").onclick = ()=>this.openModal();
    container.querySelectorAll("[data-acc]").forEach(el=>{
      const id = el.dataset.acc;
      el.querySelector(".btn-edit-acc").onclick = ()=>this.openModal(S.accounts.find(a=>a.id===id));
      el.querySelector(".btn-del-acc").onclick = ()=>{
        UI.confirm("A conta será removida. Lançamentos associados continuam no histórico.", ()=>{
          Store.deleteAccount(id); UI.toast("Conta removida."); App.rerender();
        }, {title:"Remover conta"});
      };
    });
  },

  openModal(existing=null){
    const a = existing || {name:"", bank:"", type:"Conta corrente", initialBalance:0};
    const types = Object.keys(this.icons);
    UI.openModal(`
      <div class="modal-head"><h3>${existing?"Editar conta":"Nova conta"}</h3><button class="icon-btn" id="closeA"><i data-lucide="x"></i></button></div>
      <div class="modal-body">
        <div class="field"><label>Nome da conta</label><input id="a_name" value="${escapeHtml(a.name)}" placeholder="Ex: Conta Corrente"/></div>
        <div class="field"><label>Banco</label><input id="a_bank" value="${escapeHtml(a.bank)}"/></div>
        <div class="field"><label>Tipo</label><select id="a_type">${types.map(t=>`<option ${t===a.type?'selected':''}>${t}</option>`).join("")}</select></div>
        <div class="field"><label>Saldo inicial (R$)</label><input type="number" id="a_balance" value="${a.initialBalance}"/></div>
      </div>
      <div class="modal-foot">
        <button class="btn btn-secondary btn-block" id="cancelA">Cancelar</button>
        <button class="btn btn-primary btn-block" id="saveA">Salvar</button>
      </div>
    `, { onMount(root){
      root.querySelector("#closeA").onclick = ()=>UI.closeModal();
      root.querySelector("#cancelA").onclick = ()=>UI.closeModal();
      root.querySelector("#saveA").onclick = ()=>{
        const payload = {
          name: root.querySelector("#a_name").value.trim() || "Conta",
          bank: root.querySelector("#a_bank").value,
          type: root.querySelector("#a_type").value,
          initialBalance: Number(root.querySelector("#a_balance").value)||0,
        };
        if(existing){ Store.updateAccount(existing.id, payload); UI.toast("Conta atualizada."); }
        else { Store.addAccount(payload); UI.toast("Conta adicionada."); }
        UI.closeModal(); App.rerender();
      };
    }});
  }
};
