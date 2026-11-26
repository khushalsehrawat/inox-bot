import { NextRequest, NextResponse } from "next/server";
import { customerSession } from "@/lib/website-customers";
import { AccountError, accountInput, customerCookie, customerLifetime, limitAccount, registerAccount, loginAccount, logoutAccount } from "@/lib/website-account-auth";
import { isSameOrigin } from "@/lib/request";
import { limitedBody } from "@/lib/web-admin";
import { cookies } from "next/headers";
const headers = { "Cache-Control": "private, no-store" };
export async function GET(_req: NextRequest, { params }: { params: Promise<{ action: string }> }) {
  if ((await params).action !== "session") return NextResponse.json({}, { status: 404 });
  try { return NextResponse.json({ user: await customerSession() }, { headers }); }
  catch { return NextResponse.json({ message: "Unable to check your session." }, { status: 503, headers }); }
}
export async function POST(req: NextRequest, { params }: { params: Promise<{ action: string }> }) {
  if (!isSameOrigin(req)) return NextResponse.json({ message: "Invalid request origin." }, { status: 403, headers });
  const { action } = await params;
  if (!["login", "register", "logout"].includes(action)) return NextResponse.json({}, { status: 404, headers });
  try {
    if (action === "logout") {
      await logoutAccount((await cookies()).get(customerCookie)?.value);
      const response = NextResponse.json({ success: true }, { headers });
      response.cookies.set(customerCookie, "", { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 0 });
      return response;
    }
    const raw = await limitedBody(req, 4096);
    let body: unknown;
    try { body = JSON.parse(Buffer.from(raw).toString()); } catch { throw new AccountError(400, "Invalid request."); }
    const input = accountInput(body, action === "register");
    await limitAccount(action, input.email);
    if (action === "register") {
      await registerAccount(input);
      return NextResponse.json({ message: "Account created. Please sign in." }, { status: 201, headers });
    }
    const { token, user } = await loginAccount(input);
    const response = NextResponse.json({ user }, { headers });
    response.cookies.set(customerCookie, token, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: customerLifetime });
    return response;
  } catch (error) {
    return NextResponse.json({ message: error instanceof AccountError ? error.message : "Website accounts are temporarily unavailable. Please try again." }, { status: error instanceof AccountError ? error.status : 503, headers });
  }
}
