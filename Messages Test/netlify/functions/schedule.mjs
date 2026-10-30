import { randomUUID } from 'node:crypto';
import { env, origin, session, body, subscription, seal, json, failure } from '../../server/security.mjs';
export default async req => {
  try {
    origin(req); session(req);
    const sub=subscription((await body(req)).subscription);
    const id=randomUUID(), due=Date.now()+5000;
    const job=seal({subscription:sub,id,due},'push-job',45000);
    const response=await fetch(new URL('/.netlify/functions/deliver-background',env('APP_ORIGIN')),{
      method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({job}),signal:AbortSignal.timeout(10000),redirect:'error'
    });
    if(response.status!==202) throw new Error('Background queue rejected job');
    return json({id,due,status:'scheduled'},202);
  } catch(e) { return failure(e); }
};
export const config = { method:'POST', rateLimit:{windowLimit:6,windowSize:60,aggregateBy:['ip','domain'],action:'rate_limit'} };
