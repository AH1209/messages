import { createCipheriv, createDecipheriv, randomBytes, createHash, timingSafeEqual } from 'node:crypto';
export function env(name) { const v = process.env[name]; if (!v) throw new Error('Server configuration missing'); return v; }
function key() { const s = env('APP_SECRET'); if (!/^[a-f0-9]{64}$/i.test(s)) throw new Error('Invalid server secret'); return Buffer.from(s, 'hex'); }
export function seal(value, purpose, lifetime) {
  const iv = randomBytes(12), cipher = createCipheriv('aes-256-gcm', key(), iv);
  cipher.setAAD(Buffer.from(purpose));
  const data = Buffer.concat([cipher.update(JSON.stringify({ ...value, exp: Date.now() + lifetime })), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), data]).toString('base64url');
}
export function open(token, purpose) {
  if (typeof token !== 'string' || token.length > 12000) throw new Error('Invalid token');
  const b = Buffer.from(token, 'base64url'), d = createDecipheriv('aes-256-gcm', key(), b.subarray(0,12));
  d.setAAD(Buffer.from(purpose)); d.setAuthTag(b.subarray(12,28));
  const value = JSON.parse(Buffer.concat([d.update(b.subarray(28)), d.final()]).toString());
  if (!Number.isFinite(value.exp) || value.exp <= Date.now()) throw new Error('Expired token');
  return value;
}
export function same(a, b) { return timingSafeEqual(createHash('sha256').update(String(a)).digest(), createHash('sha256').update(String(b)).digest()); }
export function origin(req) { if (req.headers.get('origin') !== env('APP_ORIGIN')) throw Object.assign(new Error('Request origin rejected'), { status:403 }); }
export function session(req) {
  try { return open(req.headers.get('cookie')?.match(/(?:^|;\s*)__Host-push-session=([^;]+)/)?.[1], 'session'); }
  catch { throw Object.assign(new Error('Enter your access code to authorize this device.'), { status:401 }); }
}
export async function body(req) {
  if (!req.headers.get('content-type')?.startsWith('application/json')) throw Object.assign(new Error('JSON required'),{status:415});
  const text = await req.text();
  if (Buffer.byteLength(text) > 10000) throw Object.assign(new Error('Request too large'),{status:413});
  try { return JSON.parse(text); } catch { throw Object.assign(new Error('Invalid JSON'),{status:400}); }
}
export function subscription(s) {
  try {
    const u = new URL(s.endpoint);
    const allowed = u.hostname === 'web.push.apple.com' || u.hostname.endsWith('.push.apple.com') || u.hostname === 'fcm.googleapis.com' || u.hostname === 'updates.push.services.mozilla.com';
    if (!allowed || u.protocol !== 'https:' || u.port || u.username || u.password || u.hash || s.endpoint.length > 2048) throw 0;
    for (const [k,n] of [['p256dh',65],['auth',16]]) if (!/^[\w-]+$/.test(s.keys[k]) || Buffer.from(s.keys[k],'base64url').length !== n) throw 0;
    if (Buffer.from(s.keys.p256dh,'base64url')[0] !== 4) throw 0;
    if (s.expirationTime != null && (!Number.isFinite(s.expirationTime) || s.expirationTime <= Date.now())) throw 0;
    return { endpoint:u.href, expirationTime:s.expirationTime ?? null, keys:{p256dh:s.keys.p256dh,auth:s.keys.auth} };
  } catch { throw Object.assign(new Error('Invalid or expired push subscription. Enable notifications again.'),{status:400}); }
}
export function json(data, status=200, headers={}) { return Response.json(data,{status,headers:{'Cache-Control':'no-store',...headers}}); }
export function failure(e) { return json({error:e.status ? e.message : 'Server unavailable. Check Netlify configuration and function logs.'},e.status || 500); }
