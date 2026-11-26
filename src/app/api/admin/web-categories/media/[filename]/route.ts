import { categoryMedia } from "@/lib/web-category-media";
import { requireWebAdmin, taxonomyErrorResponse } from "@/lib/web-admin";
export const runtime = "nodejs";
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ filename: string }> },
) {
  try {
    await requireWebAdmin();
    return categoryMedia((await params).filename, true);
  } catch (error) {
    return taxonomyErrorResponse(error);
  }
}
