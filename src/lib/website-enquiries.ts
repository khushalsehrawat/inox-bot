import type { RowDataPacket } from "mysql2/promise";
import { websitePool } from "./web-mysql.mjs";
import type { SavedEnquiry } from "./customer-enquiry-model";

export function savedEnquiry(row: RowDataPacket): SavedEnquiry {
  const body = typeof row.body === "string" ? JSON.parse(row.body) : row.body;
  return {
    id: row.id, customerId: row.customer_id || null, status: row.status,
    createdAt: new Date(row.created_at).toISOString(), updatedAt: new Date(row.updated_at).toISOString(),
    name: body.name || "", email: body.email || "", phone: body.phone || "", company: body.company || "",
    city: body.city || "", type: body.type || "Project enquiry", message: body.message || "",
    items: (body.items || []).map((item: Record<string, unknown>) => ({
      id: String(item.id), variationId: String(item.variationId || ""), quantity: Number(item.quantity),
      name: String(item.name || item.id), sku: String(item.sku || item.variationId || ""),
    })),
  };
}

export async function customerEnquiries(customerId: string, page: number) {
  // Ownership is checked in SQL; a customer cannot request another account's history.
  const [rows] = await websitePool().query<RowDataPacket[]>(
    "SELECT id,customer_id,status,created_at,updated_at,body FROM web_enquiries WHERE customer_id=? ORDER BY created_at DESC,id DESC LIMIT 21 OFFSET ?",
    [customerId, (page - 1) * 20],
  );
  return { enquiries: rows.slice(0, 20).map(savedEnquiry), hasMore: rows.length > 20 };
}
