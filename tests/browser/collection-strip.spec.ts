import { test, expect } from "@playwright/test";

test("collections move continuously with a seamless loop and working pause control", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto("/");
  const strip = page.locator(".collection-ticker");
  const track = strip.locator(".collection-ticker-track");
  for (const width of [390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await strip.scrollIntoViewIfNeeded();
    await expect.poll(() => track.evaluate(element => element.getAnimations().length)).toBeGreaterThan(0);
    await strip.hover();
    await expect.poll(() => track.evaluate(element => getComputedStyle(element).animationPlayState)).toBe("running");
    const geometry = await strip.evaluate(element => {
      const viewport = element.querySelector(".collection-ticker-viewport")!;
      const groups = [...element.querySelectorAll(".collection-ticker-group")];
      const labelsFit = [...element.querySelectorAll(".collection-ticker-sequence > a")].every(link => {
        const image = link.querySelector(".picture")!.getBoundingClientRect();
        const label = link.querySelector("span")!.getBoundingClientRect();
        const arrow = link.querySelector("svg")!.getBoundingClientRect();
        return image.right <= label.left && label.right <= arrow.left;
      });
      return { widths: groups.map(group => group.getBoundingClientRect().width), viewport: viewport.clientWidth, labelsFit, overflow: document.documentElement.scrollWidth > innerWidth };
    });
    expect(geometry.widths[0]).toBeCloseTo(geometry.widths[1], 2);
    expect(geometry.widths[0]).toBeGreaterThanOrEqual(geometry.viewport);
    expect(geometry.labelsFit).toBeTruthy();
    expect(geometry.overflow).toBeFalsy();
  }
  await page.getByRole("button", { name: "Pause collection movement" }).click();
  await expect.poll(() => track.evaluate(element => getComputedStyle(element).animationPlayState)).toBe("paused");
  await page.getByRole("button", { name: "Resume collection movement" }).click();
  await expect.poll(() => track.evaluate(element => getComputedStyle(element).animationPlayState)).toBe("running");
  const resetDelta = await track.evaluate(element => {
    const animation = element.getAnimations()[0];
    const duration = Number(animation.effect!.getTiming().duration);
    animation.currentTime = duration - 1;
    const before = element.children[1].getBoundingClientRect().x;
    animation.currentTime = duration + 1;
    const after = element.children[0].getBoundingClientRect().x;
    return Math.abs(after - before);
  });
  expect(resetDelta).toBeLessThan(1);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect.poll(() => track.evaluate(element => getComputedStyle(element).animationName)).toBe("none");
  await expect(page.getByRole("button", { name: "Pause collection movement" })).toBeHidden();
});
