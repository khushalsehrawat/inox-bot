import { NextRequest, NextResponse } from "next/server";
import { requireWebAdmin, taxonomyErrorResponse } from "@/lib/web-admin";
import { websitePool } from "@/lib/web-mysql.mjs";
import type { RowDataPacket } from "mysql2/promise";
const headers = { "Cache-Control": "private, no-store" };
export async function GET(req: NextRequest) {
  try {
    await requireWebAdmin();
    const customerId = req.nextUrl.searchParams.get("customerId");
    if (customerId && !/^[a-f0-9-]{36}$/i.test(customerId)) return NextResponse.json({ message: "Invalid customer." }, { status: 400, headers });
    const [rows] = await websitePool().execute<RowDataPacket[]>(`SELECT u.id,u.email,u.first_name,u.last_name,u.country_code,u.mobile,u.company_name,u.created_at,
      c.first_login,c.last_login,COALESCE(c.login_count,0) AS login_count,
      (SELECT COUNT(*) FROM web_user_sessions s WHERE s.user_id=u.id AND s.expires_at>UTC_TIMESTAMP()) AS active_sessions,
      (SELECT COUNT(*) FROM web_enquiries e WHERE e.customer_id=u.id) AS enquiry_count
      FROM web_users u LEFT JOIN web_customers c ON c.id=u.id ORDER BY COALESCE(c.last_login,u.created_at) DESC,u.id LIMIT 1000`);
    const [events] = await websitePool().execute<RowDataPacket[]>(`SELECT a.id,a.customer_id,a.event,a.details,a.created_at,u.email FROM web_customer_activity a JOIN web_users u ON u.id=a.customer_id ${customerId ? "WHERE a.customer_id=?" : ""} ORDER BY a.created_at DESC,a.id DESC LIMIT 100`, customerId ? [customerId] : []);
    const date = (value: Date | null) => value ? new Date(value).toISOString() : null;
    const customers = rows.map(row => ({
      id: row.id, email: row.email, name: [row.first_name,row.last_name].filter(Boolean).join(" "),
      mobile: [row.country_code,row.mobile].filter(Boolean).join(" "), company: row.company_name,
      registeredAt: date(row.created_at), first_login: date(row.first_login), last_login: date(row.last_login),
      login_count: Number(row.login_count), activeSessions: Number(row.active_sessions), enquiryCount: Number(row.enquiry_count),
    }));
    const activity = events.map(row => {
      const details = typeof row.details === "string" ? JSON.parse(row.details) : row.details;
      return { id: row.id, customerId: row.customer_id, email: row.email, event: row.event, createdAt: date(row.created_at), enquiryId: details.enquiryId };
    });
    return NextResponse.json({ customers, activity }, { headers });
  } catch (error) { return taxonomyErrorResponse(error); }
}
