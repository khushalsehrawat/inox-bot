# inox-bot ? Ask INOX

Clean preview repository for the Ask INOX assistant and the INOX website runtime it requires. No original repository history, private database, credentials, caches, or unrelated subprojects are included.

## Local setup

Use Node.js 24+, run `npm ci`, copy `.env.example` to `.env.local`, and configure the server-side Gemini key and catalogue database. Run `npm run dev` and open http://127.0.0.1:3000/products.

## Vercel preview

Import this repository as Next.js. Use Node.js 24.x and `npm run build`. Set `ASK_INOX_ENABLED=true`, `ASK_INOX_PROVIDER=gemini`, `GEMINI_API_KEY`, `WEB_DATABASE_DRIVER=mysql`, and the required `WEB_MYSQL_*` settings in the Preview environment only. Never expose credentials with NEXT_PUBLIC prefixes. The database must permit connections from Vercel; no catalogue database is bundled. Use dedicated preview data and do not send real enquiries during testing.

The assistant currently stores session state and usage limits in process memory. Vercel may route requests to different instances or restart them; reliable multi-instance use requires a shared session/rate-limit store. This is not a production deployment certification.

See [assistant setup and known limitations](docs/ask-inox.md).

Event-gallery media is intentionally omitted from this bot preview repository; those galleries may have missing images/videos.
