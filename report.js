/* =====================================================================
   REPORT — generates a friendly, print/PDF-ready financial report:
   KPI numbers, insights, charts and summaries, with the raw transaction
   list included only as a reference section at the end (not the whole
   point of the export, like the old CSV-only option was).

   Opens in a new tab as a fully self-contained HTML document (its own
   Chart.js instance), so "Salvar como PDF" via the browser's print
   dialog works cleanly without touching the main app.
   ===================================================================== */

const Report = {
  open(ym){
    const win = window.open("", "_blank");
    if(!win){ UI.toast("Seu navegador bloqueou a nova aba. Permita pop-ups para gerar o relatório.", {error:true}); return; }
    win.document.open();
    win.document.write(this.buildHtml(ym));
    win.document.close();
  },

  buildHtml(ym){
    const S = Store.state;
    const t = Store.totalsForMonth(ym);
    const [year, monthNum] = ym.split("-");
    const mesNome = `${MESES_PT[Number(monthNum)-1]} de ${year}`;
    const health = Store.healthScore(ym);
    const insights = Store.insights(ym);
    const cats = Store.categoryBreakdown(ym,"Despesa").filter(c=>c.valor>0);
    const budgets = Store.budgetStatus(ym).filter(b=>b.orcamento>0);
    const debts = Store.debtsSummary();
    const inv = Store.investmentsSummary();
    const goals = Store.goalsList();
    const series = Store.last12MonthsSeries(ym);
    const txs = Store.monthTransactions(ym).sort((a,b)=>a.date.localeCompare(b.date));
    const accName = id => (S.accounts.find(a=>a.id===id)||{}).name || "—";
    const cardName = id => (S.cards.find(c=>c.id===id)||{}).name || "—";
    const now = new Date().toLocaleString("pt-BR");

    const esc = (s) => String(s??"").replace(/[&<>"']/g, c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));

    return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<title>Relatório Nortem — ${mesNome}</title>
<script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.4/dist/chart.umd.min.js"></script>
<style>
  :root{
    --ink:#12151C; --ink-soft:#626A7A; --ink-faint:#9AA2B1; --border:#E5E8EE; --bg:#fff; --surface:#F6F7F9;
    --accent:#0FA678; --accent-strong:#0B7F5C; --coral:#E1543F; --gold:#B8892B; --accent-soft:#E4F6EF;
  }
  *{box-sizing:border-box;}
  body{ font-family:-apple-system,Segoe UI,Inter,Arial,sans-serif; color:var(--ink); margin:0; background:var(--surface); }
  .page{ max-width:880px; margin:0 auto; background:#fff; padding:40px 48px 60px; }
  .toolbar{ position:sticky; top:0; background:#1a1f2b; padding:12px 20px; display:flex; justify-content:flex-end; gap:10px; z-index:10; }
  .toolbar button{ background:#0FA678; color:#fff; border:none; padding:9px 16px; border-radius:8px; font-size:13px; font-weight:600; cursor:pointer; }
  .toolbar button.secondary{ background:#333c4d; }
  header.rp{ display:flex; align-items:center; gap:12px; border-bottom:2px solid var(--ink); padding-bottom:18px; margin-bottom:24px; }
  .logo{ width:38px; height:38px; border-radius:10px; background:linear-gradient(135deg,#00D68F,#0FA678,#0A7CFF); display:flex; align-items:center; justify-content:center; }
  .logo svg{ width:22px; height:22px; }
  h1{ font-size:20px; margin:0; }
  .sub{ color:var(--ink-soft); font-size:12.5px; margin-top:2px; }
  h2.section{ font-size:15px; border-left:4px solid var(--accent); padding-left:10px; margin:34px 0 14px; }
  .kpis{ display:grid; grid-template-columns:repeat(5,1fr); gap:10px; }
  .kpi{ border:1px solid var(--border); border-radius:10px; padding:12px; }
  .kpi .l{ font-size:10.5px; color:var(--ink-soft); text-transform:uppercase; letter-spacing:.03em; }
  .kpi .v{ font-size:17px; font-weight:700; margin-top:4px; }
  .health{ display:flex; align-items:center; gap:16px; border:1px solid var(--border); border-radius:12px; padding:16px; }
  .health .score{ font-size:30px; font-weight:800; }
  .factors{ flex:1; display:grid; grid-template-columns:1fr 1fr; gap:6px 16px; font-size:12px; }
  .bar{ height:6px; border-radius:4px; background:#eee; overflow:hidden; margin-top:2px; }
  .bar>span{ display:block; height:100%; }
  ul.insights{ margin:0; padding-left:18px; font-size:13px; line-height:1.9; }
  table{ width:100%; border-collapse:collapse; font-size:12px; }
  th{ text-align:left; padding:8px 10px; background:var(--surface); font-size:10.5px; text-transform:uppercase; color:var(--ink-soft); border-bottom:1px solid var(--border); }
  td{ padding:7px 10px; border-bottom:1px solid var(--border); }
  .charts{ display:grid; grid-template-columns:1.4fr 1fr; gap:16px; align-items:start; }
  .chart-box{ border:1px solid var(--border); border-radius:12px; padding:14px; }
  .chart-box canvas{ max-height:220px; }
  .pill{ display:inline-block; padding:2px 8px; border-radius:20px; font-size:10.5px; font-weight:700; }
  .foot{ margin-top:40px; padding-top:14px; border-top:1px solid var(--border); font-size:11px; color:var(--ink-faint); text-align:center; }
  @media print{
    .toolbar{ display:none; }
    body{ background:#fff; }
    .page{ padding:0; max-width:none; }
    h2.section{ page-break-after:avoid; }
    table, .chart-box, .kpi, .health{ page-break-inside:avoid; }
  }
</style>
</head>
<body>
  <div class="toolbar">
    <button class="secondary" onclick="window.close()">Fechar</button>
    <button onclick="window.print()">🖨️ Imprimir / Salvar como PDF</button>
  </div>
  <div class="page">
    <header class="rp">
      <div class="logo"><svg viewBox="0 0 32 32" fill="none"><path d="M7 24V8.8c0-.9 1.1-1.3 1.7-.6l11.6 13c.6.7 1.7.3 1.7-.6V8" stroke="#fff" stroke-width="3.4" stroke-linecap="round"/><path d="M19.4 8H25v5.6" stroke="#fff" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"/></svg></div>
      <div>
        <h1>Relatório Financeiro — ${mesNome}</h1>
        <div class="sub">${esc(S.profile.name)} · gerado em ${now} · Nortem</div>
      </div>
    </header>

    <h2 class="section">📊 Resumo do mês</h2>
    <div class="kpis">
      <div class="kpi"><div class="l">Receita</div><div class="v" style="color:var(--accent-strong)">${money(t.receita)}</div></div>
      <div class="kpi"><div class="l">Despesa</div><div class="v" style="color:var(--coral)">${money(t.despesa)}</div></div>
      <div class="kpi"><div class="l">Saldo</div><div class="v">${money(t.saldo)}</div></div>
      <div class="kpi"><div class="l">% da renda usada</div><div class="v">${pct(t.pctRenda)}</div></div>
      <div class="kpi"><div class="l">Patrimônio líquido</div><div class="v">${money(Store.patrimonioLiquido())}</div></div>
    </div>

    <h2 class="section">🏆 Saúde financeira</h2>
    <div class="health">
      <div class="score">${health.score}<span style="font-size:13px; color:var(--ink-soft);">/100</span></div>
      <div class="factors">
        ${health.factors.map(f=>`<div>${f.label} — ${f.value}%<div class="bar"><span style="width:${f.value}%; background:${f.value<40?'var(--coral)':f.value<70?'var(--gold)':'var(--accent)'}"></span></div></div>`).join("")}
      </div>
    </div>

    ${insights.length ? `
    <h2 class="section">🧠 Insights</h2>
    <ul class="insights">${insights.map(i=>`<li>${esc(i.text)}</li>`).join("")}</ul>
    ` : ""}

    <h2 class="section">📈 Evolução e categorias</h2>
    <div class="charts">
      <div class="chart-box"><canvas id="flowChart"></canvas></div>
      <div class="chart-box"><canvas id="catChart"></canvas></div>
    </div>

    ${budgets.length ? `
    <h2 class="section">🎯 Orçamentos</h2>
    <table><thead><tr><th>Categoria</th><th>Orçamento</th><th>Gasto</th><th>% usado</th><th>Status</th></tr></thead><tbody>
      ${budgets.map(b=>`<tr><td>${b.categoria}</td><td>${money(b.orcamento)}</td><td>${money(b.gasto)}</td><td>${pct(b.pctUsed)}</td>
        <td><span class="pill" style="background:${b.pctUsed>1?'#FBE9E6':b.pctUsed>=0.7?'#F7EED9':'#E4F6EF'}; color:${b.pctUsed>1?'#E1543F':b.pctUsed>=0.7?'#B8892B':'#0B7F5C'}">${b.pctUsed>1?'Acima':b.pctUsed>=0.7?'Atenção':'Normal'}</span></td></tr>`).join("")}
    </tbody></table>` : ""}

    ${S.cards.length ? `
    <h2 class="section">💳 Cartões</h2>
    <table><thead><tr><th>Cartão</th><th>Limite</th><th>Utilizado</th><th>Disponível</th><th>Fatura atual</th></tr></thead><tbody>
      ${S.cards.map(c=>{ const u=Store.cardUtilization(c.id,ym); return `<tr><td>${esc(c.name)}</td><td>${money(u.limite)}</td><td>${money(u.utilizado)}</td><td>${money(u.disponivel)}</td><td>${money(u.faturaAtual)}</td></tr>`; }).join("")}
    </tbody></table>` : ""}

    ${debts.rows.length ? `
    <h2 class="section">📉 Dívidas</h2>
    <div class="kpis" style="grid-template-columns:repeat(3,1fr); margin-bottom:12px;">
      <div class="kpi"><div class="l">Total original</div><div class="v">${money(debts.totalOriginal)}</div></div>
      <div class="kpi"><div class="l">Já pago</div><div class="v" style="color:var(--accent-strong)">${money(debts.totalPago)}</div></div>
      <div class="kpi"><div class="l">Restante</div><div class="v" style="color:var(--coral)">${money(debts.totalRestante)}</div></div>
    </div>` : ""}

    ${inv.rows.length ? `
    <h2 class="section">📈 Investimentos</h2>
    <div class="kpis" style="grid-template-columns:repeat(3,1fr); margin-bottom:12px;">
      <div class="kpi"><div class="l">Investido</div><div class="v">${money(inv.totalInvestido)}</div></div>
      <div class="kpi"><div class="l">Valor atual</div><div class="v">${money(inv.totalAtual)}</div></div>
      <div class="kpi"><div class="l">Rentabilidade</div><div class="v" style="color:var(--accent-strong)">${pct(inv.rentabilidade)}</div></div>
    </div>` : ""}

    ${goals.length ? `
    <h2 class="section">🎯 Metas</h2>
    <table><thead><tr><th>Meta</th><th>Atual</th><th>Objetivo</th><th>Progresso</th></tr></thead><tbody>
      ${goals.map(g=>`<tr><td>${esc(g.name)}</td><td>${money(g.current)}</td><td>${money(g.target)}</td><td>${pct(g.pctConcluido)}</td></tr>`).join("")}
    </tbody></table>` : ""}

    <h2 class="section">📋 Lançamentos do mês (${txs.length})</h2>
    <table><thead><tr><th>Data</th><th>Descrição</th><th>Categoria</th><th>Conta/Cartão</th><th>Status</th><th style="text-align:right;">Valor</th></tr></thead><tbody>
      ${txs.map(tx=>`<tr><td>${fmtDate(tx.date)}</td><td>${esc(tx.description)}</td><td>${esc(tx.category)}</td>
        <td>${tx.cardId?esc(cardName(tx.cardId)):esc(accName(tx.accountId))}</td><td>${tx.status}</td>
        <td style="text-align:right; color:${tx.type==='Receita'?'var(--accent-strong)':'inherit'}">${tx.type==='Receita'?'+':'−'} ${money(tx.value)}</td></tr>`).join("") || `<tr><td colspan="6" style="text-align:center; color:var(--ink-faint);">Nenhum lançamento neste mês.</td></tr>`}
    </tbody></table>

    <div class="foot">Relatório gerado automaticamente pelo Nortem — nortem-sigma.vercel.app</div>
  </div>

<script>
  const flowData = ${JSON.stringify(series)};
  const catData = ${JSON.stringify(cats.map(c=>({categoria:c.categoria, valor:c.valor})))};
  const catColors = ${JSON.stringify(CATEGORY_COLORS)};

  window.addEventListener("load", function(){
    new Chart(document.getElementById("flowChart"), {
      data: {
        labels: flowData.map(s=>s.label),
        datasets: [
          { type:"bar", label:"Receitas", data: flowData.map(s=>s.receita), backgroundColor:"#0FA678", borderRadius:4 },
          { type:"bar", label:"Despesas", data: flowData.map(s=>s.despesa), backgroundColor:"#E1543F", borderRadius:4 },
        ]
      },
      options: { responsive:true, plugins:{ legend:{ position:"bottom", labels:{boxWidth:8,font:{size:10}} }, title:{display:true,text:"Receitas x Despesas — 12 meses",font:{size:12}} } }
    });
    new Chart(document.getElementById("catChart"), {
      type:"doughnut",
      data: { labels: catData.map(c=>c.categoria), datasets:[{ data: catData.map(c=>c.valor), backgroundColor: catData.map(c=>catColors[c.categoria]||"#94A3B8") }] },
      options: { responsive:true, plugins:{ legend:{ position:"bottom", labels:{boxWidth:8,font:{size:9}} }, title:{display:true,text:"Gastos por categoria",font:{size:12}} } }
    });
  });
</script>
</body>
</html>`;
  },
};
