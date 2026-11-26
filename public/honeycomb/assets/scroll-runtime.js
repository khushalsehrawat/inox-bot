(() => {
  'use strict';
  if (!window.gsap || !window.ScrollTrigger) return;
  gsap.registerPlugin(ScrollTrigger);
  // Mobile browser chrome resizes the visual viewport during a swipe. Rebuilding
  // every pin for those small height changes makes the page jump under the finger.
  // Width/orientation changes and explicit refreshes still recalculate the scenes.
  ScrollTrigger.config({ ignoreMobileResize: true, limitCallbacks: true });
  const pending = new Set(['panel', 'layers', 'cabinet']);
  const loaded = document.readyState === 'complete' ? Promise.resolve() : new Promise(resolve => addEventListener('load', resolve, { once: true }));
  let pageReady = false;
  let releaseCabinet, cabinetScheduled = false;
  window.honeycombBeforeCabinet = new Promise(resolve => { releaseCabinet = resolve; });
  function finish() {
    if (pageReady && !pending.has('panel') && !pending.has('layers') && !cabinetScheduled) {
      cabinetScheduled = true;
      requestAnimationFrame(() => {
        ScrollTrigger.sort();
        ScrollTrigger.refresh();
        releaseCabinet();
      });
    }
    if (!pageReady || pending.size) return;
    requestAnimationFrame(() => {
      ScrollTrigger.sort();
      ScrollTrigger.refresh();
      document.documentElement.classList.add('hc-scroll-ready');
    });
  }
  window.honeycombSceneReady = name => { pending.delete(name); finish(); };
  Promise.all([loaded, document.fonts.ready]).then(() => { pageReady = true; finish(); });
})();
