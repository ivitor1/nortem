/* =====================================================================
   NOTIFICATIONS — the bell icon opens this panel. Two sections:
   1) Real alerts computed from the person's own data (Store.alerts)
   2) A daily digest: one expense-reduction tip, one extra-income tip,
      and one financial-life insight, rotating once per day (stable
      all day via a date-seeded index, changes at midnight).
   This is an in-app panel, not an OS push notification — the browser
   has to be open to see it. Said plainly in the README.
   ===================================================================== */

const DAILY_TIPS = {
  economia: [
    "Revise assinaturas recorrentes (streaming, apps, academia) a cada 3 meses — é comum pagar por serviços que você já não usa.",
    "Antes de comprar algo não essencial, espere 24 horas. Boa parte do impulso passa nesse tempo.",
    "Compare preços de mercado com um app de comparação antes de fazer a compra do mês — a diferença entre mercados costuma passar de 15%.",
    "Leve dinheiro ou um limite definido quando for a lugares onde costuma gastar por impulso (shopping, delivery).",
    "Negocie contas fixas uma vez por ano — internet, seguro e plano de celular quase sempre têm desconto para quem liga pedindo.",
    "Cozinhar em maior quantidade e congelar porções costuma sair bem mais barato que delivery no dia a dia.",
    "Troque compras por unidade em farmácia/mercado por embalagens maiores dos itens que você realmente consome sempre.",
    "Configure um alerta de orçamento por categoria (em Orçamentos) — ver o número subindo em tempo real muda o comportamento mais do que revisar o extrato no fim do mês.",
    "Cancele o cartão de crédito adicional que você não usa — anuidade é dinheiro saindo por nada.",
    "Delivery de comida costuma custar de 30% a 50% a mais que preparar a mesma refeição em casa — vale reservar para ocasiões, não rotina.",
  ],
  renda: [
    "Liste 3 habilidades que você tem e já usou no trabalho — normalmente pelo menos uma pode virar um serviço freelance nas horas vagas.",
    "Itens parados em casa (eletrônicos, roupas, móveis) viram dinheiro rápido em marketplaces — um app de brechó ou OLX resolve em poucos dias.",
    "Aulas particulares (idiomas, reforço escolar, música) são uma das formas mais simples de renda extra sem precisar de investimento inicial.",
    "Se você recebe 13º ou restituição de imposto, considere destinar uma parte para reserva antes de qualquer gasto — já é 'dinheiro extra' por natureza.",
    "Cashback e pontos de cartão que já são seus por direito frequentemente ficam esquecidos — vale checar o app do cartão uma vez por mês.",
    "Revenda com pequena margem (compra em atacado, venda no varejo) é uma renda extra comum para quem tem tempo e uma rede de contatos local.",
    "Serviços sob demanda (motorista de aplicativo, entregas, montagem de móveis) são boas opções de renda extra pontual, sem compromisso fixo.",
    "Se você domina algo específico (Excel, edição de vídeo, design), plataformas de freelance pagam por projeto pequeno — não precisa ser um trabalho grande.",
    "Alugar um espaço ocioso (vaga de garagem, quarto, ferramenta que você usa pouco) pode gerar renda passiva mensal com baixo esforço.",
    "Revisite assinaturas de serviços que você paga mas indica para outras pessoas — alguns têm programas de indicação que pagam de verdade.",
  ],
  insight: [
    "Reserva de emergência não é sobre o valor guardado — é sobre quantos meses de despesa ela cobre. Isso muda com o seu custo de vida, não é um número fixo para sempre.",
    "Dívida com juros altos (cartão, cheque especial) quase sempre compensa mais quitar do que investir o mesmo valor — é um retorno garantido que nenhum investimento seguro paga.",
    "Gasto que você não sente (assinaturas, débitos automáticos pequenos) costuma pesar mais no fim do ano do que o gasto grande e visível que você lembra de ter feito.",
    "Orçamento que estoura todo mês na mesma categoria não é falta de disciplina — geralmente é um teto irreal. Vale ajustar o número antes de se cobrar mais.",
    "Patrimônio líquido (o que você tem menos o que deve) é uma foto mais honesta da sua situação financeira do que o saldo da conta no fim do mês.",
    "Quem acompanha os gastos regularmente costuma gastar menos, mesmo sem se propor a cortar nada — só o ato de olhar já muda o comportamento.",
    "O primeiro passo que mais destrava progresso financeiro geralmente não é 'ganhar mais', é organizar o que já entra e sai — dinheiro invisível é dinheiro perdido.",
    "Metas com prazo definido são cumpridas com mais frequência que metas abertas ('quero economizar mais') — vale sempre colocar um valor e uma data.",
    "Investir pouco e com constância tende a superar quem espera 'ter uma quantia maior' para começar — o tempo no mercado pesa mais que o valor inicial.",
    "Renda alta não é sinônimo de saúde financeira — o que determina isso é a diferença entre o que entra e o que sai, não o tamanho de nenhum dos dois sozinho.",
  ],
};

function dailyPick(arr){
  const days = Math.floor(Date.now()/86400000);
  return arr[days % arr.length];
}

const Notifications = {
  open(){
    document.getElementById("notifPanel").hidden = false;
    document.getElementById("notifBackdrop").hidden = false;
    requestAnimationFrame(()=>document.getElementById("notifPanel").classList.add("open"));
    this.render();
    initIcons();
  },
  close(){
    document.getElementById("notifPanel").classList.remove("open");
    document.getElementById("notifBackdrop").hidden = true;
    setTimeout(()=>{ document.getElementById("notifPanel").hidden = true; }, 200);
  },

  render(){
    const ym = Store.state.settings.selectedYm;
    const alerts = Store.alerts(ym);
    const insights = Store.insights(ym);
    const featuredInsight = insights[0] ? insights[0].text : dailyPick(DAILY_TIPS.insight);

    const body = document.getElementById("notifBody");
    body.innerHTML = `
      <div class="notif-section">
        <div class="notif-section-title">Alertas</div>
        <div class="alert-list">
          ${alerts.length ? alerts.map(a=>`<div class="alert-item ${a.tone}"><i data-lucide="${a.icon}"></i><span>${escapeHtml(a.text)}</span></div>`).join("")
            : `<div class="alert-item good"><i data-lucide="check-circle"></i><span>Tudo em ordem por aqui.</span></div>`}
        </div>
      </div>

      <div class="notif-section">
        <div class="notif-section-title">💡 Dicas de hoje</div>
        <div class="notif-tip"><span class="notif-tip-tag tint-coral">Reduzir gastos</span><p>${escapeHtml(dailyPick(DAILY_TIPS.economia))}</p></div>
        <div class="notif-tip"><span class="notif-tip-tag tint-green">Renda extra</span><p>${escapeHtml(dailyPick(DAILY_TIPS.renda))}</p></div>
        <div class="notif-tip"><span class="notif-tip-tag tint-blue">Sobre suas finanças</span><p>${escapeHtml(featuredInsight)}</p></div>
      </div>

      <p class="notif-foot">Dicas mudam todo dia. Alertas refletem seus dados em tempo real.</p>
    `;
    initIcons();
  },

  init(){
    document.getElementById("closeNotif").addEventListener("click", ()=>this.close());
    document.getElementById("notifBackdrop").addEventListener("click", ()=>this.close());
  },
};

document.addEventListener("DOMContentLoaded", ()=>Notifications.init());
