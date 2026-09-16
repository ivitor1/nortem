/* =====================================================================
   UI — toasts, generic modal/confirm helpers, and the transaction form
   (the single "Novo lançamento" modal used everywhere in the app)
   ===================================================================== */

const UI = {
  toast(text, opts={}){
    const root = document.getElementById("toastRoot");
    const el = document.createElement("div");
    el.className = "toast" + (opts.error ? " error" : "");
    el.innerHTML = `<i data-lucide="${opts.icon || (opts.error ? 'x-circle' : 'check-circle')}"></i><span>${escapeHtml(text)}</span>`;
    root.appendChild(el);
    initIcons();
    setTimeout(()=>{ el.style.opacity="0"; el.style.transform="translateY(6px)"; el.style.transition="all .2s ease"; setTimeout(()=>el.remove(),200); }, 2600);
  },

  openModal(innerHtml, {size="md", onMount}={}){
    this.closeModal();
    const root = document.getElementById("modalRoot");
    const backdrop = document.createElement("div");
    backdrop.className = "modal-backdrop";
    backdrop.id = "activeModalBackdrop";
    backdrop.innerHTML = `<div class="modal ${size==='lg'?'modal-lg':''}">${innerHtml}</div>`;
    backdrop.addEventListener("mousedown", (e)=>{ if(e.target===backdrop) this.closeModal(); });
    root.appendChild(backdrop);
    initIcons();
    if(onMount) onMount(backdrop);
    document.addEventListener("keydown", this._escHandler = (e)=>{ if(e.key==="Escape") this.closeModal(); });
  },
  closeModal(){
    const el = document.getElementById("activeModalBackdrop");
    if(el) el.remove();
    if(this._escHandler) document.removeEventListener("keydown", this._escHandler);
  },

  confirm(message, onConfirm, {title="Tem certeza?", confirmLabel="Excluir", danger=true}={}){
    this.openModal(`
      <div class="modal-body">
        <div class="confirm-icon"><i data-lucide="alert-triangle"></i></div>
        <h3 style="font-family:var(--font-display); font-size:16px; margin-top:14px;">${escapeHtml(title)}</h3>
        <p style="color:var(--ink-soft); font-size:13.5px; margin-top:6px;">${escapeHtml(message)}</p>
      </div>
      <div class="modal-foot">
        <button class="btn btn-secondary btn-block" id="cancelConfirm">Cancelar</button>
        <button class="btn ${danger?'btn-danger':'btn-primary'} btn-block" id="okConfirm">${escapeHtml(confirmLabel)}</button>
      </div>
    `, { size:"sm" });
    document.querySelector(".modal").classList.add("confirm");
    document.getElementById("cancelConfirm").onclick = ()=>this.closeModal();
    document.getElementById("okConfirm").onclick = ()=>{ this.closeModal(); onConfirm(); };
  },

  // ------------------------------------------------------- theme toggle
  applyTheme(theme){
    document.documentElement.setAttribute("data-theme", theme);
    const btn = document.getElementById("themeToggle");
    if(btn){
      btn.innerHTML = theme==="dark"
        ? `<i data-lucide="sun"></i><span>Modo claro</span>`
        : `<i data-lucide="moon"></i><span>Modo escuro</span>`;
      initIcons();
    }
  },

  // ================================================= TRANSACTION MODAL
  openTransactionModal(existing=null){
    const S = Store.state;
    const isEdit = !!existing;
    const t = existing || {
      type:"Despesa", description:"", value:"", category:"", subcategory:"",
      accountId: S.accounts[0]?.id || "", paymentMethod:"Débito", cardId:"",
      status:"Pago", fixed:false, date: todayStr(), dueDate: todayStr(),
      installments:1, notes:""
    };

    const catOptions = (type) => type==="Receita" ? RECEITA_CATS : Object.keys(DESPESA_CATS);
    const subOptions = (cat) => DESPESA_CATS[cat] || [];

    const html = `
      <div class="modal-head">
        <h3>${isEdit ? "Editar lançamento" : "Novo lançamento"}</h3>
        <button class="icon-btn" id="closeTxModal"><i data-lucide="x"></i></button>
      </div>
      <div class="modal-body">
        <div class="segmented" id="typeSeg">
          ${["Receita","Despesa","Transferência"].map(ty => `
            <button type="button" data-type="${ty}" class="${t.type===ty?'active':''}">${ty==="Receita"?"🔵":ty==="Despesa"?"🔴":"🟡"} ${ty}</button>
          `).join("")}
        </div>

        <div class="field">
          <label>Descrição</label>
          <input type="text" id="f_desc" placeholder="Ex: Mercado" value="${escapeHtml(t.description)}" />
        </div>

        <div class="field-row">
          <div class="field">
            <label>Valor (R$)</label>
            <input type="number" id="f_value" step="0.01" min="0" placeholder="0,00" value="${t.value||""}" />
          </div>
          <div class="field">
            <label>Data</label>
            <input type="date" id="f_date" value="${t.date}" />
          </div>
        </div>

        <div class="field-row">
          <div class="field">
            <label>Categoria</label>
            <select id="f_cat"><option value="">Selecione</option>${catOptions(t.type).map(c=>`<option value="${c}" ${c===t.category?'selected':''}>${c}</option>`).join("")}</select>
          </div>
          <div class="field" id="subWrap" style="${t.type==='Receita'?'display:none':''}">
            <label>Subcategoria</label>
            <select id="f_sub"><option value="">Selecione</option>${subOptions(t.category).map(c=>`<option value="${c}" ${c===t.subcategory?'selected':''}>${c}</option>`).join("")}</select>
          </div>
        </div>

        <div class="field-row">
          <div class="field">
            <label>Conta</label>
            <select id="f_account"><option value="">—</option>${S.accounts.map(a=>`<option value="${a.id}" ${a.id===t.accountId?"selected":""}>${escapeHtml(a.name)}</option>`).join("")}</select>
          </div>
          <div class="field">
            <label>Forma de pagamento</label>
            <select id="f_payment">${["Dinheiro","Débito","Crédito","PIX","Transferência","Boleto"].map(p=>`<option ${p===t.paymentMethod?'selected':''}>${p}</option>`).join("")}</select>
          </div>
        </div>

        <div class="field" id="cardWrap" style="${t.paymentMethod==='Crédito'?'':'display:none'}">
          <label>Cartão</label>
          <select id="f_card"><option value="">Selecione</option>${S.cards.map(c=>`<option value="${c.id}" ${c.id===t.cardId?'selected':''}>${escapeHtml(c.name)}</option>`).join("")}</select>
        </div>

        <div class="field-row">
          <div class="field">
            <label>Status</label>
            <select id="f_status">${["Pago","Pendente","Agendado"].map(s=>`<option ${s===t.status?'selected':''}>${s}</option>`).join("")}</select>
          </div>
          <div class="field">
            <label>&nbsp;</label>
            <div class="checkbox-row"><input type="checkbox" id="f_fixed" ${t.fixed?'checked':''}/> Despesa fixa</div>
          </div>
        </div>

        <div class="field" id="installWrap" style="${t.paymentMethod==='Crédito' && !isEdit ? '' : 'display:none'}">
          <div class="checkbox-row"><input type="checkbox" id="f_installCheck" ${t.installments>1?'checked':''}/> Compra parcelada</div>
          <div id="installNumWrap" style="${t.installments>1?'':'display:none'}; margin-top:10px;">
            <label style="font-size:12.5px; font-weight:600; color:var(--ink-soft);">Número de parcelas</label>
            <input type="number" id="f_installments" min="2" max="48" value="${t.installments>1?t.installments:12}" style="margin-top:6px; padding:11px 13px; border-radius:11px; border:1.5px solid var(--border); width:100%;" />
            <div class="installment-preview" id="installPreview" style="margin-top:10px;"></div>
          </div>
        </div>

        <div class="field">
          <label>Observações</label>
          <textarea id="f_notes" rows="2" placeholder="Opcional">${escapeHtml(t.notes||"")}</textarea>
        </div>
      </div>
      <div class="modal-foot">
        <button class="btn btn-secondary btn-block" id="cancelTx">Cancelar</button>
        <button class="btn btn-primary btn-block" id="saveTx"><i data-lucide="check"></i>Salvar</button>
      </div>
    `;

    UI.openModal(html, { onMount(root){
      let curType = t.type, curCat = t.category, curPayment = t.paymentMethod;

      root.querySelector("#closeTxModal").onclick = ()=>UI.closeModal();
      root.querySelector("#cancelTx").onclick = ()=>UI.closeModal();

      root.querySelectorAll("#typeSeg button").forEach(btn=>{
        btn.onclick = ()=>{
          curType = btn.dataset.type;
          root.querySelectorAll("#typeSeg button").forEach(b=>b.classList.toggle("active", b===btn));
          const catSel = root.querySelector("#f_cat");
          catSel.innerHTML = `<option value="">Selecione</option>` + catOptions(curType).map(c=>`<option value="${c}">${c}</option>`).join("");
          root.querySelector("#subWrap").style.display = curType==="Receita" ? "none" : "";
          renderSub();
        };
      });

      function renderSub(){
        const cat = root.querySelector("#f_cat").value;
        const subSel = root.querySelector("#f_sub");
        subSel.innerHTML = `<option value="">Selecione</option>` + subOptions(cat).map(c=>`<option value="${c}">${c}</option>`).join("");
      }
      root.querySelector("#f_cat").onchange = renderSub;

      root.querySelector("#f_payment").onchange = (e)=>{
        curPayment = e.target.value;
        const isCredit = curPayment === "Crédito";
        root.querySelector("#cardWrap").style.display = isCredit ? "" : "none";
        root.querySelector("#installWrap").style.display = (isCredit && !isEdit) ? "" : "none";
      };

      root.querySelector("#f_installCheck").onchange = (e)=>{
        root.querySelector("#installNumWrap").style.display = e.target.checked ? "" : "none";
        updatePreview();
      };
      root.querySelector("#f_installments")?.addEventListener("input", updatePreview);
      function updatePreview(){
        const n = Number(root.querySelector("#f_installments").value)||0;
        const val = Number(root.querySelector("#f_value").value)||0;
        const per = n>0 ? (val/n) : 0;
        const prev = root.querySelector("#installPreview");
        if(!prev) return;
        let items = [];
        for(let i=1;i<=Math.min(n,6);i++) items.push(`${i}/${n} · ${money(per)}`);
        if(n>6) items.push(`… +${n-6}`);
        prev.innerHTML = items.map(x=>`<span>${x}</span>`).join("");
      }
      root.querySelector("#f_value").addEventListener("input", updatePreview);
      updatePreview();

      root.querySelector("#saveTx").onclick = ()=>{
        const desc = root.querySelector("#f_desc").value.trim();
        const value = Number(root.querySelector("#f_value").value);
        const date = root.querySelector("#f_date").value;
        const category = root.querySelector("#f_cat").value;
        const subcategory = root.querySelector("#f_sub") ? root.querySelector("#f_sub").value : "";
        const accountId = root.querySelector("#f_account").value || null;
        const paymentMethod = root.querySelector("#f_payment").value;
        const cardId = root.querySelector("#f_card") ? (root.querySelector("#f_card").value || null) : null;
        const status = root.querySelector("#f_status").value;
        const fixed = root.querySelector("#f_fixed").checked;
        const notes = root.querySelector("#f_notes").value;
        const installCheck = root.querySelector("#f_installCheck")?.checked;
        const installments = installCheck ? Number(root.querySelector("#f_installments").value)||1 : 1;

        if(!desc || !value || value<=0 || !date || !category){
          UI.toast("Preencha descrição, valor, data e categoria.", {error:true});
          return;
        }

        const payload = {
          type: curType, description: desc, value, date, dueDate: date,
          category, subcategory, accountId, paymentMethod,
          cardId: paymentMethod==="Crédito" ? cardId : null,
          status, fixed, notes,
          installments: isEdit ? existing.installments : (installments||1),
          installmentNum: isEdit ? existing.installmentNum : 1,
          groupId: existing ? existing.groupId : null
        };

        if(isEdit){
          Store.updateTransaction(existing.id, payload);
          UI.toast("Lançamento atualizado com sucesso.");
        } else {
          Store.addTransaction(payload);
          UI.toast("Lançamento adicionado com sucesso.");
        }
        UI.closeModal();
        App.rerender();
      };
    }});
  },
};
