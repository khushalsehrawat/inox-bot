// Repeatable mobile scroll profile; headless timings are not device FPS guarantees.
import { chromium } from '@playwright/test';
import { existsSync, readdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
const cache = join(homedir(), 'AppData', 'Local', 'ms-playwright');
const executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || (process.platform === 'win32' && existsSync(cache)
  ? readdirSync(cache).filter(name => /^chromium-\d+$/.test(name)).sort().reverse()
    .map(name => join(cache, name, 'chrome-win64', 'chrome.exe')).find(existsSync) : undefined);
const browser = await chromium.launch({ executablePath });
try {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 3 });
  if (process.env.HONEYCOMB_PROFILE_BASELINE === '1') {
    await page.route('**/honeycomb{,/**}', async route => {
      const pathname = new URL(route.request().url()).pathname;
      const path = pathname === '/honeycomb' ? 'public/honeycomb/index.html' : `public${pathname}`;
      if (!/\.(?:html|css|js)$/.test(path)) return route.continue();
      const body = execFileSync('git', ['show', `HEAD:${path}`], { maxBuffer: 4 * 1024 * 1024 });
      await route.fulfill({ body, contentType: path.endsWith('.js') ? 'text/javascript' : path.endsWith('.css') ? 'text/css' : 'text/html' });
    });
  }
  await page.goto(`${process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:3000'}/honeycomb`);
  await page.waitForFunction(() => ['panel-cinematic', 'honeycomb-reveal', 'cabinet-opening'].every(id => window.ScrollTrigger?.getById(id)));
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Performance.enable');
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  for (const id of ['panel-cinematic', 'honeycomb-reveal', 'cabinet-opening']) {
    await page.evaluate(id => {
      document.documentElement.style.scrollBehavior = 'auto';
      scrollTo(0, ScrollTrigger.getById(id).start);
    }, id);
    await page.waitForTimeout(800);
    const before = Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map(m => [m.name, m.value]));
    const frames = await page.evaluate(id => new Promise(resolve => {
      const trigger = ScrollTrigger.getById(id), intervals = [];
      let frame = 0, previous;
      function tick(now) {
        if (previous !== undefined) intervals.push(now - previous);
        previous = now;
        scrollTo(0, trigger.start + (trigger.end - trigger.start) * frame / 90);
        if (++frame <= 90) requestAnimationFrame(tick);
        else resolve(intervals);
      }
      requestAnimationFrame(tick);
    }), id);
    const after = Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map(m => [m.name, m.value]));
    const sorted = [...frames].sort((a, b) => a - b);
    console.log(JSON.stringify({ id, frames: frames.length, p95FrameMs: +sorted[Math.floor(sorted.length * .95)].toFixed(1),
      layouts: after.LayoutCount - before.LayoutCount, styleRecalculations: after.RecalcStyleCount - before.RecalcStyleCount,
      layoutMs: +((after.LayoutDuration - before.LayoutDuration) * 1000).toFixed(1),
      scriptMs: +((after.ScriptDuration - before.ScriptDuration) * 1000).toFixed(1) }));
  }
} finally { await browser.close(); }
