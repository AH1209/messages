import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes, createECDH } from 'node:crypto';
import { seal,open,subscription } from '../server/security.mjs';
import { deliver } from '../server/delivery.mjs';
import schedule from '../netlify/functions/schedule.mjs';
import authorize from '../netlify/functions/authorize.mjs';
process.env.APP_SECRET=randomBytes(32).toString('hex');
process.env.APP_ORIGIN='https://example.netlify.app';
process.env.TEST_ACCESS_CODE=randomBytes(32).toString('hex');
process.env.VAPID_SUBJECT='mailto:test@example.com';
process.env.VAPID_PUBLIC_KEY='test';process.env.VAPID_PRIVATE_KEY='test';
const ecdh=createECDH('prime256v1');ecdh.generateKeys();
const sub={endpoint:'https://web.push.apple.com/test',expirationTime:null,keys:{p256dh:ecdh.getPublicKey().toString('base64url'),auth:randomBytes(16).toString('base64url')}};
const request=(data,cookie='',origin=process.env.APP_ORIGIN)=>new Request(process.env.APP_ORIGIN+'/.netlify/functions/schedule',{method:'POST',headers:{'Content-Type':'application/json',origin,cookie},body:JSON.stringify(data)});
test('encrypted jobs reject tampering, expiry, and cross-purpose reuse',()=>{
 const t=seal({subscription:sub},'push-job',1000);assert.deepEqual(open(t,'push-job').subscription,sub);
 const raw=Buffer.from(t,'base64url');raw[30]^=1;assert.throws(()=>open(raw.toString('base64url'),'push-job'));
 assert.throws(()=>open(t,'session'));assert.throws(()=>open(seal({},'push-job',-1),'push-job'));
});
test('subscription validation blocks local URLs, credentials, lookalike hosts and malformed keys',()=>{
 assert.deepEqual(subscription(sub),sub);
 for(const endpoint of ['http://web.push.apple.com/x','https://127.0.0.1/x','https://web.push.apple.com.evil.com/x','https://user@web.push.apple.com/x','https://web.push.apple.com:444/x'])assert.throws(()=>subscription({...sub,endpoint}));
 assert.throws(()=>subscription({...sub,keys:{auth:'x',p256dh:'y'}}));
});
test('authorization requires correct code and origin; cookie is secure',async()=>{
 assert.equal((await authorize(request({code:'wrong'}))).status,401);
 assert.equal((await authorize(request({code:process.env.TEST_ACCESS_CODE},'','https://evil.com'))).status,403);
 const r=await authorize(request({code:process.env.TEST_ACCESS_CODE}));assert.equal(r.status,200);
 for(const flag of ['HttpOnly','Secure','SameSite=Strict'])assert.ok(r.headers.get('set-cookie').includes(flag));
});
test('schedule rejects anonymous callers and acknowledges only background 202',async()=>{
 assert.equal((await schedule(request({subscription:sub}))).status,401);
 const cookie='__Host-push-session='+seal({},'session',10000);
 const original=globalThis.fetch;
 try {
  globalThis.fetch=async(url,options)=>{assert.equal(url.origin,process.env.APP_ORIGIN);const job=open(JSON.parse(options.body).job,'push-job');assert.deepEqual(job.subscription,sub);assert.ok(job.due-Date.now()>4500);return new Response(null,{status:202});};
  assert.equal((await schedule(request({subscription:sub},cookie))).status,202);
  globalThis.fetch=async()=>new Response(null,{status:500});
  assert.equal((await schedule(request({subscription:sub},cookie))).status,500);
 } finally {globalThis.fetch=original;}
});
test('backend waits five real seconds before invoking push sender, independently of page',async()=>{
 const start=Date.now();let calls=0;
 const job=seal({subscription:sub,id:'01234567-89ab-cdef-0123-456789abcdef',due:start+5000},'push-job',45000);
 await deliver(request({job}),async(s,p,opts)=>{calls++;assert.ok(Date.now()-start>=4900);assert.equal(JSON.parse(p).title,'Alex');assert.equal(opts.TTL,60);assert.equal(opts.urgency,'high');});
 assert.equal(calls,1);
});
test('invalid background jobs send nothing; 410 errors do not trigger retry',async()=>{
 let calls=0;await deliver(request({job:'invalid'}),async()=>{calls++;});assert.equal(calls,0);
 const job=seal({subscription:sub,id:'expired-test',due:Date.now()},'push-job',45000);
 await deliver(request({job}),async()=>{calls++;throw Object.assign(new Error('Gone'),{statusCode:410});});assert.equal(calls,1);
});
