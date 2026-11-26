import { test, expect } from '@playwright/test';

test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, reducedMotion: 'reduce' });

test('phone navigation expands collections, scrolls and follows a category', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Open navigation', exact: true }).tap();
  const navigation = page.locator('#mobile-navigation');
  const collections = navigation.getByRole('button', { name: 'Explore product collections' });
  await expect(collections).toHaveAttribute('aria-expanded', 'false');
  await collections.tap();
  await expect(collections).toHaveAttribute('aria-expanded', 'true');
  const options = navigation.locator('.mobile-collections a');
  await expect(options.first()).toHaveText('View all products');
  expect(await options.count()).toBeGreaterThan(1);
  expect(await navigation.evaluate(el => el.getBoundingClientRect().bottom <= window.innerHeight)).toBeTruthy();
  const category = options.last();
  const href = await category.getAttribute('href');
  await category.tap();
  await expect(page).toHaveURL(new RegExp(href!.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$'));
  await expect(navigation).toBeHidden();
});

test('phone collections collapse and Escape restores menu-button focus', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Open navigation', exact: true }).tap();
  const collections = page.locator('#mobile-navigation').getByRole('button', { name: 'Explore product collections' });
  await collections.tap();
  await collections.tap();
  await expect(page.locator('#mobile-collections')).toHaveCount(0);
  await collections.focus();
  await page.keyboard.press('Escape');
  await expect(page.locator('#mobile-navigation')).toBeHidden();
  await expect(page.getByRole('button', { name: 'Open navigation', exact: true })).toBeFocused();
});
