/* =====================================================================
   CHARTS — thin wrapper around Chart.js so pages just pass data in.
   Reads current theme colors so charts match light/dark mode.
   ===================================================================== */

const Charts = {
  instances: {},

  colors(){
    const cs = getComputedStyle(document.documentElement);
    return {
      accent: cs.getPropertyValue("--accent").trim(),
      coral: cs.getPropertyValue("--coral").trim(),
      gold: cs.getPropertyValue("--gold").trim(),
      blue: cs.getPropertyValue("--blue").trim(),
      ink: cs.getPropertyValue("--ink").trim(),
      inkSoft: cs.getPropertyValue("--ink-soft").trim(),
      border: cs.getPropertyValue("--border").trim(),
      surface: cs.getPropertyValue("--surface").trim(),
    };
  },

  destroy(id){
    if(this.instances[id]){ this.instances[id].destroy(); delete this.instances[id]; }
  },

  baseFont(){
    return { family: "Inter", size: 12 };
  },

  renderFlow(canvasId, series){
    const el = document.getElementById(canvasId); if(!el || !window.Chart) return;
    const c = this.colors();
    this.destroy(canvasId);
    this.instances[canvasId] = new Chart(el, {
      data: {
        labels: series.map(s=>s.label),
        datasets: [
          { type:"bar", label:"Receitas", data: series.map(s=>s.receita), backgroundColor: c.accent, borderRadius:6, barPercentage:.6, categoryPercentage:.65 },
          { type:"bar", label:"Despesas", data: series.map(s=>s.despesa), backgroundColor: c.coral, borderRadius:6, barPercentage:.6, categoryPercentage:.65 },
          { type:"line", label:"Saldo", data: series.map(s=>s.saldo), borderColor: c.ink, backgroundColor:"transparent", tension:.35, pointRadius:3, pointBackgroundColor:c.ink, borderWidth:2, yAxisID:"y" },
        ]
      },
      options: {
        responsive:true, maintainAspectRatio:false,
        interaction:{ mode:"index", intersect:false },
        plugins:{
          legend:{ position:"top", align:"end", labels:{ boxWidth:8, boxHeight:8, usePointStyle:true, font:this.baseFont(), color:c.inkSoft } },
          tooltip:{ callbacks:{ label:(ctx)=> ` ${ctx.dataset.label}: ${money(ctx.parsed.y)}` } }
        },
        scales:{
          x:{ grid:{ display:false }, ticks:{ color:c.inkSoft, font:this.baseFont() } },
          y:{ grid:{ color:c.border }, ticks:{ color:c.inkSoft, font:this.baseFont(), callback:(v)=>moneyCompact(v) } }
        }
      }
    });
  },

  renderDonut(canvasId, rows, onClick){
    const el = document.getElementById(canvasId); if(!el || !window.Chart) return;
    const c = this.colors();
    this.destroy(canvasId);
    const top = rows.filter(r=>r.valor>0);
    this.instances[canvasId] = new Chart(el, {
      type:"doughnut",
      data:{
        labels: top.map(r=>r.categoria),
        datasets:[{ data: top.map(r=>r.valor), backgroundColor: top.map(r=>CATEGORY_COLORS[r.categoria]||c.inkSoft), borderWidth:0, hoverOffset:6 }]
      },
      options:{
        responsive:true, maintainAspectRatio:false, cutout:"68%",
        plugins:{ legend:{ display:false }, tooltip:{ callbacks:{ label:(ctx)=> ` ${ctx.label}: ${money(ctx.parsed)}` } } },
        onClick:(evt, els)=>{ if(els.length && onClick) onClick(top[els[0].index].categoria); }
      }
    });
  },

  renderForecast(canvasId, rows){
    const el = document.getElementById(canvasId); if(!el || !window.Chart) return;
    const c = this.colors();
    this.destroy(canvasId);
    this.instances[canvasId] = new Chart(el, {
      type:"bar",
      data:{
        labels: rows.map(r=>r.label),
        datasets:[
          { label:"Receitas previstas", data: rows.map(r=>r.receita), backgroundColor: c.accent, borderRadius:8, barPercentage:.55 },
          { label:"Despesas previstas", data: rows.map(r=>r.despesa), backgroundColor: c.coral, borderRadius:8, barPercentage:.55 },
        ]
      },
      options:{
        responsive:true, maintainAspectRatio:false,
        plugins:{ legend:{ position:"top", align:"end", labels:{ boxWidth:8, boxHeight:8, usePointStyle:true, color:c.inkSoft } },
          tooltip:{ callbacks:{ label:(ctx)=> ` ${ctx.dataset.label}: ${money(ctx.parsed.y)}` } } },
        scales:{ x:{ grid:{display:false}, ticks:{color:c.inkSoft} }, y:{ grid:{color:c.border}, ticks:{color:c.inkSoft, callback:(v)=>moneyCompact(v)} } }
      }
    });
  },

  renderInvestEvolution(canvasId, rows){
    const el = document.getElementById(canvasId); if(!el || !window.Chart) return;
    const c = this.colors();
    this.destroy(canvasId);
    const sorted = [...rows].sort((a,b)=> a.date.localeCompare(b.date));
    let accInvested = 0, accAtual = 0;
    const labels = [], investedSeries = [], atualSeries = [];
    sorted.forEach(r=>{
      accInvested += Number(r.invested||0)+Number(r.contributions||0)-Number(r.withdrawals||0);
      accAtual += Number(r.currentValue||0);
      labels.push(fmtDate(r.date));
      investedSeries.push(accInvested);
      atualSeries.push(accAtual);
    });
    this.instances[canvasId] = new Chart(el, {
      type:"line",
      data:{ labels, datasets:[
        { label:"Aportado", data: investedSeries, borderColor: c.inkSoft, backgroundColor:"transparent", borderDash:[4,3], tension:.3, pointRadius:2 },
        { label:"Valor atual", data: atualSeries, borderColor: c.accent, backgroundColor: c.accent+"22", fill:true, tension:.3, pointRadius:2 },
      ]},
      options:{ responsive:true, maintainAspectRatio:false,
        plugins:{ legend:{ position:"top", align:"end", labels:{ boxWidth:8, boxHeight:8, usePointStyle:true, color:c.inkSoft } } },
        scales:{ x:{ grid:{display:false}, ticks:{color:c.inkSoft} }, y:{ grid:{color:c.border}, ticks:{color:c.inkSoft, callback:(v)=>moneyCompact(v)} } }
      }
    });
  },
};
