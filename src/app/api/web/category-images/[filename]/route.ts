import { categoryMedia } from "@/lib/web-category-media";
export const runtime = "nodejs";
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ filename: string }> },
) {
  return categoryMedia((await params).filename);
}
