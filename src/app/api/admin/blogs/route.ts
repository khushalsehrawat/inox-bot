import { NextRequest, NextResponse } from "next/server";
import { requireWebAdmin, limitedBody, taxonomyErrorResponse } from "@/lib/web-admin";
import { getBlogPosts, saveBlogPost, deleteBlogPost } from "@/lib/blog-store";
import { isSameOrigin } from "@/lib/request";
import { TaxonomyError } from "@/lib/web-taxonomy-store.mjs";
export const runtime = "nodejs";
export async function GET() {
  try {
    await requireWebAdmin();
    return NextResponse.json({ posts: await getBlogPosts(false) }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return taxonomyErrorResponse(error); }
}
export async function POST(request: NextRequest) {
  try {
    if (!isSameOrigin(request)) throw new TaxonomyError(403, "Invalid request origin.");
    await requireWebAdmin();
    let input;
    try { input = JSON.parse(Buffer.from(await limitedBody(request, 2 * 1024 * 1024)).toString()); }
    catch (error) { if (error instanceof TaxonomyError) throw error; throw new TaxonomyError(400, "Invalid blog details."); }
    return NextResponse.json({ post: await saveBlogPost(input) }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return taxonomyErrorResponse(error); }
}
export async function DELETE(request: NextRequest) {
  try {
    if (!isSameOrigin(request)) throw new TaxonomyError(403, "Invalid request origin.");
    await requireWebAdmin();
    let input;
    try { input = JSON.parse(Buffer.from(await limitedBody(request, 4096)).toString()); }
    catch (error) { if (error instanceof TaxonomyError) throw error; throw new TaxonomyError(400, "Invalid blog details."); }
    await deleteBlogPost(input);
    return NextResponse.json({ message: "Blog deleted." }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return taxonomyErrorResponse(error); }
}
