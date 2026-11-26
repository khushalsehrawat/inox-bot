import { NextResponse } from "next/server";
import { customerSession } from "@/lib/website-customers";
import { variationPrices } from "@/lib/website-pricing";
export async function GET() {
  const headers = { "Cache-Control": "private, no-store" };
  try {
    if (!await customerSession()) return NextResponse.json({ message: "Sign in to see prices." }, { status: 401, headers });
    const prices = await variationPrices(true);
    return NextResponse.json({ prices }, { headers });
  } catch { return NextResponse.json({ message: "Prices are temporarily unavailable." }, { status: 503, headers }); }
}
