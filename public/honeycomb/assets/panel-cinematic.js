(() => {
  'use strict';
  // Entry keeps the headline visible; scrolling moves the panel aside for details.
  // scrub:true maps scroll directly: stopping scroll freezes the strip immediately.
  const settings = Object.freeze({ scrollLength: 3.6, coverStart: .12, coverEnd: .43, detailsStart: .30, detailsEnd: .46, lensStart: .54, lensEnd: .76 });
  window.PANEL_CINEMATIC = settings;
  const section = document.querySelector('#panel-journey');
  if (!section || !window.gsap || !window.ScrollTrigger) return;
  const { gsap, ScrollTrigger } = window;
  gsap.registerPlugin(ScrollTrigger);
  const $ = s => section.querySelector(s);
  const product = $('.pc-product'), copy = $('.pc-copy');
  const lens = $('.pc-lens'), callout = $('.pc-callout'), curl = $('.pc-curl'), corner = $('.pc-corner');
  const maskLeft = $('.pc-mask-left'), maskRight = $('.pc-mask-right'), cells = $('.pc-cells'), status = $('.pc-state');
  const originalCells = cells.innerHTML;
  const sourceImage = section.querySelector('.pc-scene>image');
  const originalSource = sourceImage.getAttribute('href');
  const rows = [...section.querySelectorAll('.pc-rows button')];
  const details = [$('.pc-description'), $('.pc-rows')];
  const state = { cover: 1, lens: 1, cells: 1 };
  let trigger, disposed = false;
  const media = gsap.matchMedia();
  const clamp = n => Math.max(0, Math.min(1, n));
  const easeCover = gsap.parseEase('power2.inOut');
  const phase = (p, start, end) => clamp((p - start) / (end - start));
  let lastCover = -1, lastLens = -1, lastCells = -1;
  function renderCover() {
    if (state.cover === lastCover) return;
    lastCover = state.cover;
    // Travel by physical edge length: first short face, then around the corner.
    const distance = state.cover * (719 + 1031);
    const a = clamp(distance / 719), b = clamp((distance - 719) / 1031);
    maskLeft.setAttribute('width', 694 * a);
    maskRight.setAttribute('width', 992 * b);
    corner.style.opacity = b > 0 ? '1' : '0';
    const moving = state.cover > 0 && state.cover < 1;
    curl.style.display = moving ? 'block' : 'none';
    if (moving) {
      const short = distance < 719, t = short ? a : b;
      const x = short ? 45 + 694 * t : 739 + 992 * t;
      const y = short ? 375 + 189 * t : 564 - 279 * t;
      const h = short ? 139 + 20 * t : 159 - 33 * t;
      curl.setAttribute('d', `M${x - 30} ${y - 3} Q${x + 16} ${y + 16} ${x + 20} ${y - 4} L${x + 20} ${y + h - 5} Q${x + 6} ${y + h + 15} ${x - 30} ${y + h + 1}Z`);
    }
    section.dataset.cover = state.cover.toFixed(4);
  }
  function renderLens() {
    // Explicit source-space pivots avoid nested SVG transform-origin drift.
    if (lastLens !== state.lens) {
      lens.setAttribute('transform', `translate(1320 260) scale(${state.lens}) translate(-1320 -260)`);
      lastLens = state.lens;
    }
    if (lastCells !== state.cells) {
      cells.setAttribute('transform', `translate(1320 260) scale(${state.cells}) translate(-1320 -260)`);
      lastCells = state.cells;
    }
  }
  const navigate = event => {
    if (trigger) window.scrollTo({ top: trigger.start + (trigger.end - trigger.start) * Number(event.currentTarget.dataset.progress), behavior: 'smooth' });
  };
  rows.forEach(row => row.addEventListener('click', navigate));
  async function initialize() {
    // Keep the complete static presentation until the actual source image decodes.
    const initiallyMobile = matchMedia('(max-width:767px)').matches;
    const image = new Image(); image.src = initiallyMobile ? '/honeycomb/assets/mobile/aluminium-panel.webp' : originalSource;
    try { await image.decode(); } catch { return; }
    let mobileTexturesReady = false;
    if (initiallyMobile) {
      const texture = new Image(); texture.src = '/honeycomb/assets/mobile/lens-cells.webp';
      try { await texture.decode(); mobileTexturesReady = true; } catch { /* Retain the vector fallback. */ }
    }
    if (disposed) return;
    media.add({ mobile: '(max-width:767px)', desktop: '(min-width:768px)', reduce: '(prefers-reduced-motion:reduce)', landscape: '(max-width:900px) and (max-height:540px) and (orientation:landscape)' }, context => {
      if (context.conditions.reduce || context.conditions.landscape) return;
      const mobile = context.conditions.mobile;
      let previousDetails, previousStep = -2, previousStatus;
      if (mobile && mobileTexturesReady) {
        cells.innerHTML = '<image href="/honeycomb/assets/mobile/lens-cells.webp" x="1010" y="-50" width="620" height="620"/>';
        sourceImage.setAttribute('href', image.src);
      }
      section.classList.add('pc-animated');
      state.cover = 0; renderCover();
      state.lens = .04; state.cells = .97; renderLens();
      copy.inert = false; copy.removeAttribute('aria-hidden');
      gsap.set(product, { left: '50%', top: mobile ? '33%' : '49%', width: mobile ? '78%' : '46%', xPercent: -50, yPercent: -50, x: 0, y: 0 });
      gsap.set(copy, { autoAlpha: 1, y: 0 });
      gsap.set(details, { autoAlpha: 0, y: 16 });
      details.forEach(el => { el.inert = true; el.setAttribute('aria-hidden', 'true'); });
      gsap.set($('.pc-hint'), { left: '50%' });
      gsap.set($('.pc-hint'), { autoAlpha: 1 });
      gsap.set(callout, { autoAlpha: 0 });
      gsap.set($('.pc-leader'), { strokeDasharray: 1, strokeDashoffset: 1 });
      gsap.set($('.pc-progress span'), { scaleX: 0 });
      const timeline = gsap.timeline({ defaults: { ease: 'none' }, scrollTrigger: {
        id: 'panel-cinematic', trigger: section, start: 'top top', pin: true, scrub: true, refreshPriority: 2,
        end: () => `+=${$('.pc-stage').offsetHeight * (mobile ? 2.4 : settings.scrollLength)}`,
        invalidateOnRefresh: true, anticipatePin: 1,
      }, onUpdate() {
        const p = timeline.progress();
        // Derive all physical geometry from progress, including after resize or
        // preference changes. No cached tween start values can reopen the strip.
        state.cover = easeCover(phase(p, settings.coverStart, settings.coverEnd));
        state.lens = .04 + .96 * easeCover(phase(p, settings.lensStart + .06, settings.lensEnd));
        state.cells = .97 + .09 * phase(p, .64, .88);
        renderCover(); renderLens();
        const visible = p > settings.detailsStart;
        if (previousDetails !== visible) {
          details.forEach(el => { el.inert = !visible; el.setAttribute('aria-hidden', String(!visible)); });
          previousDetails = visible;
        }
        const step = p < settings.coverStart ? -1 : p < settings.coverEnd ? 0 : p < settings.lensStart ? 2 : 1;
        if (previousStep !== step) {
          rows.forEach((row, i) => { if (step === i) row.setAttribute('aria-current', 'step'); else row.removeAttribute('aria-current'); });
          previousStep = step;
        }
        const label = p < settings.coverStart ? 'EXPOSED CORE' : p < settings.coverEnd ? 'CLOSING THE EDGE' : p < settings.lensStart ? 'REFINED OUTSIDE' : 'THE ENGINEERING WITHIN';
        if (previousStatus !== label) { status.textContent = label; previousStatus = label; }
      } });
      trigger = timeline.scrollTrigger;
      timeline.to({}, { duration: 1 }, 0)
        .to(product, { ...(mobile ? { y: () => -$('.pc-stage').offsetHeight * .04 } : { left: '73%' }), duration: settings.coverEnd - settings.coverStart, ease: 'power2.inOut' }, settings.coverStart)
        .to(details, { autoAlpha: 1, y: 0, duration: settings.detailsEnd - settings.detailsStart, ease: 'sine.inOut' }, settings.detailsStart)
        .to($('.pc-hint'), { left: mobile ? '50%' : '73%', duration: settings.coverEnd - settings.coverStart, ease: 'power2.inOut' }, settings.coverStart)
        .to($('.pc-hint'), { autoAlpha: 0, duration: .05 }, settings.coverStart)
        .to(callout, { autoAlpha: 1, duration: .035 }, settings.lensStart)
        .to($('.pc-leader'), { strokeDashoffset: 0, duration: .08 }, settings.lensStart)
        .to($('.pc-progress span'), { scaleX: 1, duration: 1 }, 0);
      return () => {
        trigger = undefined;
        section.classList.remove('pc-animated');
        cells.innerHTML = originalCells;
        sourceImage.setAttribute('href', originalSource);
        copy.inert = false; copy.removeAttribute('aria-hidden');
        details.forEach(el => { el.inert = false; el.removeAttribute('aria-hidden'); });
        state.cover = 1; state.lens = 1; state.cells = 1;
        renderCover(); renderLens();
        delete section.dataset.cover;
      };
    });
    await document.fonts.ready;
    if (!disposed) { ScrollTrigger.sort(); ScrollTrigger.refresh(); }
  }
  initialize().finally(() => window.honeycombSceneReady?.('panel'));
  const cleanup = event => {
    if (event.persisted) return;
    disposed = true; media.revert();
    rows.forEach(row => row.removeEventListener('click', navigate));
    window.removeEventListener('pagehide', cleanup);
  };
  window.addEventListener('pagehide', cleanup);
})();
