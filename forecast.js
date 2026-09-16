/* =====================================================================
   FORECAST VIEW — "Previsão financeira"
   ===================================================================== */

const ForecastView = {
  render(container){
    const rows = Store.forecast(4);

    container.innerHTML = `
      <div class="section-head" style="margin-top:0;"><h2>Próximos meses</h2></div>
      <p style="color:var(--ink-soft); font-size:13.5px; max-width:620px; margin-bottom:16px;">
        A previsão combina a média das suas despesas fixas recentes com parcelas e lançamentos já
        agendados para os próximos meses.
      </p>

      <div class="chart-card">
        <div class="chart-wrap"><canvas id="forecastChart"></canvas></div>
      </div>

      <div class="grid-4" style="margin-top:16px;">
        ${rows.map(r=>`
          <div class="card">
            <div class="card-title">${r.label}</div>
            <div style="margin-top:8px; font-size:13px; display:flex; justify-content:space-between;"><span>Receitas previstas</span><b style="color:var(--accent-strong)">${money(r.receita)}</b></div>
            <div style="font-size:13px; display:flex; justify-content:space-between; margin-top:4px;"><span>Despesas previstas</span><b style="color:var(--coral)">${money(r.despesa)}</b></div>
            <div style="border-top:1px solid var(--border); margin-top:8px; padding-top:8px; font-size:13.5px; display:flex; justify-content:space-between;"><span>Saldo previsto</span><b>${money(r.saldo)}</b></div>
          </div>
        `).join("")}
      </div>
    `;

    Charts.renderForecast("forecastChart", rows);
  }
};
