import { mainSiteConnected, mainSiteProducts, MAIN_SITE_ORIGIN } from "@/lib/main-site-catalogue";
import { NextResponse } from "next/server";
import { publicCategories } from "@/lib/public-site";
import { askInoxEnabled } from "@/lib/ask-inox-enabled";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export async function GET(){
 const required=["WEB_MYSQL_HOST","WEB_MYSQL_DATABASE","WEB_MYSQL_USER","WEB_MYSQL_PASSWORD"];
 const missing=required.filter(key=>!process.env[key]);
 const connected=mainSiteConnected();
 const catalogue=!connected && missing.length?{available:false}:await publicCategories();
 const products=connected?await mainSiteProducts().catch(()=>null):null;
 const available=catalogue.available && (!connected || products!==null);
 return NextResponse.json({enabled:askInoxEnabled(),geminiConfigured:!!process.env.GEMINI_API_KEY,catalogue:{source:connected?MAIN_SITE_ORIGIN:"database",demo:false,products:products?.length,variants:products?.reduce((count,p)=>count+(p.variations?.length || 0),0),available,status:available?"connected":!connected && missing.length?"configuration_missing":"source_unavailable",missing:connected?[]:missing}}, {headers:{"Cache-Control":"no-store"}});
}
