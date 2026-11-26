import { test, expect } from "@playwright/test";
test("category CSV preview confirms valid parent/subcategory rows while skipping invalid rows", async ({
  page,
  baseURL,
}) => {
  await page.goto("/admin");
  await page.getByLabel("Email address").fill("admin@example.test");
  await page.getByLabel("Password", { exact: true }).fill("test-only");
  await page.getByRole("button", { name: "Sign in securely" }).click();
  await page.getByRole("button", { name: "Categories", exact: true }).click();
  await page
    .getByLabel("Choose category CSV")
    .setInputFiles({
      name: "categories.csv",
      mimeType: "text/csv",
      buffer: Buffer.from(
        "name,slug,parentSlug,description,published,sortOrder\nCSV Root,csv-root,,Imported root,true,20\nCSV Child,csv-child,csv-root,Imported child,true,1\n,invalid-row,,,false,2",
      ),
    });
  await expect(page.getByText(/2 valid \/ 1 invalid rows/)).toBeVisible();
  await page.getByRole("button", { name: "Confirm valid categories" }).click();
  await expect(
    page.getByText("Website categories saved.", { exact: false }),
  ).toBeVisible();
  const response = await page
    .context()
    .request.get("/api/admin/web-categories");
  const { categories } = await response.json();
  const root = categories.find((c: { slug: string }) => c.slug === "csv-root"),
    child = categories.find((c: { slug: string }) => c.slug === "csv-child");
  expect(child.parentId).toBe(root.id);
  expect(
    categories.some((c: { slug: string }) => c.slug === "invalid-row"),
  ).toBeFalsy();
  expect(
    (
      await page
        .context()
        .request.post("/api/admin/web-categories", {
          headers: { Origin: new URL(baseURL!).origin },
          data: {
            operation: "update",
            id: root.id,
            version: 0,
            category: root,
          },
        })
    ).status(),
  ).toBe(409);
});
