import { NextRequest, NextResponse } from "next/server";
import type { RowDataPacket, ResultSetHeader } from "mysql2/promise";
import { requireWebAdmin, taxonomyErrorResponse, limitedBody } from "@/lib/web-admin";
import { websitePool } from "@/lib/web-mysql.mjs";
import { savedEnquiry } from "@/lib/website-enquiries";
import { enquiryStatuses, type EnquiryStatus } from "@/lib/customer-enquiry-model";
import { isSameOrigin } from "@/lib/request";
const headers = { "Cache-Control": "private, no-store" };
export async function GET(req: NextRequest) {
  try {
    await requireWebAdmin();
    const page = Number(req.nextUrl.searchParams.get("page") || 1);
    const status = req.nextUrl.searchParams.get("status") || "";
    if (!Number.isSafeInteger(page) || page < 1 || page > 100000 || (status && !enquiryStatuses.includes(status as EnquiryStatus))) return NextResponse.json({ message: "Invalid enquiry filter." }, { status: 400, headers });
    const [rows] = await websitePool().query<RowDataPacket[]>(
      `SELECT e.id,e.customer_id,e.status,e.created_at,e.updated_at,e.body,u.email AS account_email FROM web_enquiries e LEFT JOIN web_users u ON u.id=e.customer_id ${status ? "WHERE e.status=?" : ""} ORDER BY e.created_at DESC,e.id DESC LIMIT 51 OFFSET ?`,
      [...(status ? [status] : []), (page - 1) * 50],
    );
    return NextResponse.json({ enquiries: rows.slice(0, 50).map(row => ({ ...savedEnquiry(row), accountEmail: row.account_email || null })), hasMore: rows.length > 50 }, { headers });
  } catch (error) { return taxonomyErrorResponse(error); }
}
export async function PATCH(req: NextRequest) {
  try {
    await requireWebAdmin();
    if (!isSameOrigin(req)) return NextResponse.json({ message: "Invalid request origin." }, { status: 403, headers });
    let data;
    try { data = JSON.parse(Buffer.from(await limitedBody(req, 1024)).toString()); }
    catch { return NextResponse.json({ message: "Invalid enquiry update." }, { status: 400, headers }); }
    if (!data || typeof data.id !== "string" || !/^[a-f0-9-]{36}$/i.test(data.id) || !enquiryStatuses.includes(data.status)) return NextResponse.json({ message: "Choose a valid enquiry and status." }, { status: 422, headers });
    const [result] = await websitePool().execute<ResultSetHeader>("UPDATE web_enquiries SET status=? WHERE id=?", [data.status, data.id]);
    if (!result.affectedRows) return NextResponse.json({ message: "Enquiry not found." }, { status: 404, headers });
    return NextResponse.json({ success: true }, { headers });
  } catch (error) { return taxonomyErrorResponse(error); }
}
