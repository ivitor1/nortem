/* =====================================================================
   SETTINGS VIEW — "Configurações"
   ===================================================================== */

const SettingsView = {
  openCat: null, // which despesa category is expanded in the manager

  render(container){
    const S = Store.state;
    const despesaCats = Object.entries(S.categories.despesa);

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

      <div class="section-head">
        <h2>Categorias e subcategorias</h2>
        <button class="btn btn-secondary btn-sm" id="addCatBtn"><i data-lucide="plus"></i>Nova categoria</button>
      </div>
      <div class="card">
        <p style="font-size:12.5px; color:var(--ink-soft); margin-bottom:14px;">Categorias de despesa — clique para ver/editar as subcategorias.</p>
        <div class="cat-manager">
          ${despesaCats.map(([cat,subs])=>`
            <div class="cat-manager-row" data-cat="${escapeHtml(cat)}">
              <div class="cat-manager-head">
                <button class="cat-expand"><i data-lucide="${this.openCat===cat?'chevron-down':'chevron-right'}"></i><b>${escapeHtml(cat)}</b><span style="color:var(--ink-faint); font-weight:400;">(${subs.length})</span></button>
                <div class="row-actions" style="opacity:1;">
                  <button class="icon-btn btn-rename-cat" title="Renomear"><i data-lucide="pencil"></i></button>
                  <button class="icon-btn btn-del-cat" title="Excluir categoria"><i data-lucide="trash-2"></i></button>
                </div>
              </div>
              ${this.openCat===cat ? `
                <div class="cat-manager-body">
                  ${subs.map(sub=>`
                    <span class="sub-chip" data-sub="${escapeHtml(sub)}">
                      ${escapeHtml(sub)}
                      <button class="sub-rename" title="Renomear"><i data-lucide="pencil"></i></button>
                      <button class="sub-del" title="Excluir"><i data-lucide="x"></i></button>
                    </span>
                  `).join("")}
                  <button class="sub-chip sub-add" id="addSubBtn"><i data-lucide="plus"></i>Subcategoria</button>
                </div>
              ` : ""}
            </div>
          `).join("")}
        </div>

        <p style="font-size:12.5px; color:var(--ink-soft); margin:20px 0 10px;">Categorias de receita</p>
        <div class="cat-manager">
          <div class="cat-manager-body" style="padding:0;">
            ${S.categories.receita.map(cat=>`
              <span class="sub-chip" data-receita-cat="${escapeHtml(cat)}">
                ${escapeHtml(cat)}
                <button class="receita-rename" title="Renomear"><i data-lucide="pencil"></i></button>
                <button class="receita-del" title="Excluir"><i data-lucide="x"></i></button>
              </span>
            `).join("")}
            <button class="sub-chip sub-add" id="addReceitaCatBtn"><i data-lucide="plus"></i>Categoria de receita</button>
          </div>
        </div>
      </div>

      <div class="section-head"><h2>🤖 Assistente com IA</h2></div>
      <div class="card">
        <p style="font-size:12.5px; color:var(--ink-soft); margin-bottom:12px;">
          O assistente (botão flutuante no canto da tela) já consegue registrar lançamentos por texto
          (ex: "gastei 45 no mercado hoje") sem precisar de nada aqui. Para ele também responder dúvidas,
          dar ideias e conversar sobre investimentos usando IA de verdade, cole abaixo uma chave de API da
          Anthropic (console.anthropic.com). A chave fica salva <b>só no seu navegador</b> e as perguntas
          vão direto do seu navegador para a Anthropic — nunca passam por nenhum outro servidor.
        </p>
        <div class="field"><label>Chave da API (Anthropic)</label><input type="password" id="a_key" placeholder="sk-ant-..." value="${escapeHtml(S.assistant.apiKey)}"/></div>
        <div class="field" style="margin-top:12px;"><label>Modelo</label><input id="a_model" value="${escapeHtml(S.assistant.model)}"/></div>
        <div style="display:flex; gap:10px; margin-top:12px;">
          <button class="btn btn-primary btn-sm" id="saveAssistant">Salvar</button>
          <button class="btn btn-ghost btn-sm" id="clearChatBtn"><i data-lucide="eraser"></i>Limpar histórico de conversa</button>
        </div>
        ${!S.assistant.apiKey ? `<p style="font-size:12px; color:var(--ink-faint); margin-top:12px;">Sem chave configurada, o assistente funciona em modo básico: registra lançamentos por texto e responde perguntas simples usando seus dados reais, mas sem a flexibilidade de uma IA completa.</p>` : ""}
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
        <p style="font-size:12px; color:var(--ink-faint); margin-top:12px;">
          O backup é local: seus lançamentos ficam guardados no navegador indefinidamente (não há limite de
          tempo — anos de histórico continuam disponíveis em Lançamentos, filtro "Todo o período"). Ainda
          assim, exporte periodicamente para não perder nada ao trocar de navegador ou computador.
        </p>
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

    this.wire(container);
  },

  wire(container){
    const S = Store.state;

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

    // ---- category manager ----
    document.getElementById("addCatBtn").onclick = ()=>{
      UI.promptText("Nova categoria de despesa", "Nome", "", (name)=>{
        if(Store.addDespesaCategory(name)){ UI.toast("Categoria criada."); App.rerender(); }
        else UI.toast("Não foi possível criar (nome vazio ou já existe).", {error:true});
      });
    };
    document.getElementById("addReceitaCatBtn").onclick = ()=>{
      UI.promptText("Nova categoria de receita", "Nome", "", (name)=>{
        if(Store.addReceitaCategory(name)){ UI.toast("Categoria criada."); App.rerender(); }
        else UI.toast("Não foi possível criar (nome vazio ou já existe).", {error:true});
      });
    };

    container.querySelectorAll(".cat-manager-row").forEach(row=>{
      const cat = row.dataset.cat;
      row.querySelector(".cat-expand").onclick = ()=>{ this.openCat = this.openCat===cat ? null : cat; App.rerender(); };
      row.querySelector(".btn-rename-cat").onclick = ()=>{
        UI.promptText("Renomear categoria", "Nome", cat, (name)=>{
          if(Store.renameDespesaCategory(cat, name)){ UI.toast("Categoria renomeada."); App.rerender(); }
          else UI.toast("Não foi possível renomear.", {error:true});
        });
      };
      row.querySelector(".btn-del-cat").onclick = ()=>{
        UI.confirm(`As subcategorias de "${cat}" serão removidas. Lançamentos antigos mantêm o nome histórico.`, ()=>{
          Store.deleteDespesaCategory(cat); UI.toast("Categoria excluída."); App.rerender();
        }, {title:"Excluir categoria"});
      };
      row.querySelectorAll(".sub-chip[data-sub]").forEach(chip=>{
        const sub = chip.dataset.sub;
        chip.querySelector(".sub-rename").onclick = ()=>{
          UI.promptText("Renomear subcategoria", "Nome", sub, (name)=>{
            if(Store.renameSubcategory(cat, sub, name)){ UI.toast("Subcategoria renomeada."); App.rerender(); }
            else UI.toast("Não foi possível renomear.", {error:true});
          });
        };
        chip.querySelector(".sub-del").onclick = ()=>{
          Store.deleteSubcategory(cat, sub); UI.toast("Subcategoria removida."); App.rerender();
        };
      });
      const addSubBtn = row.querySelector("#addSubBtn");
      if(addSubBtn) addSubBtn.onclick = ()=>{
        UI.promptText(`Nova subcategoria em ${cat}`, "Nome", "", (name)=>{
          if(Store.addSubcategory(cat, name)){ UI.toast("Subcategoria criada."); App.rerender(); }
          else UI.toast("Não foi possível criar.", {error:true});
        });
      };
    });

    container.querySelectorAll(".sub-chip[data-receita-cat]").forEach(chip=>{
      const cat = chip.dataset.receitaCat;
      chip.querySelector(".receita-rename").onclick = ()=>{
        UI.promptText("Renomear categoria de receita", "Nome", cat, (name)=>{
          if(Store.renameReceitaCategory(cat, name)){ UI.toast("Categoria renomeada."); App.rerender(); }
          else UI.toast("Não foi possível renomear.", {error:true});
        });
      };
      chip.querySelector(".receita-del").onclick = ()=>{
        UI.confirm(`A categoria "${cat}" será removida da lista.`, ()=>{
          Store.deleteReceitaCategory(cat); UI.toast("Categoria excluída."); App.rerender();
        }, {title:"Excluir categoria"});
      };
    });

    // ---- assistant ----
    document.getElementById("saveAssistant").onclick = ()=>{
      Store.setAssistantSettings({
        apiKey: document.getElementById("a_key").value.trim(),
        model: document.getElementById("a_model").value.trim() || "claude-haiku-4-5-20251001",
      });
      UI.toast("Configurações do assistente salvas."); App.rerender();
    };
    document.getElementById("clearChatBtn").onclick = ()=>{
      UI.confirm("O histórico de conversa com o assistente será apagado.", ()=>{
        Store.clearChat(); UI.toast("Conversa apagada.");
      }, {title:"Limpar conversa", confirmLabel:"Limpar"});
    };

    // ---- backup ----
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
