import { expect, test } from "@playwright/test";

test("architectural collections link to responsive detail pages and interactive layers", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator(".home-collections + .architectural-collections")).toBeVisible();
  await expect(page.getByRole("link", { name: "Discover Facade", exact: true })).toHaveAttribute("href", "/facade");
  await expect(page.getByRole("link", { name: "Discover Xcomb", exact: true })).toHaveAttribute("href", "/xcomb");
  for (const width of [320, 390, 600, 768, 820, 1000, 1024, 1280, 1440]) {
    await page.setViewportSize({ width, height: 844 });
    const menu = page.getByRole("button", { name: "Open navigation" });
    if (width <= 1000) {
      await menu.click();
      for (const label of ["Facade", "Xcomb"]) await expect(page.locator("#mobile-navigation").getByRole("link", { name: label, exact: true })).toBeVisible();
      await page.getByRole("button", { name: "Close navigation" }).click();
    } else {
      await expect(page.locator(".desktop-nav").getByRole("link", { name: "Facade", exact: true })).toBeVisible();
      expect(await page.locator(".header").evaluate(header => {
        const nav = header.querySelector(".desktop-nav")!.getBoundingClientRect();
        const actions = header.querySelector(".header-actions")!.getBoundingClientRect();
        return nav.right <= actions.left;
      })).toBeTruthy();
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
  }
  for (const route of ["facade", "xcomb"]) {
    await page.goto(`/${route}`);
    for (const width of [320, 390, 768, 820, 1024, 1440]) {
      await page.setViewportSize({ width, height: 844 });
      await expect(page.locator("h1")).toContainText(route === "facade" ? "Facade" : "Xcomb");
      await expect.poll(() => page.locator(".material-hero-art img").evaluate((image: HTMLImageElement) => image.complete && image.naturalWidth > 0)).toBeTruthy();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
    }
  }
  const expand = page.getByRole("button", { name: "Explore the layers" });
  await expand.click();
  await expect(page.getByRole("button", { name: "Bring the layers together" })).toHaveAttribute("aria-expanded", "true");
  await page.getByRole("button", { name: "Bring the layers together" }).click();
  await expect(expand).toHaveAttribute("aria-expanded", "false");
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/facade");
  await expect.poll(() => page.locator(".facade-fins i").first().evaluate(element => getComputedStyle(element).animationName)).toBe("none");
});
