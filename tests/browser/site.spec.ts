import { test, expect } from "@playwright/test";
test("public routes fit desktop and mobile viewports", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 900 });
    for (const path of [
      "/",
      "/products",
      "/products/pull-out-waste-bin-40-litre",
      "/catalogues",
      "/about",
      "/contact",
      "/enquiry",
      "/admin",
    ]) {
      await page.goto(path);
      await expect(page.locator("h1,h2").first()).toBeVisible();
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth + 1,
        ),
        `${width}px ${path}`,
      ).toBeTruthy();
    }
  }
  expect(errors).toEqual([]);
  await page.goto("/");
  await page.waitForTimeout(1700);
  await page.screenshot({ path: "docs/home-mobile.png", fullPage: true });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.waitForTimeout(1700);
  await page.screenshot({ path: "docs/home-desktop.png", fullPage: true });
});
test("filter, modal, persistent basket and quantities work", async ({
  page,
}) => {
  await page.goto("/products");
  await page.getByRole("button", { name: "Quick preview" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await page.getByRole("button", { name: "Add to enquiry" }).click();
  await page.goto("/enquiry");
  await expect(page.getByRole("spinbutton")).toHaveValue("1");
  await page.getByRole("spinbutton").fill("4");
  await page.reload();
  await expect(page.getByRole("spinbutton")).toHaveValue("4");
  await page.goto("/products");
  await page
    .getByRole("textbox", { name: "Search products by name or SKU" })
    .fill("does-not-exist");
  await expect(page.getByText("No matching products.")).toBeVisible();
});
test("mobile navigation and admin sign-in layout work", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.getByRole("button", { name: "Open navigation" }).click();
  await page
    .getByRole("navigation", { name: "Main navigation" })
    .getByRole("link", { name: "About", exact: true })
    .click();
  await expect(page).toHaveURL(/about/);
  await page.goto("/admin");
  await expect(
    page.getByRole("button", { name: /Open local draft workspace/ }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Sign in securely" }),
  ).toBeVisible();
  await expect(page.getByLabel("Email address")).toBeVisible();
  await page.screenshot({ path: "docs/admin-mobile.png", fullPage: true });
});
test("API rejects unauthorized requests and never fakes enquiry success", async ({
  request,
}) => {
  const headers = { Origin: "http://127.0.0.1:3000" };
  expect((await request.get("/api/admin/session")).status()).toBe(401);
  expect(
    (
      await request.post("/api/admin/session", {
        headers: { Origin: "https://example.com" },
        data: {},
      })
    ).status(),
  ).toBe(403);
  expect(
    (
      await request.post("/api/enquiries", { headers, data: { name: "A" } })
    ).status(),
  ).toBe(422);
  expect(
    (
      await request.post("/api/enquiries", {
        headers,
        data: {
          name: "Test User",
          email: "test@example.com",
          phone: "+91 9000000000",
          message: "Test only",
          consent: "on",
          items: [],
        },
      })
    ).status(),
  ).toBe(503);
  const pdf = await request.get("/media/collection.pdf");
  expect(pdf.ok()).toBeTruthy();
  expect((await pdf.body()).subarray(0, 5).toString()).toBe("%PDF-");
});
