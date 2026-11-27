import { mainSiteConnected } from "@/lib/main-site-catalogue";
import { isSameOrigin } from "@/lib/request";
import { NextRequest, NextResponse } from "next/server";
import { getWebProducts } from "@/lib/web-taxonomy";
import { usesMysql } from "@/lib/web-taxonomy";
import { mysqlTransaction } from "@/lib/web-mysql.mjs";
import { randomUUID } from "node:crypto";
import { customerSession } from "@/lib/website-customers";
import { limitedBody } from "@/lib/web-admin";
import { notifySavedEnquiry } from "@/lib/enquiry-mail.mjs";
export async function POST(req: NextRequest) {
  if(mainSiteConnected())return NextResponse.json({message:"Your selection is saved for review here. Please complete the enquiry on inoxdecor.com using the exact product variants. This separate bot site cannot submit to the main website."},{status:409});
  if (!isSameOrigin(req))
    return NextResponse.json(
      { message: "Invalid request origin." },
      { status: 403 },
    );
  if (!req.headers.get("content-type")?.startsWith("application/json"))
    return NextResponse.json({ message: "Use JSON." }, { status: 415 });
  let raw: string;
  try { raw = Buffer.from(await limitedBody(req, 16000)).toString(); }
  catch {
    return NextResponse.json(
      { message: "Enquiry is too large." },
      { status: 413 },
    );
  }
  let data;
  try {
    data = JSON.parse(raw);
  } catch {
    return NextResponse.json({ message: "Invalid enquiry." }, { status: 400 });
  }
  if (!data || typeof data !== "object" || Array.isArray(data))
    return NextResponse.json({ message: "Invalid enquiry." }, { status: 422 });
  if (data.website)
    return NextResponse.json(
      { message: "Unable to accept this enquiry." },
      { status: 422 },
    );
  let products: Awaited<ReturnType<typeof getWebProducts>>;
  try { products = Array.isArray(data.items) && data.items.length ? await getWebProducts() : []; }
  catch { return NextResponse.json({ message: "Products are temporarily unavailable. Your enquiry has not been sent." }, { status: 503 }); }
  const valid =
    typeof data.name === "string" &&
    data.name.trim().length > 1 &&
    data.name.length <= 120 &&
    typeof data.email === "string" &&
    data.email.length <= 254 &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email) &&
    typeof data.phone === "string" &&
    /^[+\d()\s.-]{6,30}$/.test(data.phone) &&
    typeof data.message === "string" &&
    data.message.trim().length > 0 &&
    data.message.length <= 3000 &&
    (data.company === undefined || (typeof data.company === "string" && data.company.length <= 160)) &&
    (data.city === undefined || (typeof data.city === "string" && data.city.length <= 160)) &&
    (data.type === undefined || ["Project enquiry", "Product information", "Become a partner"].includes(data.type)) &&
    data.consent === "on" &&
    Array.isArray(data.items) &&
    data.items.length <= 100 &&
    data.items.every(
      (i: { id: string; variationId?: string; quantity: number }) =>
        i &&
        products.some((p) => p.id === i.id && p.variations?.some(v => v.id === i.variationId && v.active && v.available)) &&
        Number.isInteger(i.quantity) &&
        i.quantity > 0 &&
        i.quantity <= 999,
    );
  if (!valid)
    return NextResponse.json(
      {
        message:
          "Check your name, email, phone, message, consent and product quantities.",
      },
      { status: 422 },
    );
  if (!usesMysql()) return NextResponse.json({message:"Enquiry storage requires MySQL. Your basket is retained."},{status:503});
  try {
    const id=randomUUID();
    const customer = await customerSession();
    const enquiry={name:data.name.trim(),email:data.email.trim().toLowerCase(),phone:data.phone.trim(),message:data.message.trim(),company:data.company?.trim() || '',city:data.city?.trim() || '',type:data.type || 'Project enquiry',consent:true,items:data.items.map((i:{id:string;variationId:string;quantity:number})=>{
      const product = products.find(p => p.id === i.id)!;
      const variation = product.variations!.find(v => v.id === i.variationId)!;
      return {id:i.id,variationId:i.variationId,quantity:i.quantity,name:product.name,sku:variation.sku};
    })};
    await mysqlTransaction(async db => {
      await db.execute('INSERT INTO web_enquiries(id,customer_id,body) VALUES(?,?,?)',[id,customer?.id || null,JSON.stringify(enquiry)]);
      if (customer) await db.execute("INSERT INTO web_customer_activity(id,customer_id,event,details) VALUES(?,?,'Enquiry submitted',?)", [randomUUID(), customer.id, JSON.stringify({ enquiryId: id })]);
    });
    await notifySavedEnquiry(id, enquiry);
    return NextResponse.json({message:customer ? `Enquiry saved to your account. Reference: ${id}` : `Enquiry saved. Reference: ${id}`,id,savedToAccount:Boolean(customer)},{status:201,headers:{'Cache-Control':'private, no-store'}});
  } catch {return NextResponse.json({message:'Enquiry could not be saved. Please try again.'},{status:503});}
}
