# inox-bot ? Ask INOX

Clean preview repository for the Ask INOX assistant and the INOX website runtime it requires. No original repository history, private database, credentials, caches, or unrelated subprojects are included.

## Local setup

Use Node.js 24+, run `npm ci`, copy `.env.example` to `.env.local`, and configure the server-side Gemini key and catalogue database. Run `npm run dev` and open http://127.0.0.1:3000/products.

## Vercel preview

Import this repository as Next.js. Use Node.js 24.x and `npm run build`. Set `ASK_INOX_ENABLED=true`, `ASK_INOX_PROVIDER=gemini`, `GEMINI_API_KEY`, `WEB_DATABASE_DRIVER=mysql`, and the required `WEB_MYSQL_*` settings in the Preview environment only. Never expose credentials with NEXT_PUBLIC prefixes. The database must permit connections from Vercel; no catalogue database is bundled. Use dedicated preview data and do not send real enquiries during testing.

The assistant currently stores session state and usage limits in process memory. Vercel may route requests to different instances or restart them; reliable multi-instance use requires a shared session/rate-limit store. This is not a production deployment certification.

See [assistant setup and known limitations](docs/ask-inox.md).

Event-gallery media is intentionally omitted from this bot preview repository; those galleries may have missing images/videos.

## Runtime diagnostics

Open `/api/ask-inox/health` after deployment. It reports the feature flag, whether Gemini is configured, and whether catalogue configuration is missing or its connection/schema failed. No secret values are returned. The bot preview is enabled on Vercel by default; set `ASK_INOX_ENABLED=false` to disable it explicitly.

Public home, product listing, journal listing and shared layout now remain accessible during a catalogue outage. The site displays an unavailable notice and does not replace live products with fixtures. Brand questions can still retrieve approved public text. Live product lookup still requires a reachable configured MySQL catalogue. Database errors on admin or write operations are not suppressed.

Run `node scripts/check-vercel-public.mjs` after `npm run build` to smoke-test production pages and public knowledge lookup with database/provider credentials removed. It makes no provider calls and sends no enquiries.
