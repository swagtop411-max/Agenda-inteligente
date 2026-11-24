/* Agenda Inteligente - Supabase auth and cloud sync.
   The publishable key is designed for browser use; RLS protects user rows. */
(function(){
"use strict";
const SUPABASE_URL="https://emzpmnnekznhoslfpuui.supabase.co";
const SUPABASE_PUBLISHABLE_KEY="sb_publishable_6l2-Nhtb3ZgU_RNDeCaEdA_vVLOok1h";
let client=null,session=null,syncBusy=false,syncTimer=null,lastMessage="";
const tables=["events","cards","bills","incomes","budgets","debts","debt_payments"];
const statusText=()=>session?("Conectado como "+(session.user.email||"usuário")):"Não conectado";
function clientReady(){
 if(client)return client;
 if(!window.supabase||!window.supabase.createClient)throw new Error("Não foi possível carregar a conexão segura. Verifique sua internet e atualize a página.");
 client=window.supabase.createClient(SUPABASE_URL,SUPABASE_PUBLISHABLE_KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
 return client;
}
function message(text,error=false){lastMessage=text;const el=document.querySelector("#cloudMessage");if(el){el.textContent=text;el.className="auth-message"+(error?" error":"");}}
function setAuthNav(){document.querySelectorAll("[data-view]").forEach(b=>b.classList.toggle("active",b.dataset.view==="auth"));}
function renderAuth(mode="login"){
 const main=document.querySelector("#mainContent");if(!main)return;
 setAuthNav();
 const signed=!!session;
 main.innerHTML='<div class="auth-wrap"><section class="auth-card"><p class="eyebrow">CONTA E SINCRONIZAÇÃO</p><h2>Agenda Inteligente na nuvem</h2><p class="muted">Entre com seu e-mail para proteger e sincronizar seus registros entre dispositivos.</p>'+
 (signed?'<div class="auth-message">Você está conectado como <strong>'+escapeHtml(session.user.email||"")+'</strong>.</div><div class="sync-status"><i class="sync-dot '+(lastMessage.includes("conclu")?"ok":"")+'"></i><span>'+escapeHtml(lastMessage||"Conta autenticada. Seus registros locais continuam preservados.")+'</span></div><div class="auth-actions"><button class="primary" id="cloudSyncNow">Sincronizar agora</button><button class="auth-secondary" id="cloudSignOut">Sair da conta</button></div>':
 '<div class="auth-actions"><button class="'+(mode==="login"?"primary":"auth-secondary")+'" data-auth-mode="login">Entrar</button><button class="'+(mode==="signup"?"primary":"auth-secondary")+'" data-auth-mode="signup">Criar conta</button><button class="auth-secondary" data-auth-mode="reset">Recuperar senha</button></div><form class="auth-form" id="cloudAuthForm">'+
 (mode==="reset"||mode==="newpassword"?'': '<label for="cloudEmail">E-mail</label><input id="cloudEmail" name="email" type="email" autocomplete="email" required placeholder="seuemail@exemplo.com">')+
 (mode==="reset"?'<label for="cloudResetEmail">E-mail cadastrado</label><input id="cloudResetEmail" name="email" type="email" autocomplete="email" required placeholder="seuemail@exemplo.com">':'')+
 (mode==="newpassword"?'<label for="cloudNewPassword">Nova senha</label><input id="cloudNewPassword" name="password" type="password" minlength="8" autocomplete="new-password" required placeholder="Mínimo de 8 caracteres">':(mode==="reset"?'':'<label for="cloudPassword">Senha</label><input id="cloudPassword" name="password" type="password" minlength="8" autocomplete="'+(mode==="signup"?"new-password":"current-password")+'" required placeholder="Mínimo de 8 caracteres">'))+
 '<button class="primary" type="submit">'+(mode==="signup"?"Criar minha conta":mode==="reset"?"Enviar link de recuperação":mode==="newpassword"?"Salvar nova senha":"Entrar")+'</button></form>'+(mode==="login"||mode==="signup"?'<button class="auth-secondary" id="cloudGoogle" type="button">Continuar com Google</button>':'')+'<div id="cloudMessage" class="auth-message" style="display:'+(lastMessage?"block":"none")+'">'+escapeHtml(lastMessage)+'</div>')+
 '</section><section class="auth-card"><h3>Seus dados e segurança</h3><p class="muted">A sincronização usa o banco Supabase com políticas RLS por usuário. Seus registros locais não são apagados ao entrar. Na primeira sincronização, os dados locais são combinados com os dados da nuvem por identificador.</p><p class="muted">A sincronização atual envia alterações e combina registros; exclusões feitas offline ainda precisam ser tratadas em uma etapa própria. Continue mantendo seu backup JSON.</p></section></div>';
 const form=document.querySelector("#cloudAuthForm");
 if(form)form.onsubmit=async e=>{
  e.preventDefault();const fd=new FormData(form),email=String(fd.get("email")||"").trim(),password=String(fd.get("password")||"");
  const submit=form.querySelector("button[type=submit]");submit.disabled=true;submit.textContent="Aguarde...";
  try{
   const c=clientReady();let result;
   if(mode==="signup")result=await c.auth.signUp({email,password,options:{emailRedirectTo:"https://swagtop411-max.github.io/Agenda-inteligente/"}});
   else if(mode==="reset")result=await c.auth.resetPasswordForEmail(email,{redirectTo:"https://swagtop411-max.github.io/Agenda-inteligente/"});
   else if(mode==="newpassword")result=await c.auth.updateUser({password});
   else result=await c.auth.signInWithPassword({email,password});
   if(result.error)throw result.error;
   if(mode==="reset")message("Se o endereço estiver cadastrado, você receberá um link para redefinir a senha. Confira também o spam.");
   else if(mode==="newpassword"){message("Senha atualizada. Entre novamente com a nova senha.");await c.auth.signOut();session=null;renderAuth("login");}
   else if(mode==="signup"&&!result.data.session)message("Conta criada. Confirme seu e-mail pelo link enviado para concluir o cadastro e depois entre aqui.");
   else {session=result.data.session;message("Autenticação concluída. Preparando a sincronização...");await afterLogin();}
  }catch(err){message(err.message||"Não foi possível concluir. Confira os dados e tente novamente.",true);}
  finally{if(document.querySelector("#cloudAuthForm button[type=submit]")){const b=document.querySelector("#cloudAuthForm button[type=submit]");b.disabled=false;b.textContent=mode==="signup"?"Criar minha conta":mode==="reset"?"Enviar link de recuperação":mode==="newpassword"?"Salvar nova senha":"Entrar";}}
 };
 main.querySelectorAll("[data-auth-mode]").forEach(b=>b.onclick=()=>{lastMessage="";renderAuth(b.dataset.authMode);});
 const googleBtn=document.querySelector("#cloudGoogle");if(googleBtn)googleBtn.onclick=async()=>{try{const {error}=await clientReady().auth.signInWithOAuth({provider:"google",options:{redirectTo:"https://swagtop411-max.github.io/Agenda-inteligente/"}});if(error)throw error;}catch(err){message("Login Google ainda precisa ser habilitado e configurado no painel Supabase: "+(err.message||""),true);}};
 const syncBtn=document.querySelector("#cloudSyncNow");if(syncBtn)syncBtn.onclick=()=>syncNow(true);
 const out=document.querySelector("#cloudSignOut");if(out)out.onclick=async()=>{await clientReady().auth.signOut();session=null;lastMessage="Você saiu da conta. Os dados locais permanecem neste aparelho.";renderAuth();};
}
function escapeHtml(v){return String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));}
async function getRows(table){const {data,error}=await client.from(table).select("*");if(error)throw error;return data||[];}
function mergeById(local,remote){const map=new Map((remote||[]).map(x=>[String(x.id),x]));(local||[]).forEach(x=>map.set(String(x.id),{...(map.get(String(x.id))||{}),...x}));return [...map.values()];}
function remoteToLocal(rows){
 const by=Object.fromEntries(tables.map(t=>[t,rows[t]||[]]));
 const debts=by.debts.map(d=>({...d,type:d.type||"mandatory",balance:Number(d.balance)||0,initialBalance:Number(d.initial_balance)||Number(d.balance)||0,minimum:Number(d.minimum)||0,interest:Number(d.interest)||0,payments:by.debt_payments.filter(p=>p.debt_id===d.id).map(p=>({id:p.id,amount:Number(p.amount)||0,date:p.date,note:p.note||"",includeInFinance:p.include_in_finance!==false}))}));
 const budgets={};by.budgets.forEach(b=>{const month=String(b.month).slice(0,7);(budgets[month]||(budgets[month]={}))[b.category]=Number(b.amount)||0;});
 return {events:by.events.map(x=>({id:x.id,title:x.title,date:x.date,time:x.time||""})),cards:by.cards.map(x=>({id:x.id,title:x.title,limit:Number(x.limit)||0,closing:x.closing,due:x.due})),bills:by.bills.map(x=>({id:x.id,groupId:x.group_id||x.id,title:x.title,amount:Number(x.amount)||0,date:x.date,part:x.part,count:x.count,paid:!!x.paid,cardId:x.card_id||"",kind:x.kind||"bill",category:x.category||"Outros"})),incomes:by.incomes.map(x=>({id:x.id,title:x.title,amount:Number(x.amount)||0,date:x.date})),budgets,debts};
}
function localToRemote(){
 const uid=session.user.id;
 const rows={
 events:db.events.map(x=>({id:x.id,user_id:uid,title:x.title,date:x.date,time:x.time||null})),
 cards:db.cards.map(x=>({id:x.id,user_id:uid,title:x.title,limit:Number(x.limit)||0,closing:Number(x.closing)||1,due:Number(x.due)||1})),
 bills:db.bills.map(x=>({id:x.id,user_id:uid,group_id:x.groupId||x.id,title:x.title,amount:Number(x.amount)||0,date:x.date,part:Number(x.part)||1,count:Number(x.count)||1,paid:!!x.paid,card_id:(db.cards.some(card=>card.id===x.cardId)?x.cardId:null),kind:x.kind||"bill",category:x.category||"Outros"})),
 incomes:db.incomes.map(x=>({id:x.id,user_id:uid,title:x.title,amount:Number(x.amount)||0,date:x.date})),
 budgets:Object.entries(db.budgets||{}).flatMap(([month,cats])=>Object.entries(cats||{}).map(([category,amount])=>({user_id:uid,month:month+"-01",category,amount:Number(amount)||0}))),
 debts:db.debts.map(x=>({id:x.id,user_id:uid,title:x.title,type:x.type||"mandatory",balance:Number(x.balance)||0,initial_balance:Number(x.initialBalance??x.balance)||0,minimum:Number(x.minimum)||0,interest:Number(x.interest)||0,date:x.date||null,risk:x.risk||"medium"})),
 debt_payments:db.debts.flatMap(d=>(d.payments||[]).map(p=>({id:p.id,user_id:uid,debt_id:d.id,amount:Number(p.amount)||0,date:p.date,note:p.note||"",include_in_finance:p.includeInFinance!==false})))
 };
 return rows;
}
async function pushLocal(){
 const rows=localToRemote();
 for(const t of ["events","cards","incomes","budgets","debts","bills","debt_payments"]){
  if(!rows[t].length)continue;
  const {error}=await client.from(t).upsert(rows[t],{onConflict:t==="budgets"?"user_id,month,category":"id"});
  if(error)throw error;
 }
}
async function syncNow(showUI){
 if(!session||syncBusy)return;syncBusy=true;
 try{
  client=clientReady();
  const remote={};for(const t of tables)remote[t]=await getRows(t);
  const cloudDb=remoteToLocal(remote);
  const cloudHas=Object.values(remote).some(a=>a.length>0);
  if(cloudHas){
   db.events=mergeById(db.events,cloudDb.events);
   db.cards=mergeById(db.cards,cloudDb.cards);
   db.bills=mergeById(db.bills,cloudDb.bills);
   db.incomes=mergeById(db.incomes,cloudDb.incomes);
   db.debts=mergeById(db.debts,cloudDb.debts).map(d=>({...d,payments:mergeById(d.payments||[],(cloudDb.debts.find(x=>x.id===d.id)||{}).payments||[])}));
   Object.entries(cloudDb.budgets).forEach(([m,c])=>{db.budgets[m]||(db.budgets[m]={});Object.entries(c).forEach(([k,v])=>{if(db.budgets[m][k]===undefined)db.budgets[m][k]=v;});});
  }
  localStorage.setItem(KEY,JSON.stringify(db));
  await pushLocal();
  localStorage.setItem(KEY,JSON.stringify(db));
  lastMessage="Sincronização concluída. "+db.events.length+" compromisso(s), "+db.bills.length+" parcela(s), "+db.cards.length+" cartão(ões), "+db.incomes.length+" receita(s) e "+db.debts.length+" dívida(s) disponíveis.";
  if(showUI)renderAuth();
  render();
 }catch(err){lastMessage="Falha na sincronização: "+(err.message||"verifique conexão, login e permissões.");if(showUI)renderAuth();console.error("Agenda Inteligente sync:",err);}
 finally{syncBusy=false;}
}
async function afterLogin(){renderAuth();await syncNow(true);}
function queueSync(){if(!session||!client)return;clearTimeout(syncTimer);syncTimer=setTimeout(()=>syncNow(false),1800);}
const originalSave=save;
save=function(){originalSave();queueSync();};
const originalSetView=setView;
setView=function(v){if(v==="auth"){activeView="auth";renderAuth();return;}originalSetView(v);};
document.querySelectorAll('[data-view="auth"]').forEach(b=>b.addEventListener("click",()=>{activeView="auth";renderAuth();}));
(async function init(){
 try{client=clientReady();const {data,error}=await client.auth.getSession();if(error)throw error;session=data.session;
  client.auth.onAuthStateChange((event,newSession)=>{session=newSession;if(event==="PASSWORD_RECOVERY"){lastMessage="Digite e salve sua nova senha abaixo.";activeView="auth";renderAuth("newpassword");}else if(newSession&&event==="SIGNED_IN"){afterLogin();}});
  if(session){lastMessage="Conta conectada. Verificando dados na nuvem...";await syncNow(false);}
 }catch(err){console.warn("Supabase não inicializado:",err);}
})();
window.AgendaInteligenteCloud={sync:()=>syncNow(true),getStatus:()=>statusText()};
})();