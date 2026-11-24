(function(){
"use strict";
const URL="https://emzpmnnekznhoslfpuui.supabase.co";
const KEY="sb_publishable_6l2-Nhtb3ZgU_RNDeCaEdA_vVLOok1h";
let client=null;
const main=document.querySelector("#mainContent");
function esc(v){return String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));}
function note(text,error){const el=document.querySelector("#familyNotice");if(el){el.textContent=text;el.className="auth-message"+(error?" error":"");el.style.display="block";}}
function ready(){if(!client){if(!window.supabase)throw new Error("A conexão ainda está carregando. Atualize a página.");client=window.supabase.createClient(URL,KEY);}return client;}
async function show(){
 activeView="family";
 document.querySelectorAll("[data-view]").forEach(x=>x.classList.toggle("active",x.dataset.view==="family"));
 main.innerHTML='<div class="auth-wrap"><section class="auth-card family-card"><p class="eyebrow">ORGANIZAÇÃO COMPARTILHADA</p><h2>Família</h2><p class="muted">Crie um grupo familiar e convide pessoas que tenham sua própria conta no Agenda Inteligente.</p><div id="familyNotice" class="auth-message" style="display:none"></div><div id="familyContent"><p class="muted">Carregando...</p></div></section></div>';
 try{
  const c=ready(),{data:{session},error:sessionError}=await c.auth.getSession();if(sessionError)throw sessionError;
  if(!session){document.querySelector("#familyContent").innerHTML='<p class="muted">Entre na aba Conta para acessar o módulo Família.</p>';return;}
  const {data,error}=await c.rpc("get_my_families");if(error)throw error;
  const families=data||[];
  const rows=families.map(f=>'<div class="family-group"><div><strong>'+esc(f.family_name)+'</strong><small>'+(f.member_role==="admin"?"Administrador":"Membro")+' · '+Number(f.member_count||0)+' integrante(s)</small></div>'+(f.member_role==="admin"?'<button class="secondary-button" data-invite="'+f.family_id+'">Convidar</button>':"")+'</div>').join("");
  document.querySelector("#familyContent").innerHTML=(rows||'<p class="muted">Você ainda não participa de uma família.</p>')+
  '<form id="familyCreate" class="family-form"><label for="familyName">Nome da família</label><input id="familyName" name="name" required minlength="2" maxlength="80" placeholder="Ex.: Família Silva"><button class="primary">Criar família</button></form>'+
  '<form id="familyAccept" class="family-form"><label for="familyCode">Código do convite</label><input id="familyCode" name="token" required placeholder="Cole o código recebido"><button class="auth-secondary">Aceitar convite</button></form>'+
  '<p class="family-safety-note">Seus registros pessoais continuam privados. Criar uma família ou aceitar um convite não compartilha automaticamente compromissos, receitas, despesas ou dívidas. O compartilhamento seletivo será configurado em uma etapa protegida separada.</p>';
  document.querySelector("#familyCreate").onsubmit=async e=>{e.preventDefault();const b=e.currentTarget.querySelector("button");b.disabled=true;try{const {error}=await c.rpc("create_family",{p_name:new FormData(e.currentTarget).get("name")});if(error)throw error;await show();note("Família criada. Você é o administrador.");}catch(x){note(x.message||"Não foi possível criar a família. Confira se a migração SQL foi executada.",true);}finally{b.disabled=false;}};
  document.querySelector("#familyAccept").onsubmit=async e=>{e.preventDefault();const b=e.currentTarget.querySelector("button");b.disabled=true;try{const token=String(new FormData(e.currentTarget).get("token")||"").trim();const {error}=await c.rpc("accept_family_invitation",{p_token:token});if(error)throw error;await show();note("Convite aceito. Você agora faz parte da família.");}catch(x){note(x.message||"Não foi possível aceitar o convite.",true);}finally{b.disabled=false;}};
  document.querySelectorAll("[data-invite]").forEach(b=>b.onclick=async()=>{const email=prompt("Digite o e-mail exato da pessoa que deseja convidar:");if(!email)return;try{const {data,error}=await c.rpc("invite_family_member",{p_family_id:b.dataset.invite,p_email:email});if(error)throw error;const token=data&&data[0]&&data[0].invitation_token;if(!token)throw new Error("O convite não foi gerado.");const appUrl="https://swagtop411-max.github.io/Agenda-inteligente/";const text="Você foi convidado(a) para a família no Agenda Inteligente!\n\n1. Abra o aplicativo pelo navegador: "+appUrl+"\n2. Entre ou crie sua conta usando este e-mail: "+email+"\n3. Acesse Menu > Família e cole o código abaixo.\n\nCódigo do convite: "+token+"\n\nO código vence em 7 dias. Não é necessário baixar nada pela Play Store; o Agenda Inteligente funciona pelo navegador e pode ser adicionado à tela inicial do celular.";if(navigator.share){await navigator.share({title:"Convite — Agenda Inteligente",text});}else{await navigator.clipboard.writeText(text);alert("Convite copiado. Envie para "+email+".");}}catch(x){note(x.message||"Não foi possível gerar o convite.",true);}});
 }catch(x){document.querySelector("#familyContent").innerHTML='<p class="muted">A base de Família ainda precisa ser preparada no Supabase. Execute o arquivo <strong>supabase/family.sql</strong> no SQL Editor do projeto e depois atualize o aplicativo.</p>';note(x.message||"Não foi possível carregar as famílias.",true);}
}
document.addEventListener("click",e=>{const b=e.target.closest('[data-view="family"]');if(!b)return;e.preventDefault();e.stopImmediatePropagation();show();const sidebar=document.querySelector(".sidebar");if(sidebar)sidebar.classList.remove("menu-open");const toggle=document.querySelector("#menuToggle");if(toggle){toggle.setAttribute("aria-expanded","false");toggle.querySelector(".menu-toggle-icon").textContent="☰";toggle.querySelector("span:last-child").textContent="Menu";}},true);
window.AgendaInteligenteFamily={open:show};
})();