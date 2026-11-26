// Cache the existing vector artwork as textures for mobile compositing.
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import sharp from 'sharp';
import { fileURLToPath } from 'node:url';
const assets = new URL('../public/honeycomb/assets/', import.meta.url);
const output = new URL('mobile/', assets);
await mkdir(output, { recursive: true });
const html = await readFile(new URL('../public/honeycomb/index.html', import.meta.url), 'utf8');
const scene = html.match(/<svg class="pc-scene"[\s\S]*?<\/svg>/)[0];
const defs = scene.match(/<defs>([\s\S]*?)<\/defs>/)[1];
const cells = scene.match(/<g class="pc-cells"[^>]*>([\s\S]*?)<\/g>/)[1];
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="768" height="768" viewBox="1010 -50 620 620"><defs>${defs}</defs>${cells}</svg>`;
await writeFile(new URL('lens-cells.webp', output), await sharp(Buffer.from(svg)).webp({ quality: 90 }).toBuffer());
await sharp(fileURLToPath(new URL('original-aluminium-panel.png', assets)))
  .resize({ width: 1100 }).webp({ quality: 90 }).toFile(fileURLToPath(new URL('aluminium-panel.webp', output)));
const core = await readFile(new URL('layers/aluminium-core.svg', assets));
await writeFile(new URL('aluminium-core.webp', output), await sharp(core).resize(1000, 950).webp({ quality: 92 }).toBuffer());
console.log('Generated mobile panel, lens and honeycomb layer textures.');
