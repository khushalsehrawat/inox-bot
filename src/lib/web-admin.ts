import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { TaxonomyError } from "./web-taxonomy-store.mjs";
import { websiteAdminConfig, websiteAdminCookie, verifyWebsiteAdminSession } from "./website-admin-auth.mjs";
export async function requireWebAdmin() {
  let local;
  try { local = websiteAdminConfig(); }
  catch { throw new TaxonomyError(503, "Website administrator access is not configured correctly."); }
  if (local) {
    const session = (await cookies()).get(websiteAdminCookie)?.value;
    if (!verifyWebsiteAdminSession(session, local)) throw new TaxonomyError(401, "Sign in with your website administrator account.");
    return { scope: "website" as const };
  }
  const token = (await cookies()).get("inox_admin_access")?.value;
  if (!token)
    throw new TaxonomyError(
      401,
      "Sign in with your existing INOX administrator account.",
    );
  const configured = process.env.INOX_API_ORIGIN;
  if (!configured)
    throw new TaxonomyError(
      503,
      "Configure INOX_API_ORIGIN to enable live category management.",
    );
  const origin = new URL(configured);
  if (
    origin.username ||
    origin.password ||
    !["http:", "https:"].includes(origin.protocol) ||
    (process.env.NODE_ENV === "production" && origin.protocol !== "https:")
  )
    throw new TaxonomyError(
      503,
      "Invalid authentication service configuration.",
    );
  let response;
  try {
    response = await fetch(`${origin.origin}/api/v1/admin/me`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
      signal: AbortSignal.timeout(10000),
    });
  } catch {
    throw new TaxonomyError(
      502,
      "The admin authentication service is unavailable.",
    );
  }
  if (response.status >= 500)
    throw new TaxonomyError(
      503,
      "The INOX authentication service is temporarily unavailable.",
    );
  if (!response.ok)
    throw new TaxonomyError(401, "Your admin session expired. Sign in again.");
  const result = await response.json();
  if (result.success !== true || result.data?.role !== "admin")
    throw new TaxonomyError(403, "Administrator access is required.");
  return { scope: "shared" as const };
}
export function taxonomyErrorResponse(error: unknown) {
  return NextResponse.json(
    {
      message:
        error instanceof TaxonomyError
          ? error.message
          : "Website catalogue storage is unavailable. Check database and persistent storage configuration.",
    },
    {
      status: error instanceof TaxonomyError ? error.status : 503,
      headers: { "Cache-Control": "no-store" },
    },
  );
}
export async function limitedBody(request: Request, max: number) {
  const reader = request.body?.getReader();
  if (!reader) return new Uint8Array();
  let size = 0;
  const chunks: Uint8Array[] = [];
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > max) {
      await reader.cancel();
      throw new TaxonomyError(
        413,
        "File or request exceeds the permitted size.",
      );
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks);
}
