import { expect, test, type Page } from "@playwright/test";

const position = (page: Page, row = 0) => page.locator(".living-track").nth(row).evaluate(el => new DOMMatrix(getComputedStyle(el).transform).m41);
async function gallery(page: Page, width = 1440) {
  await page.setViewportSize({ width, height: 1000 });
  await page.goto("/");
  await page.locator(".living-collections").scrollIntoViewIfNeeded();
  await page.mouse.move(0, 0);
}

test("rows move independently in opposite directions, decelerate and resume", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await gallery(page);
  await expect(page.locator(".living-collections")).toHaveClass(/is-automatic/);
  const start = [await position(page), await position(page, 1)];
  await page.waitForTimeout(500);
  expect(start[0] - await position(page)).toBeGreaterThan(4);
  expect(await position(page, 1) - start[1]).toBeGreaterThan(3);
  const row = page.locator(".living-row").first();
  const bounds = (await row.boundingBox())!;
  await page.mouse.move(bounds.x + 100, bounds.y + 80);
  await expect(page.locator(".living-collections")).toHaveClass(/is-examining/);
  await page.waitForTimeout(1500);
  const stopped = await position(page);
  await page.waitForTimeout(250);
  expect(Math.abs(await position(page) - stopped)).toBeLessThan(.1);
  await page.mouse.move(0, 0);
  await page.waitForTimeout(500);
  expect(stopped - await position(page)).toBeGreaterThan(4);
  await page.getByRole("button", { name: "Pause collection slideshow", exact: true }).click();
  await page.waitForTimeout(1500);
  const paused = await position(page);
  await page.waitForTimeout(250);
  expect(Math.abs(await position(page) - paused)).toBeLessThan(.1);
  await page.getByRole("button", { name: "Resume collection slideshow", exact: true }).click();
  await page.waitForTimeout(500);
  expect(paused - await position(page)).toBeGreaterThan(4);
});

test("loop groups match, fill the viewport, and expose no duplicate tab stops", async ({ page }) => {
  await gallery(page);
  await expect(page.locator(".living-collections")).toHaveClass(/is-automatic/);
  for (const width of [1440, 1024, 1920]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.waitForTimeout(100);
    const result = await page.locator(".living-row").evaluateAll(rows => rows.map(row => {
      const groups = [...row.querySelectorAll<HTMLElement>(".living-group")];
      const widths = groups.map(group => group.getBoundingClientRect().width);
      const transform = new DOMMatrix(getComputedStyle(row.querySelector(".living-track")!).transform).m41;
      const rowBounds = row.getBoundingClientRect();
      const first = groups[0].getBoundingClientRect(), last = groups[2].getBoundingClientRect();
      return {
        sameWidth: Math.max(...widths) - Math.min(...widths) < 1,
        wideEnough: widths[0] >= row.clientWidth,
        covered: first.left <= rowBounds.left + 1 && last.right >= rowBounds.right - 1,
        clones: groups.slice(1).every(group => group.getAttribute("aria-hidden") === "true" && [...group.querySelectorAll("a")].every(a => a.tabIndex === -1)),
        transform: Number.isFinite(transform),
        duplicates: row.querySelectorAll('a:not([tabindex="-1"])').length === new Set([...row.querySelectorAll('a:not([tabindex="-1"])')].map(a => a.getAttribute("href"))).size,
      };
    }));
    result.forEach(row => { expect(row.sameWidth && row.wideEnough && row.covered && row.clones && row.transform && row.duplicates, JSON.stringify({ width, ...row })).toBeTruthy(); });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
  }
});

test("keyboard selection navigates directly to the category without a preview", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  await gallery(page);
  const link = page.locator('.living-group:not([aria-hidden]) a:not([tabindex="-1"])').first();
  await link.focus();
  await expect(page.locator(".living-collections")).toHaveClass(/is-manual/);
  const href = await link.getAttribute("href");
  await expect(link).not.toHaveAttribute("aria-haspopup");
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(new RegExp(href!.replace("?", "\\?")));
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect(errors).toEqual([]);
});

test("touch browsing is manual, swipe does not navigate, and taps open the category", async ({ browser, baseURL }) => {
  const context = await browser.newContext({ baseURL, viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const page = await context.newPage();
  await page.goto("/");
  const slider = page.locator(".living-collections");
  await slider.scrollIntoViewIfNeeded();
  await expect(slider).toHaveClass(/is-manual/);
  await expect(slider.getByRole("button", { name: "Pause collection slideshow" })).toHaveCount(0);
  const row = slider.locator(".living-row").first();
  const bounds = (await row.boundingBox())!;
  const touch = await context.newCDPSession(page);
  await touch.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: 290, y: bounds.y + 70 }] });
  for (let x = 260; x >= 80; x -= 30) {
    await touch.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x, y: bounds.y + 70 }] });
    await page.waitForTimeout(16);
  }
  await touch.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await expect.poll(() => row.evaluate(el => el.scrollLeft)).toBeGreaterThan(40);
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await row.dispatchEvent("pointerdown", { pointerType: "touch", clientX: 250, clientY: 100, buttons: 1 });
  await row.dispatchEvent("pointermove", { pointerType: "touch", clientX: 70, clientY: 100, buttons: 1 });
  await row.locator("a").first().dispatchEvent("click", { detail: 1 });
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await slider.getByRole("button", { name: "Next collections" }).click();
  await expect.poll(() => row.evaluate(el => el.scrollLeft)).toBeGreaterThan(30);
  const card = row.locator('.living-group:not([aria-hidden]) a:not([tabindex="-1"])').nth(1);
  const href = await card.getAttribute("href");
  await card.tap();
  await expect(page).toHaveURL(new RegExp(href!.replace("?", "\\?")));
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.goBack();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page).toHaveURL(/\/$/);
  await context.close();
});

test("reduced motion has still rows and accessible manual navigation", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await gallery(page, 390);
  await expect(page.locator(".living-collections")).toHaveClass(/is-manual/);
  await expect(page.locator(".living-cursor")).not.toBeVisible();
  const start = await position(page);
  await page.waitForTimeout(250);
  expect(await position(page)).toBe(start);
  expect(await page.locator(".living-collections").evaluate(el => el.getAnimations({ subtree: true }).filter(animation => animation.playState === "running").length)).toBe(0);
  const row = page.locator(".living-row").first();
  await row.focus();
  await page.keyboard.press("ArrowRight");
  await expect.poll(() => row.evaluate(el => el.scrollLeft)).toBeGreaterThan(30);
  const card = row.locator('.living-group:not([aria-hidden]) a:not([tabindex="-1"])').nth(1);
  const href = await card.getAttribute("href");
  await card.focus();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(new RegExp(href!.replace("?", "\\?")));
  await expect(page.getByRole("dialog")).toHaveCount(0);
});

test("offscreen rows suspend and resize safely resumes motion", async ({ page }) => {
  await gallery(page);
  await page.waitForTimeout(300);
  await page.evaluate(() => scrollTo({ top: 0, behavior: "instant" }));
  await page.waitForTimeout(300);
  const stopped = await position(page);
  await page.waitForTimeout(300);
  expect(await position(page)).toBe(stopped);
  await page.locator(".living-collections").scrollIntoViewIfNeeded();
  await page.mouse.move(0, 0);
  await page.waitForTimeout(400);
  expect(await position(page)).not.toBe(stopped);
  await page.setViewportSize({ width: 768, height: 1000 });
  await expect(page.locator(".living-collections")).toHaveClass(/is-manual/);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await expect(page.locator(".living-collections")).toHaveClass(/is-automatic/);
});

test("collection links and titles remain available without JavaScript", async ({ browser, baseURL }) => {
  const context = await browser.newContext({ baseURL, javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto("/");
  const links = page.locator('.living-group:not([aria-hidden]) a:not([tabindex="-1"])');
  expect(await links.count()).toBeGreaterThan(0);
  await expect(links.first().locator("h3")).not.toBeEmpty();
  await expect(links.first()).toHaveAttribute("href", /^\/products\?category=/);
  await context.close();
});
