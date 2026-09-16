/* =====================================================================
   APP — bootstraps the store, wires navigation, and renders the
   active view into #view. This is the only place that knows about
   routes; each view module just renders into a container.
   ===================================================================== */

const App = {
  route: "dashboard",
  params: {},

  titles: {
    dashboard: "Início", transactions: "Lançamentos", budgets: "Orçamentos",
    cards: "Cartões", accounts: "Contas", debts: "Dívidas",
    investments: "Investimentos", goals: "Metas", forecast: "Previsão", settings: "Configurações",
  },

  viewModules: {
    dashboard: DashboardView, transactions: TransactionsView, budgets: BudgetsView,
    cards: CardsView, accounts: AccountsView, debts: DebtsView,
    investments: InvestmentsView, goals: GoalsView, forecast: ForecastView, settings: SettingsView,
  },

  init(){
    Store.init();
    UI.applyTheme(Store.state.settings.theme || "light");

    this.wireNav();
    this.wireThemeToggle();
    this.wireNewTx();
    this.wireMobileSheet();

    this.navigate("dashboard");
  },

  navigate(route, params={}){
    this.route = route;
    this.params = params;
    document.querySelectorAll(".nav-item, .bn-item").forEach(el=>{
      el.classList.toggle("active", el.dataset.route === route);
    });
    document.getElementById("topbarTitle").textContent = this.titles[route] || "";
    this.closeSidebarMobile();
    this.renderView();
    document.querySelector(".view-container").scrollTop = 0;
    window.scrollTo(0,0);
  },

  rerender(){ this.renderView(); },

  renderView(){
    const container = document.getElementById("view");
    const mod = this.viewModules[this.route];
    if(mod) mod.render(container, this.params);
    initIcons();
    this.refreshAlertsDot();
  },

  refreshAlertsDot(){
    const dot = document.getElementById("alertsDot");
    if(!dot) return;
    const alerts = Store.alerts(Store.state.settings.selectedYm);
    dot.hidden = alerts.length === 0;
  },

  wireNav(){
    document.querySelectorAll(".nav-item, .bn-item[data-route], .sheet-item").forEach(el=>{
      el.addEventListener("click", ()=>{
        this.navigate(el.dataset.route);
        this.closeMoreSheet();
      });
    });
    document.getElementById("moreNavBtn").addEventListener("click", ()=>this.openMoreSheet());
    document.getElementById("menuBtn").addEventListener("click", ()=>{
      document.getElementById("sidebar").classList.toggle("open");
    });
  },
  closeSidebarMobile(){
    document.getElementById("sidebar").classList.remove("open");
  },

  wireMobileSheet(){
    const backdrop = document.getElementById("moreBackdrop");
    backdrop.addEventListener("mousedown", (e)=>{ if(e.target===backdrop) this.closeMoreSheet(); });
  },
  openMoreSheet(){ document.getElementById("moreBackdrop").hidden = false; },
  closeMoreSheet(){ document.getElementById("moreBackdrop").hidden = true; },

  wireThemeToggle(){
    document.getElementById("themeToggle").addEventListener("click", ()=>{
      const next = Store.state.settings.theme === "dark" ? "light" : "dark";
      Store.updateSettings({theme: next});
      UI.applyTheme(next);
      this.renderView(); // re-render so charts pick up new theme colors
    });
  },

  wireNewTx(){
    document.getElementById("newTxBtn").addEventListener("click", ()=>UI.openTransactionModal());
    document.getElementById("fabAdd").addEventListener("click", ()=>UI.openTransactionModal());
    document.getElementById("alertsBtn").addEventListener("click", ()=>this.navigate("dashboard"));
  },
};

document.addEventListener("DOMContentLoaded", ()=>{
  App.init();
});
