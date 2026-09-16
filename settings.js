/* =====================================================================
   SETTINGS VIEW — "Configurações"
   ===================================================================== */

const SettingsView = {
  render(container){
    const S = Store.state;

    container.innerHTML = `
      <div class="section-head" style="margin-top:0;"><h2>Configurações</h2></div>

      <div class="grid-2">
        <div class="card">
          <div class="card-title" style="margin-bottom:12px;">Perfil</div>
          <div class="field"><label>Seu nome</label><input id="s_name" value="${escapeHtml(S.profile.name)}"/></div>
          <button class="btn btn-primary btn-sm" id="saveProfile" style="margin-top:12px;">Salvar</button>
        </div>

        <div class="card">
          <div class="card-title" style="margin-bottom:12px;">Regra 50/30/20</div>
          <p style="font-size:12.5px; color:var(--ink-soft); margin-bottom:10px;">Usada para classificar categorias em Necessidades, Desejos e Investimentos/Metas.</p>
          <div class="field-row">
            <div class="field"><label>Necessidades (%)</label><input type="number" id="r_nec" value="${Math.round(S.settings.ruleNecessidades*100)}"/></div>
            <div class="field"><label>Desejos (%)</label><input type="number" id="r_des" value="${Math.round(S.settings.ruleDesejos*100)}"/></div>
          </div>
          <div class="field" style="margin-top:12px;"><label>Investimentos/Metas (%)</label><input type="number" id="r_inv" value="${Math.round(S.settings.ruleInvestimentos*100)}"/></div>
          <button class="btn btn-primary btn-sm" id="saveRule" style="margin-top:12px;">Salvar regra</button>
        </div>
      </div>

      <div class="section-head"><h2>Categorias</h2></div>
      <div class="card">
        <p style="font-size:12.5px; color:var(--ink-soft); margin-bottom:12px;">Estrutura padrão de categorias e subcategorias de despesa usada nos lançamentos e orçamentos.</p>
        <div class="grid-3">
          ${Object.entries(DESPESA_CATS).map(([cat,subs])=>`
            <div>
              <b style="font-size:13.5px;">${cat}</b>
              <div style="font-size:12px; color:var(--ink-soft); margin-top:4px; line-height:1.7;">${subs.join(" · ")}</div>
            </div>
          `).join("")}
        </div>
      </div>

      <div class="section-head"><h2>Backup dos meus dados</h2></div>
      <div class="card">
        <div style="display:flex; gap:10px; flex-wrap:wrap;">
          <button class="btn btn-secondary" id="exportJson"><i data-lucide="download"></i>Exportar dados (JSON)</button>
          <button class="btn btn-secondary" id="exportCsv"><i data-lucide="file-spreadsheet"></i>Exportar lançamentos (CSV)</button>
          <label class="btn btn-secondary" style="cursor:pointer;">
            <i data-lucide="upload"></i>Importar dados
            <input type="file" id="importFile" accept="application/json" style="display:none;"/>
          </label>
        </div>
        <p style="font-size:12px; color:var(--ink-faint); margin-top:12px;">O backup é local: exporte periodicamente para não perder seus dados ao trocar de navegador ou dispositivo.</p>
      </div>

      <div class="section-head"><h2 style="color:var(--coral)">Zona de risco</h2></div>
      <div class="card" style="border-color:var(--coral-soft);">
        <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px;">
          <div>
            <b style="font-size:13.5px;">Começar do zero</b>
            <p style="font-size:12.5px; color:var(--ink-soft); margin-top:2px;">Remove todos os dados de demonstração e lançamentos atuais.</p>
          </div>
          <button class="btn btn-danger" id="resetBtn">Apagar tudo</button>
        </div>
      </div>
    `;

    document.getElementById("saveProfile").onclick = ()=>{
      Store.updateProfile({ name: document.getElementById("s_name").value.trim() || "Você" });
      UI.toast("Perfil atualizado."); App.rerender();
    };
    document.getElementById("saveRule").onclick = ()=>{
      Store.updateSettings({
        ruleNecessidades: (Number(document.getElementById("r_nec").value)||0)/100,
        ruleDesejos: (Number(document.getElementById("r_des").value)||0)/100,
        ruleInvestimentos: (Number(document.getElementById("r_inv").value)||0)/100,
      });
      UI.toast("Regra 50/30/20 atualizada.");
    };

    document.getElementById("exportJson").onclick = ()=>{
      const blob = new Blob([JSON.stringify(Store.state, null, 2)], {type:"application/json"});
      this.download(blob, `nortem-backup-${todayStr()}.json`);
      UI.toast("Backup exportado.");
    };
    document.getElementById("exportCsv").onclick = ()=>{
      const rows = [["Data","Tipo","Descrição","Categoria","Subcategoria","Conta","Forma de pagamento","Cartão","Status","Valor","Parcelas"]];
      Store.state.transactions.forEach(t=>{
        const accName = (Store.state.accounts.find(a=>a.id===t.accountId)||{}).name || "";
        const cardName = (Store.state.cards.find(c=>c.id===t.cardId)||{}).name || "";
        rows.push([t.date,t.type,t.description,t.category,t.subcategory,accName,t.paymentMethod,cardName,t.status,t.value,`${t.installmentNum}/${t.installments}`]);
      });
      const csv = rows.map(r=>r.map(v=>`"${String(v??"").replace(/"/g,'""')}"`).join(";")).join("\n");
      this.download(new Blob([csv],{type:"text/csv;charset=utf-8"}), `nortem-lancamentos-${todayStr()}.csv`);
      UI.toast("CSV exportado.");
    };
    document.getElementById("importFile").onchange = (e)=>{
      const file = e.target.files[0]; if(!file) return;
      const reader = new FileReader();
      reader.onload = ()=>{
        try{
          const data = JSON.parse(reader.result);
          if(!data.transactions) throw new Error("formato inválido");
          Store.replaceAll(data);
          UI.toast("Dados importados com sucesso.");
          App.rerender();
        }catch(err){ UI.toast("Arquivo inválido. Verifique se é um backup do Nortem.", {error:true}); }
      };
      reader.readAsText(file);
    };

    document.getElementById("resetBtn").onclick = ()=>{
      UI.confirm("Todos os lançamentos, contas, cartões, dívidas, investimentos e metas serão apagados permanentemente.", ()=>{
        Store.resetToBlank();
        UI.toast("Tudo pronto. Comece a adicionar seus dados.");
        App.rerender();
      }, {title:"Apagar todos os dados", confirmLabel:"Apagar tudo"});
    };
  },

  download(blob, filename){
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
  }
};
