import { test, expect } from '@playwright/test';

async function open(page) {
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('response', r => { if (r.status() >= 400) errors.push(`${r.status()} ${r.url()}`); });
  await page.goto('/honeycomb');
  await expect(page.locator('#panel-journey')).toHaveClass(/pc-animated/);
  await expect(page.locator('#material')).toHaveClass(/hc-animated/);
  await page.evaluate(() => document.fonts.ready);
  return errors;
}
async function seek(page, p) {
  await page.evaluate(p => {
    document.documentElement.style.scrollBehavior = 'auto';
    const t = window.ScrollTrigger.getById('panel-cinematic');
    scrollTo(0, t.start + (t.end - t.start) * p);
  }, p);
  await expect.poll(() => page.evaluate(() => window.ScrollTrigger.getById('panel-cinematic').progress)).toBeCloseTo(p, 2);
}
const cover = page => page.locator('#panel-journey').getAttribute('data-cover');

test('physical closure, frozen scroll, reverse, magnifier, keyboard and independent pins', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const errors = await open(page);
  await seek(page, .05);
  const initial = await page.locator('.pc-product').boundingBox();
  expect(initial.x + initial.width / 2).toBeCloseTo(720, 0);
  expect(initial.width).toBeLessThan(1440 * .5);
  expect(Number(await cover(page))).toBe(0);
  await expect(page.locator('.pc-copy h2')).toBeVisible();
  await expect(page.locator('.pc-description')).toBeHidden();
  await expect(page.locator('.pc-rows')).toBeHidden();
  await page.screenshot({ path: 'test-results/panel-cinematic-entry.png' });
  await expect(page.locator('.pc-callout')).toBeHidden();
  await seek(page, .25);
  const partial = await cover(page);
  expect(Number(partial)).toBeGreaterThan(0);
  expect(Number(partial)).toBeLessThan(1);
  await expect(page.locator('.pc-curl')).toBeVisible();
  const moving = await page.locator('.pc-product').boundingBox();
  expect(moving.x).toBeGreaterThan(initial.x);
  expect(moving.x + moving.width / 2).toBeLessThan(1440 * .73);
  await page.waitForTimeout(250);
  expect(await cover(page)).toBe(partial);
  await seek(page, .49);
  expect(Number(await cover(page))).toBe(1);
  await expect(page.locator('.pc-copy h2')).toBeVisible();
  await expect(page.locator('.pc-description')).toBeVisible();
  await expect(page.locator('.pc-rows')).toBeVisible();
  await expect(page.locator('.pc-curl')).toBeHidden();
  await seek(page, .76);
  await expect(page.locator('.pc-lens-rim')).toBeVisible();
  const rim = await page.locator('.pc-lens-rim').boundingBox();
  expect(rim.y).toBeGreaterThan(97);
  expect(rim.x + rim.width).toBeLessThan(1440);
  await seek(page, .97);
  await expect(page.locator('.pc-copy')).toBeVisible();
  await expect(page.locator('.pc-copy h2')).toBeInViewport();
  await expect(page.locator('.pc-rows button').nth(1)).toHaveAttribute('aria-current', 'step');
  await page.screenshot({ path: 'test-results/panel-cinematic-desktop.png' });
  await page.locator('.pc-rows button').nth(2).focus();
  await page.keyboard.press('Enter');
  await expect.poll(() => page.evaluate(() => ScrollTrigger.getById('panel-cinematic').progress)).toBeCloseTo(.49, 2);
  await seek(page, .25);
  expect(await cover(page)).toBe(partial);
  await seek(page, .05);
  expect(Number(await cover(page))).toBe(0);
  await expect(page.locator('.pc-description')).toBeHidden();
  await expect(page.locator('.pc-rows')).toBeHidden();
  expect((await page.locator('.pc-product').boundingBox()).x).toBeCloseTo(initial.x, 0);
  await page.mouse.wheel(0, 400);
  await expect.poll(() => page.evaluate(() => ScrollTrigger.getById('panel-cinematic').progress)).toBeGreaterThan(.12);
  expect(await page.evaluate(() => {
    const a = ScrollTrigger.getById('panel-cinematic'), b = ScrollTrigger.getById('honeycomb-reveal');
    return b.start > a.end && ScrollTrigger.getAll().filter(t => t.vars.id === 'panel-cinematic').length === 1;
  })).toBe(true);
  await page.locator('.pc-footer a').click();
  await expect(page.locator('#material')).toBeInViewport();
  expect(errors).toEqual([]);
});

for (const [width, height] of [[1440,700],[1024,900],[768,1024],[390,844],[360,740]]) {
  test(`composition and reversal at ${width} × ${height}`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    const errors = await open(page);
    await seek(page, .05);
    await expect(page.locator('.pc-copy h2')).toBeVisible();
    if (width >= 768) {
      const product = await page.locator('.pc-product').boundingBox();
      expect(product.x + product.width / 2).toBeCloseTo(width / 2, 0);
    }
    await seek(page, .97);
    const copy = await page.locator('.pc-copy').boundingBox();
    if (width >= 768) expect((await page.locator('.pc-product').boundingBox()).x).toBeGreaterThan(copy.x + copy.width);
    const rim = await page.locator('.pc-lens-rim').boundingBox();
    expect(copy.y).toBeGreaterThan(90);
    expect(copy.y + copy.height).toBeLessThan(height - 40);
    expect(rim.y).toBeGreaterThan(80);
    expect(rim.x + rim.width).toBeLessThan(width);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    expect(Number(await cover(page))).toBe(1);
    if (width < 768) {
      const product = await page.locator('.pc-product').boundingBox();
      const frontBottom = product.y + (723 + 260) / 1250 * product.height;
      expect(frontBottom).toBeLessThan(copy.y);
    }
    await page.screenshot({ path: `test-results/panel-cinematic-${width}.png` });
    await seek(page, .2);
    expect(Number(await cover(page))).toBeGreaterThan(0);
    expect(Number(await cover(page))).toBeLessThan(1);
    expect(errors).toEqual([]);
  });
}

test('reduced motion and breakpoint changes retain the finished static product', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/honeycomb');
  await expect(page.locator('.pc-copy')).toBeVisible();
  await expect(page.locator('.pc-lens-rim')).toBeVisible();
  await expect(page.locator('#panel-journey')).not.toHaveClass(/pc-animated/);
  expect(await page.locator('.pc-mask-left').getAttribute('width')).toBe('694');
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await expect(page.locator('#panel-journey')).toHaveClass(/pc-animated/);
  await seek(page, .97);
  await page.setViewportSize({ width: 390, height: 844 });
  await seek(page, .97);
  expect(Number(await page.locator('.pc-mask-left').getAttribute('width'))).toBe(694);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect(page.locator('#panel-journey')).not.toHaveClass(/pc-animated/);
  await expect(page.locator('.pc-copy')).toBeVisible();
  expect(await page.locator('.pc-mask-right').getAttribute('width')).toBe('992');
});

test('without JavaScript, the closed panel, cutaway and copy remain available', async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto('/honeycomb');
  await expect(page.locator('.pc-copy')).toBeVisible();
  await expect(page.locator('.pc-lens-rim')).toBeVisible();
  expect(await page.locator('.pc-mask-right').getAttribute('width')).toBe('992');
  await context.close();
});
