import { env, json, failure, session } from '../../server/security.mjs';
export default async req => {
  try { let authenticated=false; try { session(req); authenticated=true; } catch {} return json({publicKey:env('VAPID_PUBLIC_KEY'), authenticated}); } catch(e) { return failure(e); }
};
export const config = { method:'GET' };
