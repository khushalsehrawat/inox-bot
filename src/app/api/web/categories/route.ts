import { NextResponse } from "next/server";
import { getPublicWebCategories } from "@/lib/web-taxonomy";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET() {
  try {
    return NextResponse.json(
      { categories: await getPublicWebCategories() },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return NextResponse.json(
      { message: "Website categories are temporarily unavailable." },
      { status: 503 },
    );
  }
}
