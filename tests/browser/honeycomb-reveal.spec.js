import { test, expect } from '@playwright/test';

async function open(page) {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('response', response => {
    if (response.status() >= 400) errors.push(`${response.status()} ${response.url()}`);
  });
  await page.goto('/honeycomb');
  await expect(page.locator('#material')).toHaveClass(/hc-animated/);
  await page.evaluate(() => document.fonts.ready);
  return errors;
}
async function seek(page, progress) {
  await page.evaluate(p => {
    const trigger = window.ScrollTrigger.getById('honeycomb-reveal');
    document.documentElement.style.scrollBehavior = 'auto';
    window.scrollTo(0, trigger.start + (trigger.end - trigger.start) * p);
  }, progress);
  await expect.poll(() => page.evaluate(() => window.ScrollTrigger.getById('honeycomb-reveal').animation.progress())).toBeCloseTo(progress, 2);
}
async function layerOffsets(page) {
  return page.evaluate(() => Object.fromEntries(window.HONEYCOMB_CONFIG.layers.map(layer => [layer.id, Number(window.gsap.getProperty(document.querySelector(`[data-layer="${layer.id}"]`), 'yPercent'))])));
}
async function noOverflow(page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
}

test('desktop: closed entry, all reveals, keyboard selection, reversal and release', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const errors = await open(page);
  await expect(page.locator('.hero + .pin-spacer #panel-journey')).toHaveCount(1);
  await expect(page.locator('#material')).toHaveCount(1);
  await expect(page.locator('.hc-layer')).toHaveCount(3);
  await seek(page, .05);
  const closed = await layerOffsets(page);
  await expect(page.locator('.hc-copy')).toBeHidden();
  await expect(page.locator('.hc-hint')).toBeVisible();
  const centre = await page.locator('.hc-model').boundingBox();
  expect(centre.x + centre.width / 2).toBeCloseTo(720, 0);
  await page.screenshot({ path: 'test-results/honeycomb-closed.png' });

  await seek(page, .39);
  const surface = await layerOffsets(page);
  expect(surface['wood-veneer']).toBeLessThan(closed['wood-veneer']);
  expect(surface['aluminium-core']).toBeCloseTo(closed['aluminium-core'], 2);
  expect(surface['bottom-sheet']).toBeCloseTo(closed['bottom-sheet'], 2);
  await expect(page.locator('.hc-row').nth(0)).toHaveAttribute('aria-current', 'step');
  await expect(page.locator('.hc-chapter').nth(0)).toHaveAttribute('aria-hidden', 'false');
  await expect(page.locator('.hc-chapter').nth(0).locator('h2')).toBeVisible();
  await page.screenshot({ path: 'test-results/honeycomb-surface.png' });

  await seek(page, .69);
  const core = await layerOffsets(page);
  expect(core['wood-veneer']).toBeLessThan(surface['wood-veneer']);
  expect(core['bottom-sheet']).toBeCloseTo(closed['bottom-sheet'], 2);
  await expect(page.locator('.hc-row').nth(1)).toHaveAttribute('aria-current', 'step');
  await expect(page.locator('.hc-chapter').nth(1)).toHaveAttribute('aria-hidden', 'false');
  await expect(page.locator('.hc-chapter').nth(0)).toBeHidden();
  await expect(page.locator('.hc-chapter').nth(0).locator('h2')).toBeHidden();
  await expect(page.locator('.hc-chapter').nth(1).locator('h2')).toBeVisible();
  const coreCopy = await page.locator('.hc-copy').boundingBox();
  const coreModel = await page.locator('.hc-model').boundingBox();
  expect(coreCopy.x).toBeGreaterThan(720);
  expect(coreModel.x + coreModel.width / 2).toBeLessThan(720);
  await page.screenshot({ path: 'test-results/honeycomb-core.png' });

  await seek(page, .97);
  const final = await layerOffsets(page);
  expect(final['bottom-sheet']).toBeGreaterThan(core['bottom-sheet']);
  const values = ['wood-veneer', 'aluminium-core', 'bottom-sheet'].map(id => final[id]);
  values.slice(1).forEach((offset, i) => expect(offset).toBeGreaterThan(values[i]));
  await expect(page.locator('.hc-row').nth(2)).toHaveAttribute('aria-current', 'step');
  await expect(page.locator('.hc-chapter').nth(2)).toHaveAttribute('aria-hidden', 'false');
  await expect(page.locator('.hc-chapter').nth(1)).toBeHidden();
  expect((await page.locator('.hc-copy').boundingBox()).x).toBeLessThan(100);
  expect(await page.locator('.hc-progress span').evaluate(el => window.gsap.getProperty(el, 'scaleX'))).toBe(1);
  await noOverflow(page);
  await page.screenshot({ path: 'test-results/honeycomb-final.png' });

  await page.locator('.hc-row').nth(0).focus();
  await page.keyboard.press('Enter');
  await expect.poll(() => page.evaluate(() => window.ScrollTrigger.getById('honeycomb-reveal').animation.progress())).toBeCloseTo(.39, 2);
  await seek(page, .05);
  const reversed = await layerOffsets(page);
  Object.keys(closed).forEach(id => expect(reversed[id]).toBeCloseTo(closed[id], 2));
  await page.mouse.wheel(0, 400);
  await expect.poll(() => page.evaluate(() => window.ScrollTrigger.getById('honeycomb-reveal').animation.progress())).toBeGreaterThan(.1);
  await seek(page, 1);
  await page.evaluate(() => window.scrollBy(0, innerHeight));
  await expect(page.locator('#why')).toBeInViewport();
  expect(await page.evaluate(() => window.ScrollTrigger.getAll().filter(t => t.vars.id === 'honeycomb-reveal').length)).toBe(1);
  expect(errors).toEqual([]);
});

for (const [width, height] of [[1440, 700], [1024, 900], [768, 1024], [390, 844], [360, 740]]) {
  test(`responsive composition at ${width}x${height}`, async ({ browser }) => {
    const context = await browser.newContext({ viewport: { width, height }, hasTouch: width < 768, isMobile: width < 768 });
    const page = await context.newPage();
    const errors = await open(page);
    await seek(page, .97);
    await noOverflow(page);
    await expect(page.locator('.hc-copy')).toBeVisible();
    if (width >= 768) {
      const copy = await page.locator('.hc-copy').boundingBox();
      expect(copy.y).toBeGreaterThan(96);
      expect(copy.y + copy.height).toBeLessThan(height);
      await seek(page, .69);
      const model = await page.locator('.hc-model').boundingBox();
      const topOffset = await page.locator('[data-layer="wood-veneer"]').evaluate(el => window.gsap.getProperty(el, 'yPercent'));
      expect(model.y + (230 / 760 + topOffset / 100) * model.height).toBeGreaterThan(96);
    }
    if (width < 768) {
      const copy = await page.locator('.hc-copy').boundingBox();
      const model = await page.locator('.hc-model').boundingBox();
      // The bottom sheet's visible front edge is at y=449 + its final translation.
      const bottomEdge = model.y + (449 + windowGap(width) * 1.33) / 760 * model.height;
      expect(bottomEdge).toBeLessThan(copy.y);
      const session = await context.newCDPSession(page);
      const touch = y => [{ x: width / 2, y, id: 1 }];
      await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: touch(220) });
      for (let step = 1; step <= 12; step++) {
        await session.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: touch(220 + step * 25) });
        await page.waitForTimeout(16); // Pace the native gesture, including touch slop.
      }
      await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      await expect.poll(() => page.evaluate(() => window.ScrollTrigger.getById('honeycomb-reveal').animation.progress())).toBeLessThan(.94);
      let previous = -1;
      await expect.poll(async () => {
        const position = await page.evaluate(() => scrollY);
        const stable = Math.abs(position - previous) < 1;
        previous = position;
        return stable;
      }, { intervals: [100, 100, 100] }).toBeTruthy();
    }
    await seek(page, .97);
    const heading = await page.locator('.hc-chapter').nth(2).locator('h2').boundingBox();
    expect(heading.y).toBeGreaterThan(width < 768 ? 82 : 96);
    expect(heading.x).toBeGreaterThanOrEqual(20);
    expect(heading.x + heading.width).toBeLessThanOrEqual(width);
    await page.screenshot({ path: `test-results/honeycomb-${width}.png` });
    expect(errors).toEqual([]);
    await context.close();
  });
}
function windowGap(width) { return width < 768 ? 90 : 105; }

test('reduced motion and live preference changes restore a normal static section', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/honeycomb');
  await expect(page.locator('.hc-row').nth(2)).toHaveAttribute('aria-current', 'step');
  await expect(page.locator('#material')).not.toHaveClass(/hc-animated/);
  await expect(page.locator('.hc-copy')).toBeVisible();
  for (const chapter of await page.locator('.hc-chapter').all()) await expect(chapter).toBeVisible();
  expect(await page.locator('#material').evaluate(el => el.parentElement.classList.contains('pin-spacer'))).toBe(false);
  await page.locator('#material').scrollIntoViewIfNeeded();
  await page.screenshot({ path: 'test-results/honeycomb-reduced.png' });
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await expect(page.locator('#material')).toHaveClass(/hc-animated/);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect(page.locator('#material')).not.toHaveClass(/hc-animated/);
  await expect(page.locator('.hc-copy')).toBeVisible();
  await noOverflow(page);
});

test('without JavaScript the final assembly and all content remain available', async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto('/honeycomb');
  await expect(page.locator('.hc-copy')).toBeVisible();
  await expect(page.locator('.hc-layer')).toHaveCount(3);
  await noOverflow(page);
  await context.close();
});

test('slow layer decoding preserves a closed first paint', async ({ page }) => {
  let release;
  const gate = new Promise(resolve => { release = resolve; });
  await page.route('**/layers/wood-veneer.svg', async route => {
    await gate;
    await route.continue();
  });
  await page.goto('/honeycomb', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('html')).toHaveClass(/hc-loading/);
  await expect(page.locator('.hc-copy')).toBeHidden();
  const model = await page.locator('.hc-model').boundingBox();
  const width = page.viewportSize().width;
  expect(model.x + model.width / 2).toBeCloseTo(width / 2, 0);
  release();
  await expect(page.locator('#material')).toHaveClass(/hc-animated/);
  await expect(page.locator('html')).not.toHaveClass(/hc-loading/);
});

test('unavailable animation library exposes the static product and information', async ({ page }) => {
  await page.route('**/assets/gsap.min.js', route => route.abort());
  await page.goto('/honeycomb');
  await expect(page.locator('html')).not.toHaveClass(/hc-loading/);
  await expect(page.locator('.hc-copy')).toBeVisible();
  await expect(page.locator('#material')).not.toHaveClass(/hc-animated/);
  await expect(page.locator('.hc-layer')).toHaveCount(3);
});
