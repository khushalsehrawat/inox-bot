import { NextRequest, NextResponse } from "next/server";
import { requireWebAdmin, limitedBody, taxonomyErrorResponse } from "@/lib/web-admin";
import { getHomeImages, saveHomeImage } from "@/lib/home-image-store";
import { isSameOrigin } from "@/lib/request";
import { TaxonomyError } from "@/lib/web-taxonomy-store.mjs";
export const runtime = "nodejs";
export async function GET() {
  try {
    await requireWebAdmin();
    return NextResponse.json({ images: await getHomeImages() }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return taxonomyErrorResponse(error); }
}
export async function POST(request: NextRequest) {
  try {
    if (!isSameOrigin(request)) throw new TaxonomyError(403, "Invalid request origin.");
    await requireWebAdmin();
    let input;
    try { input = JSON.parse(Buffer.from(await limitedBody(request, 4096)).toString()); }
    catch (error) { if (error instanceof TaxonomyError) throw error; throw new TaxonomyError(400, "Invalid image details."); }
    if (!input || typeof input !== "object") throw new TaxonomyError(400, "Invalid image details.");
    return NextResponse.json({ image: await saveHomeImage(input) }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return taxonomyErrorResponse(error); }
}
