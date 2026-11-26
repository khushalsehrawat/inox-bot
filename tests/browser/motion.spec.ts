import { test, expect } from "@playwright/test";

test("desktop hero settles, new imagery loads, dropdown responds and gallery transitions", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/");
  // Explicitly sample after the art-directed 1.3s entrance sequence.
  await page.waitForTimeout(1700);
  await expect(page.locator(".hero-link")).toHaveCSS("opacity", "1");
  expect(
    await page
      .locator(".mask-line > span")
      .first()
      .evaluate((el) =>
        Math.abs(new DOMMatrix(getComputedStyle(el).transform).m42),
      ),
  ).toBeLessThan(1);
  expect(
    await page
      .locator(".hero img")
      .evaluate((el: HTMLImageElement) => el.complete && el.naturalWidth > 0),
  ).toBeTruthy();
  expect(
    await page
      .locator("img")
      .evaluateAll((els) =>
        els.every((el) =>
          /editorial|events|category-images/.test(el.getAttribute("src") || ""),
        ),
      ),
  ).toBeTruthy();
  await page
    .getByRole("button", { name: "Explore product collections" })
    .click();
  await expect(page.locator("#collection-dropdown")).toBeVisible();
  await page
    .locator("#collection-dropdown")
    .getByRole("link", { name: "Wardrobe Fittings" })
    .click();
  await expect(page).toHaveURL(/category=wardrobe/);
  await expect(
    page.getByText("The finer details are on their way."),
  ).toBeVisible();
  await page.goto("/products/pull-out-waste-bin-40-litre");
  await page.getByRole("button", { name: "Show detail crop" }).click();
  await expect(
    page.getByRole("button", { name: "Show detail crop" }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator(".gallery-view")).toHaveCount(1);
  const specifications = page.getByRole("button", {
    name: "Technical specifications",
  });
  await specifications.click();
  await expect(specifications).toHaveAttribute("aria-expanded", "false");
  await expect(page.locator("#product-specifications")).toHaveCSS(
    "height",
    "0px",
  );
  await specifications.click();
  await expect(page.locator("#product-specifications")).toHaveAttribute(
    "aria-hidden",
    "false",
  );
  await page.goto("/");
  await page.waitForTimeout(1700);
  await page.screenshot({ path: "docs/motion-desktop.png", fullPage: true });
});

test("mobile menu closes with Escape and gallery remains usable", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.getByRole("button", { name: "Open navigation" }).click();
  await page.locator(".mobile-navigation a").first().focus();
  await page.keyboard.press("Escape");
  await expect(page.locator(".mobile-navigation")).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Open navigation" }),
  ).toBeFocused();
  await page.waitForTimeout(1700);
  await expect(page.locator(".parallax-image")).toHaveCount(0);
  await page.screenshot({ path: "docs/motion-mobile.png", fullPage: true });
});

test("reduced motion skips cinematic transforms and preserves all controls", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await expect(page.locator(".mask-line > span").first()).toHaveCSS(
    "transform",
    "none",
  );
  await expect(page.locator(".hero-link")).toHaveCSS("opacity", "1");
  await expect(page.locator(".parallax-image")).toHaveCount(0);
  expect(
    await page.evaluate(
      () =>
        document.getAnimations().filter((a) => a.playState === "running")
          .length,
    ),
  ).toBe(0);
  await page.goto("/products/pull-out-waste-bin-40-litre");
  await page.getByRole("button", { name: "Show detail crop" }).click();
  await expect(
    page.getByRole("button", { name: "Show detail crop" }),
  ).toHaveAttribute("aria-pressed", "true");
});

test("editorial headline and product information remain readable without JavaScript", async ({
  browser,
}) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto("http://127.0.0.1:3000/");
  await expect(page.locator(".mask-line > span").first()).toBeVisible();
  await expect(page.locator(".hero-link")).toHaveCSS("opacity", "1");
  await page.goto("http://127.0.0.1:3000/products/pull-out-waste-bin-40-litre");
  await expect(page.locator("h1")).toContainText("Pull Out Waste Bin");
  await expect(page.locator("#product-specifications")).toContainText(
    "Door Mounted",
  );
  await context.close();
});
