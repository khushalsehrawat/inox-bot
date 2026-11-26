import { expect, test } from "@playwright/test";

const screens = [
  [320, 568], [375, 667], [390, 844], [393, 852], [430, 932],
  [844, 390], [600, 900], [601, 900], [768, 1024], [820, 1180],
  [1024, 768], [1180, 820], [1440, 900],
];

test("collection photographs and captions fit phone, tablet and desktop viewports", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  const gallery = page.locator(".living-collections");
  for (const [width, height] of screens) {
    await page.setViewportSize({ width, height });
    await gallery.scrollIntoViewIfNeeded();
    await expect(gallery).toHaveClass(/is-manual/);
    await expect(gallery.locator(".living-row")).toHaveCount(2);
    for (const row of await gallery.locator(".living-row").all()) {
      const card = row.locator(".collection-tile").first();
      await expect(card.locator("h3")).toBeVisible();
      await expect.poll(() => card.locator("img").evaluate((image: HTMLImageElement) => image.complete && image.naturalWidth > 0)).toBeTruthy();
      const layout = await card.evaluate(card => {
        const bounds = card.getBoundingClientRect();
        const image = card.querySelector(".collection-visual")!.getBoundingClientRect();
        const caption = card.querySelector(".collection-caption")!.getBoundingClientRect();
        return {
          width: bounds.width, imageWidth: image.width, imageHeight: image.height,
          captionFits: caption.top >= bounds.top && caption.bottom <= bounds.bottom + 1,
          overlap: image.bottom > caption.top + 1,
        };
      });
      expect(layout.imageWidth, String(width)).toBeCloseTo(layout.width, 0);
      expect(layout.imageHeight, String(width)).toBeGreaterThan(130);
      expect(layout.captionFits, String(width)).toBeTruthy();
      expect(layout.overlap, String(width)).toBeFalsy();
      if (width <= 600) expect(layout.width).toBeGreaterThan(width * .7);
    }
    expect(await gallery.evaluate(el => { const rect = el.getBoundingClientRect(); return rect.left >= 0 && rect.right <= innerWidth; }), String(width)).toBeTruthy();
    if (width === 390) await page.locator(".home-collections").screenshot({ path: "docs/living-collections-mobile.png" });
    if (width === 1440) await page.locator(".home-collections").screenshot({ path: "docs/living-collections-desktop-static.png" });
  }
});
