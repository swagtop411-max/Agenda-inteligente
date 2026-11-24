const CACHE="agenda-inteligente-v70";
const FILES=["./","./index.html","./styles.css","./app.js","./cloud.js","./family.js","./push.js","./manifest.webmanifest","./icon.svg","./icon-maskable.svg","./sw.js"];
self.addEventListener("install",event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(FILES)).then(()=>self.skipWaiting())));
self.addEventListener("activate",event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key!==CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim())));
self.addEventListener("push",event=>{
  let data={title:"Agenda Inteligente",body:"Você tem um novo aviso.",url:"./"};
  try{if(event.data)data={...data,...event.data.json()};}catch(_){if(event.data)data.body=event.data.text();}
  event.waitUntil(self.registration.showNotification(data.title,{body:data.body,icon:"./icon.svg",badge:"./icon.svg",tag:data.tag||"agenda-inteligente",data:{url:data.url||"./"},renotify:false}));
});
self.addEventListener("notificationclick",event=>{
  event.notification.close();
  const target=new URL(event.notification.data?.url||"./",self.location.origin).href;
  event.waitUntil(clients.matchAll({type:"window",includeUncontrolled:true}).then(list=>{
    for(const client of list){if(new URL(client.url).origin===self.location.origin){client.focus();return client.navigate(target);}}
    return clients.openWindow(target);
  }));
});
self.addEventListener("fetch",event=>{
  if(event.request.method!=="GET") return;
  const freshFirst=event.request.mode==="navigate"||["script","style"].includes(event.request.destination);
  if(freshFirst){
    event.respondWith(fetch(event.request).then(response=>{
      if(response&&response.ok){const copy=response.clone();caches.open(CACHE).then(cache=>cache.put(event.request,copy));}
      return response;
    }).catch(()=>caches.match(event.request,{ignoreSearch:true}).then(cached=>cached||Response.error())));
  } else {
    event.respondWith(caches.match(event.request,{ignoreSearch:true}).then(cached=>cached||fetch(event.request)));
  }
});