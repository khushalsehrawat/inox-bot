# Ask INOX ? connected to the real main site

This repository runs the assistant against the anonymous public catalogue at https://inoxdecor.com. No demo products, database credentials or private prices are copied. It reads current published product/variant data already rendered by the main site, public categories and public brand/policy pages. Main-site media stays on the main origin. Reads are cached for 60 seconds.

On Vercel, the main-site connection is selected automatically when no MySQL connection settings are present. Set ASK_INOX_CATALOGUE_SOURCE=main-site explicitly to use it. Set ASK_INOX_CATALOGUE_SOURCE=database to use the website database services instead. The assistant is enabled on Vercel unless ASK_INOX_ENABLED=false. Set GEMINI_API_KEY server-side for live voice and text.

Run npm ci, npm run build and npm run start with Node 24.x. For local main-site reads set ASK_INOX_CATALOGUE_SOURCE=main-site and ASK_INOX_ENABLED=true. Use /products or /ask-inox-widget.

Product cards link to the actual main-site product with the selected variant. Local enquiry selection can be reviewed here, but this separate origin cannot transfer a visitor's session or basket to the main site. Complete the actual enquiry on inoxdecor.com; no requests are proxied to its private enquiry or account endpoints.

The main site has no public structured product API today, so the adapter parses its publicly rendered Next.js catalogue JSON without executing scripts. It fails closed if the format changes. A dedicated public feed on the main site would be a more stable future integration. No synthetic product fallback exists.

Production smoke tests: node scripts/check-vercel-public.mjs (outage handling), and node scripts/check-vercel-public.mjs --main-site (live anonymous main-site reads). Neither calls an AI provider or sends a real enquiry.

/api/ask-inox/health reports source availability and key presence without returning secret values. Sessions and usage limits currently live in process memory; multi-instance continuity still needs a shared store.
