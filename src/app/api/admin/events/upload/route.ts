import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import sharp from "sharp";
import { isSameOrigin } from "@/lib/request";
import { requireWebAdmin, limitedBody, taxonomyErrorResponse } from "@/lib/web-admin";
import { saveWebsiteMedia } from "@/lib/website-media";
import { TaxonomyError } from "@/lib/web-taxonomy-store.mjs";
export const runtime = "nodejs";
export async function POST(request: NextRequest) {
  try {
    if (!isSameOrigin(request)) throw new TaxonomyError(403, "Invalid request origin.");
    await requireWebAdmin();
    if (!["image/jpeg", "image/png", "image/webp"].includes(request.headers.get("content-type") || "")) throw new TaxonomyError(415, "Choose JPEG, PNG or WebP.");
    const bytes = Buffer.from(await limitedBody(request, 25 * 1024 * 1024));
    let output;
    try {
      const image = sharp(bytes, { limitInputPixels: 60000000 });
      const metadata = await image.metadata();
      if (!["jpeg", "png", "webp"].includes(metadata.format || "") || (metadata.pages ?? 1) !== 1) throw new Error("Invalid photo");
      output = await image.rotate().resize({ width: 1800, height: 1800, fit: "inside", withoutEnlargement: true }).webp({ quality: 85 }).toBuffer();
    } catch { throw new TaxonomyError(422, "Choose a valid still photo up to 25 MB and 60 megapixels."); }
    const url = `/api/web/product-media/${randomUUID()}.webp`;
    await saveWebsiteMedia(url, output, "image/webp");
    return NextResponse.json({url}, {status:201, headers:{"Cache-Control":"no-store"}});
  } catch (error) { return taxonomyErrorResponse(error); }
}
