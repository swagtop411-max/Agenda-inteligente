const KEY="agendaInteligente_v1";
let db;
try { db=JSON.parse(localStorage.getItem(KEY)||'{"events":[],"bills":[],"cards":[]}'); } catch { db={events:[],bills:[],cards:[]}; }
let activeView="home";
const $=s=>document.querySelector(s);
const money=n=>Number(n||0).toLocaleString("pt-BR",{style:"currency",currency:"BRL"});
const fmt=d=>new Date(d+"T12:00:00").toLocaleDateString("pt-BR");
function esc(s){return String(s||"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));}
function save(){localStorage.setItem(KEY,JSON.stringify(db));render();}
function addMonths(s,n){let d=new Date(s+"T12:00:00"),day=d.getDate();d.setDate(1);d.setMonth(d.getMonth()+n);d.setDate(Math.min(day,new Date(d.getFullYear(),d.getMonth()+1,0).getDate()));return d.toISOString().slice(0,10);}
function setView(v){activeView=v;render();}
document.querySelectorAll("[data-view]").forEach(b=>b.onclick=()=>setView(b.dataset.view));
function row(title,sub,amount="",paid=null,action=""){return '<div class="list-item"><div><strong>'+esc(title)+'</strong><small>'+esc(sub)+'</small></div><div style="text-align:right">'+(amount?'<strong>'+money(amount)+'</strong> ':"")+(paid===null?"":'<span class="pill '+(paid?"paid":"")+'">'+(paid?"Pago":"Pendente")+'</span>')+action+'</div></div>';}
function openForm(type){
 const cfg={event:["Novo compromisso",[["title","Nome do compromisso","text"],["date","Data","date"],["time","Horário","time"]]],bill:["Nova conta",[["title","Descrição","text"],["amount","Valor total (R$)","number"],["date","Primeiro vencimento","date"],["installments","Parcelas","number"]]],purchase:["Registrar compra",[["title","O que comprou?","text"],["amount","Valor total (R$)","number"],["installments","Parcelas","number"],["date","Primeiro vencimento","date"],["cardId","Cartão (opcional)","select"]]],card:["Cadastrar cartão",[["title","Nome do cartão","text"],["limit","Limite total (R$)","number"],["closing","Dia de fechamento","number"],["due","Dia de vencimento","number"]]]}[type];
 const root=$("#modalRoot");
 root.innerHTML='<div class="modal-backdrop"><div class="modal"><div class="modal-head"><h2>'+cfg[0]+'</h2><button class="close" type="button">×</button></div><form id="recordForm">'+cfg[1].map(([n,l,t])=>'<div class="field"><label>'+l+'</label>'+(t==="select"?'<select name="cardId"><option value="">Sem cartão</option>'+db.cards.map(c=>'<option value="'+c.id+'">'+esc(c.title)+'</option>').join("")+'</select>':'<input name="'+n+'" type="'+t+'" required '+(n==="installments"?'min="1" max="120" value="1"':'')+(t==="number"&&n!=="installments"?'min="0" step="0.01"':'')+'></div>').join("")+'<button class="primary" type="submit">Salvar registro</button></form></div></div>';
 root.querySelector(".close").onclick=()=>root.innerHTML="";
 root.querySelector(".modal-backdrop").onclick=e=>{if(e.target.classList.contains("modal-backdrop"))root.innerHTML="";};
 root.querySelector("form").onsubmit=e=>{e.preventDefault();let f=Object.fromEntries(new FormData(e.target)),id=crypto.randomUUID();
  if(type==="event")db.events.push({id,...f});
  if(type==="card")db.cards.push({id,...f,limit:+f.limit,closing:+f.closing,due:+f.due});
  if(type==="bill"||type==="purchase"){let total=+f.amount,count=Math.max(1,Math.min(120,+f.installments||1)),part=Math.floor(total/count*100)/100;for(let i=0;i<count;i++)db.bills.push({id:crypto.randomUUID(),groupId:id,title:f.title,amount:i===count-1?Math.round((total-part*(count-1))*100)/100:part,date:addMonths(f.date,i),part:i+1,count,paid:false,cardId:f.cardId||"",kind:type});}
  root.innerHTML="";save();
 };
}
function exportBackup(){
 const payload={format:"agenda-inteligente-backup-v1",exportedAt:new Date().toISOString(),data:db};
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
  main.innerHTML='<div class="view-title"><h2>Financeiro</h2><button class="primary" id="addBill">＋ Conta</button></div><div class="stat-card"><small>Total pendente</small><strong>'+money(pending.reduce((s,x)=>s+x.amount,0))+'</strong></div><div id="financeItems" class="list-area"></div>';
  $("#financeItems").innerHTML=db.bills.length?db.bills.slice().sort((a,b)=>a.date.localeCompare(b.date)).map(x=>'<div class="list-item"><div><strong>'+esc(x.title)+' • '+x.part+'/'+x.count+'</strong><small>Vencimento '+fmt(x.date)+'</small></div><div><strong>'+money(x.amount)+'</strong><br><button class="text-button" data-pay="'+x.id+'">'+(x.paid?"Desfazer pagamento":"Marcar como pago")+'</button><br><button class="danger-button" data-delete-bill="'+(x.groupId||x.id)+'">Excluir parcelas</button></div></div>').join(""):'<div class="empty">Nenhuma conta cadastrada.</div>';
  $("#addBill").onclick=()=>openForm("bill");
 } else if(activeView==="cards"){
  main.innerHTML='<div class="view-title"><h2>Meus cartões</h2><button class="primary" id="addCard">＋ Cartão</button></div><div id="cardsItems" class="list-area"></div>';
  $("#cardsItems").innerHTML=db.cards.length?db.cards.map(c=>{let used=db.bills.filter(x=>x.cardId===c.id&&!x.paid).reduce((s,x)=>s+x.amount,0);return '<div class="card-box"><strong>'+esc(c.title)+'</strong><strong>'+money(c.limit)+'</strong><small>Disponível: '+money(Math.max(0,c.limit-used))+' • Fecha dia '+c.closing+' • Vence dia '+c.due+'</small><br><button class="card-delete" data-delete-card="'+c.id+'">Excluir cartão</button></div>';}).join(""):'<div class="empty">Cadastre seu primeiro cartão.</div>';
  $("#addCard").onclick=()=>openForm("card");
 } else if(activeView==="backup"){
  main.innerHTML='<div class="view-title"><h2>Backup e segurança</h2></div><section class="panel"><h3>Proteja seus registros</h3><p class="muted">Baixe uma cópia dos seus compromissos, contas e cartões. Guarde o arquivo em local seguro.</p><div class="quick-actions"><button class="primary" id="exportBackup">⇩ Baixar backup</button><label class="primary-button" for="importBackup" style="cursor:pointer">⇧ Restaurar backup</label><input id="importBackup" type="file" accept="application/json,.json" hidden></div></section><section class="panel"><h3>Onde seus dados ficam?</h3><p class="muted">Nesta versão, os registros ficam apenas no navegador deste aparelho. Limpar os dados do navegador ou trocar de aparelho pode apagá-los. O backup ajuda a preservar uma cópia, mas não substitui a sincronização em nuvem.</p></section><section class="panel"><h3>Privacidade</h3><p class="muted">Não cadastre senhas bancárias, números completos de cartão ou informações altamente confidenciais nesta versão de demonstração.</p></section>';
 }
}
document.addEventListener("click",e=>{
 const action=e.target.closest("[data-action]");if(action){openForm(action.dataset.action);return;}
 const go=e.target.closest("[data-go]");if(go){setView(go.dataset.go);return;}
 const pay=e.target.closest("[data-pay]");if(pay){let item=db.bills.find(x=>x.id===pay.dataset.pay);if(item){item.paid=!item.paid;save();}return;}
 const event=e.target.closest("[data-delete-event]");if(event&&confirm("Excluir este compromisso?")){db.events=db.events.filter(x=>x.id!==event.dataset.deleteEvent);save();return;}
 const bill=e.target.closest("[data-delete-bill]");if(bill&&confirm("Excluir todas as parcelas deste lançamento?")){db.bills=db.bills.filter(x=>(x.groupId||x.id)!==bill.dataset.deleteBill);save();return;}
 const card=e.target.closest("[data-delete-card]");if(card&&confirm("Excluir este cartão? Os lançamentos vinculados serão mantidos.")){db.cards=db.cards.filter(x=>x.id!==card.dataset.deleteCard);save();return;}
 if(e.target.closest("#exportBackup")){exportBackup();return;}
});
document.addEventListener("change",e=>{
 if(e.target.id==="importBackup"){
  const file=e.target.files[0];if(!file)return;
  const reader=new FileReader();reader.onload=()=>{
   try{const parsed=JSON.parse(reader.result),data=parsed.data||parsed;if(!Array.isArray(data.events)||!Array.isArray(data.bills)||!Array.isArray(data.cards))throw new Error("Formato inválido");if(confirm("Restaurar este backup? Os dados atuais serão substituídos.")){db={events:data.events,bills:data.bills,cards:data.cards};save();alert("Backup restaurado com sucesso.");}}
   catch(err){alert("Não foi possível restaurar: arquivo inválido.");}
  };reader.readAsText(file);e.target.value="";
 }
});
render();
if("serviceWorker"in navigator)window.addEventListener("load",()=>navigator.serviceWorker.register("./sw.js").catch(()=>{}));