import { NextRequest, NextResponse } from "next/server";
import { requireWebAdmin, limitedBody, taxonomyErrorResponse } from "@/lib/web-admin";
import { getEventAlbums, saveEventAlbum } from "@/lib/event-store";
import { isSameOrigin } from "@/lib/request";
import { TaxonomyError } from "@/lib/web-taxonomy-store.mjs";
export const runtime = "nodejs";
export async function GET() {
  try {
    await requireWebAdmin();
    return NextResponse.json({ albums: await getEventAlbums() }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return taxonomyErrorResponse(error); }
}
export async function POST(request: NextRequest) {
  try {
    if (!isSameOrigin(request)) throw new TaxonomyError(403, "Invalid request origin.");
    await requireWebAdmin();
    let input;
    try { input = JSON.parse(Buffer.from(await limitedBody(request, 256 * 1024)).toString()); }
    catch (error) { if (error instanceof TaxonomyError) throw error; throw new TaxonomyError(400, "Invalid event details."); }
    return NextResponse.json({ album: await saveEventAlbum(input) }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return taxonomyErrorResponse(error); }
}
