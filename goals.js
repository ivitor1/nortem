/* =====================================================================
   GOALS VIEW — "Minhas metas"
   ===================================================================== */

const GoalsView = {
  render(container){
    const goals = Store.goalsList();

    container.innerHTML = `
      <div class="section-head" style="margin-top:0;">
        <h2>Minhas metas</h2>
        <button class="btn btn-secondary btn-sm" id="addGoalBtn"><i data-lucide="plus"></i>Nova meta</button>
      </div>

      ${goals.length===0 ? `<div class="empty-state"><i data-lucide="target"></i><h4>Nenhuma meta cadastrada</h4><p>Defina metas para acompanhar seu progresso automaticamente.</p></div>` : `
      <div class="grid-3">
        ${goals.map(g=>`
          <div class="card goal-card" data-goal="${g.id}">
            <div class="g-head"><span class="g-icon">${g.icon||"🎯"}</span><span class="g-title">${escapeHtml(g.name)}</span></div>
            <div class="progress green"><span style="width:${g.pctConcluido*100}%"></span></div>
            <div class="g-nums"><span>${money(g.current)} de ${money(g.target)}</span><b class="num">${pct(g.pctConcluido)}</b></div>
            <div class="g-remain">${g.pctConcluido>=1 ? "🎉 Meta concluída!" : `Faltam ${money(g.remaining)} · ${money(g.mensalNecessario)}/mês para o prazo`}</div>
            <div style="display:flex; gap:6px; margin-top:4px;">
              <button class="btn btn-secondary btn-sm btn-contribute" style="flex:1;"><i data-lucide="plus"></i>Adicionar valor</button>
              <button class="icon-btn btn-edit-g"><i data-lucide="pencil"></i></button>
              <button class="icon-btn btn-del-g"><i data-lucide="trash-2"></i></button>
            </div>
          </div>
        `).join("")}
      </div>`}
    `;

    document.getElementById("addGoalBtn").onclick = ()=>this.openModal();
    container.querySelectorAll("[data-goal]").forEach(card=>{
      const id = card.dataset.goal;
      const g = Store.state.goals.find(x=>x.id===id);
      card.querySelector(".btn-contribute").onclick = ()=>this.openContributeModal(g);
      card.querySelector(".btn-edit-g").onclick = ()=>this.openModal(g);
      card.querySelector(".btn-del-g").onclick = ()=>{
        UI.confirm("Essa ação não pode ser desfeita.", ()=>{ Store.deleteGoal(id); UI.toast("Meta excluída."); App.rerender(); }, {title:"Excluir meta"});
      };
    });
  },

  openContributeModal(g){
    UI.openModal(`
      <div class="modal-head"><h3>Adicionar valor — ${escapeHtml(g.name)}</h3><button class="icon-btn" id="closeK"><i data-lucide="x"></i></button></div>
      <div class="modal-body">
        <div class="field"><label>Valor (R$)</label><input type="number" id="k_val" min="0" step="10" placeholder="0,00"/></div>
      </div>
      <div class="modal-foot">
        <button class="btn btn-secondary btn-block" id="cancelK">Cancelar</button>
        <button class="btn btn-primary btn-block" id="saveK">Adicionar</button>
      </div>
    `, { onMount(root){
      root.querySelector("#closeK").onclick = ()=>UI.closeModal();
      root.querySelector("#cancelK").onclick = ()=>UI.closeModal();
      root.querySelector("#saveK").onclick = ()=>{
        const val = Number(root.querySelector("#k_val").value)||0;
        if(val<=0){ UI.toast("Informe um valor válido.", {error:true}); return; }
        Store.contributeGoal(g.id, val);
        UI.closeModal();
        const updated = Store.state.goals.find(x=>x.id===g.id);
        if(updated.current >= updated.target) UI.toast(`🎉 Parabéns! Você atingiu sua meta "${updated.name}".`);
        else UI.toast("Valor adicionado à meta.");
        App.rerender();
      };
    }});
  },

  openModal(existing=null){
    const g = existing || {icon:"🎯", name:"", target:0, current:0, deadlineMonths:12};
    const iconOptions = ["🎯","🛟","✈️","🏠","🚗","🎓","💍","👶","🩺","🏖️"];
    UI.openModal(`
      <div class="modal-head"><h3>${existing?"Editar meta":"Nova meta"}</h3><button class="icon-btn" id="closeG"><i data-lucide="x"></i></button></div>
      <div class="modal-body">
        <div class="field">
          <label>Ícone</label>
          <select id="g_icon">${iconOptions.map(i=>`<option ${i===g.icon?'selected':''}>${i}</option>`).join("")}</select>
        </div>
        <div class="field"><label>Nome da meta</label><input id="g_name" value="${escapeHtml(g.name)}" placeholder="Ex: Reserva de emergência"/></div>
        <div class="field-row">
          <div class="field"><label>Valor objetivo (R$)</label><input type="number" id="g_target" value="${g.target}"/></div>
          <div class="field"><label>Valor atual (R$)</label><input type="number" id="g_current" value="${g.current}"/></div>
        </div>
        <div class="field"><label>Prazo (meses)</label><input type="number" min="1" id="g_deadline" value="${g.deadlineMonths}"/></div>
      </div>
      <div class="modal-foot">
        <button class="btn btn-secondary btn-block" id="cancelG">Cancelar</button>
        <button class="btn btn-primary btn-block" id="saveG">Salvar</button>
      </div>
    `, { onMount(root){
      root.querySelector("#closeG").onclick = ()=>UI.closeModal();
      root.querySelector("#cancelG").onclick = ()=>UI.closeModal();
      root.querySelector("#saveG").onclick = ()=>{
        const payload = {
          icon: root.querySelector("#g_icon").value,
          name: root.querySelector("#g_name").value.trim() || "Nova meta",
          target: Number(root.querySelector("#g_target").value)||0,
          current: Number(root.querySelector("#g_current").value)||0,
          deadlineMonths: Number(root.querySelector("#g_deadline").value)||1,
        };
        if(existing){ Store.updateGoal(existing.id, payload); UI.toast("Meta atualizada."); }
        else { Store.addGoal(payload); UI.toast("Meta criada."); }
        UI.closeModal(); App.rerender();
      };
    }});
  }
};
