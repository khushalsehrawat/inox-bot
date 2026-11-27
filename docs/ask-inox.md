This Vercel bot repository now reads the real anonymous public website at https://inoxdecor.com. The synthetic demo catalogue has been removed. Set ASK_INOX_CATALOGUE_SOURCE=main-site for this connection explicitly; on Vercel with no database settings it is automatic. Product images and View Details point to the actual main website. The source is refreshed through a 60-second public-read cache. No internal pricing, account information or database secrets are requested.

The separate preview basket can be reviewed, but cannot automatically transfer to the main site's origin. Open the exact variant on the main site to complete the actual enquiry there. No main-site submission endpoints are proxied.

# Ask INOX on the main website

Ask INOX now uses the main website catalogue and live providers. The isolated demo, scripted speech, sample transcripts, fixture launcher and fixture browser suite have been removed.

## Run locally

```powershell
cd D:\INOX\INOX-web
npm run dev
```

Open http://127.0.0.1:3000/products and click Talk to INOX. The existing ignored `.env.local` has ASK_INOX_ENABLED=true. Gemini is the default live provider; its configured GEMINI_API_KEY stays server-side. OpenAI remains selectable when OPENAI_API_KEY is configured. ASK_INOX_PROVIDER=openai optionally changes the default. No production settings were changed or deployment performed.

Start Gemini Live and allow the microphone. Ask a product question, compare variants, or say Home page kholo / Kitchen category kholo / Open [SKU]. Public navigation keeps the conversation available. Honeycomb is a standalone page and restores the chat after a full reload; restart voice there.

Only published products and active variants are retrieved. Price permissions and variant confirmation use the existing website components. Navigation cannot open admin/API screens or external URLs. Enquiries require visitor review and submission on the existing enquiry page.

The knowledge index includes available approved public pages, privacy policy and enquiry guidance, with live published categories and blog sections. This is public website knowledge, not access to private accounts or internal business records. Full warranty terms, certifications and installation instructions cannot be invented if absent. The supplied 44-page PDF needs OCR/manual review; dedicated approved XCOMB and Facade brochures remain unavailable.

Regenerate approved content with npm run ask-inox:index (Python pypdf enables PDF extraction), then npm run ask-inox:index:check. The detailed source report is docs/ask-inox-index-report.json. No automatic OCR or upload is performed.

## Verification and manual checks

Run npm test, npm run typecheck, npm run build and npm run test:ask-inox:hostinger. Unit tests use ordinary synthetic test records, not an exposed demo catalogue. The old demo-specific browser tests are removed; their historical results are not current live-site verification.

On the main site, check a real SKU, a product-page follow-up, a published category command, a comparison, guest price restriction, microphone mute/end/close, and enquiry basket review. Do not submit real enquiries during review. Actual live speech, provider availability and catalogue connectivity must be checked against the configured services; build/unit checks alone do not prove them.

Sessions use bounded process memory and expire after 30 minutes. Voice defaults to 5 minutes (maximum 10). Keys, raw audio and transcripts are not logged. A multi-process host needs shared session/rate-limit storage. Existing moderate Next.js advisories were previously identified; this change does not upgrade the framework.

Public website questions: the approved index includes home/INOX perspective, About, public privacy policy, contact, browsing/comparison guidance, enquiry guidance, journal and event introductions, catalogue guidance and architectural collection copy. Published journal articles and catalogue records are queried live. Brand answers can use cited public excerpts without a product match; missing warranty terms and OCR-only PDF pages remain unverified. The index currently contains 20 public-text chunks.
