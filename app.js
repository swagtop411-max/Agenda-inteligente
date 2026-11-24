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
function setView(v){activeView=v;render();}
document.querySelectorAll("[data-view]").forEach(b=>b.onclick=()=>setView(b.dataset.view));
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
  if(inputType==="select"){const options=db.cards.map(card=>'<option value="'+esc(card.id)+'">'+esc(card.title)+'</option>').join("");return '<div class="field"><label>'+label+'</label><select name="cardId"><option value="">Sem cartão</option>'+options+'</select></div>';}
  if(inputType==="category"){const options=categories.map(cat=>'<option value="'+cat+'">'+cat+'</option>').join("");return '<div class="field"><label>'+label+'</label><select name="category">'+options+'</select></div>';}
  const isMoney=name==="amount"||name==="limit";
  const attrs=name==="installments"?'min="1" max="120" value="1"':(isMoney?'inputmode="decimal" data-money placeholder="0,00"':(inputType==="number"?'min="0" step="0.01"':""));
  const fieldType=isMoney?"text":inputType;
  const defaultValue=name==="month"?'value="'+new Date().toISOString().slice(0,7)+'"':"";
  return '<div class="field"><label>'+label+'</label><input name="'+name+'" type="'+fieldType+'" required '+attrs+' '+defaultValue+'></div>';
 }).join("");
 const editor=(type==="purchase"||type==="bill")?'<section class="installment-editor"><p class="muted">Digite o valor normalmente. Os pontos de milhar e a vírgula dos centavos serão inseridos automaticamente.</p><div class="field"><label>Valor de cada parcela (R$)</label><input id="installmentUnit" type="text" inputmode="decimal" data-money placeholder="0,00"></div><strong id="installmentSum"></strong></section>':"";
 root.innerHTML='<div class="modal-backdrop"><div class="modal"><div class="modal-head"><h2>'+cfg.title+'</h2><button class="close" type="button">×</button></div><form id="recordForm">'+fields+editor+'<button class="primary" type="submit">Salvar registro</button></form></div></div>';
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
function openDebtForm(){
 const root=$("#modalRoot");const cats=["Obrigação prioritária","Dívida negociável","Conta essencial fixa","Gasto que posso reduzir"];
 root.innerHTML='<div class="modal-backdrop"><div class="modal"><div class="modal-head"><h2>Cadastrar compromisso ou dívida</h2><button class="close" type="button">×</button></div><form id="debtForm"><div class="field"><label>Nome da conta ou dívida</label><input name="title" required placeholder="Ex.: Cartão, aluguel, empréstimo"></div><div class="field"><label>Classificação</label><select name="type">'+cats.map((x,i)=>'<option value="'+["mandatory","negotiable","essential","flexible"][i]+'">'+x+'</option>').join("")+'</select></div><div class="field"><label>Valor total em aberto (R$)</label><input name="balance" data-money inputmode="decimal" required placeholder="0,00"></div><div class="field"><label>Pagamento mínimo ou parcela mensal (R$)</label><input name="minimum" data-money inputmode="decimal" placeholder="0,00"></div><div class="field"><label>Juros ao mês (%) — se souber</label><input name="interest" type="number" min="0" max="1000" step="0.01" placeholder="Opcional"></div><div class="field"><label>Próximo vencimento</label><input name="date" type="date" required></div><div class="field"><label>O que pode acontecer se atrasar?</label><select name="risk"><option value="high">Risco alto: corte, perda de bem ou consequência legal</option><option value="medium" selected>Risco moderado: juros, multa ou cobrança</option><option value="low">Pode negociar sem consequência imediata conhecida</option></select></div><button class="primary" type="submit">Salvar dívida</button></form></div></div>';
 bindMoneyInputs(root);root.querySelector(".close").onclick=()=>root.innerHTML="";root.querySelector(".modal-backdrop").onclick=e=>{if(e.target.classList.contains("modal-backdrop"))root.innerHTML="";};
 root.querySelector("#debtForm").onsubmit=e=>{e.preventDefault();const f=Object.fromEntries(new FormData(e.currentTarget));db.debts.push({id:crypto.randomUUID(),title:f.title,type:f.type,balance:parseMoney(f.balance),minimum:parseMoney(f.minimum),interest:Number(f.interest)||0,date:f.date,risk:f.risk});root.innerHTML="";save();};
}
function simulateDebtStrategy(items,monthlyBudget,method){
 const rows=items.map(x=>({id:x.id,title:x.title,balance:Math.round(Math.max(0,Number(x.balance)||0)*100),minimum:Math.round(Math.max(0,Number(x.minimum)||0)*100),rate:Math.max(0,Number(x.interest)||0)/100}));
 const original=rows.reduce((sum,x)=>sum+x.balance,0);if(!rows.length)return {months:0,interest:0,paid:0,success:true};
 const budget=Math.round(Math.max(0,monthlyBudget)*100);if(budget<=0)return {success:false,reason:"Informe um valor disponível para quitar dívidas."};
 let interest=0,paid=0;
 for(let month=1;month<=360;month++){
  const active=rows.filter(x=>x.balance>0);if(!active.length)return {success:true,months:month-1,interest:interest/100,paid:paid/100};
  let interestThisMonth=0;
  for(const x of active){const charge=Math.round(x.balance*x.rate);x.balance+=charge;interest+=charge;interestThisMonth+=charge;}
  let remaining=budget;
  const minimumTotal=active.reduce((sum,x)=>sum+Math.min(x.balance,x.minimum),0);
  if(minimumTotal>budget)return {success:false,reason:"O valor disponível não cobre as parcelas mínimas das dívidas negociáveis. Negocie os pagamentos mínimos antes de simular."};
  for(const x of active){const amount=Math.min(x.balance,x.minimum);x.balance-=amount;remaining-=amount;paid+=amount;}
  const sorted=rows.filter(x=>x.balance>0).sort((a,b)=>method==="avalanche"?(b.rate-a.rate||a.balance-b.balance):(a.balance-b.balance||b.rate-a.rate));
  for(const x of sorted){if(remaining<=0)break;const amount=Math.min(remaining,x.balance);x.balance-=amount;remaining-=amount;paid+=amount;}
  if(rows.every(x=>x.balance<=0))return {success:true,months:month,interest:interest/100,paid:paid/100};
  if(budget<=interestThisMonth)return {success:false,reason:"Com este orçamento, os juros podem impedir a quitação. Considere negociar taxas menores."};
 }
 return {success:false,reason:"Não foi possível projetar a quitação em até 30 anos. Reveja juros e orçamento."};
}
function debtStrategyComparison(debts,budget){
 const fixed=debts.filter(x=>x.type==="mandatory"||x.type==="essential").reduce((sum,x)=>sum+Math.max(0,Number(x.minimum)||0),0);
 const negotiable=debts.filter(x=>x.type==="negotiable"&&Number(x.balance)>0);
 const available=Math.max(0,budget-fixed);
 const unknown=negotiable.some(x=>!Number(x.interest));
 const snow=simulateDebtStrategy(negotiable,available,"snowball"),ava=simulateDebtStrategy(negotiable,available,"avalanche");
 const base='<div class="strategy-heading"><h3>Compare dois caminhos</h3><p class="muted">Após reservar '+money(fixed)+' para obrigações essenciais e prioritárias, restam '+money(available)+' por mês para as dívidas negociáveis.</p></div>';
 if(!negotiable.length)return base+'<p class="muted">Cadastre pelo menos uma dívida negociável com saldo em aberto para comparar estratégias.</p>';
 if(budget<fixed)return base+'<p class="recovery-guidance">O valor reservado ainda não cobre os pagamentos prioritários. Negocie primeiro essas obrigações.</p>';
 const card=(name,subtitle,sim)=>'<article class="strategy-card"><strong>'+name+'</strong><small>'+subtitle+'</small>'+(sim.success?'<div class="strategy-numbers"><span><b>'+sim.months+'</b> meses</span><span><b>'+money(sim.interest)+'</b> juros estimados</span><span><b>'+money(sim.paid)+'</b> total estimado</span></div>':'<p class="strategy-warning">'+sim.reason+'</p>')+'</article>';
 let html=base+'<div class="strategy-cards">'+card("Bola de neve","Prioriza o menor saldo",snow)+card("Avalanche","Prioriza a maior taxa de juros",ava)+'</div>';
 if(snow.success&&ava.success){const saving=Math.max(0,snow.interest-ava.interest);html+='<p class="recovery-guidance">'+(saving>0?'Neste cenário, a avalanche economizaria aproximadamente '+money(saving)+' em juros.':'Neste cenário, as estratégias apresentam custos semelhantes.')+'</p>';}
 html+='<p class="recovery-note">Simulação ilustrativa com juros mensais constantes, pagamentos mínimos informados e valor mensal fixo. Não inclui multas, tarifas, descontos, reajustes ou novas compras. '+(unknown?'Atenção: dívidas sem juros informados foram calculadas com taxa zero; o resultado pode subestimar o custo real. ':'')+'Contas essenciais e obrigações prioritárias são reservadas antes da simulação, mas seus saldos não são projetados aqui. Não é uma proposta de renegociação.</p>';
 return html;
}
function drawDebtRecovery(month,incomeTotal){
 const list=$("#debtItems"),overview=$("#recoveryOverview"),result=$("#debtPlanResult");if(!list||!overview||!result)return;
 const types={mandatory:"Obrigação prioritária",essential:"Conta essencial fixa",negotiable:"Dívida negociável",flexible:"Gasto que posso reduzir"};
 const rank={mandatory:0,essential:1,negotiable:2,flexible:3};
 const debts=db.debts.slice().sort((a,b)=>(rank[a.type]??4)-(rank[b.type]??4)||(b.risk==="high"?1:0)-(a.risk==="high"?1:0)||(Number(b.interest)||0)-(Number(a.interest)||0));
 const total=debts.reduce((n,x)=>n+(Number(x.balance)||0),0);
 overview.innerHTML='<div class="recovery-stats"><div><small>Total de dívidas cadastradas</small><strong>'+money(total)+'</strong></div><div><small>Renda registrada no mês</small><strong>'+money(incomeTotal)+'</strong></div><div><small>Compromissos cadastrados</small><strong>'+debts.length+'</strong></div></div><p class="recovery-guidance">Primeiro proteja alimentação, moradia, água, energia e saúde. Em seguida, avalie obrigações com risco de corte, perda de bens ou consequências legais. Para as demais, compare juros e negocie condições que caibam no orçamento.</p>';
 list.innerHTML=debts.length?'<h3>Suas dívidas e prioridades</h3>'+debts.map(x=>'<article class="debt-item"><div class="debt-item-head"><div><strong>'+esc(x.title)+'</strong><small>'+types[x.type]+'</small></div><b>'+money(x.balance)+'</b></div><div class="debt-item-meta"><span>Vencimento '+fmt(x.date)+'</span><span>Parcela mínima '+money(x.minimum)+'</span></div><div class="debt-item-meta"><span>Juros informados: '+(x.interest?x.interest.toLocaleString("pt-BR")+'% a.m.':"Não informado")+'</span><span class="risk-'+x.risk+'">'+(x.risk==="high"?"Risco alto":x.risk==="medium"?"Risco moderado":"Risco baixo informado")+'</span></div><button class="danger-button" data-delete-debt="'+x.id+'">Remover</button></article>').join(""):'<div class="empty">Cadastre suas dívidas e obrigações para montar seu plano.</div>';
 const saved=localStorage.getItem("agendaDebtBudget")||"",budget=parseMoney(saved);
 const budgetInput=$("#debtBudget");if(budgetInput&&budgetInput.value!==saved&&saved)budgetInput.value=Number(budget).toLocaleString("pt-BR",{minimumFractionDigits:2,maximumFractionDigits:2});
 const mandatory=debts.filter(x=>x.type==="mandatory"||x.type==="essential"),negotiable=debts.filter(x=>x.type==="negotiable");
 const required=mandatory.reduce((n,x)=>n+(Number(x.minimum)||0),0);
 let remaining=budget,allocations=[];
 mandatory.forEach(x=>{const pay=Math.min(remaining,Number(x.minimum)||0);remaining-=pay;allocations.push({x,pay,short:Math.max(0,(Number(x.minimum)||0)-pay)});});
 const strategy=negotiable.slice().sort((a,b)=>(Number(b.interest)||0)-(Number(a.interest)||0));
 strategy.forEach(x=>{const pay=Math.min(remaining,Number(x.minimum)||Number(x.balance)||0);remaining-=pay;allocations.push({x,pay,short:Math.max(0,(Number(x.minimum)||Number(x.balance)||0)-pay)});});
 result.innerHTML=!debts.length?'<p class="muted">Cadastre as dívidas acima para visualizar uma proposta.</p>':!budget?'<p class="muted">Informe quanto consegue reservar por mês. O aplicativo distribuirá o valor conforme as prioridades cadastradas.</p>':'<div class="plan-summary"><small>Valor mensal informado</small><strong>'+money(budget)+'</strong><small>Parcelas mínimas prioritárias cadastradas: '+money(required)+'</small></div>'+allocations.map(a=>'<div class="plan-allocation"><span>'+esc(a.x.title)+'<small>'+(a.x.type==="negotiable"?"Negociar juros e condições":"Proteger obrigação prioritária")+'</small></span><b>'+money(a.pay)+'</b></div>').join("")+'<p class="recovery-guidance">'+(budget<required?'Atenção: o valor reservado não cobre todas as parcelas mínimas prioritárias. Procure os credores antes do vencimento para negociar.':'A proposta respeita primeiro as obrigações essenciais cadastradas. Confirme juros, encargos e condições diretamente com cada credor antes de aceitar acordos.')+'</p>';
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
 a.href=url;a.download="agenda-inteligente-backup.json";a.click();URL.revokeObjectURL(url);
}
function render(){
 const main=$("#mainContent"),today=new Date().toISOString().slice(0,10),month=today.slice(0,7),pending=db.bills.filter(x=>!x.paid);
 document.querySelectorAll("[data-view]").forEach(b=>b.classList.toggle("active",b.dataset.view===activeView));
 $("#todayLabel").textContent=new Date().toLocaleDateString("pt-BR",{weekday:"long",day:"2-digit",month:"long"});
 if(activeView==="home"){
  main.innerHTML='<section class="welcome"><div><p class="eyebrow">PAINEL PESSOAL</p><h1>Olá! 👋</h1><p class="muted">Aqui está um resumo da sua organização.</p></div><button class="primary-button" id="quickAdd">＋ Novo registro</button></section><section class="stats-grid" id="statsGrid"></section><section class="content-grid"><article class="panel"><div class="panel-heading"><div><p class="eyebrow">SUA ROTINA</p><h2>Próximos compromissos</h2></div><button class="text-button" data-go="agenda">Ver agenda →</button></div><div id="upcomingList" class="list-area"></div></article><article class="panel"><div class="panel-heading"><div><p class="eyebrow">CONTROLE FINANCEIRO</p><h2>Contas a vencer</h2></div><button class="text-button" data-go="finance">Ver financeiro →</button></div><div id="dueList" class="list-area"></div></article></section><section class="panel"><div class="panel-heading"><div><p class="eyebrow">ACESSO RÁPIDO</p><h2>O que deseja registrar?</h2></div></div><div class="quick-actions"><button class="quick-card" data-action="event"><span>▦</span><strong>Compromisso</strong><small>Organize seus horários</small></button><button class="quick-card" data-action="bill"><span>◈</span><strong>Conta ou despesa</strong><small>Controle seus pagamentos</small></button><button class="quick-card" data-action="purchase"><span>＋</span><strong>Nova compra</strong><small>Registre parcelas e compras</small></button></div></section>';
  $("#statsGrid").innerHTML=[["Compromissos",db.events.length],["Contas pendentes",pending.length],["Despesas do mês",money(db.bills.filter(x=>x.date.startsWith(month)).reduce((s,x)=>s+x.amount,0))],["Cartões cadastrados",db.cards.length]].map(([a,b])=>'<article class="stat-card"><small>'+a+'</small><strong>'+b+'</strong></article>').join("");
  let upcoming=[...db.events.map(x=>({...x,kind:"event"})),...pending.map(x=>({...x,kind:"bill"}))].filter(x=>x.date>=today).sort((a,b)=>a.date.localeCompare(b.date));
  $("#upcomingList").innerHTML=upcoming.length?upcoming.slice(0,5).map(x=>row(x.title,fmt(x.date)+(x.time?" • "+x.time:"")+(x.kind==="bill"?" • Parcela "+x.part+"/"+x.count:""),x.kind==="bill"?x.amount:"")).join(""):'<div class="empty">Nenhum compromisso próximo.</div>';
  $("#dueList").innerHTML=pending.length?pending.slice().sort((a,b)=>a.date.localeCompare(b.date)).slice(0,5).map(x=>row(x.title,fmt(x.date),x.amount,false)).join(""):'<div class="empty">Nenhuma conta pendente.</div>';
  $("#quickAdd").onclick=()=>openForm("event");
 } else if(activeView==="agenda"){
  main.innerHTML='<div class="view-title"><h2>Minha agenda</h2><button class="primary" id="addEvent">＋ Compromisso</button></div><div class="field"><label>Filtrar mês</label><input id="monthFilter" type="month" value="'+month+'"></div><div id="agendaItems" class="list-area"></div>';
  const draw=()=>{let m=$("#monthFilter").value,arr=[...db.events.map(x=>({...x,kind:"event"})),...db.bills.map(x=>({...x,kind:"bill"}))].filter(x=>x.date.startsWith(m)).sort((a,b)=>a.date.localeCompare(b.date));$("#agendaItems").innerHTML=arr.length?arr.map(x=>row(x.title,fmt(x.date)+(x.time?" • "+x.time:"")+(x.kind==="bill"?" • Parcela "+x.part+"/"+x.count:""),x.kind==="bill"?x.amount:"",x.kind==="bill"?x.paid:null,'<br><button class="danger-button" data-delete-'+(x.kind==="bill"?"bill":"event")+'="'+(x.kind==="bill"?(x.groupId||x.id):x.id)+'">Excluir</button>')).join(""):'<div class="empty">Sem registros neste mês.</div>';};
  $("#monthFilter").onchange=draw;draw();$("#addEvent").onclick=()=>openForm("event");
 } else if(activeView==="finance"){
  main.innerHTML='<div class="view-title"><h2>Financeiro</h2><div class="finance-header-actions"><button class="secondary-button" id="addIncome">＋ Receita</button><button class="primary" id="addBill">＋ Despesa</button></div></div><div class="field"><label>Mês analisado</label><input id="spendingMonth" type="month" value="'+month+'"></div><div class="finance-summary-grid"><article class="finance-summary-card income"><small>Receitas do mês</small><strong id="monthIncome">R$ 0,00</strong></article><article class="finance-summary-card expense"><small>Despesas do mês</small><strong id="monthSpent">R$ 0,00</strong></article><article class="finance-summary-card balance"><small>Saldo do mês</small><strong id="monthBalance">R$ 0,00</strong></article><article class="finance-summary-card pending"><small>Total pendente</small><strong id="pendingTotal">'+money(pending.reduce((sum,x)=>sum+(Number(x.amount)||0),0))+'</strong></article></div><section class="panel cashflow-panel"><div class="panel-heading"><div><p class="eyebrow">PREVISÃO DO DINHEIRO</p><h2>Fluxo de caixa</h2><small class="muted">O que já entrou, o que saiu e o que ainda está previsto</small></div></div><div id="cashflowSummary"></div><div id="cashflowTimeline" class="cashflow-timeline"></div></section><section class="panel calendar-panel"><div class="panel-heading"><div><p class="eyebrow">ORGANIZAÇÃO DAS DATAS</p><h2>Calendário financeiro</h2><small class="muted">Toque em um dia para conferir entradas e vencimentos</small></div></div><div id="financeCalendar"></div><div id="calendarDayDetails"></div></section><section class="panel recovery-panel"><div class="panel-heading"><div><p class="eyebrow">PLANO PARA SAIR DAS DÍVIDAS</p><h2>Recuperação financeira</h2><small class="muted">Organize prioridades e monte um plano que caiba no seu orçamento</small></div><button class="primary" id="addDebt">＋ Cadastrar dívida</button></div><div id="recoveryOverview"></div><div id="debtItems"></div><div class="recovery-planner"><h3>Quanto você consegue reservar por mês?</h3><div class="field"><label>Valor mensal para negociar e quitar dívidas (R$)</label><input id="debtBudget" type="text" inputmode="decimal" data-money placeholder="0,00"></div><div id="debtPlanResult"></div></div><p class="recovery-note">O plano é uma estimativa de organização, não substitui orientação financeira ou jurídica. Antes de atrasar qualquer conta, verifique riscos de corte de serviços, perda de bens, multas e consequências legais. Sempre que possível, negocie antes do vencimento.</p></section><section class="panel budget-panel"><div class="panel-heading"><div><p class="eyebrow">PLANEJAMENTO</p><h2>Orçamento por categoria</h2></div><button class="text-button" id="addBudget">＋ Definir limite</button></div><div id="budgetItems"></div></section><section class="panel spending-panel"><div class="panel-heading"><div><p class="eyebrow">ANÁLISE</p><h2>Gastos por categoria</h2></div></div><div id="spendingBreakdown"></div></section><section class="panel"><div class="panel-heading"><div><p class="eyebrow">ENTRADAS</p><h2>Receitas recebidas</h2></div></div><div id="incomeItems" class="list-area"></div></section><section class="panel"><div class="panel-heading"><div><p class="eyebrow">SAÍDAS</p><h2>Contas e despesas</h2></div></div><div id="financeItems" class="list-area"></div></section>';
  const categories=["Alimentação","Transporte","Moradia","Saúde","Educação","Lazer e diversão","Compras","Contas e serviços","Outros"];
  const drawFinance=()=>{
   const selected=$("#spendingMonth").value;
   const expenses=db.bills.filter(x=>String(x.date||"").startsWith(selected));
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
   drawFinanceCalendar(selected,expenses,incomes);
   drawDebtRecovery(selected,incomeTotal);
   const groups={};
   expenses.forEach(x=>{const cat=x.category||"Outros";groups[cat]=(groups[cat]||0)+(Number(x.amount)||0);});
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
   $("#financeItems").innerHTML=expenses.length?expenses.slice().sort((a,b)=>a.date.localeCompare(b.date)).map(x=>'<article class="finance-entry"><div class="finance-entry-head"><div class="finance-entry-main"><span class="finance-entry-icon">↗</span><div class="finance-entry-name"><strong>'+esc(x.title)+'</strong><small>Parcela '+x.part+' de '+x.count+'</small></div></div><strong class="finance-entry-amount">'+money(x.amount)+'</strong></div><div class="finance-entry-info"><span class="finance-category">'+esc(x.category||"Outros")+'</span><span class="finance-due">Vencimento · '+fmt(x.date)+'</span><span class="finance-status '+(x.paid?"is-paid":"is-pending")+'">'+(x.paid?"Pago":"Pendente")+'</span></div><details class="finance-entry-details"><summary><span>Gerenciar lançamento</span><span class="finance-chevron">⌄</span></summary><div class="finance-entry-actions"><button class="text-button" data-pay="'+x.id+'">'+(x.paid?"Desfazer pagamento":"Marcar como pago")+'</button><button class="text-button" data-edit-installment="'+x.id+'">Editar parcela</button><button class="danger-button" data-delete-bill="'+(x.groupId||x.id)+'">Excluir compra</button></div></details></article>').join(""):'<div class="empty">Nenhuma despesa cadastrada neste mês.</div>';
  };
  $("#spendingMonth").onchange=drawFinance;drawFinance();
  $("#addDebt").onclick=()=>openDebtForm();
  $("#debtBudget").onchange=()=>{localStorage.setItem("agendaDebtBudget",String(parseMoney($("#debtBudget").value)));drawDebtRecovery($("#spendingMonth").value,db.incomes.filter(x=>String(x.date||"").startsWith($("#spendingMonth").value)).reduce((a,x)=>a+(Number(x.amount)||0),0));};
  bindMoneyInputs(main);
  $("#addIncome").onclick=()=>openForm("income");
  $("#addBill").onclick=()=>openForm("bill");
  $("#addBudget").onclick=()=>openForm("budget");
 } else if(activeView==="cards"){
  main.innerHTML='<div class="view-title"><h2>Meus cartões</h2><button class="primary" id="addCard">＋ Cartão</button></div><div id="cardsItems" class="list-area"></div>';
  $("#cardsItems").innerHTML=db.cards.length?db.cards.map(c=>{let used=db.bills.filter(x=>x.cardId===c.id&&!x.paid).reduce((s,x)=>s+x.amount,0);return '<div class="card-box"><strong>'+esc(c.title)+'</strong><strong>'+money(c.limit)+'</strong><small>Disponível: '+money(Math.max(0,c.limit-used))+' • Fecha dia '+c.closing+' • Vence dia '+c.due+'</small><br><button class="card-delete" data-delete-card="'+c.id+'">Excluir cartão</button></div>';}).join(""):'<div class="empty">Cadastre seu primeiro cartão.</div>';
  $("#addCard").onclick=()=>openForm("card");
 } else if(activeView==="backup"){
  main.innerHTML='<div class="view-title"><h2>Backup e segurança</h2></div><section class="panel"><h3>Proteja seus registros</h3><p class="muted">Baixe uma cópia dos seus compromissos, contas e cartões. Guarde o arquivo em local seguro.</p><div class="quick-actions"><button class="primary" id="exportBackup">⇩ Baixar backup</button><label class="primary-button" for="importBackup" style="cursor:pointer">⇧ Restaurar backup</label><input id="importBackup" type="file" accept="application/json,.json" hidden></div></section><section class="panel"><h3>Onde seus dados ficam?</h3><p class="muted">Nesta versão, os registros ficam apenas no navegador deste aparelho. Limpar os dados do navegador ou trocar de aparelho pode apagá-los. O backup ajuda a preservar uma cópia, mas não substitui a sincronização em nuvem.</p></section><section class="panel"><h3>Privacidade</h3><p class="muted">Não cadastre senhas bancárias, números completos de cartão ou informações altamente confidenciais nesta versão de demonstração.</p></section>';
 }
}
document.addEventListener("click",e=>{
 const quick=e.target.closest("#quickAdd");if(quick){openForm("event");return;}
 const action=e.target.closest("[data-action]");if(action){openForm(action.dataset.action);return;}
 const go=e.target.closest("[data-go]");if(go){setView(go.dataset.go);return;}
 const edit=e.target.closest("[data-edit-installment]");if(edit){editInstallment(edit.dataset.editInstallment);return;}
 const pay=e.target.closest("[data-pay]");if(pay){let item=db.bills.find(x=>x.id===pay.dataset.pay);if(item){item.paid=!item.paid;save();}return;}
 const debt=e.target.closest("[data-delete-debt]");if(debt&&confirm("Remover esta dívida do plano?")){db.debts=db.debts.filter(x=>x.id!==debt.dataset.deleteDebt);save();return;}
 const income=e.target.closest("[data-delete-income]");if(income&&confirm("Excluir esta receita?")){db.incomes=db.incomes.filter(x=>x.id!==income.dataset.deleteIncome);save();return;}
 const event=e.target.closest("[data-delete-event]");if(event&&confirm("Excluir este compromisso?")){db.events=db.events.filter(x=>x.id!==event.dataset.deleteEvent);save();return;}
 const bill=e.target.closest("[data-delete-bill]");if(bill&&confirm("Excluir todas as parcelas deste lançamento?")){db.bills=db.bills.filter(x=>(x.groupId||x.id)!==bill.dataset.deleteBill);save();return;}
 const card=e.target.closest("[data-delete-card]");if(card&&confirm("Excluir este cartão? Os lançamentos vinculados serão mantidos.")){db.cards=db.cards.filter(x=>x.id!==card.dataset.deleteCard);save();return;}
 if(e.target.closest("#exportBackup")){exportBackup();return;}
});
document.addEventListener("change",e=>{
 if(e.target.id==="importBackup"){
  const file=e.target.files[0];if(!file)return;
  const reader=new FileReader();reader.onload=()=>{
   try{const parsed=JSON.parse(reader.result),data=parsed.data||parsed;if(!Array.isArray(data.events)||!Array.isArray(data.bills)||!Array.isArray(data.cards))throw new Error("Formato inválido");if(confirm("Restaurar este backup? Os dados atuais serão substituídos.")){db={events:data.events,bills:data.bills,cards:data.cards,incomes:Array.isArray(data.incomes)?data.incomes:[],budgets:data.budgets&&typeof data.budgets==="object"?data.budgets:{},debts:Array.isArray(data.debts)?data.debts:[]};db.bills.forEach(x=>{if(!x.category)x.category="Outros";});save();alert("Backup restaurado com sucesso.");}}
   catch(err){alert("Não foi possível restaurar: arquivo inválido.");}
  };reader.readAsText(file);e.target.value="";
 }
});
render();
if("serviceWorker"in navigator)window.addEventListener("load",()=>navigator.serviceWorker.register("./sw.js").catch(()=>{}));