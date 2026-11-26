import { test, expect } from "@playwright/test";

test("authenticated web category management persists and drives public navigation and product filters", async ({
  page,
  request,
  baseURL,
}) => {
  const origin = new URL(baseURL!).origin;
  expect((await request.get("/api/admin/web-categories")).status()).toBe(401);
  expect(
    (
      await request.post("/api/admin/web-categories", {
        headers: { Origin: "https://untrusted.example" },
        data: { operation: "create" },
      })
    ).status(),
  ).toBe(403);
  await page.goto("/admin");
  await page.getByLabel("Email address").fill("admin@example.test");
  await page.getByLabel("Password", { exact: true }).fill("test-only");
  await page.getByRole("button", { name: "Sign in securely" }).click();
  await page.getByRole("button", { name: "Categories", exact: true }).click();
  await expect(
    page.getByText("Live website categories.", { exact: false }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Add category", exact: true }).click();
  await page.getByLabel("Category name").fill("Web Test Collection");
  await page.getByLabel("Published on the website").check();
  await page
    .getByLabel("Upload category image")
    .setInputFiles("public/media/editorial/editorial-hardware.webp");
  await expect(page.getByLabel("Collection image (optional)")).toHaveValue(
    /\/api\/web\/category-images\//,
  );
  await page
    .getByRole("button", { name: "Save website category", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page
    .getByRole("button", { name: "Add subcategory", exact: true })
    .click();
  await page.getByLabel("Category name").fill("Web Test Hinges");
  await page
    .getByLabel("Parent category")
    .selectOption({ label: "Web Test Collection" });
  await page.getByLabel("Published on the website").check();
  await page
    .getByRole("button", { name: "Save website category", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  const browserRequest = page.context().request;
  let managed = await (
    await browserRequest.get("/api/admin/web-categories")
  ).json();
  const root = managed.categories.find(
      (c: { slug: string }) => c.slug === "web-test-collection",
    ),
    child = managed.categories.find(
      (c: { slug: string }) => c.slug === "web-test-hinges",
    );
  expect(root).toBeTruthy();
  expect(child.parentId).toBe(root.id);
  const response = await browserRequest.post("/api/admin/web-categories", {
    headers: { Origin: origin },
    data: {
      operation: "assign",
      productId: "pull-out-waste-bin-40-litre",
      categoryId: child.id,
    },
  });
  expect(response.ok()).toBeTruthy();
  expect(
    (
      await browserRequest.post("/api/admin/web-categories", {
        headers: { Origin: origin },
        data: {
          operation: "delete",
          id: child.id,
          version: child.version + 1,
          confirmed: true,
        },
      })
    ).status(),
  ).toBe(409);
  await page.goto(`/products?category=${root.id}`);
  await expect(
    page
      .getByRole("link", { name: "Pull Out Waste Bin", exact: false })
      .first(),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Web Test Hinges", exact: true })
    .click();
  await expect(
    page
      .getByRole("link", { name: "Pull Out Waste Bin", exact: false })
      .first(),
  ).toBeVisible();
  await page.goto("/");
  await expect(
    page
      .locator(".category-strip")
      .getByText("Web Test Collection", { exact: true }),
  ).toBeVisible();
  const image = await browserRequest.get(root.image);
  expect(image.ok()).toBeTruthy();
  expect(image.headers()["content-type"]).toBe("image/webp");
  await browserRequest.post("/api/admin/web-categories", {
    headers: { Origin: origin },
    data: {
      operation: "update",
      id: root.id,
      version: root.version,
      category: { ...root, published: false },
    },
  });
  const publicTree = await (await request.get("/api/web/categories")).json();
  expect(
    publicTree.categories.some((c: { id: string }) => c.id === child.id),
  ).toBeFalsy();
  expect((await request.get(root.image)).status()).toBe(404);
  expect(
    (await request.get("/products/pull-out-waste-bin-40-litre")).status(),
  ).toBe(404);
  expect(await (await request.get("/sitemap.xml")).text()).not.toContain(
    "pull-out-waste-bin-40-litre",
  );
  await page.goto("/admin");
  await page.getByRole("button", { name: "Categories", exact: true }).click();
  await expect(
    page.getByText("Web Test Collection", { exact: true }).first(),
  ).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBeTruthy();
  await page.screenshot({
    path: "docs/web-categories-admin-mobile.png",
    fullPage: true,
  });
});

test("admin login requires sign-in and has no local workspace entry", async ({
  page,
  request,
}) => {
  await page.goto("/admin");
  await expect(
    page.getByRole("button", { name: /Open local draft workspace/ }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Sign in securely" }),
  ).toBeVisible();
  expect((await request.get("/api/admin/web-categories")).status()).toBe(401);
});

test("admin creates a subcategory inside a subcategory on desktop and mobile", async ({
  page,
}) => {
  await page.goto("/admin");
  await page.getByLabel("Email address").fill("admin@example.test");
  await page.getByLabel("Password", { exact: true }).fill("test-only");
  await page.getByRole("button", { name: "Sign in securely" }).click();
  await page.getByRole("button", { name: "Categories", exact: true }).click();
  for (const [name, parent] of [
    ["Nested Collection", ""],
    ["Nested Branch", "Nested Collection"],
    ["Nested Leaf", "Nested Collection / Nested Branch"],
  ]) {
    await page
      .getByRole("button", { name: "Add category", exact: true })
      .click();
    await page.getByLabel("Category name").fill(name);
    if (parent)
      await page.getByLabel("Parent category").selectOption({ label: parent });
    await page.getByLabel("Published on the website").check();
    await page
      .getByRole("button", { name: "Save website category", exact: true })
      .click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
  }
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 900 });
    await expect(
      page.getByRole("cell", { name: /Nested Leaf/ }).first(),
    ).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBeTruthy();
  }
  const categories = await (
    await page.request.get("/api/web/categories")
  ).json();
  const list = Array.isArray(categories) ? categories : categories.categories;
  const leaf = list.find((c: { slug: string }) => c.slug === "nested-leaf");
  const branch = list.find((c: { slug: string }) => c.slug === "nested-branch");
  expect(leaf.parentId).toBe(branch.id);
});
