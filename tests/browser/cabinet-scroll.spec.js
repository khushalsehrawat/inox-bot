import { test, expect } from '@playwright/test';

async function seek(page, progress) {
  await page.evaluate(p => {
    document.documentElement.style.scrollBehavior = 'auto';
    const trigger = ScrollTrigger.getById('cabinet-opening');
    scrollTo(0, trigger.start + (trigger.end - trigger.start) * p);
    ScrollTrigger.update();
  }, progress);
}

for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
  test(`cabinet opens before markers appear and closes in reverse at ${viewport.width}px`, async ({ page }) => {
    await page.setViewportSize(viewport);
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto('/honeycomb');
    const bench = page.locator('.construction-workbench');
    await expect(bench).toHaveClass(/cabinet-animated/);
    await seek(page, 0);
    await expect(bench).toHaveAttribute('data-door', 'closed');
    await expect(page.locator('.dg .hs').first()).toBeHidden();
    await page.screenshot({ path: `test-results/cabinet-closed-${viewport.width}.png` });
    const closed = await page.locator('.cabinet-door').getAttribute('style');
    await seek(page, .4);
    await expect(bench).toHaveAttribute('data-door', 'opening');
    await expect(page.locator('.dg .hs').first()).toBeHidden();
    expect(await page.locator('.cabinet-door').getAttribute('style')).not.toBe(closed);
    await page.screenshot({ path: `test-results/cabinet-opening-${viewport.width}.png` });
    await seek(page, .99);
    await expect(bench).toHaveAttribute('data-door', 'open');
    await expect(page.locator('.dg .hs').first()).toBeVisible();
    await page.locator('.tabs [data-k="core"]').click();
    await expect(page.locator('#dgl')).toHaveText('Aluminium Honeycomb Core');
    await page.screenshot({ path: `test-results/cabinet-open-${viewport.width}.png` });
    const box = await bench.boundingBox();
    expect(box.y).toBeGreaterThanOrEqual(95);
    expect(box.y + box.height).toBeLessThanOrEqual(viewport.height + 1);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await seek(page, 0);
    await expect(bench).toHaveAttribute('data-door', 'closed');
    await expect(page.locator('.dg .hs').first()).toBeHidden();
    expect(errors).toEqual([]);
  });
}

test('reduced motion keeps the original open cabinet and controls available', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/honeycomb');
  await expect(page.locator('.construction-workbench')).not.toHaveClass(/cabinet-animated/);
  await page.locator('.tabs [data-k="carcass"]').click();
  await expect(page.locator('#dgl')).toHaveText('Carcass');
  await expect(page.locator('.dg>img')).toBeVisible();
});
