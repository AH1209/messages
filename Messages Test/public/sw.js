const CACHE='messages-test-v1';
const SHELL=['/','/styles.css','/app.js','/manifest.webmanifest','/icons/icon.svg','/icons/icon-192.png','/icons/icon-512.png','/icons/apple-touch-icon.png'];
self.addEventListener('install',event=>{event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(SHELL)).then(()=>self.skipWaiting()));});
self.addEventListener('activate',event=>{event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('messages-test-')&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));});
self.addEventListener('fetch',event=>{
  const url=new URL(event.request.url);
  if(event.request.method!=='GET'||url.origin!==self.location.origin||url.pathname.startsWith('/.netlify/'))return;
  if(!SHELL.includes(url.pathname))return;
  event.respondWith(fetch(event.request).catch(()=>caches.match(event.request)));
});
self.addEventListener('push',event=>{
  let data={};try{data=event.data?.json()||{};}catch{}
  const id=typeof data.id==='string'?data.id:'fallback';
  event.waitUntil(self.registration.showNotification('Alex',{
    body:"Hey! Just wanted to check if you're getting these notifications.",
    icon:'/icons/icon-192.png',badge:'/icons/icon-192.png',
    tag:'messages-test-'+id,renotify:false,silent:false,data:{url:'/',id}
  }));
});
self.addEventListener('notificationclick',event=>{
  event.notification.close();
  event.waitUntil((async()=>{
    const windows=await self.clients.matchAll({type:'window',includeUncontrolled:true});
    for(const client of windows){if(new URL(client.url).origin===self.location.origin&&'focus'in client)return client.focus();}
    return self.clients.openWindow('/');
  })());
});
