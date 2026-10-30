import { env, origin, body, same, seal, json, failure } from '../../server/security.mjs';
export default async req => {
  try {
    origin(req); const { code } = await body(req);
    if (typeof code !== 'string' || !same(code,env('TEST_ACCESS_CODE'))) return json({error:'Incorrect access code.'},401);
    const token=seal({},'session',30*86400000);
    return json({ok:true},200,{'Set-Cookie':`__Host-push-session=${token}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=2592000`});
  } catch(e) { return failure(e); }
};
export const config = { method:'POST', rateLimit:{windowLimit:5,windowSize:60,aggregateBy:['ip','domain'],action:'rate_limit'} };
