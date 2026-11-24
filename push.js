/* Agenda Inteligente — ativação de notificações push no Android */
(function(){
"use strict";
const VAPID_PUBLIC_KEY="BEYx2FlU1M6iZsvwv8mTdTzu8-S8PHF9_5khSRyZCIk22wVcwReoi-R6vHmAqU9lOHnSRlpeIFiy74Ck9pWQxMc";
const toBytes=value=>{const pad="=".repeat((4-value.length%4)%4);const raw=atob((value+pad).replace(/-/g,"+").replace(/_/g,"/"));return Uint8Array.from(raw,c=>c.charCodeAt(0));};
function panel(){
 const notice=document.querySelector("#mainContent .notice-center");
 if(!notice||document.getElementById("pushSettings"))return;
 const card=document.createElement("section");
 card.className="panel push-settings";card.id="pushSettings";
 card.innerHTML='<div class="panel-heading"><div><p class="eyebrow">LEMBRETES NO CELULAR</p><h2>Notificações push</h2><small class="muted">Receba avisos mesmo com o aplicativo fechado</small></div><span class="push-state" id="pushState">Verificando</span></div><p class="muted push-description">Contas: 3 dias antes, 1 dia antes e no vencimento. Compromissos: 1 dia antes e 1 hora antes. Contas atrasadas também geram aviso.</p><div class="push-actions"><button class="primary" id="enablePush" type="button">Ativar notificações</button><button class="auth-secondary" id="disablePush" type="button" hidden>Desativar neste aparelho</button></div><small class="push-footnote" id="pushMessage">A ativação depende da permissão do Android e da configuração do serviço de envio.</small>';
 notice.insertAdjacentElement("afterend",card);
 refresh();
}
async function getContext(){
 const cloud=window.AgendaInteligenteCloud;
 if(!cloud)throw new Error("A conexão com a conta ainda está carregando. Aguarde alguns segundos.");
 const session=cloud.getSession(),client=cloud.getClient();
 if(!session)throw new Error("Entre na sua conta do Agenda Inteligente antes de ativar as notificações.");
 return {session,client};
}
function setMessage(text,error){const el=document.getElementById("pushMessage");if(el){el.textContent=text;el.classList.toggle("error",!!error);}}
async function refresh(){
 const state=document.getElementById("pushState");if(!state)return;
 const enable=document.getElementById("enablePush"),disable=document.getElementById("disablePush");
 if(!("serviceWorker"in navigator)||!("PushManager"in window)||!("Notification"in window)){
  state.textContent="Indisponível";enable.disabled=true;setMessage("Este navegador não oferece suporte a notificações push.",true);return;
 }
 try{
  const reg=await navigator.serviceWorker.ready,sub=await reg.pushManager.getSubscription();
  state.textContent=sub?"Ativadas":"Desativadas";
  enable.hidden=!!sub;disable.hidden=!sub;
  if(Notification.permission==="denied"){state.textContent="Bloqueadas";setMessage("As notificações foram bloqueadas nas configurações do navegador. Altere a permissão do site para permitir.",true);}
  else if(sub)setMessage("Este aparelho está inscrito para receber notificações push.");
  else setMessage("Ative para autorizar os avisos neste aparelho.");
 }catch(e){state.textContent="Aguardando";setMessage("Não foi possível verificar o suporte neste momento.",true);}
}
async function enable(){
 const button=document.getElementById("enablePush");if(button)button.disabled=true;
 try{
  const {session,client}=await getContext();
  if(!("Notification"in window)||!("PushManager"in window))throw new Error("Seu navegador não oferece suporte a notificações push.");
  const permission=await Notification.requestPermission();
  if(permission!=="granted")throw new Error("Permissão não concedida. Autorize as notificações do Agenda Inteligente nas configurações do navegador.");
  const reg=await navigator.serviceWorker.ready;
  let sub=await reg.pushManager.getSubscription();
  if(!sub)sub=await reg.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:toBytes(VAPID_PUBLIC_KEY)});
  const {error}=await client.from("push_subscriptions").upsert({user_id:session.user.id,endpoint:sub.endpoint,subscription:sub.toJSON(),updated_at:new Date().toISOString()},{onConflict:"user_id,endpoint"});
  if(error)throw error;
  setMessage("Notificações autorizadas neste aparelho. Falta concluir a ativação do serviço de envio no Supabase.");
  await refresh();
 }catch(e){setMessage(e.message||"Não foi possível ativar as notificações.",true);}
 finally{if(button)button.disabled=false;}
}
async function disable(){
 const button=document.getElementById("disablePush");if(button)button.disabled=true;
 try{
  const {client}=await getContext(),reg=await navigator.serviceWorker.ready,sub=await reg.pushManager.getSubscription();
  if(sub){const {error}=await client.from("push_subscriptions").delete().eq("endpoint",sub.endpoint);if(error)throw error;await sub.unsubscribe();}
  setMessage("Notificações desativadas neste aparelho.");await refresh();
 }catch(e){setMessage(e.message||"Não foi possível desativar.",true);}
 finally{if(button)button.disabled=false;}
}
document.addEventListener("click",e=>{
 if(e.target.closest("#enablePush"))enable();
 if(e.target.closest("#disablePush"))disable();
});
const observer=new MutationObserver(panel);
window.addEventListener("load",panel);
observer.observe(document.getElementById("mainContent")||document.body,{childList:true,subtree:true});
})();
