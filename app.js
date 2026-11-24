const KEY="agendaInteligente_v1";
let db;
try { db=JSON.parse(localStorage.getItem(KEY)||'{"events":[],"bills":[],"cards":[]}'); } catch { db={events:[],bills:[],cards:[]}; }
if(!db || typeof db!=="object") db={};
db={events:Array.isArray(db.events)?db.events:[],bills:Array.isArray(db.bills)?db.bills:[],cards:Array.isArray(db.cards)?db.cards:[],incomes:Array.isArray(db.incomes)?db.incomes:[],budgets:db.budgets&&typeof db.budgets==="object"?db.budgets:{},debts:Array.isArray(db.debts)?db.debts:[]};
db.bills.forEach(x=>{if(!x.category)x.category="Outros";});
let activeView="home";
const $=s=>document.querySelector(s);
const money=n=>Number(n||0).toLocaleString("pt-BR",{style:"currency",currency:"BRL"});
function parseMoney(value){let raw=String(value??"").trim().replace(/R\$/gi,"").replace(/\s/g,"");if(!raw)return 0;const comma=raw.lastIndexOf(","),dot=raw.lastIndexOf(".");if(comma>=0){raw=raw.replace(/\./g,"").replace(",",".");}else if(dot>=0){const decimals=raw.length-dot-1;if(decimals===1||decimals===2)raw=raw.slice(0,dot).replace(/\./g,"")+"."+raw.slice(dot+1);else raw=raw.replace(/\./g,"");}const number=Number(raw);return Number.isFinite(number)?Math.round(number*100)/100:0;}
function formatMoneyInput(value,complete=false){let raw=String(value??"").replace(/[^0-9,]/g,"");const hasComma=raw.includes(",");const parts=raw.split(",");let integer=(parts[0]||"").replace(/\D/g,"").replace(/^0+(?=\d)/,"");integer=integer.replace(/\B(?=(\d{3})+(?!\d))/g,".");let decimals=(parts[1]||"").replace(/\D/g,"").slice(0,2);if(complete&&!hasComma)decimals="00";if(complete&&hasComma)decimals=decimals.padEnd(2,"0");return integer+(hasComma||complete?","+decimals:"");}
function bindMoneyInputs(root){root.querySelectorAll("[data-money]").forEach(input=>{input.type="text";input.inputMode="decimal";input.autocomplete="off";input.addEventListener("blur",()=>{if(input.value.trim())input.value=Number(parseMoney(input.value)).toLocaleString("pt-BR",{minimumFractionDigits:2,maximumFractionDigits:2});});});}
const fmt=d=>new Date(d+"T12:00:00").toLocaleDateString("pt-BR");
function esc(s){return String(s||"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));}
function save(){localStorage.setItem(KEY,JSON.stringify(db));render();}
function addMonths(s,n){let d=new Date(s+"T12:00:00"),day=d.getDate();d.setDate(1);d.setMonth(d.getMonth()+n);d.setDate(Math.min(day,new Date(d.getFullYear(),d.getMonth()+1,0).getDate()));return d.toISOString().slice(0,10);}
function setView(v){if(v==="family"){activeView="family";if(window.AgendaInteligenteFamily){window.AgendaInteligenteFamily.open();}else{document.querySelectorAll("[data-view]").forEach(b=>b.classList.toggle("active",b.dataset.view==="family"));$("#mainContent").innerHTML='<section class="panel"><h2>Família</h2><p class="muted">O módulo Família não carregou. Atualize a página e tente novamente.</p></section>';}return;}activeView=v;render();}
document.querySelectorAll("[data-view]").forEach(b=>b.onclick=()=>setView(b.dataset.view));
const menuToggle=document.getElementById("menuToggle");
const mainSidebar=document.querySelector(".sidebar");
if(menuToggle&&mainSidebar){
 menuToggle.addEventListener("click",()=>{
  const open=mainSidebar.classList.toggle("menu-open");
  menuToggle.setAttribute("aria-expanded",String(open));
  menuToggle.querySelector(".menu-toggle-icon").textContent=open?"✕":"☰";
  menuToggle.querySelector("span:last-child").textContent=open?"Fechar":"Menu";
 });
 document.querySelectorAll(".sidebar [data-view]").forEach(b=>b.addEventListener("click",()=>{
  mainSidebar.classList.remove("menu-open");
  menuToggle.setAttribute("aria-expanded","false");
  menuToggle.querySelector(".menu-toggle-icon").textContent="☰";
  menuToggle.querySelector("span:last-child").textContent="Menu";
 }));
}
function row(title,sub,amount="",paid=null,action=""){return '<div class="list-item"><div><strong>'+esc(title)+'</strong><small>'+esc(sub)+'</small></div><div style="text-align:right">'+(amount?'<strong>'+money(amount)+'</strong> ':"")+(paid===null?"":'<span class="pill '+(paid?"paid":"")+'">'+(paid?"Pago":"Pendente")+'</span>')+action+'</div></div>';}
function openForm(type){
 const configs={
  event:{title:"Novo compromisso",fields:[["title","Nome do compromisso","text"],["date","Data","date"],["time","Horário","time"]]},
  bill:{title:"Nova conta",fields:[["title","Descrição","text"],["category","Categoria","category"],["amount","Valor total (R$)","number"],["date","Primeiro vencimento","date"],["installments","Parcelas","number"]]},
  purchase:{title:"Registrar compra",fields:[["title","O que comprou?","text"],["category","Categoria","category"],["amount","Valor total da compra (R$)","number"],["installments","Parcelas","number"],["date","Primeiro vencimento","date"],["cardId","Cartão (opcional)","select"]]},
  card:{title:"Cadastrar cartão",fields:[["title","Nome do cartão","text"],["limit","Limite total (R$)","number"],["closing","Dia de fechamento","number"],["due","Dia de vencimento","number"]]},
  income:{title:"Registrar receita",fields:[["title","Descrição da receita","text"],["amount","Valor recebido (R$)","number"],["date","Data do recebimento","date"]]},
  budget:{title:"Definir orçamento mensal",fields:[["month","Mês do orçamento","month"],["category","Categoria","category"],["amount","Limite mensal (R$)","number"]]}
 };
 const cfg=configs[type];if(!cfg){alert("Tipo de registro inválido.");return;}
 const categories=["Alimentação","Transporte","Moradia","Saúde","Educação","Lazer e diversão","Compras","Contas e serviços","Outros"];
 const root=$("#modalRoot");
 const fields=cfg.fields.map(([name,label,inputType])=>{
  if(inputType==="select"){const options=db.cards.map(card=>'<option value="'+esc(card.id)+'">'+esc(card.title)+'</option>').join("");return '<div class="field"><label>'+label+'</label><select name="cardId"><option value="">Sem cartão · não vincular</option>'+options+'</select>'+(db.cards.length?'':'<small class="muted">Você ainda não cadastrou cartões. É possível salvar a compra sem vínculo e cadastrar um cartão depois.</small>')+'</div>';}
  if(inputType==="category"){const options=categories.map(cat=>'<option value="'+cat+'">'+cat+'</option>').join("");return '<div class="field"><label>'+label+'</label><select name="category">'+options+'</select></div>';}
  const isMoney=name==="amount"||name==="limit";
  const attrs=name==="installments"?'min="1" max="120" step="1" value="1"':((name==="closing"||name==="due")?'min="1" max="31" step="1" placeholder="1 a 31"':(isMoney?'inputmode="decimal" data-money placeholder="0,00"':(inputType==="number"?'min="0" step="0.01"':"")));
  const fieldType=isMoney?"text":inputType;
  const defaultValue=name==="month"?'value="'+new Date().toISOString().slice(0,7)+'"':"";
  return '<div class="field"><label>'+label+'</label><input name="'+name+'" type="'+fieldType+'" required '+attrs+' '+defaultValue+'></div>';
 }).join("");
 const editor=(type==="purchase"||type==="bill")?'<section class="installment-editor"><p class="muted">Digite o valor normalmente. Os pontos de milhar e a vírgula dos centavos serão inseridos automaticamente.</p><div class="field"><label>Valor de cada parcela (R$)</label><input id="installmentUnit" type="text" inputmode="decimal" data-money placeholder="0,00"></div><strong id="installmentSum"></strong></section>':"";
 root.innerHTML='<div class="modal-backdrop"><section class="modal" role="dialog" aria-modal="true" aria-label="'+esc(cfg.title)+'"><header class="modal-head"><div><p class="modal-kicker">AGENDA INTELIGENTE</p><h2>'+cfg.title+'</h2></div><button class="close" type="button" aria-label="Fechar formulário">×</button></header><form id="recordForm" class="modal-form"><div class="modal-body">'+fields+editor+'</div><footer class="modal-footer"><button class="primary" type="submit">Salvar registro</button></footer></form></section></div></div>';
 root.querySelector(".close").onclick=()=>{root.innerHTML="";};
 root.querySelector(".modal-backdrop").onclick=e=>{if(e.target.classList.contains("modal-backdrop"))root.innerHTML="";};
 const form=root.querySelector("#recordForm");
 bindMoneyInputs(root);
 const unit=root.querySelector("#installmentUnit");
 const sumLabel=root.querySelector("#installmentSum");
 function cents(n){return Math.round(parseMoney(n)*100);}
 function updateUnit(){
  if(!unit)return;
  const count=Math.max(1,Math.min(120,Number(form.elements.installments.value)||1));
  const value=cents(unit.value),sum=value*count;
  sumLabel.textContent="Total das "+count+" parcelas: "+money(sum/100);
  if(form.elements.amount)form.elements.amount.value=unit.value?formatMoneyInput((sum/100).toFixed(2).replace(".",","),true):"";
 }
 function updateUnitFromTotal(){
  if(!unit)return;
  const count=Math.max(1,Math.min(120,Number(form.elements.installments.value)||1));
  const total=cents(form.elements.amount.value);
  unit.value=total?formatMoneyInput((Math.floor(total/count)/100).toFixed(2).replace(".",","),true):"";
  const unitCents=unit.value?cents(unit.value):0;
  sumLabel.textContent="Total das "+count+" parcelas: "+money((unitCents*count)/100);
 }
 if(unit){
  unit.oninput=updateUnit;
  form.elements.amount.oninput=updateUnitFromTotal;
  form.elements.installments.oninput=updateUnitFromTotal;
  updateUnitFromTotal();
 }
 form.onsubmit=e=>{
  e.preventDefault();
  const f=Object.fromEntries(new FormData(form));
  const id=crypto.randomUUID();
  if(type==="event")db.events.push({id,...f});
  if(type==="card")db.cards.push({id,...f,limit:parseMoney(f.limit),closing:+f.closing,due:+f.due});
  if(type==="income")db.incomes.push({id,title:f.title,amount:parseMoney(f.amount),date:f.date});
  if(type==="budget"){if(!db.budgets[f.month])db.budgets[f.month]={};db.budgets[f.month][f.category]=parseMoney(f.amount);}
  if(type==="bill"||type==="purchase"){
   const count=Math.max(1,Math.min(120,+f.installments||1));
   const unitValue=unit?cents(unit.value):0;
   const total=cents(f.amount);
   const base=unit&&unit.value!==""?unitValue:Math.floor(total/count);
   const amounts=Array.from({length:count},()=>base/100);
   amounts.forEach((amount,i)=>db.bills.push({id:crypto.randomUUID(),groupId:id,title:f.title,amount,date:addMonths(f.date,i),part:i+1,count,paid:false,cardId:f.cardId||"",category:f.category||"Outros",kind:type}));
  }
  root.innerHTML="";save();
 };
}

function drawFinancialAlerts(selected,incomes,expenses,incomeTotal,expenseTotal,projectedBalance){
 const root=$("#financialAlerts");if(!root)return;
 const today=new Date(),todayKey=today.getFullYear()+"-"+String(today.getMonth()+1).padStart(2,"0")+"-"+String(today.getDate()).padStart(2,"0");
 const essentialCategories=["Alimentação","Moradia","Saúde","Contas e serviços"];
 const essentialSpend=expenses.filter(x=>essentialCategories.includes(x.category||"Outros")).reduce((n,x)=>n+(Number(x.amount)||0),0);
 const pending=expenses.filter(x=>!x.paid);
 const overdue=selected===todayKey.slice(0,7)?pending.filter(x=>String(x.date||"")<todayKey):[];
 const ratio=incomeTotal>0?expenseTotal/incomeTotal*100:(expenseTotal>0?100:0);
 const priorityDebts=db.debts.filter(x=>(x.type==="mandatory"||x.type==="essential")&&Number(x.balance)>0);
 const priorityMinimum=priorityDebts.reduce((n,x)=>n+(Number(x.minimum)||0),0);
 const highRiskSoon=selected===todayKey.slice(0,7)?db.debts.filter(x=>Number(x.balance)>0&&x.risk==="high"&&x.date&&x.date>=todayKey&&x.date<=addDays(todayKey,7)):[];
 const possibleDuplicates=[];
 if(selected===todayKey.slice(0,7)){
  db.debts.forEach(d=>(Array.isArray(d.payments)?d.payments:[]).forEach(p=>{
   if(p.includeInFinance!==true||!String(p.date||"").startsWith(selected))return;
   const cents=Math.round((Number(p.amount)||0)*100);
   const matches=db.bills.filter(b=>String(b.date||"")===String(p.date||"")&&Math.round((Number(b.amount)||0)*100)===cents);
   if(matches.length)possibleDuplicates.push({debt:d,payment:p,count:matches.length});
  }));
 }

 const budget=parseMoney(localStorage.getItem("agendaDebtBudget")||"");
 const alerts=[];
 if(incomeTotal<=0&&expenseTotal>0)alerts.push({level:"warning",title:"Renda não registrada",text:"Há despesas cadastradas, mas nenhuma receita neste mês. Registre sua renda para melhorar a análise."});
 if(projectedBalance<0)alerts.push({level:"critical",title:"Despesas acima das receitas",text:"As despesas cadastradas superam as receitas em "+money(Math.abs(projectedBalance))+". Revise gastos não essenciais e procure negociar contas antes do vencimento."});
 else if(incomeTotal>0&&ratio>=85)alerts.push({level:"warning",title:"Orçamento muito comprometido",text:"As despesas representam "+ratio.toFixed(1).replace(".",",")+"% das receitas deste mês. A margem restante está pequena."});
 else if(incomeTotal>0&&ratio>=65)alerts.push({level:"attention",title:"Atenção ao comprometimento da renda",text:"As despesas representam "+ratio.toFixed(1).replace(".",",")+"% das receitas. Acompanhe os próximos vencimentos antes de assumir novos gastos."});
 if(overdue.length)alerts.push({level:"critical",title:overdue.length+" conta(s) vencida(s)",text:"Existem despesas pendentes com vencimento anterior a hoje. Confira as consequências do atraso e contate o credor para verificar opções."});
 if(highRiskSoon.length)alerts.push({level:"warning",title:"Obrigação de alto risco próxima do vencimento",text:highRiskSoon.map(x=>x.title).join(", ")+". Confira o contrato e procure o credor antes do vencimento."});
 if(possibleDuplicates.length)alerts.push({level:"warning",title:possibleDuplicates.length+" possível(is) lançamento(s) duplicado(s)",text:possibleDuplicates.map(x=>x.debt.title+" · "+money(x.payment.amount)+" em "+fmt(x.payment.date)).join("; ")+". O mesmo valor e data também aparecem em Contas e despesas. Confira o Histórico de pagamentos da dívida e use “Retirar do fluxo de caixa” se for o mesmo pagamento."});
 if(budget>0&&priorityMinimum>budget)alerts.push({level:"warning",title:"Reserva mensal abaixo das obrigações prioritárias",text:"As parcelas mínimas prioritárias cadastradas somam "+money(priorityMinimum)+", acima dos "+money(budget)+" reservados. Avalie uma negociação antes de comprometer o orçamento."});
 if(!alerts.length)alerts.push({level:"good",title:"Nenhum sinal crítico identificado",text:"Pelos lançamentos cadastrados, não há alerta de déficit, vencimento atrasado ou obrigação prioritária acima da reserva informada. Continue atualizando suas contas."});
 const severity={critical:0,warning:1,attention:2,good:3};
 alerts.sort((a,b)=>severity[a.level]-severity[b.level]);
 const label={critical:"Ação necessária",warning:"Atenção",attention:"Monitorar",good:"Situação estável"};
 root.innerHTML='<div class="alert-overview"><div class="alert-overview-main"><span class="alert-status '+alerts[0].level+'">'+label[alerts[0].level]+'</span><strong>'+alerts.filter(x=>x.level!=="good").length+' alerta(s) ativo(s) neste mês</strong></div><div class="alert-metrics"><div><small>Renda comprometida</small><b>'+ratio.toFixed(1).replace(".",",")+'%</b></div><div><small>Despesas essenciais cadastradas</small><b>'+money(essentialSpend)+'</b></div><div><small>Parcelas prioritárias</small><b>'+money(priorityMinimum)+'</b></div></div></div><div class="financial-alert-list">'+alerts.map(x=>'<article class="financial-alert '+x.level+'"><span class="financial-alert-mark">'+(x.level==="critical"?"!":x.level==="good"?"✓":"•")+'</span><div><strong>'+x.title+'</strong><p>'+x.text+'</p></div></article>').join("")+'</div><p class="alert-disclaimer">Análise baseada somente nos valores e classificações que você cadastrou. As parcelas prioritárias são exibidas separadamente e não são somadas novamente às despesas, para evitar duplicidade. O aplicativo não consulta bancos, contratos ou serviços públicos.</p>';
}
function addDays(dateString,days){
 const d=new Date(dateString+"T12:00:00");d.setDate(d.getDate()+days);return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0");
}
function debtPaymentExpensesForMonth(month){
 return db.debts.flatMap(debt=>(Array.isArray(debt.payments)?debt.payments:[])
  .filter(payment=>{
   if(!String(payment.date||"").startsWith(month)||payment.includeInFinance===false)return false;
   if(payment.includeInFinance===true)return true;
   const cents=Math.round((Number(payment.amount)||0)*100);
   return !db.bills.some(bill=>String(bill.date||"")===String(payment.date||"")&&Math.round((Number(bill.amount)||0)*100)===cents);
  })
  .map(payment=>({id:payment.id,title:"Pagamento de "+debt.title,amount:Number(payment.amount)||0,date:payment.date,paid:true,category:"Contas e serviços",kind:"debtPayment",note:payment.note||""})));
}
function drawFinanceCalendar(month,expenses,incomes){
 const root=$("#financeCalendar"),details=$("#calendarDayDetails");if(!root||!details)return;
 const [year,mon]=month.split("-").map(Number),first=new Date(year,mon-1,1),days=new Date(year,mon,0).getDate(),offset=(first.getDay()+6)%7;
 const byDay={};[...incomes.map(x=>({...x,_income:true})),...expenses.map(x=>({...x,_income:false}))].forEach(x=>{const d=Number(String(x.date||"").slice(8,10));if(!d)return;(byDay[d]||(byDay[d]=[])).push(x);});
 const labels=["Seg","Ter","Qua","Qui","Sex","Sáb","Dom"];
 let html='<div class="calendar-grid calendar-labels">'+labels.map(x=>'<span>'+x+'</span>').join("")+'</div><div class="calendar-grid">';
 for(let n=0;n<offset;n++)html+='<span class="calendar-empty"></span>';
 for(let d=1;d<=days;d++){const list=byDay[d]||[],hasIn=list.some(x=>x._income),hasOut=list.some(x=>!x._income);html+='<button type="button" class="calendar-day '+(list.length?"has-items":"")+'" data-calendar-day="'+d+'"><b>'+d+'</b><span class="calendar-dots">'+(hasIn?'<i class="in"></i>':"")+(hasOut?'<i class="out"></i>':"")+'</span></button>';}
 html+='</div><div class="calendar-legend"><span><i class="in"></i> Receitas</span><span><i class="out"></i> Despesas e vencimentos</span></div>';
 root.innerHTML=html;
 const showDay=d=>{const list=byDay[d]||[];details.innerHTML='<h3>'+String(d).padStart(2,"0")+'/'+String(mon).padStart(2,"0")+'/'+year+'</h3>'+(list.length?list.map(x=>'<div class="calendar-detail-row"><div><strong>'+esc(x.title)+'</strong><small>'+(x._income?"Receita recebida":x.paid?"Despesa paga":"Despesa pendente")+'</small></div><b class="'+(x._income?"positive-text":"")+'">'+(x._income?"+ ":"− ")+money(x.amount)+'</b></div>').join(""):'<p class="muted">Nenhuma movimentação nesta data.</p>');};
 root.querySelectorAll("[data-calendar-day]").forEach(btn=>btn.onclick=()=>{root.querySelectorAll(".calendar-day").forEach(x=>x.classList.remove("selected"));btn.classList.add("selected");showDay(Number(btn.dataset.calendarDay));});
 const today=new Date();const initial=today.getFullYear()===year&&today.getMonth()+1===mon?today.getDate():1;const target=root.querySelector('[data-calendar-day="'+initial+'"]');if(target)target.click();else showDay(1);
}
function openDebtForm(debtId=""){
 const current=db.debts.find(x=>x.id===debtId)||null,root=$("#modalRoot"),cats=["Obrigação prioritária","Dívida negociável","Conta essencial fixa","Gasto que posso reduzir"];
 const values=current||{title:"",type:"mandatory",balance:"",minimum:"",interest:"",date:"",risk:"medium"};
 root.innerHTML='<div class="modal-backdrop"><div class="modal"><div class="modal-head"><h2>'+(current?"Editar dívida":"Cadastrar compromisso ou dívida")+'</h2><button class="close" type="button">×</button></div><form id="debtForm"><div class="field"><label>Nome da conta ou dívida</label><input name="title" required placeholder="Ex.: Cartão, aluguel, empréstimo" value="'+esc(values.title)+'"></div><div class="field"><label>Classificação</label><select name="type">'+cats.map((x,i)=>'<option value="'+["mandatory","negotiable","essential","flexible"][i]+'" '+(values.type===["mandatory","negotiable","essential","flexible"][i]?"selected":"")+'>'+x+'</option>').join("")+'</select></div><div class="field"><label>Valor total em aberto (R$)</label><input name="balance" data-money inputmode="decimal" required placeholder="0,00" value="'+Number(values.balance||0).toLocaleString("pt-BR",{minimumFractionDigits:2,maximumFractionDigits:2})+'"></div><div class="field"><label>Pagamento mínimo ou parcela mensal (R$)</label><input name="minimum" data-money inputmode="decimal" placeholder="0,00" value="'+Number(values.minimum||0).toLocaleString("pt-BR",{minimumFractionDigits:2,maximumFractionDigits:2})+'"></div><div class="field"><label>Juros ao mês (%) — se souber</label><input name="interest" type="number" min="0" max="1000" step="0.01" placeholder="Opcional" value="'+(values.interest||"")+'"></div><div class="field"><label>Próximo vencimento</label><input name="date" type="date" required value="'+esc(values.date)+'"></div><div class="field"><label>O que pode acontecer se atrasar?</label><select name="risk"><option value="high" '+(values.risk==="high"?"selected":"")+'>Risco alto: corte, perda de bem ou consequência legal</option><option value="medium" '+(values.risk==="medium"?"selected":"")+'>Risco moderado: juros, multa ou cobrança</option><option value="low" '+(values.risk==="low"?"selected":"")+'>Pode negociar sem consequência imediata conhecida</option></select></div><button class="primary" type="submit">Salvar dívida</button></form></div></div>';
 bindMoneyInputs(root);root.querySelector(".close").onclick=()=>root.innerHTML="";root.querySelector(".modal-backdrop").onclick=e=>{if(e.target.classList.contains("modal-backdrop"))root.innerHTML="";};
 root.querySelector("#debtForm").onsubmit=e=>{e.preventDefault();const f=Object.fromEntries(new FormData(e.currentTarget)),balance=parseMoney(f.balance),minimum=parseMoney(f.minimum);if(balance<0||minimum<0){alert("Informe valores válidos.");return;}if(current){current.title=f.title.trim();current.type=f.type;current.balance=balance;current.initialBalance=balance+(Array.isArray(current.payments)?current.payments.reduce((n,p)=>n+(Number(p.amount)||0),0):0);current.minimum=minimum;current.interest=Number(f.interest)||0;current.date=f.date;current.risk=f.risk;}else db.debts.push({id:crypto.randomUUID(),title:f.title.trim(),type:f.type,balance,initialBalance:balance,minimum,interest:Number(f.interest)||0,date:f.date,risk:f.risk,payments:[]});root.innerHTML="";save();};
}
function openDebtPayment(debtId,paymentId=""){
 const debt=db.debts.find(x=>x.id===debtId);if(!debt)return;
 const existing=paymentId?(Array.isArray(debt.payments)?debt.payments.find(x=>x.id===paymentId):null):null;
 if(paymentId&&!existing)return;
 const root=$("#modalRoot"),title=existing?"Corrigir pagamento":"Registrar pagamento";
 const amount=existing?existing.amount:"",date=existing?existing.date:new Date().toISOString().slice(0,10),note=existing?existing.note||"":"";
 const alreadyRecorded=existing?existing.includeInFinance===false:false;
 root.innerHTML='<div class="modal-backdrop"><div class="modal"><div class="modal-head"><h2>'+title+'</h2><button class="close" type="button">×</button></div><p class="muted">'+esc(debt.title)+' · Saldo em aberto: '+money(debt.balance)+'</p><form id="debtPaymentForm"><div class="field"><label>Valor pago (R$)</label><input name="amount" data-money inputmode="decimal" required placeholder="0,00" value="'+(amount!==""?Number(amount).toLocaleString("pt-BR",{minimumFractionDigits:2,maximumFractionDigits:2}):"")+'"></div><div class="field"><label>Data do pagamento</label><input name="date" type="date" required value="'+esc(date)+'"></div><div class="field"><label>Observação (opcional)</label><input name="note" placeholder="Ex.: pagamento negociado" value="'+esc(note)+'"></div><div class="field"><label class="checkbox-field"><input name="alreadyRecorded" type="checkbox" '+(alreadyRecorded?"checked":"")+'> Este pagamento já está lançado em Contas e despesas</label><small class="muted">Marque somente se esta mesma quantia já foi cadastrada como despesa. Assim ela não será somada novamente ao fluxo de caixa.</small></div><button class="primary" type="submit">'+(existing?"Salvar correção":"Confirmar pagamento")+'</button></form></div></div>';
 bindMoneyInputs(root);root.querySelector(".close").onclick=()=>root.innerHTML="";root.querySelector(".modal-backdrop").onclick=e=>{if(e.target.classList.contains("modal-backdrop"))root.innerHTML="";};
 root.querySelector("#debtPaymentForm").onsubmit=e=>{
  e.preventDefault();const f=Object.fromEntries(new FormData(e.currentTarget)),nextAmount=parseMoney(f.amount);
  if(!(nextAmount>0)){alert("Informe um valor maior que zero.");return;}
  const available=Number(debt.balance)||0,oldAmount=existing?(Number(existing.amount)||0):0;
  if(nextAmount>available+oldAmount+0.001){alert("O valor informado ultrapassa o saldo da dívida.");return;}
  if(!f.alreadyRecorded){
   const duplicate=db.bills.some(bill=>String(bill.date||"")===String(f.date||"")&&Math.round((Number(bill.amount)||0)*100)===Math.round(nextAmount*100));
   if(duplicate&&!confirm("Já existe uma despesa com a mesma data e valor em Contas e despesas. Se for este mesmo pagamento, marque a caixa para evitar duplicidade. Deseja incluir mesmo assim?"))return;
  }
  if(existing){
   debt.balance=Math.max(0,Math.round((available+oldAmount-nextAmount)*100)/100);
   existing.amount=nextAmount;existing.date=f.date;existing.note=f.note.trim();existing.includeInFinance=!f.alreadyRecorded;
  }else{
   if(nextAmount>available+0.001){alert("O pagamento não pode ser maior que o saldo em aberto.");return;}
   debt.balance=Math.max(0,Math.round((available-nextAmount)*100)/100);
   debt.payments=Array.isArray(debt.payments)?debt.payments:[];
   debt.payments.push({id:crypto.randomUUID(),amount:nextAmount,date:f.date,note:f.note.trim(),includeInFinance:!f.alreadyRecorded});
  }
  root.innerHTML="";save();
 };
}

function simulateDebtStrategy(items,monthlyBudget,method){
 const rows=items.map(x=>({id:x.id,title:x.title,balance:Math.round(Math.max(0,Number(x.balance)||0)*100),minimum:Math.round(Math.max(0,Number(x.minimum)||0)*100),rate:Math.max(0,Number(x.interest)||0)/100,priority:(x.type==="mandatory"||x.type==="essential")?0:1,payoffMonth:null}));
 if(!rows.length)return {months:0,interest:0,paid:0,success:true,schedule:[],payoffs:[]};
 const budget=Math.round(Math.max(0,monthlyBudget)*100);
 if(budget<=0)return {success:false,reason:"Informe um valor disponível para quitar dívidas."};
 let interest=0,paid=0;const schedule=[];
 for(let month=1;month<=360;month++){
  const active=rows.filter(x=>x.balance>0);
  if(!active.length)return {success:true,months:month-1,interest:interest/100,paid:paid/100,schedule,payoffs:rows.filter(x=>x.payoffMonth).map(x=>({title:x.title,month:x.payoffMonth}))};
  let interestThisMonth=0;const interestById=new Map();
  for(const x of active){const charge=Math.round(x.balance*x.rate);x.balance+=charge;interest+=charge;interestThisMonth+=charge;interestById.set(x.id,charge);}
  let remaining=budget;
  const minimumTotal=active.reduce((sum,x)=>sum+Math.min(x.balance,x.minimum),0);
  if(minimumTotal>budget)return {success:false,reason:"O valor disponível não cobre as parcelas mínimas das dívidas negociáveis. Negocie os pagamentos mínimos antes de simular."};
  const monthRows=active.map(x=>({id:x.id,title:x.title,interest:0,payment:0,closing:0}));
  const detailById=new Map(monthRows.map(x=>[x.id,x]));
  for(const x of active){const charge=interestById.get(x.id)||0;const d=detailById.get(x.id);d.interest=charge/100;const amount=Math.min(x.balance,x.minimum);x.balance-=amount;remaining-=amount;paid+=amount;d.payment+=amount/100;}
  const sorted=rows.filter(x=>x.balance>0).sort((a,b)=>a.priority-b.priority||(method==="avalanche"?(b.rate-a.rate||a.balance-b.balance):(a.balance-b.balance||b.rate-a.rate)));
  for(const x of sorted){if(remaining<=0)break;const amount=Math.min(remaining,x.balance);x.balance-=amount;remaining-=amount;paid+=amount;detailById.get(x.id).payment+=amount/100;}
  for(const x of rows){const d=detailById.get(x.id);if(!d)continue;d.closing=x.balance/100;if(x.balance<=0&&!x.payoffMonth)x.payoffMonth=month;}
  const monthPaid=monthRows.reduce((sum,x)=>sum+Math.round(x.payment*100),0);
  schedule.push({month,interest:interestThisMonth/100,payment:monthPaid/100,balance:rows.reduce((sum,x)=>sum+x.balance,0)/100,details:monthRows});
  if(rows.every(x=>x.balance<=0))return {success:true,months:month,interest:interest/100,paid:paid/100,schedule,payoffs:rows.filter(x=>x.payoffMonth).map(x=>({title:x.title,month:x.payoffMonth}))};
  if(budget<=interestThisMonth)return {success:false,reason:"Com este orçamento, os juros podem impedir a quitação. Considere negociar taxas menores.",schedule};
 }
 return {success:false,reason:"Não foi possível projetar a quitação em até 30 anos. Reveja juros e orçamento.",schedule};
}
function debtStrategyComparison(debts,budget){
 const modeled=debts.filter(x=>x.type!=="flexible"&&Number(x.balance)>0);
 const unknown=modeled.some(x=>!Number(x.interest));
 const priorityMinimum=modeled.filter(x=>x.type==="mandatory"||x.type==="essential").reduce((sum,x)=>sum+Math.min(Math.max(0,Number(x.balance)||0),Math.max(0,Number(x.minimum)||0)),0);
 const base='<div class="strategy-heading"><h3>Compare dois caminhos</h3><p class="muted">A simulação considera o valor mensal informado para todas as obrigações com saldo. Primeiro respeita os pagamentos mínimos; depois direciona o valor restante às obrigações prioritárias e aplica a estratégia escolhida às demais dívidas.</p></div>';
 if(!modeled.length)return base+'<p class="muted">Cadastre uma obrigação ou dívida com saldo em aberto para visualizar a previsão de quitação.</p>';
 if(priorityMinimum>budget)return base+'<article class="strategy-card"><strong>Primeiro passo: renegociar a obrigação prioritária</strong><p class="strategy-warning">O valor reservado é '+money(budget)+' por mês, mas as parcelas mínimas prioritárias somam '+money(priorityMinimum)+'. Faltam '+money(priorityMinimum-budget)+' para cobrir esses mínimos.</p><p>Por enquanto, não seria responsável estimar uma data de quitação. O valor reservado deve ser tratado como capacidade de pagamento para apresentar uma proposta ao credor, não como garantia de que o pagamento parcial evitará juros, multa ou atraso.</p><p><b>Próximos passos:</b> contate o credor antes do vencimento, peça uma parcela que caiba no orçamento, solicite o custo total do acordo e confirme por escrito juros, multas e consequências. Depois, atualize o pagamento mínimo e os juros cadastrados para comparar Bola de neve e Avalanche.</p></article><p class="recovery-note">A simulação de quitação ficará disponível quando o orçamento informado cobrir os mínimos prioritários ou após você atualizar os valores com base em um acordo confirmado. Não deixe de pagar nem atrase uma obrigação com base apenas nesta estimativa.</p>';
 const snow=simulateDebtStrategy(modeled,budget,"snowball"),ava=simulateDebtStrategy(modeled,budget,"avalanche");
 const card=(name,subtitle,sim)=>'<article class="strategy-card"><strong>'+name+'</strong><small>'+subtitle+'</small>'+(sim.success?'<div class="strategy-numbers"><span><b>'+sim.months+'</b> meses</span><span><b>'+money(sim.interest)+'</b> juros estimados</span><span><b>'+money(sim.paid)+'</b> total estimado</span></div>':'<p class="strategy-warning">'+sim.reason+'</p>')+'</article>';
 let html=base+'<div class="strategy-cards">'+card("Bola de neve","Prioriza o menor saldo após as obrigações prioritárias",snow)+card("Avalanche","Prioriza a maior taxa após as obrigações prioritárias",ava)+'</div>';
 if(snow.success&&ava.success){const saving=Math.max(0,snow.interest-ava.interest);html+='<p class="recovery-guidance">'+(saving>0?'Neste cenário, a avalanche economizaria aproximadamente '+money(saving)+' em juros.':'Neste cenário, as estratégias apresentam custos semelhantes.')+'</p>';}
 const schedule=snow.success?snow.schedule:ava.success?ava.schedule:null;
 if(schedule&&schedule.length){
  html+='<div class="debt-schedule"><div class="strategy-heading"><h3>Previsão mês a mês</h3><p class="muted">Evolução estimada usando a estratégia '+(snow.success?'Bola de neve':'Avalanche')+'. Valores arredondados para centavos.</p></div>';
  html+=schedule.slice(0,12).map(row=>'<details class="debt-schedule-month"><summary><span>Mês '+row.month+'</span><b>'+money(row.balance)+' restantes</b></summary><div class="debt-schedule-meta"><span>Pagamento: '+money(row.payment)+'</span><span>Juros: '+money(row.interest)+'</span></div>'+row.details.map(d=>'<div class="debt-schedule-debt"><span>'+esc(d.title)+'</span><span>Pagou '+money(d.payment)+' · Saldo '+money(d.closing)+'</span></div>').join("")+'</details>').join("");
  if(schedule.length>12)html+='<p class="muted">Exibindo os primeiros 12 meses de '+schedule.length+'. O prazo total estimado é '+schedule.length+' meses.</p>';
  const payoff=snow.success?snow.payoffs:ava.payoffs;
  if(payoff&&payoff.length)html+='<div class="debt-payoff-list"><strong>Previsão de quitação por dívida</strong>'+payoff.map(x=>'<div><span>'+esc(x.title)+'</span><b>Mês '+x.month+'</b></div>').join("")+'</div>';
  html+='</div>';
 }
 html+='<p class="recovery-note">Simulação ilustrativa com juros mensais constantes, pagamentos mínimos informados e valor mensal fixo. Não inclui multas, tarifas, descontos, reajustes ou novas compras. '+(unknown?'Atenção: dívidas sem juros informados foram calculadas com taxa zero; o resultado pode subestimar o custo real. ':'')+'Gastos flexíveis não entram na simulação; obrigações essenciais e prioritárias com saldo são incluídas. Confirme os valores e as condições diretamente com cada credor.</p>';
 return html;
}
function drawDebtRecovery(month,incomeTotal){
 const list=$("#debtItems"),overview=$("#recoveryOverview"),result=$("#debtPlanResult");if(!list||!overview||!result)return;
 const types={mandatory:"Obrigação prioritária",essential:"Conta essencial fixa",negotiable:"Dívida negociável",flexible:"Gasto que posso reduzir"};
 const rank={mandatory:0,essential:1,negotiable:2,flexible:3};
 const debts=db.debts.slice().sort((a,b)=>(rank[a.type]??4)-(rank[b.type]??4)||(b.risk==="high"?1:0)-(a.risk==="high"?1:0)||(Number(b.interest)||0)-(Number(a.interest)||0));
 const total=debts.reduce((n,x)=>n+(Number(x.balance)||0),0);
 const paidTotal=debts.reduce((n,x)=>n+(Array.isArray(x.payments)?x.payments.reduce((a,p)=>a+(Number(p.amount)||0),0):0),0);
 const initialTotal=total+paidTotal,progress=initialTotal>0?Math.min(100,paidTotal/initialTotal*100):0;
 const monthly={};debts.forEach(x=>(Array.isArray(x.payments)?x.payments:[]).forEach(p=>{const key=String(p.date||"").slice(0,7);if(/^\\d{4}-\\d{2}$/.test(key))monthly[key]=(monthly[key]||0)+(Number(p.amount)||0);}));
 const months=Object.keys(monthly).sort().slice(-6),maxMonth=Math.max(1,...months.map(k=>monthly[k]));
 const history=months.length?'<div class="debt-progress-history"><h3>Pagamentos por mês</h3>'+months.map(k=>{const [y,m]=k.split("-").map(Number),label=new Date(y,m-1,1).toLocaleDateString("pt-BR",{month:"short",year:"2-digit"});return '<div class="debt-month-row"><span>'+label+'</span><div class="debt-month-track"><i style="width:'+Math.max(3,monthly[k]/maxMonth*100)+'%"></i></div><b>'+money(monthly[k])+'</b></div>';}).join("")+'</div>':'<p class="debt-history-empty">Os pagamentos registrados aparecerão aqui, mês a mês.</p>';
 overview.innerHTML='<div class="recovery-stats"><div><small>Saldo em aberto</small><strong>'+money(total)+'</strong></div><div><small>Total já pago</small><strong>'+money(paidTotal)+'</strong></div><div><small>Valor inicial acompanhado</small><strong>'+money(initialTotal)+'</strong></div></div><div class="debt-progress-card"><div class="debt-progress-head"><span>Progresso de quitação</span><strong>'+progress.toLocaleString("pt-BR",{minimumFractionDigits:1,maximumFractionDigits:1})+'%</strong></div><div class="debt-progress-track"><i style="width:'+progress+'%"></i></div><div class="debt-progress-foot"><span>Pago: '+money(paidTotal)+'</span><span>Falta: '+money(total)+'</span></div></div><div class="recovery-stats recovery-income"><div><small>Renda registrada no mês</small><strong>'+money(incomeTotal)+'</strong></div><div><small>Compromissos cadastrados</small><strong>'+debts.length+'</strong></div></div>'+history+'<p class="recovery-guidance">Primeiro proteja alimentação, moradia, água, energia e saúde. Em seguida, avalie obrigações com risco de corte, perda de bens ou consequências legais. Para as demais, compare juros e negocie condições que caibam no orçamento.</p>';
 list.innerHTML=debts.length?'<h3>Suas dívidas e prioridades</h3>'+debts.map(x=>{const paid=(Array.isArray(x.payments)?x.payments:[]).reduce((n,p)=>n+(Number(p.amount)||0),0);return '<article class="debt-item"><div class="debt-item-head"><div><strong>'+esc(x.title)+'</strong><small>'+types[x.type]+'</small></div><b>'+money(x.balance)+'</b></div><div class="debt-item-meta"><span>Vencimento '+fmt(x.date)+'</span><span>Parcela mínima '+money(x.minimum)+'</span></div><div class="debt-item-meta"><span>Juros informados: '+(x.interest?x.interest.toLocaleString("pt-BR")+'% a.m.':"Não informado")+'</span><span class="risk-'+x.risk+'">'+(x.risk==="high"?"Risco alto":x.risk==="medium"?"Risco moderado":"Risco baixo informado")+'</span></div>'+(paid?'<p class="debt-paid-total">Total já pago: '+money(paid)+' · '+x.payments.length+' pagamento(s)</p>':'')+'<div class="debt-actions"><button class="secondary-button" data-pay-debt="'+x.id+'" '+(Number(x.balance)<=0?'disabled':'')+'>Registrar pagamento</button><button class="text-button" data-edit-debt="'+x.id+'">Editar</button><button class="danger-button" data-delete-debt="'+x.id+'">Remover</button></div>'+(paid?'<details class="debt-history"><summary>Histórico de pagamentos</summary>'+(x.payments||[]).slice().reverse().map(p=>'<div class="debt-history-row"><div><span>'+fmt(p.date)+(p.note?' · '+esc(p.note):'')+'</span><b>'+money(p.amount)+'</b></div><div class="debt-history-actions"><button type="button" class="text-button debt-payment-toggle" data-toggle-debt-payment="'+p.id+'" data-debt-id="'+x.id+'">'+(p.includeInFinance===false?"Incluir no fluxo de caixa":"Retirar do fluxo de caixa")+'</button><button type="button" class="text-button" data-edit-debt-payment="'+p.id+'" data-debt-id="'+x.id+'">Corrigir</button><button type="button" class="danger-button" data-delete-debt-payment="'+p.id+'" data-debt-id="'+x.id+'">Excluir</button></div></div>').join("")+'</details>':'')+'</article>';}).join(""):'<div class="empty">Cadastre suas dívidas e obrigações para montar seu plano.</div>';
 const saved=localStorage.getItem("agendaDebtBudget")||"",budget=parseMoney(saved);
 const budgetInput=$("#debtBudget");if(budgetInput&&budgetInput.value!==saved&&saved)budgetInput.value=Number(budget).toLocaleString("pt-BR",{minimumFractionDigits:2,maximumFractionDigits:2});
 const mandatory=debts.filter(x=>x.type==="mandatory"||x.type==="essential"),negotiable=debts.filter(x=>x.type==="negotiable");
 const required=mandatory.reduce((n,x)=>n+Math.min(Math.max(0,Number(x.balance)||0),Math.max(0,Number(x.minimum)||0)),0);
 let remaining=budget,allocations=[];
 mandatory.forEach(x=>{const due=Math.min(Math.max(0,Number(x.balance)||0),Math.max(0,Number(x.minimum)||0));const pay=Math.min(remaining,due);remaining-=pay;allocations.push({x,pay,short:Math.max(0,due-pay)});});
 const strategy=negotiable.slice().sort((a,b)=>(Number(b.interest)||0)-(Number(a.interest)||0));
 strategy.forEach(x=>{const due=Math.min(Math.max(0,Number(x.balance)||0),Math.max(0,Number(x.minimum)||Number(x.balance)||0));const pay=Math.min(remaining,due);remaining-=pay;allocations.push({x,pay,short:Math.max(0,due-pay)});});
 const flexible=debts.filter(x=>x.type==="flexible"&&Number(x.balance)>0);
 const flexibleMonthly=flexible.reduce((n,x)=>n+Math.max(0,Number(x.minimum)||0),0);
 const flexibleHtml=flexible.length?'<div class="strategy-heading"><h3>Gastos que podem ser reduzidos</h3><p class="muted">Estes itens não são tratados como dívidas nem recebem pagamentos automaticamente. Se você conseguir reduzir ou pausar algum deles, poderá liberar até '+money(flexibleMonthly)+' por mês, conforme os valores informados.</p></div>'+flexible.map(x=>'<div class="plan-allocation"><span>'+esc(x.title)+'<small>Possível redução mensal informada</small></span><b>'+money(x.minimum||0)+'</b></div>').join(""):'' ;
 result.innerHTML=!debts.length?'<p class="muted">Cadastre as dívidas acima para visualizar uma proposta.</p>':!budget?'<p class="muted">Informe quanto consegue reservar por mês. O aplicativo distribuirá o valor conforme as prioridades cadastradas.</p>':'<div class="plan-summary"><small>Valor mensal informado</small><strong>'+money(budget)+'</strong><small>Parcelas mínimas prioritárias cadastradas: '+money(required)+'</small></div>'+allocations.map(a=>'<div class="plan-allocation"><span>'+esc(a.x.title)+'<small>'+(a.x.type==="negotiable"?"Negociar juros e condições":"Proteger obrigação prioritária")+'</small></span><b>'+money(a.pay)+'</b></div>').join("")+'<p class="recovery-guidance">'+(budget<required?'Atenção: o valor reservado não cobre todas as parcelas mínimas prioritárias. Procure os credores antes do vencimento para negociar.':'A proposta respeita primeiro as obrigações essenciais cadastradas. Confirme juros, encargos e condições diretamente com cada credor antes de aceitar acordos.')+'</p>'+flexibleHtml;
 if(budget>0&&debts.length)result.innerHTML+=debtStrategyComparison(debts,budget);

}
function editInstallment(id){
 const current=db.bills.find(x=>x.id===id);if(!current)return;
 const group=db.bills.filter(x=>(x.groupId||x.id)===(current.groupId||current.id)).sort((a,b)=>a.part-b.part);
 const categories=["Alimentação","Transporte","Moradia","Saúde","Educação","Lazer e diversão","Compras","Contas e serviços","Outros"];
 const categoryOptions=categories.map(cat=>'<option value="'+cat+'" '+((current.category||"Outros")===cat?"selected":"")+'>'+cat+'</option>').join("");
 const root=$("#modalRoot");
 root.innerHTML='<div class="modal-backdrop"><div class="modal"><div class="modal-head"><h2>Editar parcela '+current.part+'/'+current.count+'</h2><button class="close" type="button">×</button></div><form id="editInstallmentForm"><div class="field"><label>Aplicar alteração</label><select name="scope"><option value="one">Somente esta parcela</option><option value="future">Esta e todas as próximas</option></select></div><div class="field"><label>Valor desta parcela (R$)</label><input name="amount" type="text" inputmode="decimal" data-money value="'+Number(current.amount).toLocaleString("pt-BR",{minimumFractionDigits:2,maximumFractionDigits:2})+'" required></div><div class="field"><label>Vencimento</label><input name="date" type="date" value="'+esc(current.date)+'" required></div><div class="field"><label>Categoria</label><select name="category">'+categoryOptions+'</select></div><p class="muted">Ao escolher “esta e todas as próximas”, o valor será repetido nas parcelas seguintes e as datas serão ajustadas mantendo o intervalo mensal.</p><button class="primary" type="submit">Salvar alterações</button></form></div></div>';
 bindMoneyInputs(root);
 root.querySelector(".close").onclick=()=>{root.innerHTML="";};
 root.querySelector(".modal-backdrop").onclick=e=>{if(e.target.classList.contains("modal-backdrop"))root.innerHTML="";};
 root.querySelector("#editInstallmentForm").onsubmit=e=>{
  e.preventDefault();const f=Object.fromEntries(new FormData(e.target)),amount=parseMoney(f.amount);
  const targets=f.scope==="future"?group.filter(x=>x.part>=current.part):[current];
  targets.forEach(item=>{item.amount=amount;item.category=f.category||"Outros";const offset=(Number(item.part)||1)-(Number(current.part)||1);item.date=f.scope==="future"?addMonths(f.date,offset):f.date;});
  root.innerHTML="";save();
 };
}
function exportBackup(){
 const payload={format:"agenda-inteligente-backup-v2",exportedAt:new Date().toISOString(),data:db};
 const blob=new Blob([JSON.stringify(payload,null,2)],{type:"application/json"});
 const url=URL.createObjectURL(blob),a=document.createElement("a");
 a.href=url;a.download="agenda-inteligente-backup-"+new Date().toISOString().slice(0,10)+".json";
 document.body.appendChild(a);a.click();a.remove();
 setTimeout(()=>URL.revokeObjectURL(url),30000);
}
function render(){
 const main=$("#mainContent"),today=new Date().toISOString().slice(0,10),month=today.slice(0,7),pending=db.bills.filter(x=>!x.paid);
 document.querySelectorAll("[data-view]").forEach(b=>b.classList.toggle("active",b.dataset.view===activeView));
 $("#todayLabel").textContent=new Date().toLocaleDateString("pt-BR",{weekday:"long",day:"2-digit",month:"long"});
 if(activeView==="home"){
  main.innerHTML='<section class="welcome"><div><p class="eyebrow">PAINEL PESSOAL</p><h1>Olá! 👋</h1><p class="muted">Aqui está um resumo da sua organização.</p></div><button class="primary-button" id="quickAdd">＋ Novo registro</button></section><section class="stats-grid" id="statsGrid"></section><section class="content-grid"><article class="panel"><div class="panel-heading"><div><p class="eyebrow">SUA ROTINA</p><h2>Próximos compromissos</h2></div><button class="text-button" data-go="agenda">Ver agenda →</button></div><div id="upcomingList" class="list-area"></div></article><article class="panel"><div class="panel-heading"><div><p class="eyebrow">CONTROLE FINANCEIRO</p><h2>Contas a vencer</h2></div><button class="text-button" data-go="finance">Ver financeiro →</button></div><div id="dueList" class="list-area"></div></article></section><section class="panel notice-center"><div class="panel-heading"><div><p class="eyebrow">ACOMPANHAMENTO</p><h2>Avisos e próximos prazos</h2><small class="muted">Compromissos e contas dos próximos 7 dias</small></div><span class="notice-count" id="noticeCount">0</span></div><div id="noticeList" class="notice-list"></div></section><section class="panel"><div class="panel-heading"><div><p class="eyebrow">ACESSO RÁPIDO</p><h2>O que deseja registrar?</h2></div></div><div class="quick-actions"><button class="quick-card" data-action="event"><span>▦</span><strong>Compromisso</strong><small>Organize seus horários</small></button><button class="quick-card" data-action="bill"><span>◈</span><strong>Conta ou despesa</strong><small>Controle seus pagamentos</small></button><button class="quick-card" data-action="purchase"><span>＋</span><strong>Nova compra</strong><small>Registre parcelas e compras</small></button></div></section>';
  const monthIncome=db.incomes.filter(x=>String(x.date||"").startsWith(month)).reduce((sum,x)=>sum+(Number(x.amount)||0),0);const monthBills=db.bills.filter(x=>String(x.date||"").startsWith(month));const monthExpenses=monthBills.reduce((sum,x)=>sum+(Number(x.amount)||0),0);const monthPending=monthBills.filter(x=>!x.paid).reduce((sum,x)=>sum+(Number(x.amount)||0),0);const monthBalance=monthIncome-monthExpenses;$("#statsGrid").innerHTML=[[ "Receitas do mês",money(monthIncome),"income"],["Despesas do mês",money(monthExpenses),"expense"],["Saldo do mês",money(monthBalance),"balance"],["Pendente no mês",money(monthPending),"pending"]].map(([label,value,kind])=>'<article class="stat-card dashboard-stat '+kind+'"><small>'+label+'</small><strong>'+value+'</strong></article>').join("");
  let upcoming=[...db.events.map(x=>({...x,kind:"event"})),...pending.map(x=>({...x,kind:"bill"}))].filter(x=>String(x.date||"")>=today).sort((a,b)=>(a.date||"").localeCompare(b.date||""));
  $("#upcomingList").innerHTML=upcoming.length?upcoming.slice(0,5).map(x=>row(x.title,fmt(x.date)+(x.time?" • "+x.time:"")+(x.kind==="bill"?" • Parcela "+x.part+"/"+x.count:""),x.kind==="bill"?x.amount:"")).join(""):'<div class="empty">Nenhum compromisso próximo.</div>';
  const overdue=pending.filter(x=>String(x.date||"")<today);const dueSoon=pending.filter(x=>String(x.date||"")>=today).sort((a,b)=>(a.date||"").localeCompare(b.date||""));const dueList=[...overdue.sort((a,b)=>(a.date||"").localeCompare(b.date||"")), ...dueSoon];$("#dueList").innerHTML=(overdue.length?'<div class="dashboard-warning"><strong>'+overdue.length+' conta(s) vencida(s)</strong><span>Confira os vencimentos em atraso.</span></div>':"")+(dueList.length?dueList.slice(0,5).map(x=>row(x.title,(String(x.date||"")<today?"Vencida · ":"Vence em · ")+fmt(x.date),x.amount,false)).join(""):'<div class="empty">Nenhuma conta pendente.</div>');
  const noticeItems=[
   ...overdue.map(x=>({date:x.date,title:x.title,kind:"overdue",label:"Conta vencida",detail:"Vencimento em "+fmt(x.date),amount:x.amount})),
   ...dueSoon.filter(x=>String(x.date||"")<=addDays(today,7)).map(x=>({date:x.date,title:x.title,kind:"bill",label:x.date===today?"Vence hoje":"Conta a vencer",detail:"Vencimento em "+fmt(x.date),amount:x.amount})),
   ...db.events.filter(x=>String(x.date||"")>=today&&String(x.date||"")<=addDays(today,7)).map(x=>({date:x.date,title:x.title,kind:"event",label:x.date===today?"Compromisso hoje":"Compromisso",detail:fmt(x.date)+(x.time?" · "+x.time:""),amount:null}))
  ].sort((a,b)=>String(a.date||"").localeCompare(String(b.date||""))).slice(0,8);
  $("#noticeCount").textContent=noticeItems.length;
  $("#noticeList").innerHTML=noticeItems.length?noticeItems.map(x=>'<article class="notice-item '+x.kind+'"><span class="notice-icon">'+(x.kind==="overdue"?"!":x.kind==="bill"?"$":"◷")+'</span><div class="notice-copy"><strong>'+esc(x.title)+'</strong><small>'+esc(x.label)+' · '+esc(x.detail)+'</small></div>'+(x.amount!==null?'<b>'+money(x.amount)+'</b>':"")+'</article>').join(""):'<div class="notice-empty"><strong>Tudo em dia por enquanto</strong><span>Não há contas vencidas ou compromissos nos próximos 7 dias.</span></div>';
  $("#quickAdd").onclick=()=>openForm("event");
 } else if(activeView==="agenda"){
  main.innerHTML='<div class="view-title agenda-view-title"><div><p class="eyebrow">SUA ROTINA</p><h2>Minha agenda</h2></div><button class="primary" id="addEvent">＋ Compromisso</button></div><div class="field"><label>Mês selecionado</label><input id="monthFilter" type="month" value="'+month+'"></div><nav class="agenda-tabs" role="tablist" aria-label="Seções da agenda"><button class="agenda-tab active" type="button" role="tab" aria-selected="true" data-agenda-tab="compromissos">Compromissos <span id="agendaEventCount">0</span></button><button class="agenda-tab" type="button" role="tab" aria-selected="false" data-agenda-tab="contas">Contas a vencer <span id="agendaBillCount">0</span></button></nav><section class="agenda-tab-panel is-active" data-agenda-panel="compromissos"><article class="panel"><div class="panel-heading"><div><p class="eyebrow">ORGANIZAÇÃO PESSOAL</p><h2>Seus compromissos</h2><small class="muted">Eventos e atividades do mês selecionado</small></div></div><div id="agendaEvents" class="list-area"></div></article></section><section class="agenda-tab-panel" data-agenda-panel="contas" hidden><article class="panel"><div class="panel-heading"><div><p class="eyebrow">CONTROLE DE VENCIMENTOS</p><h2>Contas e parcelas</h2><small class="muted">Despesas previstas para o mês selecionado</small></div></div><div id="agendaBills" class="list-area"></div></article></section>';
  const draw=()=>{const m=$("#monthFilter").value;const events=db.events.filter(x=>String(x.date||"").startsWith(m)).sort((a,b)=>(a.date||"").localeCompare(b.date||""));const bills=db.bills.filter(x=>String(x.date||"").startsWith(m)).sort((a,b)=>(a.date||"").localeCompare(b.date||""));$("#agendaEventCount").textContent=events.length;$("#agendaBillCount").textContent=bills.length;$("#agendaEvents").innerHTML=events.length?events.map(x=>row(x.title,fmt(x.date)+(x.time?" • "+x.time:""),"",null,'<br><button class="danger-button" data-delete-event="'+x.id+'">Excluir</button>')).join(""):'<div class="empty">Nenhum compromisso neste mês. Toque em “＋ Compromisso” para adicionar.</div>';$("#agendaBills").innerHTML=bills.length?bills.map(x=>row(x.title,fmt(x.date)+" • Parcela "+x.part+"/"+x.count,x.amount,x.paid,'<br><button class="danger-button" data-delete-bill="'+(x.groupId||x.id)+'">Excluir</button>')).join(""):'<div class="empty">Nenhuma conta ou parcela neste mês.</div>';};
  $("#monthFilter").onchange=draw;draw();$("#addEvent").onclick=()=>openForm("event");
 } else if(activeView==="finance"){
  main.innerHTML='<div class="view-title finance-view-title"><div><p class="eyebrow">CONTROLE DO SEU DINHEIRO</p><h2>Financeiro</h2></div><div class="finance-header-actions"><button class="secondary-button" id="addIncome">＋ Receita</button><button class="primary" id="addBill">＋ Despesa</button></div></div><div class="field"><label>Mês analisado</label><input id="spendingMonth" type="month" value="'+month+'"></div><div class="finance-summary-grid"><article class="finance-summary-card income"><small>Receitas do mês</small><strong id="monthIncome">R$ 0,00</strong></article><article class="finance-summary-card expense"><small>Despesas do mês</small><strong id="monthSpent">R$ 0,00</strong></article><article class="finance-summary-card balance"><small>Saldo do mês</small><strong id="monthBalance">R$ 0,00</strong></article><article class="finance-summary-card pending"><small>Total pendente</small><strong id="pendingTotal">'+money(pending.reduce((sum,x)=>sum+(Number(x.amount)||0),0))+'</strong></article></div><nav class="finance-tabs" role="tablist" aria-label="Seções do financeiro"><button class="finance-tab active" type="button" role="tab" aria-selected="true" data-finance-tab="resumo">Resumo</button><button class="finance-tab" type="button" role="tab" aria-selected="false" data-finance-tab="planejamento">Planejamento</button><button class="finance-tab" type="button" role="tab" aria-selected="false" data-finance-tab="dividas">Dívidas</button><button class="finance-tab" type="button" role="tab" aria-selected="false" data-finance-tab="orcamento">Orçamento</button><button class="finance-tab" type="button" role="tab" aria-selected="false" data-finance-tab="movimentacoes">Movimentações</button></nav><div class="finance-tab-panel is-active" data-finance-panel="resumo"><section class="panel cashflow-panel"><div class="panel-heading"><div><p class="eyebrow">PREVISÃO DO DINHEIRO</p><h2>Fluxo de caixa</h2><small class="muted">O que já entrou, o que saiu e o que ainda está previsto</small></div></div><div id="cashflowSummary"></div><div id="cashflowTimeline" class="cashflow-timeline"></div></section></div><div class="finance-tab-panel" data-finance-panel="planejamento" hidden><section class="panel forecast-panel"><details class="forecast-disclosure"><summary class="forecast-disclosure-summary"><div><p class="eyebrow">PRÓXIMOS MESES</p><h2>Compromissos futuros</h2><small class="muted">Toque para consultar a previsão dos próximos meses</small></div><span class="forecast-disclosure-icon" aria-hidden="true">⌄</span></summary><div id="upcomingForecast" class="forecast-disclosure-content"></div></details></section><section class="panel financial-alert-panel"><div class="panel-heading"><div><p class="eyebrow">PREVENÇÃO FINANCEIRA</p><h2>Alertas inteligentes</h2><small class="muted">Sinais para proteger seu orçamento e evitar atrasos</small></div></div><div id="financialAlerts"></div></section><section class="panel calendar-panel"><div class="panel-heading"><div><p class="eyebrow">ORGANIZAÇÃO DAS DATAS</p><h2>Calendário financeiro</h2><small class="muted">Toque em um dia para conferir entradas e vencimentos</small></div></div><div id="financeCalendar"></div><div id="calendarDayDetails"></div></section></div><div class="finance-tab-panel" data-finance-panel="dividas" hidden><section class="panel recovery-panel"><div class="panel-heading"><div><p class="eyebrow">PLANO PARA SAIR DAS DÍVIDAS</p><h2>Recuperação financeira</h2><small class="muted">Organize prioridades e monte um plano que caiba no seu orçamento</small></div><button class="primary" id="addDebt">＋ Cadastrar dívida</button></div><div id="recoveryOverview"></div><div id="debtItems"></div><div class="recovery-planner"><h3>Quanto você consegue reservar por mês?</h3><div class="field"><label>Valor mensal para negociar e quitar dívidas (R$)</label><input id="debtBudget" type="text" inputmode="decimal" data-money placeholder="0,00"></div><div id="debtPlanResult"></div></div><p class="recovery-note">O plano é uma estimativa de organização, não substitui orientação financeira ou jurídica. Antes de atrasar qualquer conta, verifique riscos de corte de serviços, perda de bens, multas e consequências legais. Sempre que possível, negocie antes do vencimento.</p></section></div><div class="finance-tab-panel" data-finance-panel="orcamento" hidden><section class="panel budget-panel"><div class="panel-heading"><div><p class="eyebrow">PLANEJAMENTO</p><h2>Orçamento por categoria</h2></div><button class="text-button" id="addBudget">＋ Definir limite</button></div><div id="budgetItems"></div></section><section class="panel spending-panel"><div class="panel-heading"><div><p class="eyebrow">ANÁLISE</p><h2>Para onde foi seu dinheiro</h2></div></div><div id="spendingBreakdown"></div></section></div><div class="finance-tab-panel" data-finance-panel="movimentacoes" hidden><section class="panel"><div class="panel-heading"><div><p class="eyebrow">ENTRADAS</p><h2>Receitas recebidas</h2></div></div><div id="incomeItems" class="list-area"></div></section><section class="panel"><div class="panel-heading"><div><p class="eyebrow">SAÍDAS</p><h2>Contas e despesas</h2></div></div><div id="financeItems" class="list-area"></div></section></div>';
  const categories=["Alimentação","Transporte","Moradia","Saúde","Educação","Lazer e diversão","Compras","Contas e serviços","Outros"];
  const drawFinance=()=>{
   const selected=$("#spendingMonth").value;
   const debtExpenses=debtPaymentExpensesForMonth(selected);
   const expenses=[...db.bills.filter(x=>String(x.date||"").startsWith(selected)),...debtExpenses];
   const incomes=db.incomes.filter(x=>String(x.date||"").startsWith(selected));
   const expenseTotal=expenses.reduce((sum,x)=>sum+(Number(x.amount)||0),0);
   const incomeTotal=incomes.reduce((sum,x)=>sum+(Number(x.amount)||0),0);
   const balance=incomeTotal-expenseTotal;
   $("#monthIncome").textContent=money(incomeTotal);
   $("#monthSpent").textContent=money(expenseTotal);
   $("#monthBalance").textContent=money(balance);
   $("#monthBalance").classList.toggle("negative",balance<0);
   $("#pendingTotal").textContent=money(expenses.filter(x=>!x.paid).reduce((sum,x)=>sum+(Number(x.amount)||0),0));
   const paidExpenses=expenses.filter(x=>x.paid).reduce((sum,x)=>sum+(Number(x.amount)||0),0);
   const pendingExpenses=expenses.filter(x=>!x.paid).reduce((sum,x)=>sum+(Number(x.amount)||0),0);
   const availableBalance=incomeTotal-paidExpenses;
   const projectedBalance=incomeTotal-expenseTotal;
   const maxFlow=Math.max(incomeTotal,expenseTotal,1);
   $("#cashflowSummary").innerHTML='<div class="cashflow-metrics"><div class="cashflow-metric positive"><small>Entradas recebidas</small><strong>'+money(incomeTotal)+'</strong></div><div class="cashflow-metric"><small>Despesas pagas</small><strong>'+money(paidExpenses)+'</strong></div><div class="cashflow-metric warning"><small>Despesas previstas</small><strong>'+money(pendingExpenses)+'</strong></div></div><div class="cashflow-balance-grid"><div><small>Saldo considerando pagamentos realizados</small><strong class="'+(availableBalance<0?"negative":"")+'">'+money(availableBalance)+'</strong></div><div><small>Saldo projetado após todas as despesas</small><strong class="'+(projectedBalance<0?"negative":"")+'">'+money(projectedBalance)+'</strong></div></div><div class="cashflow-bars"><div><span>Entradas</span><div class="cashflow-track"><i class="in" style="width:'+(incomeTotal/maxFlow*100)+'%"></i></div><b>'+money(incomeTotal)+'</b></div><div><span>Despesas</span><div class="cashflow-track"><i class="out" style="width:'+(expenseTotal/maxFlow*100)+'%"></i></div><b>'+money(expenseTotal)+'</b></div></div>';
   const movements=[...incomes.map(x=>({date:x.date,title:x.title,amount:Number(x.amount)||0,income:true,paid:true})),...expenses.map(x=>({date:x.date,title:x.title,amount:Number(x.amount)||0,income:false,paid:!!x.paid}))].sort((a,b)=>String(a.date).localeCompare(String(b.date)));
   let running=0;
   $("#cashflowTimeline").innerHTML=movements.length?'<h3>Movimentações do mês</h3>'+movements.map(x=>{running+=x.income?x.amount:(x.paid?-x.amount:0);return '<div class="cashflow-movement"><div class="cashflow-movement-icon '+(x.income?"in":x.paid?"paid":"pending")+'">'+(x.income?"＋":x.paid?"−":"◷")+'</div><div class="cashflow-movement-info"><strong>'+esc(x.title)+'</strong><small>'+fmt(x.date)+' · '+(x.income?"Recebido":x.paid?"Pago":"Previsto")+'</small></div><div class="cashflow-movement-values"><b class="'+(x.income?"positive-text":x.paid?"":"pending-text")+'">'+(x.income?"+ ":"− ")+money(x.amount)+'</b><small>Saldo realizado: '+money(running)+'</small></div></div>';}).join(""):'<div class="empty">Ainda não há movimentações neste mês.</div>';
   const forecastRoot=$("#upcomingForecast");
   if(forecastRoot){
    const baseDate=selected+"-01";
    const forecastRows=Array.from({length:6},(_,index)=>{
     const monthKey=addMonths(baseDate,index).slice(0,7);
     const futureIncome=db.incomes.filter(x=>String(x.date||"").startsWith(monthKey)).reduce((sum,x)=>sum+(Number(x.amount)||0),0);
     const futureBills=db.bills.filter(x=>String(x.date||"").startsWith(monthKey)&&!x.paid);
     const debtPayments=debtPaymentExpensesForMonth(monthKey);
     const billExpense=futureBills.reduce((sum,x)=>sum+(Number(x.amount)||0),0);
     const debtExpense=debtPayments.reduce((sum,x)=>sum+(Number(x.amount)||0),0);
     const futureExpense=billExpense+debtExpense;
     return {month:monthKey,income:futureIncome,expense:futureExpense,billExpense,debtExpense,balance:futureIncome-futureExpense,count:futureBills.length+debtPayments.length,debtCount:debtPayments.length};
    });
    forecastRoot.innerHTML=forecastRows.map(row=>{
     const label=new Date(row.month+"-01T12:00:00").toLocaleDateString("pt-BR",{month:"long",year:"numeric"});
     return '<article class="forecast-month"><div class="forecast-month-head"><strong>'+label+'</strong><b class="'+(row.balance<0?"negative":"")+'">'+(row.balance>=0?"+ ":"− ")+money(Math.abs(row.balance))+'</b></div><div class="forecast-month-values"><span>Receitas cadastradas <b>'+money(row.income)+'</b></span><span>Contas pendentes <b>'+money(row.billExpense)+'</b></span><span>Pagamentos de dívidas <b>'+money(row.debtExpense)+'</b></span></div><small class="muted">'+row.count+' saída(s) considerada(s), incluindo '+row.debtCount+' pagamento(s) de dívida já registrado(s)</small></article>';
    }).join("")+'<p class="forecast-disclaimer">Resultado previsto = receitas cadastradas menos contas pendentes e pagamentos de dívidas registrados para cada mês. Não inclui saldo bancário inicial, gastos ainda não registrados ou dívidas sem pagamento cadastrado.</p>';
   }
   const groups={};
   expenses.forEach(x=>{const cat=String(x.category||"Outros").trim()||"Outros";groups[cat]=(groups[cat]||0)+(Number(x.amount)||0);});
   const palette=["#2878B8","#16A085","#F39C12","#8E63CE","#E05D6F","#28A6A1","#6574CD","#A67C52","#8795A1"];
   const ordered=Object.entries(groups).sort((a,b)=>b[1]-a[1]);
   let cursor=0;
   const segments=ordered.map(([cat,value],i)=>{const pct=expenseTotal>0?value/expenseTotal*100:0;const from=cursor;cursor+=pct;return {cat,value,pct,color:palette[i%palette.length],from,to:cursor};});
   const gradient=segments.map(x=>x.color+" "+x.from.toFixed(2)+"% "+x.to.toFixed(2)+"%").join(",");
   $("#spendingBreakdown").innerHTML=ordered.length?'<div class="spending-total"><strong>'+money(expenseTotal)+'</strong><small>'+expenses.length+' lançamento(s) no mês</small></div><div class="spending-chart-layout"><div class="spending-donut" style="background:conic-gradient('+gradient+')"><div class="spending-donut-hole"><strong>'+money(expenseTotal)+'</strong><small>Total de despesas</small></div></div><div class="spending-legend">'+segments.map(x=>'<div class="spending-legend-item"><span class="spending-dot" style="background:'+x.color+'"></span><div class="spending-legend-label"><strong>'+esc(x.cat)+'</strong><small>'+money(x.value)+'</small></div><b>'+x.pct.toFixed(1).replace(".",",")+'%</b></div>').join("")+'</div></div>':'<div class="empty">Nenhuma despesa registrada neste mês.</div>';
   const monthBudgets=db.budgets[selected]||{};
   const budgetRows=Object.entries(monthBudgets).sort((a,b)=>a[0].localeCompare(b[0]));
   $("#budgetItems").innerHTML=budgetRows.length?budgetRows.map(([cat,limit])=>{const spent=groups[cat]||0,pct=limit>0?spent/limit*100:0,over=spent>limit;return '<div class="budget-row"><div class="budget-row-head"><strong>'+esc(cat)+'</strong><span>'+money(spent)+' / '+money(limit)+'</span></div><div class="budget-track"><span class="'+(over?"over":"")+'" style="width:'+Math.min(100,pct)+'%"></span></div><small class="'+(over?"budget-over":"budget-ok")+'">'+(over?"Limite ultrapassado em "+money(spent-limit):pct>=80?"Atenção: "+pct.toFixed(0)+"% do limite utilizado":pct.toFixed(0)+"% do limite utilizado")+'</small></div>';}).join(""):'<div class="empty">Defina limites para acompanhar seus gastos por categoria.</div>';
   $("#incomeItems").innerHTML=incomes.length?incomes.slice().sort((a,b)=>b.date.localeCompare(a.date)).map(x=>'<div class="income-entry"><div><strong>'+esc(x.title)+'</strong><small>'+fmt(x.date)+'</small></div><strong>'+money(x.amount)+'</strong><button class="danger-button" data-delete-income="'+x.id+'">Excluir</button></div>').join(""):'<div class="empty">Nenhuma receita registrada neste mês.</div>';
   $("#financeItems").innerHTML=expenses.length?expenses.slice().sort((a,b)=>a.date.localeCompare(b.date)).map(x=>x.kind==="debtPayment"?'<article class="finance-entry debt-payment-entry"><div class="finance-entry-head"><div class="finance-entry-main"><span class="finance-entry-icon">✓</span><div class="finance-entry-name"><strong>'+esc(x.title)+'</strong><small>Pagamento registrado na Recuperação Financeira</small></div></div><strong class="finance-entry-amount">'+money(x.amount)+'</strong></div><div class="finance-entry-info"><span class="finance-category">Contas e serviços</span><span class="finance-due">Pago em · '+fmt(x.date)+'</span><span class="finance-status is-paid">Pago</span></div></article>':'<article class="finance-entry"><div class="finance-entry-head"><div class="finance-entry-main"><span class="finance-entry-icon">↗</span><div class="finance-entry-name"><strong>'+esc(x.title)+'</strong><small>Parcela '+x.part+' de '+x.count+'</small></div></div><strong class="finance-entry-amount">'+money(x.amount)+'</strong></div><div class="finance-entry-info"><span class="finance-category">'+esc(x.category||"Outros")+'</span><span class="finance-due">Vencimento · '+fmt(x.date)+'</span><span class="finance-status '+(x.paid?"is-paid":"is-pending")+'">'+(x.paid?"Pago":"Pendente")+'</span></div><details class="finance-entry-details"><summary><span>Gerenciar lançamento</span><span class="finance-chevron">⌄</span></summary><div class="finance-entry-actions"><button class="text-button" data-pay="'+x.id+'">'+(x.paid?"Desfazer pagamento":"Marcar como pago")+'</button><button class="text-button" data-edit-installment="'+x.id+'">Editar parcela</button><button class="danger-button" data-delete-bill="'+(x.groupId||x.id)+'">Excluir compra</button></div></details></article>').join(""):'<div class="empty">Nenhuma despesa cadastrada neste mês.</div>'
   try{drawFinancialAlerts(selected,incomes,expenses,incomeTotal,expenseTotal,projectedBalance);}catch(error){console.error("Falha nos alertas financeiros:",error);const el=$("#financialAlerts");if(el)el.innerHTML='<p class="muted">Não foi possível atualizar os alertas agora.</p>';}
   try{drawFinanceCalendar(selected,expenses,incomes);}catch(error){console.error("Falha no calendário financeiro:",error);const el=$("#financeCalendar");if(el)el.innerHTML='<p class="muted">Não foi possível atualizar o calendário agora.</p>';}
   try{drawDebtRecovery(selected,incomeTotal);}catch(error){console.error("Falha no painel de dívidas:",error);const el=$("#debtItems");if(el)el.innerHTML='<p class="muted">Não foi possível atualizar as dívidas agora. Os demais dados financeiros continuam disponíveis.</p>';}
  };
  $("#spendingMonth").onchange=drawFinance;drawFinance();
  $("#addDebt").onclick=()=>openDebtForm();
  $("#debtBudget").onchange=()=>{localStorage.setItem("agendaDebtBudget",String(parseMoney($("#debtBudget").value)));drawDebtRecovery($("#spendingMonth").value,db.incomes.filter(x=>String(x.date||"").startsWith($("#spendingMonth").value)).reduce((a,x)=>a+(Number(x.amount)||0),0));};
  bindMoneyInputs(main);
  $("#addIncome").onclick=()=>openForm("income");
  $("#addBill").onclick=()=>openForm("bill");
  $("#addBudget").onclick=()=>openForm("budget");
 } else if(activeView==="cards"){
   main.innerHTML='<div class="view-title cards-view-title"><div><p class="eyebrow">CONTROLE DOS SEUS CARTÕES</p><h2>Meus cartões</h2></div><div class="cards-header-actions"><button class="secondary-button" id="addPurchase">＋ Compra</button><button class="primary" id="addCard">＋ Cartão</button></div></div><div class="cards-overview" id="cardsOverview"></div><nav class="cards-tabs" role="tablist" aria-label="Seções dos cartões"><button class="cards-tab active" type="button" role="tab" aria-selected="true" data-cards-tab="visao">Visão geral <span id="cardsCount">0</span></button><button class="cards-tab" type="button" role="tab" aria-selected="false" data-cards-tab="compras">Compras vinculadas <span id="cardPurchasesCount">0</span></button></nav><section class="cards-tab-panel is-active" data-cards-panel="visao"><div id="cardsItems" class="cards-grid"></div></section><section class="cards-tab-panel" data-cards-panel="compras" hidden><section class="panel"><div class="panel-heading"><div><p class="eyebrow">ACOMPANHAMENTO DE COMPRAS</p><h2>Parcelas no cartão</h2><small class="muted">Compras e parcelas vinculadas aos seus cartões</small></div></div><div id="cardPurchases" class="list-area"></div></section></section>';
   const drawCards=()=>{const allCardBills=db.bills.filter(x=>x.cardId);const totalLimit=db.cards.reduce((sum,c)=>sum+(Number(c.limit)||0),0);const totalUsed=db.cards.reduce((sum,c)=>sum+db.bills.filter(x=>x.cardId===c.id&&!x.paid).reduce((n,x)=>n+(Number(x.amount)||0),0),0);const available=Math.max(0,totalLimit-totalUsed);$("#cardsCount").textContent=db.cards.length;$("#cardPurchasesCount").textContent=allCardBills.length;$("#cardsOverview").innerHTML='<article class="cards-overview-card"><small>Limite total</small><strong>'+money(totalLimit)+'</strong></article><article class="cards-overview-card"><small>Em aberto</small><strong>'+money(totalUsed)+'</strong></article><article class="cards-overview-card"><small>Disponível estimado</small><strong>'+money(available)+'</strong></article>';$("#cardsItems").innerHTML=db.cards.length?db.cards.map(c=>{const limit=Number(c.limit)||0;const linked=db.bills.filter(x=>x.cardId===c.id);const used=linked.filter(x=>!x.paid).reduce((sum,x)=>sum+(Number(x.amount)||0),0);const free=Math.max(0,limit-used);const pct=limit>0?used/limit*100:0;return '<article class="card-box card-box-modern"><div class="card-box-top"><span class="card-chip" aria-hidden="true">▦</span><span class="card-box-caption">CARTÃO</span></div><h3>'+esc(c.title)+'</h3><div class="card-limit-label">Limite total</div><strong class="card-limit-value">'+money(limit)+'</strong><div class="card-progress"><span style="width:'+Math.min(100,pct)+'%"></span></div><div class="card-balance-grid"><div><small>Em aberto</small><b>'+money(used)+'</b></div><div><small>Disponível</small><b>'+money(free)+'</b></div></div><div class="card-dates"><span>Fecha dia <b>'+esc(c.closing)+'</b></span><span>Vence dia <b>'+esc(c.due)+'</b></span></div><div class="card-box-footer"><small>'+linked.length+' parcela(s) vinculada(s) · '+pct.toFixed(0)+'% do limite utilizado</small><button class="card-delete" data-delete-card="'+c.id+'">Excluir cartão</button></div></article>';}).join(""):'<div class="empty cards-empty"><strong>Nenhum cartão cadastrado</strong><span>Adicione seu cartão para acompanhar limite, compras e parcelas em um só lugar.</span><button class="primary" id="addFirstCard">＋ Cadastrar primeiro cartão</button></div>';$("#cardPurchases").innerHTML=allCardBills.length?allCardBills.slice().sort((a,b)=>(b.date||"").localeCompare(a.date||"")).map(x=>{const card=db.cards.find(c=>c.id===x.cardId);return '<article class="card-purchase-row"><div class="card-purchase-main"><strong>'+esc(x.title)+'</strong><small>'+(card?esc(card.title):"Cartão não encontrado")+' · Parcela '+x.part+'/'+x.count+'</small><small>Vencimento · '+fmt(x.date)+'</small></div><div class="card-purchase-side"><b>'+money(x.amount)+'</b><span class="pill '+(x.paid?"paid":"")+'">'+(x.paid?"Pago":"Pendente")+'</span></div></article>';}).join(""):'<div class="empty">Nenhuma compra vinculada a cartão. Ao registrar uma compra, selecione o cartão para acompanhar as parcelas aqui.</div>';};
   drawCards();
   $("#addCard").onclick=()=>openForm("card");$("#addPurchase").onclick=()=>openForm("purchase");const firstCard=$("#addFirstCard");if(firstCard)firstCard.onclick=()=>openForm("card");
 } else if(activeView==="backup"){
  const cloudInfo=window.AgendaInteligenteCloud?window.AgendaInteligenteCloud.getStatus():{connected:false,state:"error",label:"Sincronização em nuvem indisponível",lastSyncLabel:"Não disponível",message:"Atualize a página e tente novamente."};
  const cloudStatus=cloudInfo.message||cloudInfo.label;
  const cloudConnected=cloudInfo.connected;
  const counts=[["Compromissos",db.events.length],["Contas e parcelas",db.bills.length],["Receitas",db.incomes.length],["Cartões",db.cards.length],["Dívidas",db.debts.length]];
  main.innerHTML='<div class="view-title backup-view-title"><div><p class="eyebrow">PROTEÇÃO DOS SEUS DADOS</p><h2>Backup e segurança</h2><small class="muted">Tenha uma cópia dos seus registros e saiba onde estão protegidos.</small></div></div><section class="panel backup-cloud-panel"><div class="backup-section-heading"><div><p class="eyebrow">SINCRONIZAÇÃO</p><h3>Seus dados na nuvem</h3></div><span class="backup-status '+(cloudConnected?(cloudInfo.state==="synced"?"connected":cloudInfo.state==="error"?"sync-error":"sync-wait"):"local")+'">'+(cloudConnected?"Conta conectada":"Somente neste aparelho")+'</span></div><p class="muted">'+esc(cloudStatus)+'</p><div class="backup-sync-meta"><span>Última sincronização</span><strong>'+esc(cloudInfo.lastSyncLabel||"Ainda não sincronizado")+'</strong></div><button class="secondary-button" id="backupSyncNow" '+(!window.AgendaInteligenteCloud||cloudInfo.busy||!cloudConnected?"disabled":"")+'>↻ '+(cloudInfo.busy?"Sincronizando...":"Sincronizar agora")+'</button><small class="backup-hint">Se a conexão cair, os registros continuam salvos neste aparelho. A sincronização será retomada ao voltar à internet. Mantenha também seu backup independente.</small></section><section class="panel backup-copy-panel"><div class="backup-section-heading"><div><p class="eyebrow">CÓPIA DE SEGURANÇA</p><h3>Seus registros neste aparelho</h3></div><span class="backup-count">'+counts.reduce((sum,item)=>sum+item[1],0)+' registros</span></div><div class="backup-count-grid">'+counts.map(([label,value])=>'<div><small>'+label+'</small><strong>'+value+'</strong></div>').join("")+'</div><div class="backup-actions"><button class="primary" id="exportBackup">↓ Baixar cópia de segurança</button><label class="secondary-button" for="importBackup">↑ Restaurar uma cópia</label><input id="importBackup" type="file" accept="application/json,.json" hidden></div><small class="backup-hint">O arquivo inclui compromissos, despesas e parcelas, receitas, cartões, orçamentos e dívidas.</small></section><section class="panel backup-safety-panel"><h3>Antes de restaurar</h3><p class="muted">A restauração substitui os registros atuais deste aparelho pelos dados do arquivo. Se possível, baixe uma cópia atual antes de continuar e não feche a página durante a restauração.</p><h3>Privacidade</h3><p class="muted">Não inclua senhas bancárias, códigos de segurança ou números completos de cartão nos registros. Guarde o arquivo de backup em local privado.</p></section>';
 }
}
document.addEventListener("click",e=>{
 const cardsTab=e.target.closest("[data-cards-tab]");if(cardsTab){const name=cardsTab.dataset.cardsTab;const root=cardsTab.closest("#mainContent");root.querySelectorAll("[data-cards-tab]").forEach(b=>{const active=b===cardsTab;b.classList.toggle("active",active);b.setAttribute("aria-selected",String(active));});root.querySelectorAll("[data-cards-panel]").forEach(p=>{const active=p.dataset.cardsPanel===name;p.classList.toggle("is-active",active);p.hidden=!active;p.style.display=active?"block":"none";});return;}
 const agendaTab=e.target.closest("[data-agenda-tab]");if(agendaTab){const name=agendaTab.dataset.agendaTab;const root=agendaTab.closest("#mainContent");root.querySelectorAll("[data-agenda-tab]").forEach(b=>{const active=b===agendaTab;b.classList.toggle("active",active);b.setAttribute("aria-selected",String(active));});root.querySelectorAll("[data-agenda-panel]").forEach(p=>{const active=p.dataset.agendaPanel===name;p.classList.toggle("is-active",active);p.hidden=!active;p.style.display=active?"block":"none";});return;}
 const financeTab=e.target.closest("[data-finance-tab]");if(financeTab){const name=financeTab.dataset.financeTab;const root=financeTab.closest("#mainContent");root.querySelectorAll("[data-finance-tab]").forEach(b=>{const active=b===financeTab;b.classList.toggle("active",active);b.setAttribute("aria-selected",String(active));});root.querySelectorAll("[data-finance-panel]").forEach(p=>{const active=p.dataset.financePanel===name;p.classList.toggle("is-active",active);p.hidden=!active;p.style.display=active?"block":"none";});financeTab.scrollIntoView({behavior:"smooth",block:"nearest",inline:"nearest"});return;}
 const quick=e.target.closest("#quickAdd");if(quick){openForm("event");return;}
 const action=e.target.closest("[data-action]");if(action){openForm(action.dataset.action);return;}
 const go=e.target.closest("[data-go]");if(go){setView(go.dataset.go);return;}
 const edit=e.target.closest("[data-edit-installment]");if(edit){editInstallment(edit.dataset.editInstallment);return;}
 const pay=e.target.closest("[data-pay]");if(pay){let item=db.bills.find(x=>x.id===pay.dataset.pay);if(item){item.paid=!item.paid;save();}return;}
 const debtPay=e.target.closest("[data-pay-debt]");if(debtPay){openDebtPayment(debtPay.dataset.payDebt);return;}
 const paymentToggle=e.target.closest("[data-toggle-debt-payment]");if(paymentToggle){const debt=db.debts.find(x=>x.id===paymentToggle.dataset.debtId);const payment=debt&&Array.isArray(debt.payments)?debt.payments.find(p=>p.id===paymentToggle.dataset.toggleDebtPayment):null;if(payment){const adding=payment.includeInFinance===false;if(adding){const duplicate=db.bills.some(b=>String(b.date||"")===String(payment.date||"")&&Math.round((Number(b.amount)||0)*100)===Math.round((Number(payment.amount)||0)*100));if(duplicate&&!confirm("Existe uma despesa com a mesma data e valor em Contas e despesas. Incluir este pagamento também pode duplicar o total. Deseja continuar mesmo assim?"))return;}payment.includeInFinance=adding;save();}return;}
 const editDebtPayment=e.target.closest("[data-edit-debt-payment]");if(editDebtPayment){openDebtPayment(editDebtPayment.dataset.debtId,editDebtPayment.dataset.editDebtPayment);return;}
 const deleteDebtPayment=e.target.closest("[data-delete-debt-payment]");if(deleteDebtPayment){const debt=db.debts.find(x=>x.id===deleteDebtPayment.dataset.debtId);const payment=debt&&Array.isArray(debt.payments)?debt.payments.find(p=>p.id===deleteDebtPayment.dataset.deleteDebtPayment):null;if(debt&&payment&&confirm("Excluir este pagamento do histórico? O valor será devolvido ao saldo em aberto da dívida.")){debt.balance=Math.round(((Number(debt.balance)||0)+(Number(payment.amount)||0))*100)/100;debt.payments=debt.payments.filter(p=>p.id!==payment.id);save();}return;}
 const debtEdit=e.target.closest("[data-edit-debt]");if(debtEdit){openDebtForm(debtEdit.dataset.editDebt);return;}
 const debt=e.target.closest("[data-delete-debt]");if(debt&&confirm("Remover esta dívida do plano?")){db.debts=db.debts.filter(x=>x.id!==debt.dataset.deleteDebt);save();return;}
 const income=e.target.closest("[data-delete-income]");if(income&&confirm("Excluir esta receita?")){db.incomes=db.incomes.filter(x=>x.id!==income.dataset.deleteIncome);save();return;}
 const event=e.target.closest("[data-delete-event]");if(event&&confirm("Excluir este compromisso?")){db.events=db.events.filter(x=>x.id!==event.dataset.deleteEvent);save();return;}
 const bill=e.target.closest("[data-delete-bill]");if(bill&&confirm("Excluir todas as parcelas deste lançamento?")){db.bills=db.bills.filter(x=>(x.groupId||x.id)!==bill.dataset.deleteBill);save();return;}
 const card=e.target.closest("[data-delete-card]");if(card&&confirm("Excluir este cartão? Os lançamentos vinculados serão mantidos.")){db.cards=db.cards.filter(x=>x.id!==card.dataset.deleteCard);save();return;}
 if(e.target.closest("#exportBackup")){exportBackup();return;}
 if(e.target.closest("#backupSyncNow")){if(window.AgendaInteligenteCloud)window.AgendaInteligenteCloud.sync();return;}
});
document.addEventListener("change",e=>{
 if(e.target.id==="importBackup"){
  const file=e.target.files[0];if(!file)return;
  const reader=new FileReader();reader.onload=()=>{
   try{
    if(file.size>10*1024*1024)throw new Error("O arquivo ultrapassa o limite de 10 MB.");
    const parsed=JSON.parse(reader.result),data=parsed&&parsed.data?parsed.data:parsed;
    if(!data||typeof data!=="object"||Array.isArray(data))throw new Error("O conteúdo do arquivo não é um backup válido.");
    for(const key of ["events","bills","cards"]){if(!Array.isArray(data[key]))throw new Error("O backup está incompleto: seção "+key+" não encontrada.");if(data[key].some(item=>!item||typeof item!=="object"||Array.isArray(item)))throw new Error("Há registros inválidos na seção "+key+".");}
    for(const key of ["incomes","debts"]){if(data[key]!==undefined&&(!Array.isArray(data[key])||data[key].some(item=>!item||typeof item!=="object"||Array.isArray(item))))throw new Error("A seção "+key+" contém dados inválidos.");}
    if(data.budgets!==undefined&&(!data.budgets||typeof data.budgets!=="object"||Array.isArray(data.budgets)))throw new Error("A seção de orçamentos está inválida.");
    const summary="Compromissos: "+data.events.length+"\nContas e parcelas: "+data.bills.length+"\nCartões: "+data.cards.length+"\nReceitas: "+(data.incomes||[]).length+"\nDívidas: "+(data.debts||[]).length;
    if(confirm("Confira o conteúdo deste backup:\n\n"+summary+"\n\nA restauração substituirá os registros atuais deste aparelho. Deseja continuar?")){
     db={events:data.events,bills:data.bills,cards:data.cards,incomes:Array.isArray(data.incomes)?data.incomes:[],budgets:data.budgets&&typeof data.budgets==="object"?data.budgets:{},debts:Array.isArray(data.debts)?data.debts:[]};
     db.bills.forEach(x=>{if(!x.category)x.category="Outros";});
     save();alert("Backup restaurado com sucesso. Se sua conta estiver conectada, a sincronização será iniciada automaticamente.");
    }
   }catch(err){alert("Não foi possível restaurar o backup: "+(err.message||"arquivo inválido."));}
  };reader.readAsText(file);e.target.value="";
 }
});
render();
if("serviceWorker"in navigator)window.addEventListener("load",()=>navigator.serviceWorker.register("./sw.js").catch(()=>{}));