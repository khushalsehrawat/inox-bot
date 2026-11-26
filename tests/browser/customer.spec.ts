import { test, expect } from "@playwright/test";

test("guests cannot fetch prices or customer records", async ({ request }) => {
  expect((await request.get("/api/customer/prices")).status()).toBe(401);
  expect((await request.get("/api/admin/website-customers")).status()).toBe(401);
  expect((await request.get("/api/admin/product-prices")).status()).toBe(401);
  expect((await request.post("/api/customer/login", { data: { email: "test@example.com", password: "test" }, headers: { Origin: "https://other.example" } })).status()).toBe(403);
});
test("customer forms and guest product details fit mobile", async ({ page }) => {
  const errors: string[] = []; page.on("pageerror", e => errors.push(e.message));
  await page.setViewportSize({ width: 390, height: 844 });
  for (const route of ["/login", "/signup", "/products", "/products/pull-out-waste-bin-40-litre"]) {
    await page.goto(route);
    await expect(page.locator("h1").first()).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBeTruthy();
  }
  await expect(page.getByRole("link", { name: "Sign in to view price" })).toBeVisible();
  await expect(page.getByText("ABS Bins with Metal Frame")).toBeVisible();
  expect(errors).toEqual([]);
});
test("signed-in customers see prices and can sign out", async ({ page }) => {
  let signedIn = true;
  await page.route("**/api/customer/session", route => route.fulfill({ json: { user: signedIn ? { id: "customer-test", email: "test@example.com", profile: { firstName: "Test" } } : null } }));
  await page.route("**/api/customer/prices", route => route.fulfill({ json: { prices: [{ product_id: "pull-out-waste-bin-40-litre", amount: 123450 }] } }));
  await page.route("**/api/customer/logout", route => { signedIn = false; return route.fulfill({ json: { success: true } }); });
  await page.goto("/products/pull-out-waste-bin-40-litre");
  await expect(page.locator(".product-price")).toContainText("1,234.50");
  await page.getByRole("link", { name: "My account" }).click();
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page.getByRole("heading", { name: "Welcome back." })).toBeVisible();
  await page.goto("/products/pull-out-waste-bin-40-litre");
  await expect(page.getByRole("link", { name: "Sign in to view price" })).toBeVisible();
});
test("website signup saves company and opens login without OTP", async ({ page }) => {
  await page.route("**/api/customer/session", route => route.fulfill({ json: { user: null } }));
  await page.route("**/api/customer/register", async route => {
    expect(route.request().postDataJSON()).toMatchObject({ firstName: "Website", lastName: "", companyName: "Example Company", email: "customer@example.com", consentAccepted: true });
    await route.fulfill({ status: 201, json: { message: "Account created. Please sign in." } });
  });
  await page.goto("/signup");
  await page.getByLabel("First name", { exact: true }).fill("Website");
  await page.getByLabel("Company name (optional)", { exact: true }).fill("Example Company");
  await page.getByLabel("Email address", { exact: true }).fill("customer@example.com");
  await page.getByLabel("Mobile number", { exact: true }).fill("9876543210");
  await page.getByLabel(/^Password/).fill("Customer123!");
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Create account", exact: true }).click();
  await expect(page).toHaveURL(/\/login\?registered=1$/);
  await expect(page.getByRole("heading", { name: "Welcome back." })).toBeVisible();
  await expect(page.getByRole("status")).toHaveText("Account created. Please sign in.");
  await expect(page.getByLabel("Verification code")).toHaveCount(0);
});
