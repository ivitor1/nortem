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
          ${Store.cloud.enabled ? `
            <div style="margin-top:16px; padding-top:16px; border-top:1px solid var(--border);">
              <div style="font-size:12.5px; color:var(--ink-soft);">Conectado como</div>
              <div style="font-weight:600; font-size:13.5px; margin:2px 0 10px;">${escapeHtml(Store.cloud.userEmail||"")}</div>
              <button class="btn btn-ghost btn-sm" id="logoutBtn"><i data-lucide="log-out"></i>Sair da conta</button>
            </div>
          ` : ""}
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

      <div class="section-head"><h2>👥 Login e contas de usuário</h2></div>
      <div class="card">
        ${Store.cloud.enabled ? `
          <p style="font-size:12.5px; color:var(--accent-strong); font-weight:600; margin-bottom:6px;">
            <i data-lucide="check-circle" style="width:14px;height:14px;display:inline;vertical-align:-2px;"></i>
            Login na nuvem ativo
          </p>
          <p style="font-size:12.5px; color:var(--ink-soft);">
            Cada pessoa que abrir o link cria a própria conta e vê apenas os próprios dados, de qualquer
            dispositivo. Seus dados são salvos automaticamente na nuvem a cada alteração.
          </p>
        ` : `
          <p style="font-size:12.5px; color:var(--ink-soft); margin-bottom:12px;">
            <b style="color:var(--ink)">O app está em modo local.</b> Não há tela de login porque os dados
            ficam salvos só neste navegador — é o comportamento esperado enquanto a nuvem não estiver
            configurada. A tela de criar conta <b style="color:var(--ink)">já está pronta no código</b>,
            mas ela só aparece depois que você conectar um banco de dados (Supabase, gratuito).
          </p>
          <p style="font-size:12.5px; color:var(--ink-soft); margin-bottom:12px;">
            São 4 passos (~5 min): criar o projeto no Supabase, rodar um SQL que já está pronto, copiar
            2 chaves e colar no arquivo <code style="background:var(--surface-2); padding:2px 6px; border-radius:5px;">js/supabase-config.js</code>.
            O passo a passo completo está no <b style="color:var(--ink)">README.md</b> do projeto, na seção
            "Login multiusuário".
          </p>
          <button class="btn btn-secondary btn-sm" id="cloudSetupInfo"><i data-lucide="key-round"></i>Ver o passo a passo aqui</button>
        `}
      </div>

      <div class="section-head"><h2>🏦 Conectar conta bancária</h2></div>
      <div class="card">
        <p style="font-size:12.5px; color:var(--ink-soft); margin-bottom:12px;">
          Puxar extratos automaticamente do seu banco (Open Finance) exige passar pela conexão de um
          agregador financeiro autorizado pelo Banco Central — não é algo que dá pra simular sem essa peça.
          Isso ainda não está conectado aqui. O caminho mais comum para um app assim é o
          <a href="https://pluggy.ai" target="_blank" rel="noopener" style="color:var(--accent-strong); font-weight:600;">Pluggy</a>
          (tem sandbox gratuito para testes). Enquanto isso, use a <b>Importação de extrato em PDF</b>
          (na página Lançamentos) ou o assistente de IA para registrar gastos rapidamente.
        </p>
        <button class="btn btn-secondary btn-sm" id="bankConnectInfo"><i data-lucide="info"></i>Como isso funcionaria</button>
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
    document.getElementById("logoutBtn")?.addEventListener("click", ()=>{
      UI.confirm("Você precisará entrar novamente com seu e-mail e senha.", ()=>Auth.logout(), {title:"Sair da conta", confirmLabel:"Sair", danger:false});
    });
    document.getElementById("cloudSetupInfo")?.addEventListener("click", ()=>{
      UI.openModal(`
        <div class="modal-head"><h3>Ativar login de usuários</h3><button class="icon-btn" id="closeCloud"><i data-lucide="x"></i></button></div>
        <div class="modal-body" style="font-size:13px; line-height:1.65; color:var(--ink-soft);">
          <p><b style="color:var(--ink)">1.</b> Crie uma conta grátis em <b style="color:var(--ink)">supabase.com</b> e clique em "New Project".</p>
          <p><b style="color:var(--ink)">2.</b> Vá em <b style="color:var(--ink)">SQL Editor → New query</b>, cole o código abaixo e execute:</p>
          <pre style="background:var(--surface-2); padding:12px; border-radius:10px; font-size:11px; overflow-x:auto; white-space:pre; color:var(--ink);">create table if not exists public.app_state (
  user_id uuid references auth.users(id) primary key,
  data jsonb not null,
  updated_at timestamptz default now()
);
alter table public.app_state enable row level security;
create policy "select own" on public.app_state
  for select using (auth.uid() = user_id);
create policy "insert own" on public.app_state
  for insert with check (auth.uid() = user_id);
create policy "update own" on public.app_state
  for update using (auth.uid() = user_id);</pre>
          <p><b style="color:var(--ink)">3.</b> Em <b style="color:var(--ink)">Project Settings → API</b>, copie a "Project URL" e a chave "anon public".</p>
          <p><b style="color:var(--ink)">4.</b> Abra o arquivo <b style="color:var(--ink)">js/supabase-config.js</b> e cole as duas:</p>
          <pre style="background:var(--surface-2); padding:12px; border-radius:10px; font-size:11px; overflow-x:auto; color:var(--ink);">window.SUPABASE_URL = "https://SEUPROJETO.supabase.co";
window.SUPABASE_ANON_KEY = "sua-chave-anon";</pre>
          <p><b style="color:var(--ink)">5.</b> Em <b style="color:var(--ink)">Authentication → Providers → Email</b>, desmarque "Confirm email" (facilita o primeiro acesso).</p>
          <p><b style="color:var(--ink)">6.</b> Publique de novo no Vercel. A tela de criar conta vai aparecer para todo mundo que abrir o link.</p>
          <p style="margin-top:10px; color:var(--ink-faint); font-size:12px;">A chave "anon" pode ficar pública no site — sozinha ela não acessa nada, quem controla o acesso são as regras do passo 2.</p>
        </div>
      `, {size:"lg", onMount(root){ root.querySelector("#closeCloud").onclick = ()=>UI.closeModal(); }});
    });
    document.getElementById("bankConnectInfo").onclick = ()=>{
      UI.openModal(`
        <div class="modal-head"><h3>Conexão bancária — como funcionaria</h3><button class="icon-btn" id="closeBank"><i data-lucide="x"></i></button></div>
        <div class="modal-body" style="font-size:13px; line-height:1.7; color:var(--ink-soft);">
          <p><b style="color:var(--ink)">1.</b> Você cria uma conta grátis num agregador (ex: Pluggy) e pega uma chave de API.</p>
          <p><b style="color:var(--ink)">2.</b> Uma função de servidor (o projeto já está pronto para hospedar isso em Vercel Functions) troca essa chave por um token de conexão.</p>
          <p><b style="color:var(--ink)">3.</b> Você autoriza seu banco pelo widget do agregador (é ele que fala com o banco, o app nunca vê sua senha do banco).</p>
          <p><b style="color:var(--ink)">4.</b> O agregador devolve os extratos, e o app converte cada um em um lançamento — do mesmo jeito que a importação de PDF já faz hoje.</p>
          <p style="margin-top:10px;">Isso ainda não está plugado nesta versão porque depende da sua própria conta no agregador — não é algo que eu consiga criar por você.</p>
        </div>
      `, {onMount(root){ root.querySelector("#closeBank").onclick = ()=>UI.closeModal(); }});
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
