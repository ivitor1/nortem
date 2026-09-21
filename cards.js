/* =====================================================================
   CARDS VIEW — "Meus cartões" + "Compras parceladas"
   ===================================================================== */

const CardsView = {
  render(container){
    const S = Store.state;
    const ym = S.settings.selectedYm;
    const purchases = Store.installmentPurchases();
    const cardName = (id)=> (S.cards.find(c=>c.id===id)||{}).name || "—";

    const gradients = [
      "linear-gradient(135deg,#1F2937,#0B1220)",
      "linear-gradient(135deg,#3E63DD,#1E3A8A)",
      "linear-gradient(135deg,#0FA678,#065F46)",
      "linear-gradient(135deg,#B8892B,#7C5A12)",
      "linear-gradient(135deg,#DB2777,#831843)",
    ];

    container.innerHTML = `
      <div class="section-head" style="margin-top:0;">
        <h2>Meus cartões</h2>
        <button class="btn btn-secondary btn-sm" id="addCardBtn"><i data-lucide="plus"></i>Novo cartão</button>
      </div>

      ${S.cards.length===0 ? `<div class="empty-state"><i data-lucide="credit-card"></i><h4>Nenhum cartão cadastrado</h4><p>Adicione seu primeiro cartão para acompanhar limite e faturas.</p></div>` : `
      <div class="grid-3">
        ${S.cards.map((c,i)=>{
          const u = Store.cardUtilization(c.id, ym);
          const usedPct = u.limite>0 ? clamp(u.utilizado/u.limite,0,1) : 0;
          return `
          <div class="card" data-card="${c.id}">
            <div class="creditcard" style="background:${gradients[i%gradients.length]}">
              <div class="cc-top">
                <div><div class="cc-name">${escapeHtml(c.name)}</div><div class="cc-bank">${escapeHtml(c.bank||"")} · ${escapeHtml(c.flag||"")}</div></div>
                <i data-lucide="wifi" style="width:20px;height:20px; opacity:.8;"></i>
              </div>
              <div class="cc-limits">
                <div>Limite<b>${money(c.limit)}</b></div>
                <div>Disponível<b>${money(u.disponivel)}</b></div>
              </div>
            </div>
            <div class="card-detail">
              <div style="display:flex; justify-content:space-between; font-size:12.5px; color:var(--ink-soft);">
                <span>Utilizado</span><span>${pct(usedPct)}</span>
              </div>
              <div class="progress ${progressTone(usedPct)}"><span style="width:${usedPct*100}%"></span></div>
              <div class="card-meta-row">
                <span>Fatura atual: <b style="color:var(--ink)">${money(u.faturaAtual)}</b></span>
                <span>Fecha dia ${c.closingDay} · Vence dia ${c.dueDay}</span>
              </div>
              <div style="display:flex; gap:6px; margin-top:12px;">
                ${u.faturaAtual>0 ? `<button class="btn btn-secondary btn-sm btn-pay-invoice" style="flex:1;"><i data-lucide="check-circle"></i>Pagar fatura (${money(u.faturaAtual)})</button>` : ""}
                <button class="icon-btn btn-edit-card" title="Editar"><i data-lucide="pencil"></i></button>
                <button class="icon-btn btn-del-card" title="Remover"><i data-lucide="trash-2"></i></button>
              </div>
            </div>
          </div>`;
        }).join("")}
      </div>`}

      <div class="section-head"><h2>📆 Compras parceladas</h2></div>
      ${purchases.length===0 ? `<div class="empty-state"><i data-lucide="layers"></i><h4>Nenhuma compra parcelada</h4><p>Compras parceladas criadas no lançamento aparecem aqui, com a projeção automática das próximas parcelas.</p></div>` : `
      <div class="table-card">
        <table>
          <thead><tr><th>Compra</th><th>Cartão</th><th>Parcela</th><th>Valor da parcela</th><th style="text-align:right;">Restante</th></tr></thead>
          <tbody>
            ${purchases.map(p=>`
              <tr>
                <td data-label="Compra">${escapeHtml(p.description)}</td>
                <td data-label="Cartão">💳 ${cardName(p.cardId)}</td>
                <td data-label="Parcela">${p.current}/${p.total}</td>
                <td data-label="Valor da parcela">${money(p.valorParcela)}</td>
                <td data-label="Restante" style="text-align:right; font-weight:600;">${money(p.restante)}</td>
              </tr>`).join("")}
          </tbody>
        </table>
      </div>`}
    `;

    document.getElementById("addCardBtn").onclick = ()=>this.openCardModal();
    container.querySelectorAll("[data-card]").forEach(el=>{
      const id = el.dataset.card;
      el.querySelector(".btn-edit-card").onclick = ()=>this.openCardModal(S.cards.find(c=>c.id===id));
      el.querySelector(".btn-del-card").onclick = ()=>{
        UI.confirm("O cartão será removido, mas os lançamentos já feitos continuam no histórico.", ()=>{
          Store.deleteCard(id); UI.toast("Cartão removido."); App.rerender();
        }, {title:"Remover cartão"});
      };
      el.querySelector(".btn-pay-invoice")?.addEventListener("click", ()=>{
        this.openPayInvoiceModal(id, ym);
      });
    });
  },

  openPayInvoiceModal(cardId, ym){
    const S = Store.state;
    const u = Store.cardUtilization(cardId, ym);
    if(S.accounts.length === 0){
      UI.confirm(`Isso marca ${money(u.faturaAtual)} em lançamentos como pagos e libera esse valor no limite do cartão. Como você ainda não tem contas cadastradas, não dá para descontar de nenhuma — cadastre uma conta em Contas se quiser que o saldo reflita esse pagamento.`, ()=>{
        const n = Store.payCardInvoice(cardId, ym);
        UI.toast(`Fatura paga — ${n} lançamento(s) atualizados, limite liberado.`);
        App.rerender();
      }, {title:"Pagar fatura", confirmLabel:"Pagar mesmo assim", danger:false});
      return;
    }
    UI.openModal(`
      <div class="modal-head"><h3>Pagar fatura</h3><button class="icon-btn" id="closePay"><i data-lucide="x"></i></button></div>
      <div class="modal-body">
        <p style="font-size:13px; color:var(--ink-soft);">${money(u.faturaAtual)} serão marcados como pagos e o limite do cartão será liberado. De qual conta esse valor vai sair?</p>
        <div class="field"><label>Conta</label><select id="p_account">${S.accounts.map(a=>`<option value="${a.id}">${escapeHtml(a.name)}</option>`).join("")}</select></div>
      </div>
      <div class="modal-foot">
        <button class="btn btn-secondary btn-block" id="cancelPay">Cancelar</button>
        <button class="btn btn-primary btn-block" id="confirmPay">Pagar</button>
      </div>
    `, { onMount(root){
      root.querySelector("#closePay").onclick = ()=>UI.closeModal();
      root.querySelector("#cancelPay").onclick = ()=>UI.closeModal();
      root.querySelector("#confirmPay").onclick = ()=>{
        const accountId = root.querySelector("#p_account").value;
        const n = Store.payCardInvoice(cardId, ym, accountId);
        UI.closeModal();
        UI.toast(`Fatura paga — ${n} lançamento(s) atualizados, limite liberado e saldo da conta descontado.`);
        App.rerender();
      };
    }});
  },

  openCardModal(existing=null){
    const c = existing || {name:"", bank:"", limit:1000, closingDay:5, dueDay:12, flag:"Visa"};
    UI.openModal(`
      <div class="modal-head"><h3>${existing?"Editar cartão":"Novo cartão"}</h3><button class="icon-btn" id="closeC"><i data-lucide="x"></i></button></div>
      <div class="modal-body">
        <div class="field"><label>Nome do cartão</label><input id="c_name" value="${escapeHtml(c.name)}" placeholder="Ex: Nubank"/></div>
        <div class="field-row">
          <div class="field"><label>Banco</label><input id="c_bank" value="${escapeHtml(c.bank)}"/></div>
          <div class="field"><label>Bandeira</label><input id="c_flag" value="${escapeHtml(c.flag)}"/></div>
        </div>
        <div class="field"><label>Limite total (R$)</label><input type="number" id="c_limit" value="${c.limit}"/></div>
        <div class="field-row">
          <div class="field"><label>Dia de fechamento</label><input type="number" min="1" max="31" id="c_closing" value="${c.closingDay}"/></div>
          <div class="field"><label>Dia de vencimento</label><input type="number" min="1" max="31" id="c_due" value="${c.dueDay}"/></div>
        </div>
      </div>
      <div class="modal-foot">
        <button class="btn btn-secondary btn-block" id="cancelC">Cancelar</button>
        <button class="btn btn-primary btn-block" id="saveC">Salvar</button>
      </div>
    `, { onMount(root){
      root.querySelector("#closeC").onclick = ()=>UI.closeModal();
      root.querySelector("#cancelC").onclick = ()=>UI.closeModal();
      root.querySelector("#saveC").onclick = ()=>{
        const payload = {
          name: root.querySelector("#c_name").value.trim() || "Cartão",
          bank: root.querySelector("#c_bank").value,
          flag: root.querySelector("#c_flag").value,
          limit: Number(root.querySelector("#c_limit").value)||0,
          closingDay: Number(root.querySelector("#c_closing").value)||5,
          dueDay: Number(root.querySelector("#c_due").value)||10,
        };
        if(existing){ Store.updateCard(existing.id, payload); UI.toast("Cartão atualizado."); }
        else { Store.addCard(payload); UI.toast("Cartão adicionado."); }
        UI.closeModal(); App.rerender();
      };
    }});
  }
};
