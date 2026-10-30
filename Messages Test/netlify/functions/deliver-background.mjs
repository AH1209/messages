import webpush from 'web-push';
import { deliver } from '../../server/delivery.mjs';
export default req => deliver(req,webpush.sendNotification.bind(webpush));
export const config = { background:true, method:'POST' };
