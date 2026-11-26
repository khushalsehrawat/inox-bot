import { test, expect } from '@playwright/test';

async function open(page) {
  await page.goto('/honeycomb');
  await expect(page.locator('#material')).toHaveClass(/hc-animated/);
  await expect(page.locator('#panel-journey')).toHaveClass(/pc-animated/);
  await expect(page.locator('.construction-workbench')).toHaveClass(/cabinet-animated/);
  await expect(page.locator('html')).toHaveClass(/hc-scroll-ready/);
}
async function seek(page, id, p) {
  await page.evaluate(({ id, p }) => {
    const trigger = ScrollTrigger.getById(id);
    scrollTo(0, trigger.start + (trigger.end - trigger.start) * p);
    ScrollTrigger.update();
  }, { id, p });
  await expect.poll(() => page.evaluate(id => ScrollTrigger.getById(id).progress, id)).toBeCloseTo(p, 2);
}

for (const [width, height] of [[320, 640], [375, 667], [390, 844]]) {
  test(`mobile scroll stays synchronized and content fits at ${width}x${height}`, async ({ browser, baseURL }) => {
    const context = await browser.newContext({ baseURL, viewport: { width, height }, isMobile: true, hasTouch: true, deviceScaleFactor: 3 });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await open(page);
    await expect(page.locator('.pc-cells image')).toHaveCount(1);
    await expect(page.locator('.pc-cells polygon')).toHaveCount(0);
    await expect(page.locator('[data-layer="aluminium-core"]')).toHaveAttribute('src', /mobile\/aluminium-core.webp$/);
    const lengths = await page.evaluate(() => ['panel-cinematic', 'honeycomb-reveal'].map(id => {
      const t = ScrollTrigger.getById(id);
      return (t.end - t.start) / t.trigger.querySelector('.pc-stage,.hc-stage').offsetHeight;
    }));
    expect(lengths[0]).toBeCloseTo(2.4, 1);
    expect(lengths[1]).toBeCloseTo(2.8, 1);
    for (const id of ['panel-cinematic', 'honeycomb-reveal']) {
      for (const p of [.24, .56, .97, .36]) {
        await seek(page, id, p);
        const progress = await page.evaluate(id => {
          const t = ScrollTrigger.getById(id);
          return { scroll: t.progress, animation: t.animation.progress() };
        }, id);
        expect(progress.animation).toBeCloseTo(progress.scroll, 3);
      }
      await seek(page, id, .97);
      const copy = page.locator(id === 'panel-cinematic' ? '.pc-copy' : '.hc-copy');
      const bounds = await copy.boundingBox();
      expect(bounds.y).toBeGreaterThan(82);
      expect(bounds.y + bounds.height).toBeLessThan(height - 25);
      const product = await page.locator(id === 'panel-cinematic' ? '.pc-product' : '.hc-model').boundingBox();
      const visibleBottom = id === 'panel-cinematic' ? product.y + 983 / 1250 * product.height : product.y + (449 + 90 * 1.33) / 760 * product.height;
      expect(visibleBottom).toBeLessThan(bounds.y);
      if (id === 'honeycomb-reveal') {
        const detail = await page.locator('.hc-chapter').last().locator('.hc-detail').boundingBox();
        const divider = await page.locator('.hc-progress').boundingBox();
        expect(detail.y + detail.height).toBeLessThan(divider.y);
      }
    }
    await seek(page, 'cabinet-opening', .99);
    await expect(page.locator('.dg .hs').first()).toBeVisible();
    const cabinet = await page.locator('.construction-workbench').boundingBox();
    expect(cabinet.y + cabinet.height, JSON.stringify(await page.evaluate(() => ({ width: innerWidth, height: innerHeight, scroll: scrollY,
      bench: document.querySelector('.construction-workbench').getBoundingClientRect().toJSON(),
      trigger: [ScrollTrigger.getById('cabinet-opening').start, ScrollTrigger.getById('cabinet-opening').end],
      zoom: getComputedStyle(document.querySelector('.cabinet-door')).zoom,
      style: document.querySelector('.construction-workbench').getAttribute('style'),
      triggers: ScrollTrigger.getAll().filter(t=>t.pin).map(t=>({id:t.vars.id,start:t.start,end:t.end,active:t.isActive,priority:t.vars.refreshPriority,computedEnd:t.vars.end?.(t)})),
    })))).toBeLessThanOrEqual(height + 1);
    expect(await page.locator('.cabinet-motion').evaluate(el => getComputedStyle(el).filter)).toBe('none');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    expect(errors).toEqual([]);
    await page.screenshot({ path: `test-results/honeycomb-mobile-motion-${width}.png` });
    await context.close();
  });
}

test('phone rotation releases oversized pins and restores portrait animations', async ({ browser, baseURL }) => {
  const context = await browser.newContext({ baseURL, viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const page = await context.newPage();
  await open(page);
  await seek(page, 'honeycomb-reveal', .6);
  await page.setViewportSize({ width: 844, height: 390 });
  for (const selector of ['#panel-journey', '#material', '.construction-workbench']) {
    await expect(page.locator(selector)).not.toHaveClass(/(?:pc|hc|cabinet)-animated/);
  }
  expect(await page.evaluate(() => ['panel-cinematic', 'honeycomb-reveal', 'cabinet-opening'].every(id => !ScrollTrigger.getById(id)))).toBe(true);
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.locator('#material')).toHaveClass(/hc-animated/);
  await expect(page.locator('.construction-workbench')).toHaveClass(/cabinet-animated/);
  await seek(page, 'cabinet-opening', 0);
  await expect(page.locator('.dg .hs').first()).toBeHidden();
  await seek(page, 'cabinet-opening', .99);
  await expect(page.locator('.dg .hs').first()).toBeVisible();
  expect(await page.evaluate(() => ['panel-cinematic', 'honeycomb-reveal', 'cabinet-opening'].every(id => ScrollTrigger.getAll().filter(t => t.vars.id === id).length === 1))).toBe(true);
  await context.close();
});
