import { setTimeout as sleep } from 'node:timers/promises';
import { body, open, subscription, env } from './security.mjs';
export async function deliver(req, send, wait=sleep) {
  let job;
  try {
    job=open((await body(req)).job,'push-job');
    subscription(job.subscription);
    if (!Number.isFinite(job.due) || job.due>Date.now()+6000 || typeof job.id!=='string') return;
  } catch { return; } // Public invocations cannot create valid encrypted jobs.
  await wait(Math.max(0,job.due-Date.now()));
  if (Date.now()>job.exp) return;
  const payload=JSON.stringify({version:1,id:job.id,title:'Alex',body:"Hey! Just wanted to check if you're getting these notifications.",icon:'/icons/icon-192.png',url:'/'});
  try {
    await send(job.subscription,payload,{TTL:60,urgency:'high',topic:job.id.replaceAll('-',''),timeout:10000,vapidDetails:{subject:env('VAPID_SUBJECT'),publicKey:env('VAPID_PUBLIC_KEY'),privateKey:env('VAPID_PRIVATE_KEY')}});
    console.info(JSON.stringify({id:job.id,result:'push-service-accepted',at:new Date().toISOString()}));
  } catch(e) {
    console.error(JSON.stringify({id:job.id,result:[404,410].includes(e.statusCode)?'subscription-expired':'delivery-failed',status:e.statusCode || null}));
    // Never retry an ambiguous send: it may already have reached the device.
  }
}
