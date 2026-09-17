# Nortem — Controle Financeiro Pessoal (Web App)

**Novidades desta versão:** saudação conforme o horário do dia, nova identidade visual (logo + marca), assistente muito mais inteligente (dá orientação priorizada com base nos seus números reais, não só consulta dados), e explicação clara em Configurações sobre como ativar o login de usuários.

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
/css/styles.css            → design system (tokens, componentes, dark mode, responsivo)
/js/supabase-config.js     → suas credenciais do Supabase (vazio = modo local)
/js/utils.js               → formatação de moeda/data, helpers
/js/store.js               → modelo de dados: local (localStorage) ou nuvem (Supabase),
                              cálculos (totais, orçamento, cartões, dívidas, investimentos,
                              metas, saúde financeira, insights, previsão)
/js/auth.js                → tela de login/cadastro e sessão (só ativo em modo nuvem)
/js/ui.js                  → toasts, modais, modal de "Novo lançamento"
/js/charts.js               → wrappers do Chart.js usados pelas páginas
/js/pdf-import.js          → leitura de extrato em PDF + tela de revisão antes de importar
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

Em **Lançamentos → Importar extrato (PDF)**. Funciona melhor com extratos que
têm texto selecionável (não fotos/scans). O app lê o PDF inteiro, tenta achar
linhas com data + valor, e sempre abre uma **tela de revisão editável** antes
de importar qualquer coisa — o layout muda muito de banco para banco, então
a leitura automática é uma sugestão, não uma verdade absoluta. Confira
tipo/categoria/valor de cada linha antes de confirmar.

## 🏦 Conectar direto com o banco (Open Finance)

Isso **não está funcionando ainda** nesta versão, e sendo direto: não é algo
que eu consiga simplesmente "ligar" — puxar extratos automaticamente do seu
banco exige passar por um agregador financeiro autorizado pelo Banco Central
(ex: [Pluggy](https://pluggy.ai), que tem sandbox gratuito para testar), com
sua própria conta e chave de API lá. Em Configurações → "Conectar conta
bancária" tem um resumo de como isso funcionaria e o que falta. Enquanto
isso, a importação de PDF acima e o assistente por texto cobrem a maior parte
do uso do dia a dia.

## 🤖 Assistente com IA

Botão flutuante ✨ em qualquer página.
- **Sem configurar nada**: já registra lançamentos ditos em texto livre
  ("gastei 45 no mercado hoje") e responde perguntas simples usando seus
  dados reais (saldo, orçamento, dívidas, etc.) — tudo local, sem internet.
- **Com sua própria chave da Anthropic** (Configurações → Assistente com IA):
  conversa livre sobre dúvidas, ideias e investimentos. As perguntas vão
  direto do seu navegador para a Anthropic — nunca passam por mim ou por
  qualquer servidor meu.

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
