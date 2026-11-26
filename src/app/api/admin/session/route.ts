import { isSameOrigin } from "@/lib/request";
import { NextRequest, NextResponse } from "next/server";
import { limitedBody, requireWebAdmin } from "@/lib/web-admin";
import { TaxonomyError } from "@/lib/web-taxonomy-store.mjs";
import { websiteAdminConfig, websiteAdminCookie, websiteAdminLifetime, verifyWebsiteAdminPassword, createWebsiteAdminSession } from "@/lib/website-admin-auth.mjs";
const cookieName = "inox_admin_access";
let attempts = { start: 0, failures: 0 };
const noStore = { "Cache-Control": "no-store" };
function apiOrigin() {
  const raw = process.env.INOX_API_ORIGIN;
  if (!raw) return null;
  const url = new URL(raw);
  if (
    url.username ||
    url.password ||
    !["https:", "http:"].includes(url.protocol)
  )
    throw new Error("Invalid API origin");
  if (process.env.NODE_ENV === "production" && url.protocol !== "https:")
    throw new Error("HTTPS is required");
  return url.origin;
}
export async function POST(req: NextRequest) {
  if (!isSameOrigin(req))
    return NextResponse.json(
      { message: "Invalid request origin." },
      { status: 403 },
    );
  try {
    const raw = Buffer.from(await limitedBody(req, 2048)).toString("utf8");
    let body;
    try {
      body = JSON.parse(raw);
    } catch {
      return NextResponse.json(
        { message: "Invalid credentials format." },
        { status: 400 },
      );
    }
    if (
      !body ||
      typeof body.email !== "string" ||
      typeof body.password !== "string" ||
      body.email.length > 254 ||
      body.password.length > 256 ||
      !body.email ||
      !body.password
    )
      return NextResponse.json(
        { message: "Enter your email and password." },
        { status: 422 },
      );
    let local;
    try { local = websiteAdminConfig(); }
    catch { return NextResponse.json({ message: "Website administrator access is not configured correctly." }, { status: 503, headers: noStore }); }
    if (local) {
      const now = Date.now();
      if (now - attempts.start >= 60000) attempts = { start: now, failures: 0 };
      if (attempts.failures >= 10) return NextResponse.json({ message: "Too many sign-in attempts. Please try again in a minute." }, { status: 429, headers: { ...noStore, "Retry-After": "60" } });
      attempts.failures++;
      if (!await verifyWebsiteAdminPassword(local, body.email, body.password)) return NextResponse.json({ message: "Incorrect website administrator email or password." }, { status: 401, headers: noStore });
      attempts.failures = 0;
      const response = NextResponse.json({ authenticated: true, scope: "website" }, { headers: noStore });
      response.cookies.set(websiteAdminCookie, createWebsiteAdminSession(local), { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "strict", path: "/api/admin", maxAge: websiteAdminLifetime });
      response.cookies.set(cookieName, "", { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "strict", path: "/api/admin", maxAge: 0 });
      return response;
    }
    const origin = apiOrigin();
    if (!origin) return NextResponse.json({ message: "Website administrator access is not configured." }, { status: 503, headers: noStore });
    const upstream = await fetch(`${origin}/api/v1/admin/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: body.email, password: body.password }),
      cache: "no-store",
      signal: AbortSignal.timeout(10000),
    });
    if (upstream.status >= 500)
      return NextResponse.json(
        {
          message:
            "The INOX authentication service is temporarily unavailable. Please try again later.",
        },
        { status: 503 },
      );
    const result = await upstream.json();
    if (
      !upstream.ok ||
      !result.success ||
      result.data?.user?.role !== "admin" ||
      typeof result.data?.accessToken !== "string"
    )
      return NextResponse.json(
        { message: "Unable to sign in with this administrator account." },
        { status: upstream.status === 429 ? 429 : 401 },
      );
    const response = NextResponse.json({ authenticated: true });
    response.cookies.set(cookieName, result.data.accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      path: "/api/admin",
  maxAge: Math.min(Number(result.data.expiresIn) || 28800, 28800),    });
    response.headers.set("Cache-Control", "no-store");
    return response;
  } catch (error) {
    if (error instanceof TaxonomyError) return NextResponse.json({ message: error.message }, { status: error.status, headers: noStore });
    return NextResponse.json(
      { message: "The INOX authentication service could not be reached." },
      { status: 502 },
    );
  }
}
export async function GET() {
  try {
    const { scope } = await requireWebAdmin();
    return NextResponse.json(
      { authenticated: true, scope },
      { headers: noStore },
    );
  } catch (error) {
    return NextResponse.json({ authenticated: false }, { status: error instanceof TaxonomyError ? error.status : 503, headers: noStore });
  }
}
export async function DELETE(req: NextRequest) {
  if (!isSameOrigin(req))
    return NextResponse.json(
      { message: "Invalid request origin." },
      { status: 403 },
    );
  const response = NextResponse.json({ authenticated: false }, { headers: noStore });
  response.cookies.set(websiteAdminCookie, "", { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "strict", path: "/api/admin", maxAge: 0 });
  response.cookies.set(cookieName, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/api/admin",
    maxAge: 0,
  });
  return response;
}
