import { test, expect } from '@playwright/test';

test('event stories open complete galleries and support keyboard photo navigation', async ({ page }) => {
  await page.goto('/');
  const events = page.locator('#events');
  await events.scrollIntoViewIfNeeded();
  await expect(events.locator('.journal-card')).toHaveCount(6);
  for (let i = 0; i < 6; i++) {
    await events.locator('.journal-card').nth(i).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog.locator('.event-gallery-grid button').first()).toBeVisible();
    if (i === 0) await expect(dialog.locator('.event-gallery-grid button')).toHaveCount(85);
    if (i === 1) await expect(dialog.locator('.event-gallery-grid button')).toHaveCount(57);
    await dialog.locator('.event-gallery-grid button').first().click();
    await expect(dialog.locator('.event-lightbox > p')).toContainText('1 /');
    await page.keyboard.press('ArrowRight');
    await expect(dialog.locator('.event-lightbox > p')).toContainText('2 /');
    await page.keyboard.press('Escape');
    await expect(dialog.locator('.event-gallery-grid')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);
    await expect(events.locator('.journal-card').nth(i)).toBeFocused();
  }
  await page.evaluate(() => (document.activeElement as HTMLElement)?.blur());
  await page.addStyleTag({content: 'nextjs-portal, .skip-link { visibility: hidden !important; }'});
  await events.screenshot({ path: 'docs/events-journal-desktop.png' });
  await page.setViewportSize({width:390,height:844});
  await events.scrollIntoViewIfNeeded();
  await events.screenshot({ path: 'docs/events-journal-mobile.png' });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await events.locator('.journal-card').nth(1).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.getByRole('dialog').screenshot({path:'docs/events-gallery-mobile.png'});
});
