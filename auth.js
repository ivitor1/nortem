/* =====================================================================
   AUTH — only active when js/supabase-config.js has real credentials.
   Shows the login/signup screen, manages the Supabase session, and
   hands off to App.mount() once a user's data is loaded.
   ===================================================================== */

const Auth = {
  mode: "login", // or "signup"

  async boot(){
    this.wireForm();
    const client = Store.cloud.client;

    const { data: { session } } = await client.auth.getSession();
    if(session){
      await this.onLoggedIn(session.user);
    } else {
      this.show();
    }

    client.auth.onAuthStateChange((event, session)=>{
      if(event === "SIGNED_IN" && session){
        this.onLoggedIn(session.user);
      }
      if(event === "SIGNED_OUT"){
        Store.cloud.userId = null;
        this.show();
      }
    });
  },

  async onLoggedIn(user){
    Store.cloud.userId = user.id;
    Store.cloud.userEmail = user.email;
    try{
      await Store.loadFromCloud();
    }catch(err){
      console.error("Falha ao carregar dados da nuvem:", err);
      this.showError("Não consegui carregar seus dados agora. Tente recarregar a página.");
      return; // keep the login screen up rather than show an empty/broken app
    }
    this.hide();
    App.mount();
  },

  show(){ document.getElementById("authScreen").hidden = false; document.getElementById("app").style.display = "none"; },
  hide(){ document.getElementById("authScreen").hidden = true; document.getElementById("app").style.display = "flex"; },

  showError(msg){
    const el = document.getElementById("authError");
    el.textContent = msg; el.hidden = false;
  },
  clearError(){ document.getElementById("authError").hidden = true; },

  wireForm(){
    document.querySelectorAll("#authTabs button").forEach(btn=>{
      btn.addEventListener("click", ()=>{
        this.mode = btn.dataset.tab;
        document.querySelectorAll("#authTabs button").forEach(b=>b.classList.toggle("active", b===btn));
        document.getElementById("authSubmit").textContent = this.mode==="login" ? "Entrar" : "Criar conta";
        document.getElementById("authSubtitle").textContent = this.mode==="login"
          ? "Entre para acessar suas finanças de qualquer lugar."
          : "Crie sua conta — seus dados ficam só seus, isolados por login.";
        this.clearError();
      });
    });

    document.getElementById("authForm").addEventListener("submit", async (e)=>{
      e.preventDefault();
      this.clearError();
      const email = document.getElementById("authEmail").value.trim();
      const password = document.getElementById("authPassword").value;
      const btn = document.getElementById("authSubmit");
      btn.disabled = true;
      const client = Store.cloud.client;
      try{
        if(this.mode === "login"){
          const { error } = await client.auth.signInWithPassword({ email, password });
          if(error) throw error;
        } else {
          const { data, error } = await client.auth.signUp({ email, password });
          if(error) throw error;
          if(!data.session){
            this.showError("Conta criada! Verifique seu e-mail para confirmar o acesso antes de entrar.");
          }
        }
      }catch(err){
        this.showError(this.translateError(err.message));
      }finally{
        btn.disabled = false;
      }
    });
  },

  translateError(msg){
    if(/invalid login credentials/i.test(msg)) return "E-mail ou senha incorretos.";
    if(/already registered|already exists/i.test(msg)) return "Já existe uma conta com esse e-mail — tente entrar.";
    if(/password.*(least|short)/i.test(msg)) return "A senha precisa ter pelo menos 6 caracteres.";
    return msg || "Algo deu errado. Tente novamente.";
  },

  async logout(){
    await Store.cloud.client.auth.signOut();
  },
};
