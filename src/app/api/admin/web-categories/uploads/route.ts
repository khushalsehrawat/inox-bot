import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import sharp from "sharp";
import {
  requireWebAdmin,
  limitedBody,
  taxonomyErrorResponse,
} from "@/lib/web-admin";
import { isSameOrigin } from "@/lib/request";
import { saveWebsiteMedia } from "@/lib/website-media";
import { TaxonomyError } from "@/lib/web-taxonomy-store.mjs";
export const runtime = "nodejs";
export async function POST(req: NextRequest) {
  try {
    if (!isSameOrigin(req))
      throw new TaxonomyError(403, "Invalid request origin.");
    await requireWebAdmin();
    if (
      !["image/jpeg", "image/png", "image/webp"].includes(
        req.headers.get("content-type") || "",
      )
    )
      throw new TaxonomyError(415, "Choose JPEG, PNG or WebP.");
    const bytes = await limitedBody(req, 8 * 1024 * 1024);
    let output;
    try {
      const image = sharp(bytes, { limitInputPixels: 20000000 });
      const metadata = await image.metadata();
      if (!["jpeg", "png", "webp"].includes(metadata.format || ""))
        throw new Error("Invalid image");
      output = await image
        .rotate()
        .resize({ width: 1400, withoutEnlargement: true })
        .webp({ quality: 86 })
        .toBuffer();
    } catch {
      throw new TaxonomyError(
        422,
        "Choose a valid JPEG, PNG or WebP image up to 8 MB and 20 megapixels.",
      );
    }
    const filename = `${randomUUID()}.webp`;
    await saveWebsiteMedia(`/api/web/category-images/${filename}`,output,"image/webp");
    return NextResponse.json(
      { url: `/api/web/category-images/${filename}` },
      { status: 201, headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return taxonomyErrorResponse(error);
  }
}
