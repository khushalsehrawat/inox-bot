// Product coordinates are traced from the supplied 1774 × 887 PNG.
// This generates code-native edge geometry and a dimensional explanatory cutaway.
import { readFile, writeFile } from 'node:fs/promises';
const asset = '/honeycomb/assets/';
const points = (x, y, r) => Array.from({ length: 6 }, (_, i) => {
  const a = (i * 60 - 30) * Math.PI / 180;
  return [x + Math.cos(a) * r, y + Math.sin(a) * r];
});
const coords = p => p.map(v => v.join(',')).join(' ');
let cells = '';
for (let row = -3; row < 4; row++) for (let col = -3; col < 4; col++) {
  const x = 1320 + col * 159.35 + (row % 2) * 79.675, y = 260 + row * 138;
  const front = points(x, y, 92), back = points(x + 11, y + 22, 59);
  cells += `<polygon points="${coords(front)}" fill="#474d50"/>`;
  const shades = ['url(#pc-wall-dark)', 'url(#pc-wall-mid)', 'url(#pc-wall-light)', 'url(#pc-wall-light)', 'url(#pc-wall-mid)', 'url(#pc-wall-dark)'];
  front.forEach((p, i) => {
    const j = (i + 1) % 6;
    cells += `<polygon points="${coords([p, front[j], back[j], back[i]])}" fill="${shades[i]}"/>`;
  });
  cells += `<polygon points="${coords(back)}" fill="url(#pc-cell-depth)" stroke="#565f65" stroke-width="1"/><polygon points="${coords(front)}" fill="none" stroke="#e2e5e6" stroke-width="4" stroke-linejoin="round"/>`;
}
const section = `<section id="panel-journey" class="pc-section" aria-labelledby="pc-heading">
<div class="pc-stage">
<div class="pc-grid" aria-hidden="true"></div>
<p class="pc-meta">INOX / A MATERIAL STUDY <span>ALUMINIUM HONEYCOMB</span></p>
<div class="pc-product" role="img" aria-label="Original champagne aluminium panel. An exterior strip closes the exposed edges before a circular cutaway reveals the dimensional silver honeycomb core.">
<svg class="pc-scene" viewBox="0 -260 1774 1250" aria-hidden="true">
<defs>
<linearGradient id="pc-wall-light"><stop stop-color="#c9cdd0"/><stop offset=".6" stop-color="#a4adb3"/><stop offset="1" stop-color="#b7bec3"/></linearGradient>
<linearGradient id="pc-wall-mid" x2=".3" y2="1"><stop stop-color="#9ba4aa"/><stop offset="1" stop-color="#757f87"/></linearGradient>
<linearGradient id="pc-wall-dark" x2=".5" y2="1"><stop stop-color="#57636c"/><stop offset="1" stop-color="#78848c"/></linearGradient>
<radialGradient id="pc-cell-depth" cx=".8" cy=".8" r="1"><stop stop-color="#919a9f"/><stop offset="1" stop-color="#59636a"/></radialGradient>
<linearGradient id="pc-left-metal" x1="0" y1="0" x2="1" y2=".3"><stop stop-color="#c3b7a6"/><stop offset=".4" stop-color="#b8a893"/><stop offset="1" stop-color="#aa9a86"/></linearGradient>
<linearGradient id="pc-right-metal" x1="0" y1="0" x2="1" y2="-.25"><stop stop-color="#bbaa95"/><stop offset=".5" stop-color="#d7c9b7"/><stop offset="1" stop-color="#d0c2ae"/></linearGradient>
<linearGradient id="pc-curl"><stop stop-color="#9c8b76"/><stop offset=".45" stop-color="#e4d8c7"/><stop offset=".8" stop-color="#c9bba5"/><stop offset="1" stop-color="#817361"/></linearGradient>
<radialGradient id="pc-shadow"><stop stop-color="#343840" stop-opacity=".23"/><stop offset="1" stop-color="#343840" stop-opacity="0"/></radialGradient>
<radialGradient id="pc-lens-light" cx=".25" cy=".15" r=".9"><stop stop-color="#fff" stop-opacity=".17"/><stop offset="1" stop-color="#111820" stop-opacity=".2"/></radialGradient>
<clipPath id="pc-face-left"><path d="M45 375L739 564V723L46 514Z"/></clipPath>
<clipPath id="pc-face-right"><path d="M739 564L1731 285V411L739 723Z"/></clipPath>
<clipPath id="pc-travel-left"><rect class="pc-mask-left" x="45" y="0" width="694" height="900"/></clipPath>
<clipPath id="pc-travel-right"><rect class="pc-mask-right" x="739" y="0" width="992" height="900"/></clipPath>
<clipPath id="pc-circle"><circle cx="1320" cy="260" r="295"/></clipPath>
</defs>
<ellipse cx="900" cy="790" rx="740" ry="90" fill="url(#pc-shadow)"/>
<image href="${asset}original-aluminium-panel.png" width="1774" height="887"/>
<g clip-path="url(#pc-face-left)"><g class="pc-cover-left" clip-path="url(#pc-travel-left)"><path d="M45 375L739 564V723L46 514Z" fill="url(#pc-left-metal)"/><path d="M45 375L739 564M46 514L739 723" fill="none" stroke="#eee6d9" stroke-width="3"/></g></g>
<g clip-path="url(#pc-face-right)"><g class="pc-cover-right" clip-path="url(#pc-travel-right)"><path d="M739 564L1731 285V411L739 723Z" fill="url(#pc-right-metal)"/><path d="M739 564L1731 285M739 723L1731 411" fill="none" stroke="#f2e9dd" stroke-width="3"/></g></g>
<path class="pc-corner" d="M739 565V722" stroke="#8d7e6c" stroke-width="3"/><path class="pc-curl" fill="url(#pc-curl)"/>
<g class="pc-callout"><ellipse cx="620" cy="365" rx="27" ry="8" fill="none" stroke="#fff" stroke-width="2"/><circle cx="620" cy="365" r="6" fill="#fff"/>
<path class="pc-leader" d="M620 365L745 185H1028" pathLength="1" fill="none" stroke="#fff" stroke-width="2.5"/>
<g class="pc-lens"><g clip-path="url(#pc-circle)"><g class="pc-cells">${cells}</g><circle cx="1320" cy="260" r="295" fill="url(#pc-lens-light)"/></g><circle class="pc-lens-rim" cx="1320" cy="260" r="296" fill="none" stroke="#fcfcfa" stroke-width="4"/><circle cx="1320" cy="260" r="302" fill="none" stroke="#8e9399" stroke-width="1"/></g></g>
</svg></div>
<p class="pc-hint">SCROLL TO EXPLORE THE ENGINEERING</p>
<div class="pc-copy"><p class="pc-eyebrow">THE ENGINEERING WITHIN</p><h2 id="pc-heading">Strength inside.<br><em>Elegance outside.</em></h2><p class="pc-description">Discover the precision-engineered aluminium honeycomb core that brings lightweight strength and refined surface design together.</p>
<nav class="pc-rows" aria-label="Explore the panel transformation"><button type="button" data-progress="0.25"><i></i>Panel surface</button><button type="button" data-progress="0.87" aria-current="step"><i></i>Aluminium Honeycomb Core</button><button type="button" data-progress="0.49"><i></i>Premium finish</button></nav></div>
<div class="pc-footer"><span class="pc-state" aria-hidden="true">EXPOSED CORE</span><div class="pc-progress" aria-hidden="true"><span></span></div><a href="#material">Explore the layers</a></div>
</div></section>`;
const path = new URL('../public/honeycomb/index.html', import.meta.url);
let html = await readFile(path, 'utf8');
html = html.replace(/<section id="panel-journey"[\s\S]*?<\/section>\s*/, '');
html = html.replace('<section class="honeycomb-reveal"', section + '\n<section class="honeycomb-reveal"');
if (!html.includes('panel-cinematic.css')) html = html.replace('</head>', `<link rel="stylesheet" href="${asset}panel-cinematic.css"></head>`);
if (!html.includes('panel-cinematic.js')) html = html.replace('</body>', `<script src="${asset}panel-cinematic.js" defer></script></body>`);
html = html.replace('href="#material">Explore Honeycomb', 'href="#panel-journey">Explore Honeycomb').replace('class="hero-scroll" href="#material"', 'class="hero-scroll" href="#panel-journey"');
await writeFile(path, html);
