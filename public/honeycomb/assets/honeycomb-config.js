// All layer images share an 800 × 760 transparent canvas and one projection.
window.HONEYCOMB_CONFIG = Object.freeze({
  SCROLL_LENGTH: 400, // viewport heights: 400 = four viewports of pinned scrolling
  MOBILE_SCROLL_LENGTH: 280,
  LAYER_GAP: 105, // SVG coordinate units, independent of rendered size
  MOBILE_LAYER_GAP: 90,
  SCRUB_SMOOTHING: 0.6,
  ENTRY_CENTER_POSITION: 50, // percentage of section width
  FINAL_RIGHT_POSITION: 73,
  STAGE_BOUNDARIES: [0, 0.15, 0.4, 0.7, 0.95, 1],
  STAGE_TARGETS: [0.39, 0.69, 0.95],
  layers: [
    { id: 'wood-veneer', name: 'Wood Veneer', src: '/honeycomb/assets/layers/wood-veneer.svg', closed: -4, final: -1 },
    { id: 'aluminium-core', name: 'Aluminium Honeycomb Core', src: '/honeycomb/assets/layers/aluminium-core.svg', closed: 0, final: 0 },
    { id: 'bottom-sheet', name: 'Bottom Structural Sheet', src: '/honeycomb/assets/layers/bottom-sheet.svg', closed: 36, final: 1.33 },
  ],
});
