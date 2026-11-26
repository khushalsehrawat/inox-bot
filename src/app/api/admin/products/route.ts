import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { isSameOrigin } from "@/lib/request";
import { limitedBody, requireWebAdmin, taxonomyErrorResponse } from "@/lib/web-admin";
import { getAllWebProducts, withTaxonomy, invalidateWebCatalogue } from "@/lib/web-taxonomy";
import { websiteMediaExists } from "@/lib/website-media";
import { TaxonomyError } from "@/lib/web-taxonomy-store.mjs";
export const runtime = "nodejs";
const headers = { "Cache-Control": "no-store" };
export async function GET() {
  try {
    await requireWebAdmin();
    const drafts = await withTaxonomy(store => store.productDrafts());
    const categories = await withTaxonomy(store => store.list());
    return NextResponse.json({ drafts, categories, products: await getAllWebProducts(false, drafts) }, { headers });
  }
  catch (error) { return taxonomyErrorResponse(error); }
}
export async function POST(req: NextRequest) {
  try {
    if (!isSameOrigin(req)) throw new TaxonomyError(403, "Invalid request origin.");
    await requireWebAdmin();
    let body;
    try { body = JSON.parse(Buffer.from(await limitedBody(req, 64000)).toString()); }
    catch (error) { if (error instanceof TaxonomyError) throw error; throw new TaxonomyError(400, "Invalid product request."); }
    if (!body || typeof body !== "object" || body.operation !== "save") throw new TaxonomyError(422, "Choose a valid product operation.");
    const draft = body.product;
    const media = [...(Array.isArray(draft?.images) ? draft.images : []), ...(Array.isArray(draft?.variations) ? draft.variations.flatMap((v: { images?: string[] }) => Array.isArray(v?.images) ? v.images : []) : []), draft?.pdf].filter(value => typeof value === "string" && /^\/api\/web\/product-media\/[a-f0-9-]{36}\.(webp|pdf)$/.test(value));
    for (const url of media) {
      try { if (!await websiteMediaExists(url)) throw new Error("Missing file"); }
      catch { throw new TaxonomyError(422, "A product file is missing. Please upload it again."); }
    }
    const product = await withTaxonomy(store => store.saveProduct(draft));
    invalidateWebCatalogue();
    revalidatePath("/products"); revalidatePath(`/products/${product.id}`); revalidatePath("/sitemap.xml");
    return NextResponse.json({ product }, { headers });
  } catch (error) { return taxonomyErrorResponse(error); }
}
