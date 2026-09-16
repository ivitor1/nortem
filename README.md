# Nortem — Controle Financeiro Pessoal (Web App)

Aplicação web de finanças pessoais, construída em HTML + CSS + JavaScript puro
(sem framework, sem build step), com gráficos via Chart.js e ícones via Lucide.
Todos os dados ficam salvos no **localStorage do seu navegador** — nada é
enviado para nenhum servidor.

## Estrutura do projeto

```
/index.html          → shell da aplicação (sidebar, topbar, containers)
/css/styles.css       → design system completo (tokens, componentes, dark mode, responsivo)
/js/utils.js          → formatação de moeda/data, helpers
/js/store.js          → modelo de dados, persistência (localStorage), cálculos (totais, orçamento,
                         cartões, dívidas, investimentos, metas, saúde financeira, insights, previsão)
/js/ui.js             → toasts, modais genéricos, modal de "Novo lançamento"
/js/charts.js         → wrappers do Chart.js usados pelas páginas
/js/views/*.js        → uma página por arquivo (Dashboard, Lançamentos, Orçamentos,
                         Cartões, Contas, Dívidas, Investimentos, Metas, Previsão, Configurações)
/js/app.js            → roteamento entre páginas e inicialização
```

## Como rodar localmente

Não precisa instalar nada. Duas opções:

1. **Mais simples**: dê duplo clique em `index.html` e abra no navegador.
2. **Recomendado** (evita qualquer restrição de navegador com `file://`):
   dentro da pasta do projeto, rode um servidor local:
   ```bash
   python3 -m http.server 8080
   # depois acesse http://localhost:8080
   ```
   ou, se tiver Node instalado:
   ```bash
   npx serve .
   ```

## Como colocar online gratuitamente

O projeto é 100% estático (HTML/CSS/JS), então qualquer um destes serve, de graça:

- **Netlify Drop** (netlify.com/drop): arraste a pasta inteira do projeto no navegador.
- **Vercel**: `vercel` na pasta do projeto (ou importe o repositório pelo painel).
- **GitHub Pages**: suba os arquivos para um repositório e ative Pages nas configurações.
- **Cloudflare Pages**: conecte o repositório ou arraste a pasta.

Como não há backend, qualquer um desses hospeda o app "como está" — os dados
continuam salvos apenas no navegador de cada visitante.

## Backup dos dados

Em **Configurações → Backup dos meus dados**:
- **Exportar dados (JSON)**: baixa um arquivo com tudo (lançamentos, contas,
  cartões, dívidas, investimentos, metas, orçamentos). Guarde esse arquivo —
  é a forma de não perder nada ao trocar de navegador/computador.
- **Exportar lançamentos (CSV)**: útil para abrir no Excel/Google Sheets.
- **Importar dados**: recarrega um backup JSON exportado anteriormente
  (substitui os dados atuais).

Recomendo exportar o JSON periodicamente (ex: 1x por mês).

## Testado

Antes da entrega foram conferidos manualmente (via leitura de código e checagem
de sintaxe de todos os arquivos JS): adicionar receita/despesa e refletir em
saldo/gráficos/orçamento; compra parcelada gerando as parcelas futuras
automaticamente e aparecendo em Cartões → Compras parceladas e na Previsão;
dívidas e investimentos atualizando os totais e o patrimônio líquido; e
persistência via `localStorage` (os dados sobrevivem a fechar/abrir o
navegador, pois tudo é lido de volta no `Store.init()`). Como este ambiente de
desenvolvimento não tem acesso a um navegador real, recomendo abrir o app uma
vez e clicar pelos fluxos principais (novo lançamento, parcelamento, editar
orçamento, adicionar meta) antes do uso no dia a dia — qualquer bug de
interação que aparecer é rápido de ajustar.

## Como evoluir para um banco de dados na nuvem (Firebase/Supabase)

A arquitetura já separa **dados** (`Store.state`) de **interface** (`views/*`),
então migrar para a nuvem depois é um trabalho localizado em um único lugar:

1. Hoje: `Store.persist()` grava em `localStorage` e `Store.init()` lê de lá.
2. Amanhã: troque essas duas funções por chamadas assíncronas ao
   Firebase/Supabase (ex: `await db.collection('transactions').doc(uid).set(...)`),
   mantendo os mesmos nomes de campos (`transactions`, `accounts`, `cards`,
   `debts`, `investments`, `goals`, `budgets`) — as páginas (`views/*.js`) e os
   cálculos (`categoryBreakdown`, `healthScore` etc.) não precisam mudar, pois
   só dependem do formato de `Store.state`, não de como ele é salvo.
3. Para múltiplos usuários, adicione um `userId` ao estado e um login
   (Firebase Auth / Supabase Auth) antes de carregar os dados.
4. Para conectar a uma API bancária (Open Finance), o ponto de entrada seria
   uma função que converte os lançamentos importados da API para o mesmo
   formato de `transaction` já usado aqui, e chama `Store.addTransaction(...)`.

## Limitações conhecidas (documentadas de propósito)

- Orçamentos são mensais recorrentes (um valor por categoria, aplicado a todos
  os meses) — não é possível definir um orçamento diferente por mês específico.
- A "Previsão financeira" é uma estimativa (média das despesas fixas recentes
  + parcelas já lançadas), não uma função de recorrência automática.
- Não há calendário financeiro dedicado nesta primeira versão — os vencimentos
  aparecem nos Alertas do Dashboard e na tabela de Lançamentos.
- Gerenciar categorias/subcategorias personalizadas ainda não está exposto na
  interface (a estrutura de categorias é a mesma da planilha original); dá para
  adicionar depois em `js/utils.js` (`DESPESA_CATS`) sem tocar no resto do app.
