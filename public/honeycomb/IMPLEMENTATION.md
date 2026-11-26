# Honeycomb architectural redesign

Scope: only public/honeycomb/index.html and its private assets. Main INOX routes, hosting configuration and database are unchanged.

Run the normal repository npm run dev and open /honeycomb. This page is static HTML served by the existing rewrite. No separate app or build command is required. GSAP 3.13 and ScrollTrigger are vendored locally, as are Manrope, Instrument Serif and IBM Plex Mono (Google Fonts, SIL OFL). Font files are optimized to WOFF2. Original font files are retained for provenance.

Design: aubergine #30242E, night #211B24, mineral ivory #EEECE6, smoked silver #BAC0C4, with original INOX red. Pantone Eggplant and Aubergine Gleam were consulted as visual references, not claimed as exact digital Pantone matches. No Pantone assets or licensed swatch libraries are bundled.

Active layers: base.css supplies reference foundations; studio.css supplies the new complete theme. studio.js owns accessible interactions, GSAP scroll entrances, pointer tilt, lattice geometry and email fallback. The earlier elevated.css and elevated.js are retained but no longer loaded.

All photography and product imagery comes from the official brochure/reference HTML. Product illustrations are illustrative, and finishes are clearly labelled mood inspiration. No product dimensions, certifications, performance ratings, finish availability or warranty terms have been introduced.

Enquiry: client validation followed by an explicitly labelled mailto draft. No server endpoint or delivery is configured. Do not treat the page as a completed server enquiry integration. No personal data is stored by this page. Brochure distribution remains on request.

Deployment: upload this directory's contents to the honeycomb subdomain web root. Preserve the /honeycomb/assets path on that host, or replace /honeycomb/assets/ with /assets/ in HTML/CSS for a root-hosted standalone copy. Enable HTTPS in the dedicated hosting settings. No deployment or DNS action has been performed. Do not change main-site records or mail DNS.

Verification: Chromium at 1440x1000, 1024x1000 and 390x1000: no horizontal overflow, broken loaded images, missing resources or JavaScript errors. Local fonts loaded; construction selection, finish selection and application-to-enquiry routing passed. Reduced-motion screenshots reviewed. Production framework build is not required for these static files; JavaScript syntax checks passed. Browser review does not guarantee external email delivery.

## Five-layer scroll reveal — November 2026

The material section immediately after the existing hero now starts as one closed, centred panel. One GSAP ScrollTrigger timeline pins it for four section viewport heights, reveals the cream and champagne sheets in sequence, lifts the veneer to expose the cellular core, then lowers the backing and holds the exploded view before release. Three editorial chapters replace the repeated paragraph: surface materials on the left, core construction on the right, then the complete assembly back on the left. Each chapter enters from the centre with staggered lines; the product exchanges columns to leave room for the text. Upright Instrument Serif headings pair with Manrope body text and small material captions. On mobile the product stays above the text while chapters enter from alternating directions. All chapters appear in normal reading order without motion or JavaScript. Native scrolling reverses the complete sequence. No wheel interception or additional runtime library was added.

Files:

- `index.html`: semantic material section, five independent images, stage buttons and skip link.
- `assets/honeycomb-config.js`: scroll distance, gap sizes, positions, stage boundaries, stage destinations and replaceable layer asset slots.
- `assets/honeycomb-reveal.js`: image decoding, scoped GSAP matchMedia/timeline, progress, stage navigation, inert hidden content and cleanup.
- `assets/honeycomb-reveal.css`: responsive composition, technical blueprint background, material styling and static fallback.
- `assets/layers/*.svg`: five aligned procedural sheets/core; `wood-grain.webp` is a small texture crop from the original brochure panel. The veneer embeds this texture so it remains self-contained when loaded as an SVG image.
- `assets/studio.js` and `assets/studio.css`: removed the superseded reveal scroll calculation, obsolete lattice target and old image-mask styling. Other sections retain their existing behavior.
- `../../scripts/generate-honeycomb-layers.mjs`: deterministic SVG generation using the existing Sharp dependency.
- `../../tests/browser/honeycomb-reveal.spec.js`: browser regression coverage.
- `../../honeycomb/app/page.tsx`: one explicit `string[]` annotation repairs an existing implicit-any error in the separate legacy app, allowing the repository typecheck/build to complete. No behavior change.

### Materials and replacement

No separable source PNGs or GLB meshes were available. These are procedural SVG fallbacks, not newly photographed or validated manufacturer layer assets. Each shares an 800 × 760 transparent canvas and the same isometric footprint. The aluminium core contains individually projected hexagonal cavities, recessed interiors and extruded metallic side walls; it is not a flat hexagonal pattern.

To regenerate: `node scripts/generate-honeycomb-layers.mjs`. The original `panel.png` and `panel.webp` are preserved.

To replace a layer, provide a transparent SVG, PNG or WebP with the same aligned canvas, perspective and physical resting footprint, and change its `src` in `assets/honeycomb-config.js`. Update the matching image URL in `index.html` as well so the no-JavaScript view uses the replacement. For a different canvas, change the 760-unit translation normalization, image dimensions, CSS aspect ratio and generator consistently. Do not crop or mask the old flattened illustration into fake layers.

### Adjustment

`SCROLL_LENGTH: 400` means four viewport heights of pinned scrolling. `LAYER_GAP: 105` and `MOBILE_LAYER_GAP: 90` are SVG units and scale with the image. `SCRUB_SMOOTHING`, `ENTRY_CENTER_POSITION`, `FINAL_RIGHT_POSITION`, `STAGE_BOUNDARIES` and `STAGE_TARGETS` live beside them. CSS `--rest` values describe the default static exploded pose; update these too when changing the intended static gaps. The mobile view uses an upper product region and lower information region. A 780px minimum stage height preserves readable content on short screens.

Reduced motion disables pinning and immediately shows the exploded assembly and all copy. Live preference/breakpoint changes revert only this section's animation context. With JavaScript or GSAP unavailable, the static exploded assembly and content remain visible. Stage buttons are native keyboard-operable buttons; while animated, they scroll to the relevant timeline position. In static mode they select the information row. The continue link skips the pinned sequence.

### Verification

- `node scripts/generate-honeycomb-layers.mjs`: passed.
- `node --check` for the reveal, configuration and studio scripts: passed.
- `npm test`: 52 passed.
- `npm run typecheck`: passed after the legacy type-only correction.
- `npx playwright test tests/browser/honeycomb-reveal.spec.js`: 10 passed. Chromium coverage includes desktop 1440 × 900, short desktop 1440 × 700, tablet 1024 × 900 and 768 × 1024, and touch emulation at 390 × 844 and 360 × 740. Tests cover closed centering, staggered separation, core exposure, final order, keyboard stage navigation, native wheel/touch scrolling, reversal, final release, a single reveal trigger, reduced motion and live preference changes, no JavaScript, clipping/overlap and horizontal overflow. Additional fault-injection checks cover closed first paint while a layer request is delayed and static fallback when GSAP is unavailable. No JavaScript errors or failed resource responses were observed in normal operation.
- Stage screenshots under ignored `test-results/honeycomb-*.png` were visually inspected.
- `npm run build`: passed, including production TypeScript validation and the existing standalone/Hostinger packaging step.
- No lint script is configured.

The later annotated screenshot guides the updated typography layout: a separate, oversized centre headline (“Beauty.”, “Strength.”, “Possibility.”), followed by supporting explanations that enter from the centre and settle on alternating sides. The panel occupies the opposite side. Mobile keeps the headline above the panel and swaps the explanations beneath it. The original chapter headings remain semantic headings and return to normal reading order in the static/reduced-motion view. Browser checks also verify centred titles and separation from the physical panel.

Physical iOS/Android devices, Safari, hardware trackpads and production hosting were not tested. No hosting or DNS changes were performed.
## Cinematic edge closure (November 2026)

The new `#panel-journey` sits immediately after the hero, before the independently preserved `#material` exploded view. Hero exploration links enter the new sequence. The original three-quarter panel stays intact: `assets/original-aluminium-panel.png` is a byte-for-byte copy of the supplied 1774 × 887 transparent PNG. The reference video and screenshot are analysis references only; neither is embedded in the experience.

`assets/panel-cinematic.js` owns one pinned GSAP timeline (`panel-cinematic`) with direct `scrub: true`. Source-coordinate SVG masks advance across the short left face, then the long right face; a curved metallic leading edge follows the same perimeter. The cover, lens expansion and cell framing derive from normalized timeline progress, so stopping freezes the physical state and upward scrolling restores it. The product never separates into layers in this sequence. A higher refresh priority orders this pin before the existing exploded view, even when the images decode in a different order.

`assets/panel-cinematic.css` contains the scoped platinum presentation, responsive layouts and static fallback. On desktop the final copy enters left while the product settles right; mobile puts the copy below the panel. Reduced motion, disabled JavaScript and unavailable GSAP show the fully finished panel, circular cutaway and editorial copy without a long pin. Match-media cleanup supports live preference and viewport changes.

`../../scripts/generate-honeycomb-cinematic.mjs` traces both visible edge planes directly against the original PNG and generates the inline SVG and section markup in `index.html`. The magnifier is an explanatory SVG cutaway: open hexagonal mouths, six shaded aluminium wall facets per cell, inset backs, depth gradients and silver rims. It is generated geometry, not another product photo or a texture extracted from the screenshot. Re-run `node scripts/generate-honeycomb-cinematic.mjs` after editing this geometry; the generator replaces only its own section and installs its stylesheet/script references idempotently.

Timing is controlled by `settings` at the start of `assets/panel-cinematic.js`: `scrollLength: 3.6` is the number of viewport heights of pinned travel; `coverStart: .12` / `coverEnd: .43`, `lensStart: .54` / `lensEnd: .76`, and `copyStart: .78` / `copyEnd: .92` are normalized timeline positions. The closed caption occupies .43–.75 and composition changes at .75. Adjust the matching stage-button targets in the generator when moving the stages. The edge interpolation uses `power2.inOut` with no time-based completion after scrolling stops.

Verification: production Next build, TypeScript and JavaScript syntax checks pass. Chromium checks cover forward/reverse closure, frozen partial states, native wheel scrolling, keyboard navigation, independent pin order and release, five desktop/tablet/mobile viewport sizes, resize across breakpoints, live reduced-motion changes and no-JavaScript presentation. The original exploded-view regression suite also passes. There is no configured lint command. Physical mobile devices and Safari were not tested.

### Three-layer exploded view

The exploded `#material` view now retains only wood veneer, aluminium honeycomb core and the supporting bottom sheet. The cream and champagne upper sheets were removed from the markup, configuration, animation and layer generator. Surface-stage scrolling lifts the wood veneer; the core stage opens that gap further; the final stage lowers the supporting sheet to present all three layers. Final offsets are `-1`, `0`, and `1.33` times the configured desktop/mobile gap. Static and loading poses, descriptive copy and accessible labels match the three-layer presentation. The earlier five-layer description above is superseded by this update. The separate sliding-cover sequence is unchanged.

Verified with JavaScript syntax checks and all 18 reveal/cinematic browser tests, including forward/reverse scrolling, desktop/mobile layouts, reduced motion, disabled JavaScript and delayed assets. Desktop and mobile screenshots were visually inspected.

### Construction-study visual refresh

The three-layer reveal now shares the preceding material study's platinum spotlight, faint blueprint pattern, restrained technical labels and sans-serif/italic editorial typography. Chapter headings sit with their descriptions instead of separate oversized centred words. The model and reading column settle higher, with a product-first mobile layout. Layer controls identify the veneer, honeycomb core and supporting sheet; the active row has a subtle highlight. Procedural core materials now use neutral silver aluminium shading while retaining the existing cell geometry, projection, wood texture and three-layer animation. Updated browser checks verify visible in-column headings and responsive separation. All 18 reveal/cinematic tests pass; desktop and mobile screenshots were inspected.

### Material-study entry composition

The “Strength inside. Elegance outside.” headline, description and layer navigation are now visible immediately on entering `#panel-journey` and remain available throughout scrolling. On desktop, the animated panel stays on the right at 46% width; the late repositioning and text reveal have been removed. Mobile retains a readable stacked layout with a smaller 78%-width panel above the copy. The redundant centred closed-panel caption has been removed. Scroll still controls edge closure, reversal and the circular core magnifier. `copyStart` and `copyEnd` no longer apply. All 18 reveal/cinematic browser tests pass, including entry visibility and separation of the desktop columns.

### Scroll-led introduction

On entry, only the left eyebrow/headline remains visible; the description and layer list are hidden and removed from keyboard/accessibility navigation until their reveal. The panel starts horizontally centred at the existing small size. Between `coverStart: .12` and `coverEnd: .43`, it moves from 50% to 73% horizontally as the exterior strip closes. The details fade/slide in between `detailsStart: .30` and `detailsEnd: .46`, once the panel has cleared the reading column. On mobile it stays horizontally centred and lifts from 33% to 29% vertically to clear the stacked copy. All transitions are on the same reversible scrubbed timeline. Reduced-motion and no-script views continue showing all information immediately.
