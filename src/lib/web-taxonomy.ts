import "server-only";
import { cache } from "react";
import { unstable_cache, revalidateTag, revalidatePath } from "next/cache";
import { mysqlStore, type AsyncStore } from "./web-mysql-store.mjs";
import { publicVariation } from "./variations.mjs";
import { join, isAbsolute, resolve, relative } from "node:path";
import { categories, products, type Product } from "./data";
import { openTaxonomy } from "./web-taxonomy-store.mjs";
import type { WebCategory } from "./web-taxonomy-model";
import { catalogueDriver } from "./catalogue-driver.mjs";
import { productContent } from "./product-content.mjs";

export function webDataDirectory() {
  const configured = process.env.WEB_CATALOGUE_DATA_DIR;
  if (process.env.NODE_ENV === "production" && !configured)
    throw new Error(
      "Set WEB_CATALOGUE_DATA_DIR to persistent storage before managing website categories.",
    );
  if (configured && !isAbsolute(configured))
    throw new Error("WEB_CATALOGUE_DATA_DIR must be an absolute directory.");
  if (configured && process.env.NODE_ENV === "production") {
    const location=relative(resolve(process.cwd()),resolve(configured));
    if (!location || (!location.startsWith("..") && !isAbsolute(location))) throw new Error("Persistent media must live outside the deployment directory.");
  }
  return configured || join(process.cwd(), "data", "web-catalogue");
}
export function usesMysql() { return catalogueDriver() === "mysql"; }
export async function withTaxonomy<T>(work: (store: AsyncStore) => T | Promise<T>): Promise<T> {
  if (usesMysql()) return await work(mysqlStore());
  if (process.env.NODE_ENV === "production") throw new Error("Production requires WEB_DATABASE_DRIVER=mysql.");
  const store = openTaxonomy(join(webDataDirectory(), "taxonomy.sqlite"), categories, []);
  const asyncStore = Object.fromEntries(Object.entries(store).map(([key,fn]) => [key, async (...args: unknown[]) => (fn as (...args: unknown[]) => unknown)(...args)])) as AsyncStore;
  try { return await work(asyncStore); } finally { store.close(); }
}
const catalogueTag = "website-catalogue";
export function invalidateWebCatalogue() {
  revalidateTag(catalogueTag, { expire: 0 });
  revalidatePath("/", "layout");
}
export const getPublicWebCategories = cache(unstable_cache(
  async (): Promise<WebCategory[]> => withTaxonomy((store) => store.list(true)),
  ["public-web-categories"], { tags: [catalogueTag], revalidate: 60 },
));
export async function getAllWebProducts(
  publicOnly = false,
  loadedDrafts?: Awaited<ReturnType<AsyncStore["productDrafts"]>>,
): Promise<Product[]> {
  return withTaxonomy(async (store) => {
    const [visible, assignments, drafts] = await Promise.all([
      store.list(true), store.assignments(), loadedDrafts ?? store.productDrafts(),
    ]);
    const saved = drafts.filter(p => !publicOnly || p.webVisible).map(p => ({
      id: p.id, name: p.name, sku: p.sku, category: p.subcategory || p.category,
      variations: (p.variations || []).filter(v => !publicOnly || v.active).map(publicVariation), ...productContent(p), image: p.images[0] || null, images: p.images,
      finishes: p.finish.split(",").map(s => s.trim()).filter(Boolean), pdf: p.pdf || undefined,
      specifications: Object.fromEntries(p.specifications.replace(/^\uFEFF/, '').split(/\r\n|\n|\r/).filter(s => s.trim()).map((line) => {
        const split = line.indexOf(":");
        return split >= 0 ? [line.slice(0, split).trim(), line.slice(split + 1).trim()] : [line.trim(), ''];
      })),
    }));
    return saved
      .map((p) => ({ ...p, category: assignments[p.id] || p.category }))
      .filter((p) => !publicOnly || visible.some((c) => c.id === p.category));
  });
}
export const getWebProducts = cache(unstable_cache(
  () => getAllWebProducts(true),
  ["public-web-products"], { tags: [catalogueTag], revalidate: 60 },
));
