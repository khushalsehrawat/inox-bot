(() => {
  'use strict';
  const bench = document.querySelector('.construction-workbench');
  const scene = bench?.querySelector('.dg');
  const image = scene?.querySelector('img');
  if (!image || !window.gsap || !window.ScrollTrigger) return;

  // Project the original shutter onto its moving plane. The cabinet body stays still.
  const source = [[223, 32], [694, 122], [694, 727], [223, 786]];
  function projection(target) {
    const rows = [];
    source.forEach(([x, y], i) => {
      const [u, v] = target[i];
      rows.push([x, y, 1, 0, 0, 0, -u*x, -u*y, u]);
      rows.push([0, 0, 0, x, y, 1, -v*x, -v*y, v]);
    });
    for (let c = 0; c < 8; c++) {
      let pivot = c;
      for (let r = c + 1; r < 8; r++) if (Math.abs(rows[r][c]) > Math.abs(rows[pivot][c])) pivot = r;
      [rows[c], rows[pivot]] = [rows[pivot], rows[c]];
      const divisor = rows[c][c];
      for (let k = c; k < 9; k++) rows[c][k] /= divisor;
      for (let r = 0; r < 8; r++) {
        if (r === c) continue;
        const factor = rows[r][c];
        for (let k = c; k < 9; k++) rows[r][k] -= factor * rows[c][k];
      }
    }
    const [a,b,c,d,e,f,g,h] = rows.map(row => row[8]);
    return `matrix3d(${a},${d},0,${g},${b},${e},0,${h},0,0,1,0,${c},${f},0,1)`;
  }

  const visual = document.createElement('div');
  visual.className = 'cabinet-motion';
  visual.setAttribute('aria-hidden', 'true');
  const body = image.cloneNode();
  body.removeAttribute('alt');
  body.removeAttribute('loading');
  body.className = 'cabinet-body';
  const door = document.createElement('div');
  door.className = 'cabinet-door';
  door.innerHTML = `<svg viewBox="0 0 1881 836" xmlns="http://www.w3.org/2000/svg"><defs><clipPath id="cabinet-shutter-clip"><polygon points="223,32 694,122 694,727 223,786"/></clipPath><filter id="cabinet-grain"><feTurbulence type="fractalNoise" baseFrequency=".7" numOctaves="3" stitchTiles="stitch"/><feColorMatrix type="saturate" values="0"/><feComponentTransfer><feFuncA type="linear" slope=".13"/></feComponentTransfer><feBlend in="SourceGraphic" mode="multiply"/></filter><linearGradient id="cabinet-surface"><stop stop-color="#c3bbae"/><stop offset="1" stop-color="#a59e91"/></linearGradient></defs><g clip-path="url(#cabinet-shutter-clip)"><image class="cabinet-door-inside" href="${image.getAttribute('src')}" width="1881" height="836"/><g class="cabinet-door-outside"><polygon points="223,32 694,122 694,727 223,786" fill="url(#cabinet-surface)" filter="url(#cabinet-grain)"/><path d="M230 34L230 783" stroke="#e6dfd3" stroke-width="6"/><polygon points="223,32 694,122 694,727 223,786" fill="none" stroke="#d7cfc0" stroke-width="3"/></g></g></svg>`;
  visual.append(body, door);
  scene.prepend(visual);
  const resize = new ResizeObserver(() => { door.style.zoom = String(visual.clientWidth / 1881); });
  resize.observe(visual);
  const exterior = door.querySelector('.cabinet-door-outside');
  const markers = [...scene.querySelectorAll('.hs')];
  const controls = bench.querySelector('.construction-controls');
  const foot = bench.querySelector('.stage-foot span');
  const originalFoot = foot.textContent;
  let previousReveal = null;
  let previousFrame = -1, previousFace, previousDoorState, previousLabels;
  // Solve the projection once per pose instead of allocating and eliminating an
  // 8x8 matrix on every touch-scroll frame.
  const poses = Array.from({ length: 361 }, (_, frame) => {
    const p = frame / 360;
    const angle = p * p * (3 - 2 * p) * Math.PI;
    let cosine = Math.cos(angle);
    if (Math.abs(cosine) < .001) cosine = cosine < 0 ? -.001 : .001;
    const width = cosine >= 0 ? 734 * cosine : 471 * cosine;
    const depth = Math.sin(angle) * 110;
    const top = cosine >= 0 ? 122 - 110*cosine - depth : 122 + 90*cosine - depth;
    const bottom = cosine >= 0 ? 727 + 91*cosine + depth : 727 - 59*cosine + depth;
    return { transform: projection([[694 + width, top], [694, 122], [694, 727], [694 + width, bottom]]), outside: cosine >= 0 };
  });

  function render(progress) {
    const p = Math.max(0, Math.min(1, (progress - .08) / .68));
    const frame = Math.round(p * 360), pose = poses[frame];
    if (frame !== previousFrame) { door.style.transform = pose.transform; previousFrame = frame; }
    if (previousFace !== pose.outside) {
      exterior.style.display = pose.outside ? '' : 'none';
      body.style.setProperty('--cabinet-body-left', pose.outside ? '36.9%' : '35.62%');
      previousFace = pose.outside;
    }
    const reveal = progress >= .82;
    const doorState = p === 0 ? 'closed' : p === 1 ? 'open' : 'opening';
    if (previousDoorState !== doorState) { bench.dataset.door = doorState; previousDoorState = doorState; }
    const labels = Math.max(0, Math.min(1, (progress - .79) / .13)).toFixed(3);
    if (previousLabels !== labels) { bench.style.setProperty('--cabinet-labels', labels); previousLabels = labels; }
    if (reveal !== previousReveal) {
      previousReveal = reveal;
      bench.classList.toggle('cabinet-revealed', reveal);
      markers.forEach(marker => { marker.inert = !reveal; marker.setAttribute('aria-hidden', String(!reveal)); });
      controls.inert = !reveal;
      foot.textContent = reveal ? originalFoot : 'SCROLL TO OPEN THE CABINET ↓';
    }
  }

  function start() {
    gsap.registerPlugin(ScrollTrigger);
    const media = gsap.matchMedia();
    media.add({ reduce: '(prefers-reduced-motion: reduce)', landscape: '(max-width:900px) and (max-height:540px) and (orientation:landscape)', normal: '(min-width:0px)' }, context => {
      if (context.conditions.reduce || context.conditions.landscape) return;
      previousReveal = null;
      previousFrame = -1; previousFace = undefined; previousDoorState = undefined; previousLabels = undefined;
      bench.classList.add('cabinet-animated');
      render(0);
      const trigger = ScrollTrigger.create({
        id: 'cabinet-opening', trigger: bench,
        start: () => `top ${Math.max(100, (innerHeight - bench.offsetHeight) / 2)}px`,
        end: () => `+=${matchMedia('(max-width:860px)').matches ? Math.max(480, innerHeight * .8) : Math.max(650, innerHeight * 1.15)}`,
        pin: true, anticipatePin: 1, invalidateOnRefresh: true,
        onUpdate: self => render(self.progress),
        onRefresh: self => render(self.progress),
        onToggle: self => bench.classList.toggle('cabinet-in-view', self.isActive),
      });
      return () => {
        trigger.kill(true);
        bench.classList.remove('cabinet-animated', 'cabinet-revealed', 'cabinet-in-view');
        markers.forEach(marker => { marker.inert = false; marker.removeAttribute('aria-hidden'); });
        controls.inert = false;
        foot.textContent = originalFoot;
      };
    });
    ScrollTrigger.sort();
    ScrollTrigger.refresh();
  }
  image.loading = 'eager';
  image.decode().then(() => Promise.all([document.fonts.ready, window.honeycombBeforeCabinet]))
    .then(start).catch(() => visual.remove()).finally(() => window.honeycombSceneReady?.('cabinet'));
})();
