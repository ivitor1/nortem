# Nortem — Controle Financeiro Pessoal (Web App)

**Novidades desta versão:** saudação conforme o horário do dia, nova identidade visual (logo + marca), assistente muito mais inteligente (dá orientação priorizada com base nos seus números reais, não só consulta dados), e explicação clara em Configurações sobre como ativar o login de usuários.

**Nesta versão:** assistente com IA agora funciona automaticamente para qualquer pessoa que usar o app (via função de servidor + chave gratuita configurada uma única vez por quem publica); botão de notificações funcional (alertas reais + dicas diárias de economia/renda extra/insights); limite de gastos diário com pop-up de aviso quando ultrapassado.

**Nesta versão:** corrigida uma falha conceitual real no "Saldo" do Dashboard — ele estava somando gastos no cartão de crédito junto com o saldo da conta bancária. Agora "Saldo em contas" mostra só o dinheiro que realmente está nas suas contas, e só diminui quando você de fato paga a fatura (em Cartões, informando de qual conta o valor sai).

**Nesta versão:** importação de PDF reescrita para reconhecer extratos reais (datas por extenso, colunas de débito/crédito/saldo, categorização automática, detecção de movimentação interna) — testada contra um extrato real da Revolut; importação de PDF agora também disponível direto pelo assistente (📎); textos explicativos removidos de Configurações (login e conexão bancária já resolvidos, assistente simplificado).

**Nesta versão:** corrigido o bug do limite do cartão de crédito (uma compra no crédito agora reduz o limite disponível de verdade, e "Pagar fatura" o libera de volta), e novo "Relatório completo" com gráficos/insights/números — não só a lista de lançamentos.

Aplicação web de finanças pessoais em HTML + CSS + JavaScript puro (sem
framework, sem build step), com gráficos via Chart.js, ícones via Lucide,
leitura de PDF via pdf.js e, opcionalmente, login multiusuário + sincronização
na nuvem via Supabase.

Por padrão (sem nenhuma configuração extra) o app roda em **modo local**:
tudo salvo só no navegador de quem está usando, sem login. Ative o **modo
nuvem** (seção abaixo) quando quiser que várias pessoas tenham login próprio
com dados isolados, acessíveis de qualquer aparelho.

## Estrutura do projeto

```
/index.html               → shell da aplicação + tela de login (quando ativada)
/api/assistant.js          → função de servidor: fala com a IA usando uma chave guardada
                              no Vercel, nunca exposta no navegador (veja "Assistente com IA")
/css/styles.css            → design system (tokens, componentes, dark mode, responsivo)
/js/supabase-config.js     → suas credenciais do Supabase (vazio = modo local)
/js/utils.js               → formatação de moeda/data, helpers
/js/store.js               → modelo de dados: local (localStorage) ou nuvem (Supabase),
                              cálculos (totais, orçamento, cartões, dívidas, investimentos,
                              metas, saúde financeira, insights, previsão, limite diário)
/js/auth.js                → tela de login/cadastro e sessão (só ativo em modo nuvem)
/js/ui.js                  → toasts, modais, modal de "Novo lançamento", pop-up de limite diário
/js/charts.js               → wrappers do Chart.js usados pelas páginas
/js/report.js               → relatório completo (números, gráficos, insights) para imprimir/PDF
/js/pdf-import.js          → leitura de extrato em PDF + tela de revisão antes de importar
/js/notifications.js       → painel do sino: alertas reais + dicas diárias
/js/assistant.js            → assistente com IA (registra lançamentos por texto + chat)
/js/views/*.js              → uma página por arquivo (Dashboard, Lançamentos, Orçamentos,
                              Cartões, Contas, Dívidas, Investimentos, Metas, Previsão, Configurações)
/js/app.js                  → roteamento entre páginas e inicialização
```

## Como rodar localmente

1. **Mais simples**: dê duplo clique em `index.html`.
2. **Recomendado**: rode um servidor local dentro da pasta —
   `python3 -m http.server 8080` (depois abra `http://localhost:8080`), ou
   `npx serve .` se tiver Node.

## Como publicar (você já tem isso no Vercel)

Como o projeto é 100% estático, publicar a versão atualizada é só substituir
os arquivos onde já está publicado:

- **Se você conectou um repositório Git ao Vercel**: substitua os arquivos no
  repositório (git add / commit / push) — o Vercel republica sozinho.
- **Se você arrastou a pasta direto no Vercel/Netlify**: arraste a pasta
  atualizada de novo.
- **Vercel CLI**: `vercel --prod` dentro da pasta do projeto.

---

## 🔐 Login multiusuário — JÁ CONFIGURADO ✅

O banco de dados **já está criado e conectado**. Não há nada a fazer aqui.

- **Projeto Supabase:** `nortem` (região São Paulo — sa-east-1, menor latência no Brasil)
- **Plano:** gratuito (R$ 0/mês)
- **Credenciais:** já preenchidas em `js/supabase-config.js`
- **Segurança:** Row Level Security ativo com 4 políticas, testado na prática —
  criei dois usuários fictícios com dados diferentes e confirmei que um não
  enxerga a linha do outro. Depois apaguei os dados de teste.

Ao publicar esta versão, a **tela de login/criar conta aparece automaticamente**.
Cada pessoa cria a própria conta (e-mail + senha), e os dados dela ficam salvos
no servidor, isolados, acessíveis de qualquer aparelho.

### ⚠️ Um ajuste que só você pode fazer (1 minuto)

Por padrão o Supabase exige **confirmação por e-mail** antes do primeiro login.
Isso funciona, mas cria um passo a mais para cada pessoa. Para tirar:

1. Acesse o painel: https://supabase.com/dashboard/project/waxmwnvnckhwbuqenupe
2. Vá em **Authentication → Sign In / Providers → Email**
3. Desmarque **"Confirm email"** e salve

Se preferir manter a confirmação por e-mail ligada (é mais seguro contra
cadastros falsos), então configure também em **Authentication → URL
Configuration** o campo **Site URL** com a URL do seu app
(`https://nortem-sigma.vercel.app`), para que o link do e-mail leve de volta
ao lugar certo.

### Voltar ao modo local
Se algum dia quiser desligar o login e voltar a salvar só no navegador, basta
deixar as duas variáveis em `js/supabase-config.js` como `""`.

### Como os dados são guardados
Cada usuário tem uma linha na tabela `app_state`, com todos os dados dele em
um único JSON. Para finanças pessoais isso é rápido e suficiente (5 anos de
lançamentos diários dão poucas centenas de KB). Se um dia crescer muito, o
próximo passo seria separar em tabelas relacionais — mas não é necessário agora.

## 📄 Importar extrato em PDF

Em **Lançamentos → Importar extrato (PDF)** ou direto pelo **assistente**
(clique no 📎 ao lado da caixa de texto do chat). Funciona melhor com
extratos que têm texto selecionável (não fotos/scans).

O leitor reconhece:
- Datas numéricas (`17/09/2026`) e por extenso (`17 de set. de 2026`)
- Colunas separadas de débito/crédito/saldo (não só um valor com sinal)
- Descrições que quebram em duas linhas (ex: nome de quem pagou)
- Categoria sugerida automaticamente por palavra-chave (mercado, farmácia,
  posto de combustível, streaming, etc. — o que não reconhece cai em
  "Pessoal/Outros", editável na revisão)
- Movimentações internas (pagamento da própria fatura do cartão, transferência
  para reservas, transferência para você mesmo) — essas já vêm **desmarcadas**
  por padrão, para não inflar seus gastos/receitas reais, mas continuam
  visíveis caso você queira incluir mesmo assim

Testado com um extrato real da Revolut (176 lançamentos em 11 páginas,
verificados um a um contra o PDF original). O layout muda de banco para
banco, então isso continua sendo uma sugestão — sempre abre a **tela de
revisão** antes de importar qualquer coisa.

## 🏦 Conectar direto com o banco (Open Finance)

Isso **não está funcionando ainda** nesta versão, e sendo direto: não é algo
que eu consiga simplesmente "ligar" — puxar extratos automaticamente do seu
banco exige passar por um agregador financeiro autorizado pelo Banco Central
(ex: [Pluggy](https://pluggy.ai), que tem sandbox gratuito para testar), com
sua própria conta e chave de API lá. Em Configurações → "Conectar conta
bancária" tem um resumo de como isso funcionaria e o que falta. Enquanto
isso, a importação de PDF acima e o assistente por texto cobrem a maior parte
do uso do dia a dia.

## 🤖 Assistente com IA — funciona sozinho para qualquer pessoa

Diferente da versão anterior, ninguém que usar o app precisa colar chave nenhuma.
Isso é feito com uma função de servidor (`api/assistant.js`, roda automaticamente
no Vercel) que guarda a chave de forma segura e nunca a expõe no navegador.

**Sem configurar nada:** o assistente já registra lançamentos por texto
("gastei 45 no mercado hoje") e responde perguntas usando seus dados reais —
tudo local, sem precisar de IA nenhuma.

**Para conversa livre com IA de verdade (uma vez só, e vale para todo mundo
que usar o app depois):**

1. Escolha um provedor gratuito e pegue uma chave — recomendo o Google:
   - **Gemini** (recomendado, grátis, sem cartão de crédito): https://aistudio.google.com/apikey
   - **Groq** (também grátis): https://console.groq.com/keys
   - Anthropic/Claude também funciona, mas é pago: https://console.anthropic.com
2. No painel do **Vercel**, abra o projeto → **Settings → Environment Variables**
3. Adicione uma variável com o nome exato de uma destas (só uma é necessária):
   `GEMINI_API_KEY`, `GROQ_API_KEY` ou `ANTHROPIC_API_KEY` — cole a chave como valor
4. Clique em **Redeploy** (ou publique de novo)

Pronto — a partir daí, toda pessoa que abrir o app tem o assistente completo
funcionando automaticamente. Ninguém mais precisa configurar nada, nem saber
que isso existe. Se a variável não estiver configurada, o assistente
simplesmente continua no modo básico (sem quebrar nada).

## 🔔 Central de notificações

Clique no sino no topo — abre um painel com:
- **Alertas reais**, calculados a partir dos seus dados (fatura de cartão perto
  do vencimento, orçamento estourado, limite diário ultrapassado, meta batida)
- **Dicas do dia**: uma de redução de gastos, uma de renda extra e um insight
  sobre sua vida financeira (usa um dado real seu quando disponível). O
  conteúdo muda uma vez por dia.

Importante: isso é um painel **dentro do app** — ele aparece quando alguém
abre o app com o navegador ativo, não é uma notificação push do sistema
operacional (aquelas que aparecem mesmo com o app fechado). Implementar push
de verdade exigiria um Service Worker + um servidor de push próprio; dá para
construir depois se fizer sentido.

## 🎯 Limite de gastos diário

Em **Configurações → Limite de gastos diário**, defina um teto (ou deixe 0
para desativar). Sempre que uma despesa datada de hoje empurrar o total do
dia para além do limite, um **pop-up** aparece na hora avisando — só uma vez
por dia (não a cada lançamento depois disso), e o alerta também fica na
Central de notificações até virar o dia.

## Backup dos dados

Em Configurações → Backup: exportar tudo em JSON (para guardar ou migrar),
exportar lançamentos em CSV (Excel/Sheets), e importar um backup JSON de
volta. Em modo nuvem isso continua funcionando como uma cópia extra de
segurança — os dados já estão salvos no Supabase, mas nunca custa ter backup.

## Limitações conhecidas (documentadas de propósito)

- Orçamentos são mensais recorrentes (um valor por categoria, para todos os
  meses) — não dá pra definir um valor diferente por mês específico ainda.
- A Previsão financeira é uma estimativa (média das despesas fixas recentes +
  parcelas já lançadas), não uma função de recorrência automática de contas.
- Não há calendário financeiro dedicado — vencimentos aparecem nos Alertas do
  Dashboard e na tabela de Lançamentos.
- A leitura de PDF é heurística (procura padrões de data + valor por linha) —
  sempre revise antes de confirmar a importação.
- Conexão bancária automática (Open Finance) ainda não está implementada —
  depende de você configurar um agregador (Pluggy ou similar), como explicado
  acima.
- O assistente de IA com chave própria depende do navegador conseguir acessar
  `api.anthropic.com` diretamente; se isso falhar, ele avisa e cai para o
  modo básico automaticamente.

## Testado

Este ambiente de desenvolvimento não tem acesso a um navegador real, então a
validação foi por leitura de código, checagem de sintaxe de todo o JavaScript
e checagem cruzada de IDs/seletores entre HTML e JS. Antes de usar no dia a
dia (principalmente o modo nuvem, que depende da sua configuração do
Supabase), vale abrir o app e testar o fluxo: criar conta → login → adicionar
um lançamento → recarregar a página → confirmar que continua lá.
