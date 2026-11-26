import { NextRequest, NextResponse } from "next/server";
import { customerSession } from "@/lib/website-customers";
import { customerEnquiries } from "@/lib/website-enquiries";
const headers = { "Cache-Control": "private, no-store" };
export async function GET(req: NextRequest) {
  try {
    const customer = await customerSession();
    if (!customer) return NextResponse.json({ message: "Sign in to see your enquiries." }, { status: 401, headers });
    const page = Number(req.nextUrl.searchParams.get("page") || 1);
    if (!Number.isSafeInteger(page) || page < 1 || page > 100000) return NextResponse.json({ message: "Invalid page." }, { status: 400, headers });
    return NextResponse.json(await customerEnquiries(customer.id, page), { headers });
  } catch {
    return NextResponse.json({ message: "Your saved enquiries are temporarily unavailable. Please try again." }, { status: 503, headers });
  }
}
