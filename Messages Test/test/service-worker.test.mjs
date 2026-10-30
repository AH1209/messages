import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import webpush from 'web-push';
import { createECDH, randomBytes } from 'node:crypto';
function worker(clients={}) {
 const handlers={},shown=[];
 const self={location:{origin:'https://example.com'},addEventListener:(name,fn)=>handlers[name]=fn,registration:{showNotification:async(title,options)=>shown.push({title,options})},clients};
 vm.runInNewContext(readFileSync('public/sw.js','utf8'),{self,URL});
 return {handlers,shown};
}
test('push event extends worker lifetime and displays consistent metadata with unique test tags',async()=>{
 const {handlers,shown}=worker();
 for(const id of ['first','second']){let promise;handlers.push({data:{json:()=>({id})},waitUntil:p=>promise=p});await promise;}
 assert.equal(shown[0].title,'Alex');assert.equal(shown[0].options.silent,false);assert.equal(shown[0].options.icon,'/icons/icon-192.png');assert.notEqual(shown[0].options.tag,shown[1].options.tag);
});
test('notification tap focuses an existing app or opens its start URL',async()=>{
 let focused=0,opened=0,closed=0;
 for(const existing of [true,false]){
  const {handlers}=worker({matchAll:async()=>existing?[{url:'https://example.com/',focus:async()=>{focused++;}}]:[],openWindow:async url=>{assert.equal(url,'/');opened++;}});
  let promise;handlers.notificationclick({notification:{close:()=>{closed++;}},waitUntil:p=>promise=p});await promise;
 }
 assert.equal(focused,1);assert.equal(opened,1);assert.equal(closed,2);
});
test('real web-push library encrypts a valid VAPID request without network delivery',()=>{
 const keys=webpush.generateVAPIDKeys(),ecdh=createECDH('prime256v1');ecdh.generateKeys();
 const details=webpush.generateRequestDetails({endpoint:'https://web.push.apple.com/test',keys:{p256dh:ecdh.getPublicKey().toString('base64url'),auth:randomBytes(16).toString('base64url')}},JSON.stringify({title:'Alex'}),{TTL:60,urgency:'high',vapidDetails:{subject:'mailto:test@example.com',...keys}});
 assert.equal(details.method,'POST');assert.ok(details.headers.Authorization.startsWith('vapid '));assert.ok(Buffer.isBuffer(details.body));assert.equal(details.headers['Content-Encoding'],'aes128gcm');
});
