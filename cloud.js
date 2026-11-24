/* Agenda Inteligente - Supabase auth and cloud sync.
   The publishable key is designed for browser use; RLS protects user rows. */
(function(){
"use strict";
const SUPABASE_URL="https://emzpmnnekznhoslfpuui.supabase.co";
const SUPABASE_PUBLISHABLE_KEY="sb_publishable_6l2-Nhtb3ZgU_RNDeCaEdA_vVLOok1h";
let client=null,session=null,syncBusy=false,syncTimer=null,retryTimer=null,retryCount=0,lastMessage="";
let syncState="checking",lastSyncAt=localStorage.getItem("agendaInteligente_lastCloudSync")||"";
const tables=["events","cards","bills","incomes","budgets","debts","debt_payments"];
function statusInfo(){
 const connected=!!session;
 const state=!connected?"disconnected":!navigator.onLine?"offline":syncState;
 const labels={disconnected:"Entre na sua conta para ativar a sincronização",checking:"Verificando conexão...",idle:"Conectado, aguardando alterações",syncing:"Sincronizando seus registros...",synced:"Sincronização concluída",error:"Falha na última sincronização",offline:"Sem internet — alterações salvas neste aparelho"};
 const when=lastSyncAt?new Date(lastSyncAt).toLocaleString("pt-BR",{dateStyle:"short",timeStyle:"short"}):"Ainda não sincronizado";
 return {connected,email:session?.user?.email||"",state,label:labels[state]||labels.checking,lastSyncAt,lastSyncLabel:when,message:lastMessage||"",busy:syncBusy};
}
function refreshVisibleStatus(){
 if(activeView==="backup")render();
 else if(activeView==="auth")renderAuth();
}
function scheduleRetry(){
 if(!session||!navigator.onLine||retryCount>=5)return;
 clearTimeout(retryTimer);
 const delay=Math.min(30000*Math.pow(2,retryCount),300000);
 retryCount++;
 retryTimer=setTimeout(()=>syncNow(false),delay);
}
function clientReady(){
 if(client)return client;
 if(!window.supabase||!window.supabase.createClient)throw new Error("Não foi possível carregar a conexão segura. Verifique sua internet e atualize a página.");
 client=window.supabase.createClient(SUPABASE_URL,SUPABASE_PUBLISHABLE_KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
 return client;
}
function message(text,error=false){lastMessage=text;const el=document.querySelector("#cloudMessage");if(el){el.textContent=text;el.className="auth-message"+(error?" error":"");}}
function setAuthNav(){document.querySelectorAll("[data-view]").forEach(b=>b.classList.toggle("active",b.dataset.view==="auth"));}
function renderAuth(mode="login"){
 /* Nunca substitua a tela Família por Conta durante uma sincronização/login em segundo plano. */
 if(activeView!=="auth")return;
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
const baselineKey=()=> "agendaInteligente_sync_baseline_"+session.user.id;
const tombstoneKey=()=> "agendaInteligente_sync_tombstones_"+session.user.id;
function readBaseline(){try{return JSON.parse(localStorage.getItem(baselineKey())||"null");}catch{return null;}}
function readTombstones(){try{const x=JSON.parse(localStorage.getItem(tombstoneKey())||"[]");return Array.isArray(x)?x:[];}catch{return [];}}
function writeTombstones(rows){localStorage.setItem(tombstoneKey(),JSON.stringify(rows));}
function recordSignature(x){const copy={...(x||{})};delete copy.updatedAt;return JSON.stringify(copy);}
function addTombstone(table,id,at){
 if(!id)return;
 const rows=readTombstones(),key=table+"|"+String(id),stamp=at||new Date().toISOString(),i=rows.findIndex(x=>x.table_name+"|"+x.record_id===key);
 if(i>=0){if(String(rows[i].deleted_at)<stamp)rows[i].deleted_at=stamp;}
 else rows.push({table_name:table,record_id:String(id),deleted_at:stamp});
 writeTombstones(rows);
}
function trackArray(table,current,previous){
 const before=new Map((previous||[]).map(x=>[String(x.id),x]));
 const after=new Map((current||[]).map(x=>[String(x.id),x]));
 const now=new Date().toISOString();
 (current||[]).forEach(x=>{
  const old=before.get(String(x.id));
  if(!old||recordSignature(old)!==recordSignature(x))x.updatedAt=now;
  else if(!x.updatedAt)x.updatedAt=old.updatedAt||now;
 });
 before.forEach((x,id)=>{if(!after.has(id))addTombstone(table,id,now);});
}
function trackLocalChanges(){
 const before=readBaseline()||{events:[],cards:[],bills:[],incomes:[],debts:[],budgets:{}};
 ["events","cards","bills","incomes"].forEach(t=>trackArray(t,db[t],before[t]||[]));
 const oldDebts=before.debts||[];
 const oldPayments=oldDebts.flatMap(d=>d.payments||[]);
 const newPayments=db.debts.flatMap(d=>d.payments||[]);
 trackArray("debt_payments",newPayments,oldPayments);
 const oldDebtMap=new Map(oldDebts.map(x=>[String(x.id),x]));
 const newDebtMap=new Map(db.debts.map(x=>[String(x.id),x]));
 const now=new Date().toISOString();
 db.debts.forEach(d=>{
  const old=oldDebtMap.get(String(d.id));
  const currentWithoutPayments={...d};delete currentWithoutPayments.payments;
  const oldWithoutPayments=old?{...old}:null;if(oldWithoutPayments)delete oldWithoutPayments.payments;
  if(!old||recordSignature(oldWithoutPayments)!==recordSignature(currentWithoutPayments))d.updatedAt=now;
  else if(!d.updatedAt)d.updatedAt=old.updatedAt||now;
 });
 oldDebtMap.forEach((d,id)=>{if(!newDebtMap.has(id)){addTombstone("debts",id,now);(d.payments||[]).forEach(p=>addTombstone("debt_payments",p.id,now));}});
}
function stamp(x){return Date.parse(x?.updatedAt||"1970-01-01T00:00:00.000Z")||0;}
function mergeVersioned(local,remote){
 const map=new Map((remote||[]).map(x=>[String(x.id),x]));
 (local||[]).forEach(x=>{const old=map.get(String(x.id));if(!old||stamp(x)>stamp(old))map.set(String(x.id),x);});
 return [...map.values()];
}
function applyTombstones(rows){
 const dead=new Map(rows.map(x=>[x.table_name+"|"+x.record_id,x.deleted_at]));
 ["events","cards","bills","incomes"].forEach(t=>{db[t]=db[t].filter(x=>!dead.has(t+"|"+String(x.id)));});
 db.debts=db.debts.filter(d=>!dead.has("debts|"+String(d.id))).map(d=>({...d,payments:(d.payments||[]).filter(p=>!dead.has("debt_payments|"+String(p.id)))}));
}
function remoteToLocal(rows){
 const by=Object.fromEntries(tables.map(t=>[t,rows[t]||[]]));
 const debts=by.debts.map(d=>({...d,type:d.type||"mandatory",balance:Number(d.balance)||0,initialBalance:Number(d.initial_balance)||Number(d.balance)||0,minimum:Number(d.minimum)||0,interest:Number(d.interest)||0,updatedAt:d.updated_at||null,payments:by.debt_payments.filter(p=>p.debt_id===d.id).map(p=>({id:p.id,amount:Number(p.amount)||0,date:p.date,note:p.note||"",includeInFinance:p.include_in_finance!==false,updatedAt:p.updated_at||null}))}));
 const budgets={};by.budgets.forEach(b=>{const month=String(b.month).slice(0,7);(budgets[month]||(budgets[month]={}))[b.category]=Number(b.amount)||0;});
 return {events:by.events.map(x=>({id:x.id,title:x.title,date:x.date,time:x.time||"",updatedAt:x.updated_at||null})),cards:by.cards.map(x=>({id:x.id,title:x.title,limit:Number(x.limit)||0,closing:x.closing,due:x.due,updatedAt:x.updated_at||null})),bills:by.bills.map(x=>({id:x.id,groupId:x.group_id||x.id,title:x.title,amount:Number(x.amount)||0,date:x.date,part:x.part,count:x.count,paid:!!x.paid,cardId:x.card_id||"",kind:x.kind||"bill",category:x.category||"Outros",updatedAt:x.updated_at||null})),incomes:by.incomes.map(x=>({id:x.id,title:x.title,amount:Number(x.amount)||0,date:x.date,updatedAt:x.updated_at||null})),budgets,debts};
}
function localToRemote(){
 const uid=session.user.id;
 return {
 events:db.events.map(x=>({id:x.id,user_id:uid,title:x.title,date:x.date,time:x.time||null,updated_at:x.updatedAt||new Date().toISOString()})),
 cards:db.cards.map(x=>({id:x.id,user_id:uid,title:x.title,limit:Number(x.limit)||0,closing:Number(x.closing)||1,due:Number(x.due)||1,updated_at:x.updatedAt||new Date().toISOString()})),
 bills:db.bills.map(x=>({id:x.id,user_id:uid,group_id:x.groupId||x.id,title:x.title,amount:Number(x.amount)||0,date:x.date,part:Number(x.part)||1,count:Number(x.count)||1,paid:!!x.paid,card_id:(db.cards.some(card=>card.id===x.cardId)?x.cardId:null),kind:x.kind||"bill",category:x.category||"Outros",updated_at:x.updatedAt||new Date().toISOString()})),
 incomes:db.incomes.map(x=>({id:x.id,user_id:uid,title:x.title,amount:Number(x.amount)||0,date:x.date,updated_at:x.updatedAt||new Date().toISOString()})),
 budgets:Object.entries(db.budgets||{}).flatMap(([month,cats])=>Object.entries(cats||{}).map(([category,amount])=>({user_id:uid,month:month+"-01",category,amount:Number(amount)||0}))),
 debts:db.debts.map(x=>({id:x.id,user_id:uid,title:x.title,type:x.type||"mandatory",balance:Number(x.balance)||0,initial_balance:Number(x.initialBalance??x.balance)||0,minimum:Number(x.minimum)||0,interest:Number(x.interest)||0,date:x.date||null,risk:x.risk||"medium",updated_at:x.updatedAt||new Date().toISOString()})),
 debt_payments:db.debts.flatMap(d=>(d.payments||[]).map(p=>({id:p.id,user_id:uid,debt_id:d.id,amount:Number(p.amount)||0,date:p.date,note:p.note||"",include_in_finance:p.includeInFinance!==false,updated_at:p.updatedAt||new Date().toISOString()})))
 };
}
async function pushLocal(rows,remote,tombstones){
 const dead=new Set(tombstones.map(x=>x.table_name+"|"+x.record_id));
 for(const t of ["events","cards","incomes","debts","bills","debt_payments"]){
  const remoteMap=new Map((remote[t]||[]).map(x=>[String(x.id),x]));
  const pending=(rows[t]||[]).filter(x=>{
   if(dead.has(t+"|"+String(x.id)))return false;
   const old=remoteMap.get(String(x.id));
   return !old||Date.parse(x.updated_at||0)>Date.parse(old.updated_at||0);
  });
  if(!pending.length)continue;
  const {error}=await client.from(t).upsert(pending,{onConflict:"id"});
  if(error)throw error;
 }
 const remoteBudgets=new Map((remote.budgets||[]).map(x=>[String(x.month).slice(0,7)+"|"+x.category,x]));
 const pendingBudgets=(rows.budgets||[]).filter(x=>{
  const old=remoteBudgets.get(String(x.month).slice(0,7)+"|"+x.category);
  return !old||Number(old.amount)!==Number(x.amount);
 });
 if(pendingBudgets.length){const {error}=await client.from("budgets").upsert(pendingBudgets,{onConflict:"user_id,month,category"});if(error)throw error;}
}
async function syncTombstones(localRows){
 if(localRows.length){const payload=localRows.map(x=>({user_id:session.user.id,table_name:x.table_name,record_id:x.record_id,deleted_at:x.deleted_at}));const {error}=await client.from("sync_deletions").upsert(payload,{onConflict:"user_id,table_name,record_id"});if(error)throw error;}
 const {data,error}=await client.from("sync_deletions").select("table_name,record_id,deleted_at");
 if(error)throw error;
 const merged=new Map();
 [...localRows,...(data||[])].forEach(x=>{const k=x.table_name+"|"+x.record_id,old=merged.get(k);if(!old||String(x.deleted_at)>String(old.deleted_at))merged.set(k,x);});
 const all=[...merged.values()];
 writeTombstones(all);
 for(const t of ["events","cards","bills","incomes","debts","debt_payments"]){
  const ids=all.filter(x=>x.table_name===t).map(x=>x.record_id);
  for(const id of ids){const {error:delError}=await client.from(t).delete().eq("id",id);if(delError)throw delError;}
 }
 return all;
}
async function syncNow(showUI){
 if(!session||syncBusy)return false;
 if(!navigator.onLine){syncState="offline";lastMessage="Sem internet. Seus registros continuam salvos neste aparelho e serão sincronizados quando a conexão voltar.";if(showUI)refreshVisibleStatus();return false;}
 syncBusy=true;syncState="syncing";if(showUI)refreshVisibleStatus();
 try{
  client=clientReady();
  trackLocalChanges();
  let tombstones=await syncTombstones(readTombstones());
  applyTombstones(tombstones);
  let remote={};for(const t of tables)remote[t]=await getRows(t);
  const cloudDb=remoteToLocal(remote);
  ["events","cards","bills","incomes"].forEach(t=>{db[t]=mergeVersioned(db[t],cloudDb[t]);});
  const cloudDebtMap=new Map(cloudDb.debts.map(x=>[String(x.id),x]));
  db.debts=mergeVersioned(db.debts,cloudDb.debts).map(d=>{
   const remoteDebt=cloudDebtMap.get(String(d.id));
   if(!remoteDebt)return d;
   return {...d,payments:mergeVersioned(d.payments||[],remoteDebt.payments||[])};
  });
  Object.entries(cloudDb.budgets).forEach(([m,c])=>{db.budgets[m]||(db.budgets[m]={});Object.entries(c).forEach(([k,v])=>{if(db.budgets[m][k]===undefined)db.budgets[m][k]=v;});});
  applyTombstones(tombstones);
  localStorage.setItem(KEY,JSON.stringify(db));
  const rows=localToRemote();
  await pushLocal(rows,remote,tombstones);
  remote={};for(const t of tables)remote[t]=await getRows(t);
  const confirmed=remoteToLocal(remote);
  ["events","cards","bills","incomes"].forEach(t=>{db[t]=mergeVersioned(db[t],confirmed[t]);});
  const confirmedDebtMap=new Map(confirmed.debts.map(x=>[String(x.id),x]));
  db.debts=mergeVersioned(db.debts,confirmed.debts).map(d=>{
   const remoteDebt=confirmedDebtMap.get(String(d.id));
   return remoteDebt?{...d,payments:mergeVersioned(d.payments||[],remoteDebt.payments||[])}:d;
  });
  applyTombstones(tombstones);
  localStorage.setItem(KEY,JSON.stringify(db));
  localStorage.setItem(baselineKey(),JSON.stringify(db));
  lastSyncAt=new Date().toISOString();localStorage.setItem("agendaInteligente_lastCloudSync",lastSyncAt);
  retryCount=0;clearTimeout(retryTimer);syncState="synced";
  lastMessage="Sincronização segura concluída. "+db.events.length+" compromisso(s), "+db.bills.length+" parcela(s), "+db.cards.length+" cartão(ões), "+db.incomes.length+" receita(s) e "+db.debts.length+" dívida(s) disponíveis.";
  return true;
 }catch(err){
  syncState=navigator.onLine?"error":"offline";
  const msg=String(err.message||"");
  lastMessage=(/sync_deletions|updated_at|column .* does not exist|relation .* does not exist/i.test(msg)?"Proteção de sincronização pendente. Execute supabase/sync_safety.sql no Supabase SQL Editor. Seus dados locais foram preservados. ":"Falha na sincronização: ")+(msg||"verifique conexão, login e permissões.");
  console.error("Agenda Inteligente sync:",err);scheduleRetry();return false;
 }finally{syncBusy=false;if(activeView==="backup"||(showUI&&activeView==="auth"))refreshVisibleStatus();}
}
async function afterLogin(){if(activeView==="auth")renderAuth();await syncNow(true);}
function queueSync(){
 if(!session||!client)return;
 clearTimeout(syncTimer);
 if(!navigator.onLine){syncState="offline";lastMessage="Alteração salva neste aparelho. Aguardando conexão para sincronizar.";return;}
 syncState="idle";
 syncTimer=setTimeout(()=>syncNow(false),1800);
}
const originalSave=save;
save=function(){trackLocalChanges();originalSave();queueSync();};
const originalSetView=setView;
setView=function(v){if(v==="auth"){activeView="auth";renderAuth();return;}originalSetView(v);};
document.querySelectorAll('[data-view="auth"]').forEach(b=>b.addEventListener("click",()=>{activeView="auth";renderAuth();}));
(async function init(){
 try{client=clientReady();const {data,error}=await client.auth.getSession();if(error)throw error;session=data.session;
  client.auth.onAuthStateChange((event,newSession)=>{session=newSession;if(event==="PASSWORD_RECOVERY"){lastMessage="Digite e salve sua nova senha abaixo.";activeView="auth";renderAuth("newpassword");}else if(newSession&&event==="SIGNED_IN"){afterLogin();}});
  if(session){lastMessage="Conta conectada. Verificando dados na nuvem...";await syncNow(false);}
 }catch(err){console.warn("Supabase não inicializado:",err);}
})();
window.addEventListener("online",()=>{if(session){syncState="idle";lastMessage="Conexão restabelecida. Sincronizando alterações...";syncNow(true);}});
window.addEventListener("offline",()=>{syncState="offline";lastMessage="Sem internet. As alterações ficam salvas neste aparelho até a conexão voltar.";refreshVisibleStatus();});
document.addEventListener("visibilitychange",()=>{if(document.visibilityState==="visible"&&session&&navigator.onLine&&!syncBusy)syncNow(false);});
window.AgendaInteligenteCloud={sync:()=>syncNow(true),getStatus:()=>statusInfo()};
})();