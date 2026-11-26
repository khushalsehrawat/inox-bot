// Deterministic, aligned SVG fallback geometry. Run from the repository root.
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const directory = new URL('../public/honeycomb/assets/layers/', import.meta.url);
await mkdir(directory, { recursive: true });
// A small unobstructed piece of the supplied brochure veneer, retained as texture.
const woodTexture = await sharp(fileURLToPath(new URL('../public/honeycomb/assets/panel.png', import.meta.url)))
  .extract({ left: 820, top: 435, width: 220, height: 28 })
  .resize(880, 112).webp({ quality: 90 }).toBuffer();
await writeFile(new URL('wood-grain.webp', directory), woodTexture);

const top = '70,340 480,230 735,335 325,445';
const wrap = (title, defs, content) => `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="800" height="760" viewBox="0 0 800 760"><title>${title}</title><defs>${defs}</defs>${content}</svg>`;
function sheet(title, colours, thickness, wood = false) {
  const defs = `<linearGradient id="surface" x1="0" y1="0" x2=".8" y2="1" gradientUnits="objectBoundingBox">${colours.map((colour, i) => `<stop offset="${i / (colours.length - 1)}" stop-color="${colour}"/>`).join('')}</linearGradient><linearGradient id="edge"><stop stop-color="#84776a"/><stop offset=".5" stop-color="#d5c8b6"/><stop offset="1" stop-color="#958778"/></linearGradient><pattern id="brush" width="4" height="4" patternUnits="userSpaceOnUse"><path d="M0 0H4" stroke="#fff" stroke-opacity=".13" stroke-width=".35"/></pattern><clipPath id="face"><polygon points="${top}"/></clipPath>`;
  const edges = `<path d="M70 340L325 445L735 335V${335 + thickness}L325 ${445 + thickness}L70 ${340 + thickness}Z" fill="url(#edge)" stroke="#8e8277" stroke-width=".5"/>`;
  const texture = wood ? `<defs><pattern id="grain" width="600" height="80" patternUnits="userSpaceOnUse"><image href="data:image/webp;base64,${woodTexture.toString('base64')}" width="600" height="80" preserveAspectRatio="none"/></pattern></defs><g clip-path="url(#face)"><path d="M0 0H600V400H0Z" fill="url(#grain)" transform="matrix(.683333 -.183333 .6375 .2625 70 340)"/><polygon points="${top}" fill="#bc9b70" opacity=".12"/></g>` : `<polygon points="${top}" fill="url(#brush)"/>`;
  return wrap(title, defs, `${edges}<polygon points="${top}" fill="url(#surface)"/>${texture}<path d="M70 340L480 230L735 335L325 445Z" fill="none" stroke="#fff9eb" stroke-opacity=".65" stroke-width="1"/><path d="M325 445v${thickness}" stroke="#eee5d7" stroke-width=".8"/>`);
}
const layers = [
  ['wood-veneer', sheet('Natural wood veneer sheet', ['#94714e', '#c7a77f'], 4, true)],
  ['bottom-sheet', sheet('Bronze champagne structural backing', ['#958574', '#c4b8a6', '#a59582'], 4)],
];

const project = ([x, y]) => [70 + x * 410 / 600 + y * 255 / 400, 340 - x * 110 / 600 + y * 105 / 400];
const points = vertices => vertices.map(p => p.map(n => n.toFixed(2)).join(',')).join(' ');
let cells = '', outerWalls = '', cellClips = '';
const radius = 24;
// Each cavity has a recessed floor, three visible internal walls and six metal rims.
for (let column = -1; column < 19; column++) {
  for (let row = -1; row < 12; row++) {
    const centre = [column * radius * 1.5, (row + (column % 2) / 2) * radius * Math.sqrt(3)];
    const vertices = Array.from({ length: 6 }, (_, i) => project([centre[0] + radius * Math.cos(i * Math.PI / 3), centre[1] + radius * Math.sin(i * Math.PI / 3)]));
    const id = `cell-${column + 1}-${row + 1}`;
    cellClips += `<clipPath id="${id}"><polygon points="${points(vertices)}"/></clipPath>`;
    const centreProjected = project(centre);
    const recessed = vertices.map(([x, y]) => [centreProjected[0] + (x - centreProjected[0]) * .77, centreProjected[1] + (y - centreProjected[1]) * .77 + 2.8]);
    cells += `<g clip-path="url(#${id})"><polygon points="${points(vertices)}" fill="#343b41"/>`;
    for (let side = 0; side < 6; side++) {
      const a = vertices[side], b = vertices[(side + 1) % 6];
      if (b[0] < a[0]) {
        outerWalls += `<polygon points="${points([a, b, [b[0], b[1] + 36], [a[0], a[1] + 36]])}" fill="url(#wall${side % 3})" stroke="#b9bec2" stroke-width=".6"/>`;
      }
      cells += `<polygon points="${points([a, b, recessed[(side + 1) % 6], recessed[side]])}" fill="${['#a6afb5', '#77848e', '#56636d', '#c5cbd0', '#99a5af', '#6d7984'][side]}"/>`;
    }
    cells += `<polygon points="${points(recessed)}" fill="url(#interior)"/>`;
    cells += `</g><polygon points="${points(vertices)}" fill="none" stroke="#d9dfe2" stroke-width="1.2" stroke-linejoin="round"/>`;
  }
}
const coreDefs = `<clipPath id="volume"><path d="M70 340L480 230L735 335V371L325 481L70 376Z"/></clipPath><clipPath id="top"><polygon points="${top}"/></clipPath>${cellClips}<linearGradient id="interior" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#a6aeb5"/><stop offset="1" stop-color="#4f5b65"/></linearGradient>${['#bac2c8', '#8c979f', '#d4dade'].map((colour, i) => `<linearGradient id="wall${i}"><stop stop-color="${colour}"/><stop offset=".35" stop-color="#59656f"/><stop offset=".7" stop-color="${colour}"/><stop offset="1" stop-color="#7d8992"/></linearGradient>`).join('')}`;
layers.push(['aluminium-core', wrap('Dimensional aluminium honeycomb with open hexagonal cells and recessed internal walls', coreDefs, `<g clip-path="url(#volume)"><path d="M70 340L480 230L735 335V371L325 481L70 376Z" fill="#6c767d"/>${outerWalls}</g><g clip-path="url(#top)">${cells}</g><path d="M70 340L480 230L735 335M70 376L325 481L735 371" fill="none" stroke="#d3d9dd" stroke-width="1"/>`)]);
for (const [name, svg] of layers) await writeFile(new URL(`${name}.svg`, directory), svg);
console.log('Generated three aligned SVG layers and a brochure-derived veneer texture.');
