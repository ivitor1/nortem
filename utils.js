/* =====================================================================
   UTILS — formatting, dates, ids, small helpers used across the app
   ===================================================================== */

const MESES_PT = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho",
                   "Agosto","Setembro","Outubro","Novembro","Dezembro"];
const MESES_ABR_PT = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];
const DIAS_ABR_PT = ["Dom","Seg","Ter","Qua","Qui","Sex","Sáb"];

const DEFAULT_DESPESA_CATS = {
  "Moradia": ["Aluguel","Condomínio","Energia","Água","Gás","Internet","Telefone","Manutenção"],
  "Alimentação": ["Mercado","Restaurante","Delivery","Lanches","Padaria","Outros"],
  "Transporte": ["Combustível","Uber","99","Transporte público","Estacionamento","Pedágio","Manutenção","Seguro"],
  "Saúde": ["Farmácia","Consultas","Exames","Plano de saúde","Academia","Outros"],
  "Lazer": ["Cinema","Streaming","Viagens","Passeios","Jogos","Outros"],
  "Educação": ["Cursos","Faculdade","Livros","Materiais"],
  "Financeiro": ["Empréstimo","Juros","Tarifas","Anuidade","Investimentos","Poupança"],
  "Pessoal": ["Roupas","Calçados","Beleza","Presentes","Outros"],
};
const DEFAULT_RECEITA_CATS = ["Salário","Renda extra","Freelance","Reembolso","Rendimentos","Outros"];
const CATEGORY_COLORS = {
  "Moradia":"#3E63DD","Alimentação":"#0FA678","Transporte":"#B8892B","Saúde":"#E1543F",
  "Lazer":"#8B5CF6","Educação":"#0EA5B7","Financeiro":"#64748B","Pessoal":"#DB2777",
  "Salário":"#0FA678","Renda extra":"#0FA678","Freelance":"#0FA678","Reembolso":"#0FA678",
  "Rendimentos":"#0FA678","Outros":"#94A3B8"
};

function uid(prefix){
  return (prefix||"id") + "_" + Math.random().toString(36).slice(2,9) + Date.now().toString(36).slice(-4);
}

function money(v){
  v = Number(v)||0;
  return v.toLocaleString('pt-BR', {style:'currency', currency:'BRL'});
}
function moneyCompact(v){
  v = Number(v)||0;
  const abs = Math.abs(v);
  if(abs >= 1000000) return (v/1000000).toLocaleString('pt-BR',{maximumFractionDigits:1})+"M";
  if(abs >= 1000) return (v/1000).toLocaleString('pt-BR',{maximumFractionDigits:1})+"k";
  return money(v);
}
function pct(v, digits=0){
  v = Number(v)||0;
  return v.toLocaleString('pt-BR', {style:'percent', minimumFractionDigits:digits, maximumFractionDigits:digits});
}
function clamp(v, min, max){ return Math.max(min, Math.min(max, v)); }

// dateStr: "YYYY-MM-DD"
function todayStr(){ return new Date().toISOString().slice(0,10); }
function parseDate(s){ if(!s) return null; const [y,m,d]=s.split("-").map(Number); return new Date(y, m-1, d); }
function fmtDate(s){ const d = parseDate(s); if(!d) return ""; return d.toLocaleDateString('pt-BR'); }
function fmtDateLong(s){ const d = parseDate(s); if(!d) return ""; return `${d.getDate()} de ${MESES_PT[d.getMonth()].toLowerCase()}`; }
function monthNameOf(dateStr){ const d = parseDate(dateStr); return d? MESES_PT[d.getMonth()] : ""; }
function monthIndexOf(dateStr){ const d = parseDate(dateStr); return d? d.getMonth() : -1; }
function yearOf(dateStr){ const d = parseDate(dateStr); return d? d.getFullYear() : null; }
function addDays(dateStr, n){
  const d = parseDate(dateStr);
  const nd = new Date(d.getFullYear(), d.getMonth(), d.getDate()+n);
  return nd.toISOString().slice(0,10);
}
function addMonths(dateStr, n){
  const d = parseDate(dateStr);
  const nd = new Date(d.getFullYear(), d.getMonth()+n, Math.min(d.getDate(),28));
  return nd.toISOString().slice(0,10);
}
function ymKey(dateStr){ const d=parseDate(dateStr); return d? `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}` : ""; }
function daysUntil(dateStr){
  const d = parseDate(dateStr); if(!d) return null;
  const t = new Date(); t.setHours(0,0,0,0);
  return Math.round((d - t) / 86400000);
}

function debounce(fn, ms){
  let t; return (...args)=>{ clearTimeout(t); t = setTimeout(()=>fn(...args), ms); };
}

function escapeHtml(s){
  return String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
}

function progressTone(pctUsed){
  if(pctUsed > 1) return "coral";
  if(pctUsed >= 0.7) return "gold";
  return "green";
}
function statusPillClass(pctUsed){
  if(pctUsed > 1) return "over";
  if(pctUsed >= 0.7) return "warn";
  return "ok";
}

function initIcons(){
  if(window.lucide) window.lucide.createIcons();
}
