(() => {
  'use strict';
  const section = document.querySelector('#material.honeycomb-reveal');
  const config = window.HONEYCOMB_CONFIG;
  if (!section || !config || !window.gsap || !window.ScrollTrigger) {
    document.documentElement.classList.remove('hc-loading');
    return;
  }
  const { gsap, ScrollTrigger } = window;
  gsap.registerPlugin(ScrollTrigger);
  const rows = [...section.querySelectorAll('.hc-row')];
  const model = section.querySelector('.hc-model');
  const copy = section.querySelector('.hc-copy');
  const chapters = [...section.querySelectorAll('.hc-chapter')];
  const hint = section.querySelector('.hc-hint');
  const caption = section.querySelector('.hc-caption');
  const bar = section.querySelector('.hc-progress span');
  const shadow = section.querySelector('.hc-shadow');
  const layers = Object.fromEntries(config.layers.map(layer => [layer.id, section.querySelector(`[data-layer="${layer.id}"]`)]));
  const media = gsap.matchMedia();
  let trigger;
  let active = -1;
  let disposed = false;
  const activate = index => {
    if (active === index) return;
    active = index;
    rows.forEach((row, i) => {
      if (i === index) row.setAttribute('aria-current', 'step');
      else row.removeAttribute('aria-current');
    });
  };
  const select = event => {
    const index = rows.indexOf(event.currentTarget);
    if (trigger) {
      window.scrollTo({ top: trigger.start + (trigger.end - trigger.start) * config.STAGE_TARGETS[index], behavior: 'smooth' });
    } else activate(index);
  };
  rows.forEach(row => row.addEventListener('click', select));

  async function initialize() {
    config.layers.forEach(layer => { layers[layer.id].src = layer.src; });
    if (matchMedia('(max-width:767px)').matches) {
      const texture = new Image(); texture.src = '/honeycomb/assets/mobile/aluminium-core.webp';
      try { await texture.decode(); layers['aluminium-core'].src = texture.src; } catch { /* Keep the SVG fallback. */ }
    }
    // Decode before applying the closed state; a failed asset keeps the static fallback.
    const decoded = await Promise.allSettled([...section.querySelectorAll('.hc-layer')].map(image => image.decode()));
    if (disposed || decoded.some(result => result.status === 'rejected')) return;
    media.add({ mobile: '(max-width:767px)', desktop: '(min-width:768px)', reduce: '(prefers-reduced-motion:reduce)', landscape: '(max-width:900px) and (max-height:540px) and (orientation:landscape)' }, context => {
      const { mobile, reduce, landscape } = context.conditions;
      if (reduce || landscape) {
        activate(2);
        return;
      }
      const [start, surface, core, finish, hold, end] = config.STAGE_BOUNDARIES;
      const stage = section.querySelector('.hc-stage');
      const chapterVisibility = chapters.map(() => false);
      const entrances = [surface, core + .14, finish + .14];
      let previousStage = -2, previousCopyInert;
      const gap = mobile ? config.MOBILE_LAYER_GAP : config.LAYER_GAP;
      const percent = value => value / 760 * 100;
      const setLayer = (id, offset, at, duration) => timeline.to(layers[id], { yPercent: percent(offset), duration, ease: 'power2.inOut' }, at);
      section.classList.add('hc-animated');
      gsap.set(copy, { autoAlpha: 0, x: 0, yPercent: mobile ? 0 : -50, y: 0 });
      gsap.set(chapters, { autoAlpha: 0 });
      chapters.forEach(chapter => { chapter.inert = true; chapter.setAttribute('aria-hidden', 'true'); });
      copy.inert = true;
      gsap.set(model, { left: `${config.ENTRY_CENTER_POSITION}%`, top: '50%', xPercent: -50, yPercent: -50, x: 0, y: mobile ? 0 : 28 });
      gsap.set(hint, { autoAlpha: 1 });
      gsap.set(caption, { autoAlpha: 0 });
      gsap.set(bar, { scaleX: 0 });
      gsap.set(shadow, { scaleX: .8, opacity: .65, top: '64%' });
      config.layers.forEach(layer => gsap.set(layers[layer.id], { y: 0, yPercent: percent(layer.closed) }));
      activate(-1);
      const timeline = gsap.timeline({
        defaults: { ease: 'none' },
        onUpdate() {
          const p = timeline.time();
          const index = p < surface ? -1 : p < core ? 0 : p < finish ? 1 : 2;
          activate(index);
          const copyInert = p < surface + .025;
          if (previousCopyInert !== copyInert) { copy.inert = copyInert; previousCopyInert = copyInert; }
          chapters.forEach((chapter, i) => {
            const visible = p > entrances[i] + .00175 && (i === 2 || p < (i === 0 ? core : finish) + .05225);
            if (chapterVisibility[i] === visible) return;
            chapterVisibility[i] = visible;
            chapter.inert = !visible;
            chapter.setAttribute('aria-hidden', String(!visible));
          });
          if (previousStage !== index) { section.dataset.stage = String(index + 1); previousStage = index; }
        },
        scrollTrigger: {
          id: 'honeycomb-reveal', trigger: section, start: 'top top',
          refreshPriority: 1,
          end: () => `+=${stage.offsetHeight * (mobile ? config.MOBILE_SCROLL_LENGTH : config.SCROLL_LENGTH) / 100}`,
          pin: true, scrub: mobile ? true : config.SCRUB_SMOOTHING, anticipatePin: 1, invalidateOnRefresh: true,
        },
      });
      trigger = timeline.scrollTrigger;
      timeline.to({}, { duration: end }, start); // Includes the closed entry and final hold.
      timeline.to(model, { y: 0, duration: surface, ease: 'sine.inOut' }, start);
      timeline.to(model, {
        ...(mobile ? { y: () => -stage.offsetHeight * (stage.offsetHeight <= 700 ? .24 : .22) } : { left: `${config.FINAL_RIGHT_POSITION}%`, top: '55%' }),
        duration: (core - surface) * .8, ease: 'power2.inOut',
      }, surface);
      timeline.to(copy, { autoAlpha: 1, duration: .035 }, surface);
      // Each chapter starts near the centre, then settles into its reading column.
      // The core chapter exchanges sides with the model; the finish returns left.
      const rightColumn = () => mobile ? 0 : section.clientWidth - copy.offsetWidth - copy.offsetLeft * 2;
      const journey = () => mobile ? 65 : section.clientWidth * .24;
      chapters.forEach((chapter, index) => {
        const lines = chapter.querySelectorAll('.hc-kicker,h2,.hc-description,.hc-detail');
        const direction = index === 1 ? -1 : 1;
        gsap.set(lines, { autoAlpha: 0, x: () => journey() * direction });
        timeline.to(chapter, { autoAlpha: 1, duration: .035 }, entrances[index]);
        timeline.to(lines, { autoAlpha: 1, x: 0, duration: .07, stagger: .009, ease: 'power3.out' }, entrances[index]);
        if (index < 2) {
          const exit = index === 0 ? core : finish;
          timeline.to(chapter, { autoAlpha: 0, duration: .055 }, exit);
          timeline.to(lines, { x: () => -direction * (mobile ? 45 : 95), duration: .055, ease: 'power2.in' }, exit);
        }
      });
      if (!mobile) {
        timeline.to(copy, { x: rightColumn, duration: .12, ease: 'power2.inOut' }, core + .02);
        timeline.to(model, { left: `${100 - config.FINAL_RIGHT_POSITION}%`, duration: .15, ease: 'power2.inOut' }, core + .02);
        timeline.to(copy, { x: 0, duration: .12, ease: 'power2.inOut' }, finish + .02);
        timeline.to(model, { left: `${config.FINAL_RIGHT_POSITION}%`, duration: .15, ease: 'power2.inOut' }, finish + .02);
      }
      timeline.to(hint, { autoAlpha: 0, duration: .05 }, surface);
      setLayer('wood-veneer', -gap * .55, surface + .02, (core - surface) * .72);
      setLayer('wood-veneer', -gap, core + .015, (finish - core) * .85);
      timeline.to(layers['aluminium-core'], { scale: 1.012, duration: (finish - core) * .7, ease: 'sine.inOut' }, core + .04);
      timeline.to(caption, { autoAlpha: .8, duration: .1 }, core + .08);
      config.layers.forEach(layer => setLayer(layer.id, layer.final * gap, finish, hold - finish));
      timeline.to(layers['aluminium-core'], { scale: 1, duration: hold - finish }, finish);
      timeline.to(shadow, { scaleX: 1.15, opacity: .4, yPercent: 200, duration: hold - surface, ease: 'sine.inOut' }, surface);
      // Continuous progress, landing exactly on one-third at each completed reveal.
      timeline.to(bar, { scaleX: 1 / 3, duration: core - surface }, surface)
        .to(bar, { scaleX: 2 / 3, duration: finish - core }, core)
        .to(bar, { scaleX: 1, duration: hold - finish }, finish);
      return () => {
        trigger = undefined;
        section.classList.remove('hc-animated');
        delete section.dataset.stage;
        copy.inert = false;
        chapters.forEach(chapter => { chapter.inert = false; chapter.removeAttribute('aria-hidden'); });
      };
    });
    await document.fonts.ready;
    if (!disposed) { ScrollTrigger.sort(); ScrollTrigger.refresh(); }
  }
  initialize().finally(() => {
    document.documentElement.classList.remove('hc-loading');
    window.honeycombSceneReady?.('layers');
  });
  const cleanup = event => {
    if (event.persisted) return; // Preserve the timeline in the back/forward cache.
    disposed = true;
    media.revert();
    rows.forEach(row => row.removeEventListener('click', select));
    window.removeEventListener('pagehide', cleanup);
  };
  window.addEventListener('pagehide', cleanup);
})();
