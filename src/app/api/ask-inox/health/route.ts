import { NextResponse } from "next/server";
import { publicCategories } from "@/lib/public-site";
import { askInoxEnabled } from "@/lib/ask-inox-enabled";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export async function GET(){
 const required=["WEB_MYSQL_HOST","WEB_MYSQL_DATABASE","WEB_MYSQL_USER","WEB_MYSQL_PASSWORD"];
 const missing=required.filter(key=>!process.env[key]);
 const catalogue=missing.length?{available:false}:await publicCategories();
 return NextResponse.json({enabled:askInoxEnabled(),geminiConfigured:!!process.env.GEMINI_API_KEY,catalogue:{available:catalogue.available,status:missing.length?"configuration_missing":catalogue.available?"connected":"connection_or_schema_error",missing}}, {headers:{"Cache-Control":"no-store"}});
}
