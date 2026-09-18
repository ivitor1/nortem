/* =====================================================================
   AUTH — only active when js/supabase-config.js has real credentials.
   Shows the login/signup screen, manages the Supabase session, and
   hands off to App.mount() once a user's data is loaded.

   Includes:
   - Login
   - Signup
   - Email confirmation
   - Resend confirmation email
   - Supabase session management
   ===================================================================== */

const Auth = {
  mode: "login", // or "signup"

  async boot(){
    this.wireForm();
    this.setupResendConfirmation();

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


  /* ================================================================
     LOGIN CONCLUÍDO
     ================================================================ */

  async onLoggedIn(user){
    Store.cloud.userId = user.id;
    Store.cloud.userEmail = user.email;

    try{
      await Store.loadFromCloud();
    }catch(err){
      console.error("Falha ao carregar dados da nuvem:", err);

      this.showError(
        "Não consegui carregar seus dados agora. Tente recarregar a página."
      );

      return;
    }

    this.hide();
    App.mount();
  },


  /* ================================================================
     MOSTRAR / ESCONDER TELA DE AUTENTICAÇÃO
     ================================================================ */

  show(){
    const authScreen = document.getElementById("authScreen");
    const app = document.getElementById("app");

    if(authScreen) authScreen.hidden = false;
    if(app) app.style.display = "none";
  },

  hide(){
    const authScreen = document.getElementById("authScreen");
    const app = document.getElementById("app");

    if(authScreen) authScreen.hidden = true;
    if(app) app.style.display = "flex";
  },


  /* ================================================================
     MENSAGENS
     ================================================================ */

  showError(msg){
    const el = document.getElementById("authError");

    if(!el) return;

    el.textContent = msg;
    el.hidden = false;
  },

  clearError(){
    const el = document.getElementById("authError");

    if(el){
      el.hidden = true;
      el.textContent = "";
    }
  },


  /* ================================================================
     TABS LOGIN / CADASTRO
     ================================================================ */

  wireForm(){

    document.querySelectorAll("#authTabs button").forEach(btn=>{

      btn.addEventListener("click", ()=>{

        this.mode = btn.dataset.tab;

        document
          .querySelectorAll("#authTabs button")
          .forEach(b => b.classList.toggle("active", b === btn));

        const submitBtn = document.getElementById("authSubmit");

        if(submitBtn){
          submitBtn.textContent =
            this.mode === "login"
              ? "Entrar"
              : "Criar conta";
        }

        const subtitle = document.getElementById("authSubtitle");

        if(subtitle){
          subtitle.textContent =
            this.mode === "login"
              ? "Entre para acessar suas finanças de qualquer lugar."
              : "Crie sua conta — seus dados ficam só seus, isolados por login.";
        }

        this.clearError();

        /*
         * O botão de reenvio faz sentido principalmente no login.
         * Quando o usuário estiver criando uma conta, escondemos.
         */
        this.updateResendVisibility();
      });
    });


    /* ================================================================
       SUBMIT LOGIN / CADASTRO
       ================================================================ */

    const form = document.getElementById("authForm");

    if(!form) return;

    form.addEventListener("submit", async (e)=>{

      e.preventDefault();

      this.clearError();

      const emailInput = document.getElementById("authEmail");
      const passwordInput = document.getElementById("authPassword");
      const btn = document.getElementById("authSubmit");

      const email = emailInput.value.trim();
      const password = passwordInput.value;

      if(!email){
        this.showError("Digite seu e-mail.");
        return;
      }

      if(!password){
        this.showError("Digite sua senha.");
        return;
      }

      btn.disabled = true;

      const originalText = btn.textContent;

      btn.textContent =
        this.mode === "login"
          ? "Entrando..."
          : "Criando conta...";

      const client = Store.cloud.client;

      try{

        /* ============================================================
           LOGIN
           ============================================================ */

        if(this.mode === "login"){

          const { data, error } =
            await client.auth.signInWithPassword({
              email,
              password
            });

          if(error) throw error;

          /*
           * Se chegou aqui, o Supabase autenticou normalmente.
           * O onAuthStateChange cuidará de carregar o aplicativo.
           */

          return;
        }


        /* ============================================================
           CADASTRO
           ============================================================ */

        const { data, error } =
          await client.auth.signUp({
            email,
            password
          });

        if(error) throw error;


        /*
         * Quando a confirmação de e-mail está ativada no Supabase,
         * normalmente data.session será null.
         */

        if(!data.session){

          this.showError(
            "Conta criada! Verifique seu e-mail para confirmar o acesso. Se não encontrar, confira a pasta de spam."
          );

          /*
           * Mostra o botão de reenvio automaticamente.
           */
          this.showResendConfirmation();

        }else{

          /*
           * Caso o projeto esteja configurado sem confirmação
           * obrigatória, o usuário já recebe uma sessão.
           */
          this.hideResendConfirmation();
        }

      }catch(err){

        console.error("Erro de autenticação:", err);

        this.showError(
          this.translateError(err.message)
        );

      }finally{

        btn.disabled = false;
        btn.textContent = originalText;
      }
    });
  },


  /* ================================================================
     REENVIO DO E-MAIL DE CONFIRMAÇÃO
     ================================================================ */

  setupResendConfirmation(){

    /*
     * O index.html atual não precisa ser alterado.
     * Criamos o bloco diretamente pelo JavaScript.
     */

    const form = document.getElementById("authForm");

    if(!form) return;

    /*
     * Evita criar o botão duas vezes caso Auth.boot() seja chamado
     * novamente.
     */

    if(document.getElementById("resendConfirmationBox")){
      this.updateResendVisibility();
      return;
    }


    const box = document.createElement("div");

    box.id = "resendConfirmationBox";

    box.style.cssText = `
      margin-top: 16px;
      text-align: center;
      font-size: 13px;
      line-height: 1.5;
    `;


    const text = document.createElement("div");

    text.textContent = "Não recebeu o e-mail de confirmação?";

    text.style.cssText = `
      color: var(--text-muted, #6b7280);
      margin-bottom: 6px;
    `;


    const button = document.createElement("button");

    button.type = "button";
    button.id = "resendConfirmationBtn";
    button.textContent = "Reenviar e-mail de confirmação";

    button.style.cssText = `
      border: none;
      background: transparent;
      padding: 0;
      margin: 0;
      cursor: pointer;
      font: inherit;
      font-weight: 600;
      color: var(--primary, #0FA678);
    `;


    button.addEventListener("click", async ()=>{

      await this.resendConfirmation();
    });


    box.appendChild(text);
    box.appendChild(button);

    form.insertAdjacentElement("afterend", box);


    this.updateResendVisibility();
  },


  /* ================================================================
     CONTROLAR VISIBILIDADE DO BOTÃO
     ================================================================ */

  updateResendVisibility(){

    const box = document.getElementById("resendConfirmationBox");

    if(!box) return;

    /*
     * O reenvio fica disponível na tela de login.
     */

    box.hidden = this.mode !== "login";
  },


  showResendConfirmation(){

    const box = document.getElementById("resendConfirmationBox");

    if(!box) return;

    box.hidden = false;
  },


  hideResendConfirmation(){

    const box = document.getElementById("resendConfirmationBox");

    if(!box) return;

    box.hidden = true;
  },


  /* ================================================================
     REENVIAR CONFIRMAÇÃO
     ================================================================ */

  async resendConfirmation(){

    this.clearError();

    const emailInput = document.getElementById("authEmail");
    const resendBtn = document.getElementById("resendConfirmationBtn");

    if(!emailInput || !resendBtn) return;

    const email = emailInput.value.trim();

    if(!email){

      this.showError(
        "Digite seu e-mail no campo acima antes de reenviar a confirmação."
      );

      emailInput.focus();

      return;
    }


    /*
     * Evita vários cliques enquanto o Supabase processa a solicitação.
     */

    resendBtn.disabled = true;
    resendBtn.style.opacity = "0.6";
    resendBtn.style.cursor = "not-allowed";
    resendBtn.textContent = "Enviando...";


    try{

      const client = Store.cloud.client;

      const { error } =
        await client.auth.resend({
          type: "signup",
          email: email
        });


      if(error) throw error;


      /*
       * Sucesso.
       */

      this.showSuccess(
        "E-mail de confirmação reenviado! Verifique sua caixa de entrada e a pasta de spam."
      );


    }catch(err){

      console.error(
        "Erro ao reenviar confirmação:",
        err
      );

      this.showError(
        this.translateError(err.message)
      );

    }finally{

      resendBtn.disabled = false;
      resendBtn.style.opacity = "1";
      resendBtn.style.cursor = "pointer";
      resendBtn.textContent = "Reenviar e-mail de confirmação";
    }
  },


  /* ================================================================
     MENSAGEM DE SUCESSO
     ================================================================ */

  showSuccess(msg){

    const el = document.getElementById("authError");

    if(!el) return;

    el.textContent = msg;
    el.hidden = false;

    /*
     * Mantemos o mesmo componente visual usado pelo Nortem,
     * mas usamos uma aparência de sucesso.
     */

    el.style.color = "#0FA678";
  },


  /* ================================================================
     TRADUÇÃO DOS ERROS DO SUPABASE
     ================================================================ */

  translateError(msg){

    if(!msg){
      return "Algo deu errado. Tente novamente.";
    }


    if(/invalid login credentials/i.test(msg)){
      return "E-mail ou senha incorretos.";
    }


    if(/email not confirmed/i.test(msg)){
      return "Seu e-mail ainda não foi confirmado. Verifique sua caixa de entrada ou clique em “Reenviar e-mail de confirmação”.";
    }


    if(/email rate limit exceeded/i.test(msg)){
      return "O limite de envio de e-mails foi atingido. Aguarde um pouco e tente novamente.";
    }


    if(/rate limit/i.test(msg)){
      return "Muitas tentativas em pouco tempo. Aguarde um pouco e tente novamente.";
    }


    if(/already registered|already exists/i.test(msg)){
      return "Já existe uma conta com esse e-mail — tente entrar.";
    }


    if(/password.*(least|short)/i.test(msg)){
      return "A senha precisa ter pelo menos 6 caracteres.";
    }


    if(/password.*characters/i.test(msg)){
      return "A senha não atende aos requisitos mínimos.";
    }


    if(/invalid email/i.test(msg)){
      return "Digite um endereço de e-mail válido.";
    }


    if(/user not found/i.test(msg)){
      return "Não encontramos uma conta com esse e-mail.";
    }


    return msg || "Algo deu errado. Tente novamente.";
  },


  /* ================================================================
     LOGOUT
     ================================================================ */

  async logout(){

    await Store.cloud.client.auth.signOut();
  },
};
