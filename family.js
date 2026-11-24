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
  const initialTab=families.length?"minha":"criar";
  document.querySelector("#familyContent").innerHTML='<nav class="family-tabs" role="tablist" aria-label="Seções da família"><button type="button" class="family-tab '+(initialTab==="minha"?"active":"")+'" role="tab" aria-selected="'+(initialTab==="minha")+'" data-family-tab="minha">Minha família</button><button type="button" class="family-tab '+(initialTab==="criar"?"active":"")+'" role="tab" aria-selected="'+(initialTab==="criar")+'" data-family-tab="criar">Criar família</button><button type="button" class="family-tab" role="tab" aria-selected="false" data-family-tab="aceitar">Aceitar convite</button></nav><section class="family-panel '+(initialTab==="minha"?"is-active":"")+'" data-family-panel="minha" '+(initialTab!=="minha"?"hidden":"")+'><div class="family-panel-heading"><div><p class="eyebrow">GRUPOS E PARTICIPAÇÃO</p><h3>Minhas famílias</h3></div><span class="family-count">'+families.length+'</span></div>'+(rows||'<div class="family-empty"><strong>Você ainda não participa de uma família</strong><span>Crie um grupo ou aceite um convite para começar a organizar atividades compartilhadas.</span></div>')+'</section><section class="family-panel '+(initialTab==="criar"?"is-active":"")+'" data-family-panel="criar" '+(initialTab!=="criar"?"hidden":"")+'><div class="family-panel-heading"><div><p class="eyebrow">NOVO GRUPO</p><h3>Criar uma família</h3><small>Defina um nome para seu grupo familiar</small></div></div><form id="familyCreate" class="family-form"><label for="familyName">Nome da família</label><input id="familyName" name="name" required minlength="2" maxlength="80" placeholder="Ex.: Família Silva"><button class="primary">Criar família</button></form></section><section class="family-panel '+(initialTab==="aceitar"?"is-active":"")+'" data-family-panel="aceitar" hidden><div class="family-panel-heading"><div><p class="eyebrow">VOCÊ RECEBEU UM CONVITE?</p><h3>Entrar em uma família</h3><small>Cole o código enviado pelo administrador</small></div></div><form id="familyAccept" class="family-form"><label for="familyCode">Código do convite</label><input id="familyCode" name="token" required placeholder="Cole o código recebido"><button class="auth-secondary">Aceitar convite</button></form></section><p class="family-safety-note">Seus registros pessoais continuam privados. Criar uma família ou aceitar um convite não compartilha automaticamente compromissos, receitas, despesas ou dívidas. O compartilhamento seletivo será configurado em uma etapa protegida separada.</p>';
  document.querySelectorAll("[data-family-tab]").forEach(tab=>tab.onclick=()=>{const selected=tab.dataset.familyTab;document.querySelectorAll("[data-family-tab]").forEach(item=>{const active=item===tab;item.classList.toggle("active",active);item.setAttribute("aria-selected",String(active));});document.querySelectorAll("[data-family-panel]").forEach(panel=>{const active=panel.dataset.familyPanel===selected;panel.classList.toggle("is-active",active);panel.hidden=!active;});});
  document.querySelector("#familyCreate").onsubmit=async e=>{e.preventDefault();const b=e.currentTarget.querySelector("button");b.disabled=true;try{const {error}=await c.rpc("create_family",{p_name:new FormData(e.currentTarget).get("name")});if(error)throw error;await show();note("Família criada. Você é o administrador.");}catch(x){note(x.message||"Não foi possível criar a família. Confira se a migração SQL foi executada.",true);}finally{b.disabled=false;}};
  document.querySelector("#familyAccept").onsubmit=async e=>{e.preventDefault();const b=e.currentTarget.querySelector("button");b.disabled=true;try{const token=String(new FormData(e.currentTarget).get("token")||"").trim();const {error}=await c.rpc("accept_family_invitation",{p_token:token});if(error)throw error;await show();note("Convite aceito. Você agora faz parte da família.");}catch(x){note(x.message||"Não foi possível aceitar o convite.",true);}finally{b.disabled=false;}};
  document.querySelectorAll("[data-invite]").forEach(b=>b.onclick=()=>{
   const parent=b.closest(".family-group");
   const current=parent.querySelector(".family-invite-form");
   if(current){current.remove();b.textContent="Convidar";return;}
   const form=document.createElement("form");
   form.className="family-invite-form";
   form.innerHTML='<label>E-mail da pessoa convidada</label><input type="email" name="email" autocomplete="email" required placeholder="nome@exemplo.com"><div class="family-invite-form-actions"><button type="submit" class="primary">Gerar convite</button><button type="button" class="auth-secondary" data-cancel-invite>Cancelar</button></div>';
   parent.appendChild(form);
   b.textContent="Fechar";
   form.querySelector("[data-cancel-invite]").onclick=()=>{form.remove();b.textContent="Convidar";};
   form.onsubmit=async e=>{
    e.preventDefault();
    const submit=form.querySelector('[type="submit"]');
    const email=String(new FormData(form).get("email")||"").trim().toLowerCase();
    if(!email)return;
    submit.disabled=true;submit.textContent="Gerando...";
    try{
     const {data,error}=await c.rpc("invite_family_member",{p_family_id:b.dataset.invite,p_email:email});
     if(error)throw error;
     const token=data&&data[0]&&data[0].invitation_token;
     if(!token)throw new Error("O convite não foi gerado.");
     const expiry=data[0].invitation_expires_at?new Date(data[0].invitation_expires_at):null;
     const expiryText=expiry&&!Number.isNaN(expiry.getTime())?expiry.toLocaleDateString("pt-BR"):"em 7 dias";
     const appUrl="https://swagtop411-max.github.io/Agenda-inteligente/";
     const inviteText="Você foi convidado(a) para a família no Agenda Inteligente!\n\n1. Abra o aplicativo pelo navegador: "+appUrl+"\n2. Entre ou crie sua conta usando este e-mail: "+email+"\n3. Acesse Menu > Família e cole o código abaixo.\n\nCódigo do convite: "+token+"\nValidade até: "+expiryText+"\n\nNão precisa baixar pela Play Store. Você pode adicionar o aplicativo à tela inicial do celular.";
     form.innerHTML='<div class="family-invite-success"><strong>Convite gerado!</strong><p>Envie para '+esc(email)+'. Validade: '+esc(expiryText)+'.</p><div class="family-invite-form-actions"><button type="button" class="primary" data-share-invite>Compartilhar convite</button><button type="button" class="auth-secondary" data-copy-invite>Copiar mensagem e código</button></div></div>';
     form.querySelector("[data-share-invite]").onclick=async()=>{
      try{
       if(navigator.share)await navigator.share({title:"Convite — Agenda Inteligente",text:inviteText});
       else{await navigator.clipboard.writeText(inviteText);note("Convite copiado! Abra o WhatsApp e cole a mensagem.",false);}
      }catch(x){if(x.name!=="AbortError")note("Não foi possível compartilhar. Use Copiar mensagem e código.",true);}
     };
     form.querySelector("[data-copy-invite]").onclick=async()=>{
      try{await navigator.clipboard.writeText(inviteText);note("Convite copiado! Abra o WhatsApp e cole a mensagem.",false);}
      catch(x){
       const area=document.createElement("textarea");area.value=inviteText;area.setAttribute("readonly","");area.style.position="fixed";area.style.opacity="0";document.body.appendChild(area);area.select();const copied=document.execCommand("copy");area.remove();
       note(copied?"Convite copiado! Abra o WhatsApp e cole a mensagem.":"Não foi possível copiar automaticamente. Tente compartilhar pelo botão acima.",!copied);
      }
     };
    }catch(x){note(x.message||"Não foi possível gerar o convite.",true);submit.disabled=false;submit.textContent="Tentar novamente";}
   };
   form.querySelector("input").focus();
  });
 }catch(x){document.querySelector("#familyContent").innerHTML='<p class="muted">A base de Família ainda precisa ser preparada no Supabase. Execute o arquivo <strong>supabase/family.sql</strong> no SQL Editor do projeto e depois atualize o aplicativo.</p>';note(x.message||"Não foi possível carregar as famílias.",true);}
}
document.addEventListener("click",e=>{const b=e.target.closest('[data-view="family"]');if(!b)return;e.preventDefault();e.stopImmediatePropagation();show();const sidebar=document.querySelector(".sidebar");if(sidebar)sidebar.classList.remove("menu-open");const toggle=document.querySelector("#menuToggle");if(toggle){toggle.setAttribute("aria-expanded","false");toggle.querySelector(".menu-toggle-icon").textContent="☰";toggle.querySelector("span:last-child").textContent="Menu";}},true);
window.AgendaInteligenteFamily={open:show};
})();