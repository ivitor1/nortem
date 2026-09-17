/* =====================================================================
   DASHBOARD VIEW
   ===================================================================== */

const DashboardView = {
  render(container){
    const S = Store.state;
    const ym = S.settings.selectedYm;
    const t = Store.totalsForMonth(ym);
    const prevYm = addMonths(ym+"-01",-1).slice(0,7);
    const prevT = Store.totalsForMonth(prevYm);
    const deltaReceita = prevT.receita>0 ? (t.receita-prevT.receita)/prevT.receita : null;
    const deltaDespesa = prevT.despesa>0 ? (t.despesa-prevT.despesa)/prevT.despesa : null;
    const cardsUtilTotal = S.cards.reduce((a,c)=>a+Store.cardUtilization(c.id, ym).faturaAtual,0);
    const patrimonio = Store.patrimonioLiquido();
    const prevPatr = patrimonio; // single snapshot; delta vs invested growth used instead
    const inv = Store.investmentsSummary();
    const cats = Store.categoryBreakdown(ym, "Despesa");
    const health = Store.healthScore(ym);
    const insights = Store.insights(ym);
    const alerts = Store.alerts(ym);

    container.innerHTML = `
      <div class="dash-header">
        <div>
          <h1 style="font-family:var(--font-display); font-size:24px; font-weight:700;">${greeting().text}, ${escapeHtml(S.profile.name)} ${greeting().emoji}</h1>
          <p style="color:var(--ink-soft); font-size:14px; margin-top:4px;">Aqui está o resumo da sua vida financeira em ${MESES_PT[Number(ym.split('-')[1])-1]} de ${ym.split('-')[0]}.</p>
        </div>
      </div>

      <div class="kpi-grid" style="margin-top:20px;">
        <div class="kpi-card hero">
          <div class="kpi-top"><span class="kpi-label">💵 Saldo disponível</span></div>
          <div class="kpi-value num">${money(t.saldo)}</div>
          <div class="kpi-delta">${pct(t.pctRenda)} da renda comprometida</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-top"><span class="kpi-label">💰 Receita</span><span class="kpi-icon tint-green"><i data-lucide="arrow-down-left"></i></span></div>
          <div class="kpi-value num">${money(t.receita)}</div>
          ${deltaReceita===null?'<div class="kpi-delta" style="color:var(--ink-faint)">sem dado anterior</div>':`<div class="kpi-delta ${deltaReceita>=0?'up':'down'}"><i data-lucide="${deltaReceita>=0?'arrow-up-right':'arrow-down-right'}" style="width:13px;height:13px;"></i>${pct(Math.abs(deltaReceita))} vs mês anterior</div>`}
        </div>
        <div class="kpi-card">
          <div class="kpi-top"><span class="kpi-label">💸 Despesas</span><span class="kpi-icon tint-coral"><i data-lucide="arrow-up-right"></i></span></div>
          <div class="kpi-value num">${money(t.despesa)}</div>
          ${deltaDespesa===null?'<div class="kpi-delta" style="color:var(--ink-faint)">sem dado anterior</div>':`<div class="kpi-delta ${deltaDespesa<=0?'up':'down'}"><i data-lucide="${deltaDespesa<=0?'arrow-down-right':'arrow-up-right'}" style="width:13px;height:13px;"></i>${pct(Math.abs(deltaDespesa))} vs mês anterior</div>`}
        </div>
        <div class="kpi-card">
          <div class="kpi-top"><span class="kpi-label">📊 Economia</span><span class="kpi-icon tint-gold"><i data-lucide="piggy-bank"></i></span></div>
          <div class="kpi-value num">${money(t.saldo)}</div>
          <div class="kpi-delta" style="color:var(--ink-faint)">${pct(t.receita>0?t.saldo/t.receita:0)} da renda</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-top"><span class="kpi-label">💳 Cartões</span><span class="kpi-icon tint-blue"><i data-lucide="credit-card"></i></span></div>
          <div class="kpi-value num">${money(cardsUtilTotal)}</div>
          <div class="kpi-delta" style="color:var(--ink-faint)">fatura atual em aberto</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-top"><span class="kpi-label">📈 Patrimônio</span><span class="kpi-icon tint-green"><i data-lucide="landmark"></i></span></div>
          <div class="kpi-value num">${money(patrimonio)}</div>
          <div class="kpi-delta" style="color:var(--ink-faint)">contas + investimentos − dívidas</div>
        </div>
      </div>

      <div class="dash-grid">
        <div>
          <div class="chart-card">
            <div class="chart-head"><h3>Fluxo financeiro — últimos 12 meses</h3></div>
            <div class="chart-wrap"><canvas id="flowChart"></canvas></div>
          </div>

          <div class="section-head"><h2>🧠 Insights financeiros</h2></div>
          <div class="insight-list">
            ${insights.length ? insights.map(i=>`<div class="insight-item"><i data-lucide="${i.icon}" style="color:var(--accent)"></i><span>${escapeHtml(i.text)}</span></div>`).join("")
              : `<div class="insight-item"><i data-lucide="info"></i><span>Adicione mais lançamentos para gerar insights personalizados.</span></div>`}
          </div>
        </div>

        <div>
          <div class="chart-card">
            <div class="chart-head"><h3>Para onde está indo meu dinheiro?</h3></div>
            <div class="chart-wrap sm"><canvas id="catDonut"></canvas></div>
            <div class="cat-list" id="catList" style="margin-top:14px;">
              ${cats.filter(c=>c.valor>0).slice(0,6).map(c=>`
                <div class="cat-row" data-cat="${escapeHtml(c.categoria)}">
                  <span class="cat-dot" style="background:${CATEGORY_COLORS[c.categoria]||'#999'}"></span>
                  <div>
                    <div class="cat-meta"><span>${c.categoria}</span><span class="cat-val">${money(c.valor)}</span></div>
                  </div>
                </div>`).join("") || `<p style="color:var(--ink-faint); font-size:13px;">Nenhuma despesa registrada neste mês.</p>`}
            </div>
          </div>

          <div class="section-head"><h2>🔔 Central de alertas</h2></div>
          <div class="alert-list">
            ${alerts.length ? alerts.map(a=>`<div class="alert-item ${a.tone}"><i data-lucide="${a.icon}"></i><span>${escapeHtml(a.text)}</span></div>`).join("")
              : `<div class="alert-item good"><i data-lucide="check-circle"></i><span>Tudo em ordem por aqui.</span></div>`}
          </div>
        </div>
      </div>

      <div class="section-head"><h2>🏆 Sua saúde financeira</h2></div>
      <div class="card health-card">
        <div class="health-ring">
          <svg width="120" height="120" viewBox="0 0 120 120">
            <circle cx="60" cy="60" r="52" fill="none" stroke="var(--surface-2)" stroke-width="12"/>
            <circle cx="60" cy="60" r="52" fill="none" stroke="var(--${health.tone==='coral'?'coral':health.tone==='gold'?'gold':'accent'})"
              stroke-width="12" stroke-linecap="round"
              stroke-dasharray="${2*Math.PI*52}" stroke-dashoffset="${2*Math.PI*52*(1-health.score/100)}"/>
          </svg>
          <div class="ring-num"><b>${health.score}</b><span>${health.label}</span></div>
        </div>
        <div class="health-factors">
          ${health.factors.map(f=>`
            <div class="factor-row">
              <span>${f.label}</span>
              <div class="bar"><span style="width:${f.value}%; background:${f.value<40?'var(--coral)':f.value<70?'var(--gold)':'var(--accent)'}"></span></div>
              <span class="num" style="text-align:right; font-weight:600;">${f.value}%</span>
            </div>`).join("")}
        </div>
      </div>
    `;

    document.querySelectorAll("#catList .cat-row").forEach(row=>{
      row.onclick = ()=>{ App.navigate("transactions", { category: row.dataset.cat }); };
    });

    Charts.renderFlow("flowChart", Store.last12MonthsSeries(ym));
    Charts.renderDonut("catDonut", cats, (cat)=>App.navigate("transactions", {category:cat}));
  },
};
