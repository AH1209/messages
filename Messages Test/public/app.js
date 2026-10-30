const $ = id => document.getElementById(id);
let registration, publicKey, authenticated=false, busy=false, supported=false;
const ios=/iPad|iPhone|iPod/.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);
const standalone=matchMedia('(display-mode: standalone)').matches||navigator.standalone===true;
function status(message,help='',ready=false){$('status').textContent=message;$('help').textContent=help;$('status').classList.toggle('ready',ready);}
async function api(name,data){
  const response=await fetch('/.netlify/functions/'+name,{method:data?'POST':'GET',credentials:'same-origin',cache:'no-store',headers:data?{'Content-Type':'application/json'}:{},body:data?JSON.stringify(data):undefined});
  const result=await response.json().catch(()=>({}));
  if(!response.ok){const error=new Error(response.status===429?'Too many requests. Wait a minute and try again.':result.error||'Could not reach the server. Check your connection.');error.status=response.status;throw error;}
  return result;
}
function keyBytes(key){const s=atob(key.replace(/-/g,'+').replace(/_/g,'/')+'='.repeat((4-key.length%4)%4));return Uint8Array.from(s,c=>c.charCodeAt(0));}
async function getSubscription(create=false){
  let sub=await registration.pushManager.getSubscription();
  const expected=keyBytes(publicKey);
  if(sub && ((sub.expirationTime&&sub.expirationTime<=Date.now()) || (sub.options.applicationServerKey && String(new Uint8Array(sub.options.applicationServerKey))!==String(expected)))){await sub.unsubscribe();sub=null;}
  if(!sub&&create&&Notification.permission==='granted')sub=await registration.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:expected});
  return sub;
}
async function refresh(){
  if(!supported||busy)return;
  $('authorize').hidden=authenticated;
  const granted=Notification.permission==='granted';
  const sub=await getSubscription(granted);
  $('enable').hidden=!!sub||!authenticated||Notification.permission==='denied';
  $('send').disabled=!sub||!authenticated;
  if(Notification.permission==='denied')status('Notifications not enabled','Notifications are blocked. Open iPhone Settings → Notifications → Messages Test to allow them, then reopen the app.');
  else if(!authenticated)status('Notifications not enabled','Unlock this device with your deployment access code.');
  else if(sub)status('Ready to send','',true);
  else status('Notifications not enabled','Enable notifications once, then send as many tests as you need.');
}
function error(e){if(e.status===401){authenticated=false;$('authorize').hidden=false;}status('Something went wrong',e.message);}
$('authorize').addEventListener('submit',async event=>{event.preventDefault();const button=event.submitter;button.disabled=true;try{await api('authorize',{code:$('code').value});$('code').value='';authenticated=true;await refresh();}catch(e){error(e);}finally{button.disabled=false;}});
$('enable').addEventListener('click',async()=>{
  // Call directly in this user gesture: iOS requires transient user activation.
  const permission=Notification.requestPermission();
  $('enable').disabled=true;
  try{await permission;await refresh();}catch(e){error(e);}finally{$('enable').disabled=false;}
});
$('send').addEventListener('click',async()=>{
  busy=true;$('send').disabled=true;status('Scheduling notification…','Keep the app open until the server confirms.');
  try{const sub=await getSubscription(true);if(!sub)throw new Error('Enable notifications before sending.');await api('schedule',{subscription:sub.toJSON()});status('Notification scheduled — you can close the app','Delivery time is approximate.',true);}
  catch(e){error(e);}finally{busy=false;$('send').disabled=!authenticated;}
});
$('reset').addEventListener('click',async()=>{
  if(!registration)return;
  try{const sub=await registration.pushManager.getSubscription();if(sub)await sub.unsubscribe();await refresh();}catch(e){error(e);}
});
async function init(){
  if(ios&&!standalone){status('Notifications not enabled','In Safari, tap Share → Add to Home Screen. Then open Messages Test from its new Home Screen icon.');return;}
  if(!isSecureContext||!('serviceWorker'in navigator)||!('PushManager'in window)||!('Notification'in window)){status('Notifications not enabled','This browser needs HTTPS and Web Push support. On iPhone, use iOS 16.4 or later and open the installed Home Screen app.');return;}
  try{
    await navigator.serviceWorker.register('/sw.js',{scope:'/'});
    registration=await navigator.serviceWorker.ready;
    if(!registration.active)throw new Error('Service worker is not active. Reopen the app.');
    const config=await api('config');publicKey=config.publicKey;authenticated=config.authenticated;supported=true;await refresh();
  }catch(e){error(e);}
}
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'&&supported)refresh().catch(error);});
window.addEventListener('online',()=>{if(supported)refresh().catch(error);else init();});
init();
