# Messages Test — iOS Push Test PWA

A minimal HTML/CSS/JavaScript PWA with genuine Web Push, VAPID, `web-push`, and Netlify Functions. No database, notification provider, browser timer, polling, or cron job. The main button schedules a server-side push five seconds after the scheduling endpoint receives the request.

## Setup

Install Node.js 22 or later and Git. In this project folder:

```sh
npm install
npm run keys
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

The first command after install prints the VAPID public/private pair. The next two generate independent `APP_SECRET` and `TEST_ACCESS_CODE` values. Save these securely. Never put private keys or access codes in `public/`, Git, or build output. `.env.example` contains placeholders only. Keep VAPID keys stable across deployments; changing them requires renewing subscriptions.

## GitHub and Netlify

Create an empty GitHub repository, then run (replace the URL):

```sh
git init
git add .
git commit -m "Build Messages Test push PWA"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/messages-test.git
git push -u origin main
```

In Netlify, import the GitHub repository. The included `netlify.toml` configures the publish directory (`public`), functions directory (`netlify/functions`), Node 22, and build command. No frontend build framework is needed.

Configure these environment variables in Netlify with **Functions** scope (or all scopes), using the same values for the production deployment:

| Variable | Value |
| --- | --- |
| `VAPID_PUBLIC_KEY` | Generated public key |
| `VAPID_PRIVATE_KEY` | Generated private key; secret |
| `VAPID_SUBJECT` | Your real contact, e.g. `mailto:you@example.com` |
| `APP_SECRET` | First generated 64-character hex secret |
| `TEST_ACCESS_CODE` | Second independently generated secret; entered once per device |
| `APP_ORIGIN` | Exact production HTTPS origin, e.g. `https://messages-test.netlify.app`, with no trailing slash |

Redeploy after setting variables. Use the same production origin to install and test; preview URLs and alternate domains are intentionally rejected. If adding a custom domain, update `APP_ORIGIN`, redeploy, and install from that domain. Keep the background endpoint reachable by the scheduling function; whole-site password protection can block server-to-server invocation. The app already authenticates sending through its access code.

Netlify's current documentation says Background Functions are available on credit-based Free, Personal, Pro, and Enterprise plans. Hosting/function quotas still apply; no paid notification service is needed. Older legacy account plans may need migration. Confirm Background Functions are enabled on your account.

## Install and use on iPhone

1. Use iOS 16.4 or later. Open the production HTTPS URL in Safari.
2. Tap Share → Add to Home Screen, then launch **Messages Test** from that icon.
3. Enter your `TEST_ACCESS_CODE` into the setup form and tap Unlock. This establishes a Secure, HttpOnly, SameSite cookie for 30 days; the code is not saved in browser storage.
4. Tap **Enable Notifications**, then Allow. Permission is requested only in this tap handler.
5. Tap **Send Test Notification**. Wait until the status reads **Notification scheduled — you can close the app**.
6. Immediately go Home, open the App Switcher, and swipe Messages Test away.
7. A system notification should arrive with title **Alex** and body **Hey! Just wanted to check if you're getting these notifications.** Tap it to reopen the PWA.

You can reopen and send another test without asking permission again. The authorization cookie expires after 30 days; re-entering the access code then is separate from notification permission. Do not close the app before its scheduling acknowledgement: an interrupted HTTP request might not reach the server.

## How delivery works

`app.js` restores or creates a push subscription using the public VAPID key. A same-origin, cookie-authenticated POST goes to `/.netlify/functions/schedule`. The backend validates the subscription and encrypts it in an AES-256-GCM job envelope with a 45-second lifetime and a deadline five seconds in the future. It POSTs this envelope directly to `/.netlify/functions/deliver-background` and waits for Netlify's `202` queue acknowledgement before telling the browser that scheduling succeeded.

The background worker authenticates/decrypts the envelope, awaits the remaining server-side delay, and uses `web-push` to send the encrypted notification. Its execution does not depend on the browser. `sw.js` handles `push` with `event.waitUntil(showNotification(...))` and handles notification clicks by focusing an existing same-origin window or opening `/`.

Only the public key is returned by the configuration endpoint. Private credentials remain in function environment variables. Subscription data is transient in memory and in Netlify's encrypted-job request queue; there is no application database. Do not enable request-body logging. Logs contain only a random job ID, outcome, timestamp, or HTTP status.

The current preferred convention is `export const config = { background: true }`; the function also uses the still-supported `-background` filename. Netlify acknowledges background invocation before executing the handler, permits up to 15 minutes, limits background payloads to 256 KB, and can retry failures after one then two minutes. This app uses less than 10 KB and catches delivery errors to avoid ambiguous-send retries. Job expiry rejects delayed platform retries. A stable per-job Web Push topic and notification tag reduce duplicate delivery, while each new test has a new ID so separate tests can alert separately. Absolute exactly-once delivery is not guaranteed without durable deduplication.

## Security boundaries

- Sending requires the private deployment access code, then an authenticated cookie and exact Origin match. There is no public subscription registration or anonymous send API.
- HTTPS push endpoints are restricted to Apple, Google FCM, and Mozilla services. Credentials, nonstandard ports, malformed keys, expired subscriptions, and lookalike hostnames are rejected. Push-service VAPID binding prevents this deployment's key from sending to subscriptions bound to another application's key.
- The deployment access code grants operator permission to submit subscriptions; share it only with trusted testers. This is a private test utility, not a multi-user service with proof-of-device ownership or user accounts.
- Netlify edge rate limits protect authorization (5/minute/IP/domain) and scheduling (6/minute/IP/domain). Local CLI does not reproduce all edge protections. No unreliable in-memory global rate limiter is claimed.
- A direct call to the background URL still gets Netlify's platform-level 202 but cannot deliver without a valid encrypted job. These rejected invocations can still consume function quota. Never expose the envelope to clients. Rotating `APP_SECRET` invalidates cookies and outstanding jobs.

## Timing and iOS limits

The backend initiates sending approximately five seconds after receiving the scheduling request. Queue startup, network latency, push-service processing, offline devices, and iOS settings can delay arrival. `202` means **queued**, not delivered. A successful `web-push` response means **accepted by the push service**, not displayed on a physical iPhone. TTL is 60 seconds and urgency is high.

The app requests normal sound behavior with `silent: false`; iOS controls sound, Lock Screen, Notification Center, Focus, previews, and presentation. Web Push cannot force a custom sound, subtitle, or Apple's Messages styling. Messages Test has its own purple icon and identity. iOS may choose the installed app icon instead of the payload icon. Removing the app, disabling notifications, or clearing site data can invalidate permission/subscriptions.

## Checks and acceptance tests

```sh
npm run check
npm test
```

Local automated tests cover encryption/tampering/expiry, endpoint validation, authentication and Origin checks, background enqueue failure, an actual five-second backend wait using a mocked push sender, and expired-subscription handling. They do **not** prove remote push delivery.

For optional local development copy `.env.example` to `.env`, fill it in, set `APP_ORIGIN=http://localhost:8888`, then run `npm run dev`. Use a current Netlify CLI. Secure-cookie handling on localhost and background emulation differ by browser/CLI; use the production HTTPS deployment for acceptance. An iPhone cannot test installed push against plain HTTP on a LAN address.

Run these on the production deployment and a **physical iPhone**:

| Test | Procedure | Pass condition | Current status |
| --- | --- | --- | --- |
| A: app open | Send and leave app open | Background log shows push-service acceptance after ~5s; real notification appears | Not physically tested |
| B: background | Send, wait for acknowledgement, go Home | System notification arrives | Not physically tested |
| C: force-closed | Send, wait for acknowledgement, swipe PWA away | Background log confirms independent send; notification arrives | Not physically tested |
| D: tap | Tap received notification with app closed, then repeat with it open | Installed PWA opens or focuses | Not physically tested |
| E: repeat | Reopen app, send another test | No repeated permission setup; a new alert arrives | Not physically tested |

Record device/iOS version, send and arrival times, job ID, and results. This project has not been deployed or physically tested merely by generating its source.

## Troubleshooting

- **Install prompt:** launch from the Home Screen, not a Safari tab; update to iOS 16.4+.
- **Blocked permission:** Settings → Notifications → Messages Test → Allow Notifications. Check Focus, sounds, previews, and Lock Screen settings. Reopen afterward.
- **Unauthorized:** re-enter the deployment access code. Cookies must be allowed; use the exact production origin.
- **Scheduling error:** check all six environment variables, redeploy, and inspect Netlify function logs. Confirm the background function is listed as background and its internal invocation returns 202. A lost scheduling response is ambiguous; avoid immediately retrying because the first job may already be queued.
- **Scheduled but no notification:** inspect `deliver-background` logs. `push-service-accepted` proves a send, not iOS receipt. Test network connectivity and device notification settings. `delivery-failed` with 401/403 typically means VAPID/contact configuration; 429 indicates service throttling.
- **404/410 / subscription-expired:** no retries are attempted. Open “How to test on iPhone” and choose **Repair notification subscription** to unsubscribe and create a fresh subscription under existing permission. Because there is no persistent receipt store or polling, asynchronous expiry cannot be displayed immediately in the closed app.
- **Changed VAPID key:** the client compares subscription keys on startup and renews when needed; use Repair if required.
- **Offline:** the application shell can open, but scheduling needs internet. No offline job is silently queued.

## Verified platform references

Reviewed October 30, 2026:

- [Netlify Background Functions](https://docs.netlify.com/build/functions/background-functions/)
- [Netlify Functions API and rate-limit configuration](https://docs.netlify.com/build/functions/api/)
- [Netlify function limits](https://docs.netlify.com/build/functions/overview/)
- [WebKit: Web Push for Web Apps on iOS and iPadOS](https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/)
- [Apple: Sending web push notifications](https://developer.apple.com/documentation/usernotifications/sending-web-push-notifications-in-web-apps-and-browsers)
