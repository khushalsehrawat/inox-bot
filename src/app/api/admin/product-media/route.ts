import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import sharp from "sharp";
import { isSameOrigin } from "@/lib/request";
import { requireWebAdmin, limitedBody, taxonomyErrorResponse } from "@/lib/web-admin";
import { readWebsiteMedia, saveWebsiteMedia } from "@/lib/website-media";
import { TaxonomyError } from "@/lib/web-taxonomy-store.mjs";
export const runtime = "nodejs";
export async function GET(req: NextRequest) {
  try {
    await requireWebAdmin();
    const filename = req.nextUrl.searchParams.get("filename") || "";
    if (!/^[a-f0-9-]{36}\.(webp|pdf)$/.test(filename)) throw new TaxonomyError(404, "File not found.");
    let bytes;
    try { bytes = await readWebsiteMedia(`/api/web/product-media/${filename}`); }
    catch { throw new TaxonomyError(404, "File not found."); }
    return new Response(new Uint8Array(bytes), { headers: { "Content-Type": filename.endsWith(".pdf") ? "application/pdf" : "image/webp", "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff", ...(filename.endsWith(".pdf") ? { "Content-Disposition": 'attachment; filename="product-datasheet.pdf"' } : {}) } });
  } catch (error) { return taxonomyErrorResponse(error); }
}
export async function POST(req: NextRequest) {
  try {
    if (!isSameOrigin(req)) throw new TaxonomyError(403, "Invalid request origin.");
    await requireWebAdmin();
    const type = req.headers.get("content-type");
    if (!["image/png", "image/jpeg", "image/webp", "application/pdf"].includes(type || "")) throw new TaxonomyError(415, "Choose JPEG, PNG, WebP or PDF.");
    const bytes = Buffer.from(await limitedBody(req, type === "application/pdf" ? 10 * 1024 * 1024 : 8 * 1024 * 1024));
    let output: Buffer, extension: string;
    if (type === "application/pdf") {
      if (bytes.subarray(0, 5).toString() !== "%PDF-" || !bytes.subarray(-2048).includes(Buffer.from("%%EOF"))) throw new TaxonomyError(422, "Choose a valid PDF document.");
      output = bytes; extension = "pdf";
    } else {
      try {
        const image = sharp(bytes, { limitInputPixels: 20000000 });
        const info = await image.metadata();
        if (!["png", "jpeg", "webp"].includes(info.format || "")) throw new Error("Invalid image");
        output = await image.rotate().resize({ width: 1800, withoutEnlargement: true }).webp({ quality: 88 }).toBuffer(); extension = "webp";
      } catch { throw new TaxonomyError(422, "Choose a valid product image up to 8 MB and 20 megapixels."); }
    }
    const filename = `${randomUUID()}.${extension}`;
    await saveWebsiteMedia(`/api/web/product-media/${filename}`,output,extension === "pdf" ? "application/pdf" : "image/webp");
    return NextResponse.json({ url: `/api/web/product-media/${filename}` }, { headers: { "Cache-Control": "no-store" }, status: 201 });
  } catch (error) { return taxonomyErrorResponse(error); }
}
