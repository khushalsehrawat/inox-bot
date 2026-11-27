import "server-only";
import type { Product } from "./data";
import type { WebCategory } from "./web-taxonomy-model";
import { safeProduct, publicText, type AskSource } from "./ask-inox-core";
import { publishedProductsFromHtml, publicMainText } from "./main-site-parser.mjs";
export const MAIN_SITE_ORIGIN="https://inoxdecor.com";
export function mainSiteConnected(){if(process.env.ASK_INOX_CATALOGUE_SOURCE==="database")return false;return process.env.ASK_INOX_CATALOGUE_SOURCE==="main-site" || (process.env.VERCEL==="1" && !["WEB_MYSQL_HOST","WEB_MYSQL_DATABASE","WEB_MYSQL_USER","WEB_MYSQL_PASSWORD"].some(key=>!!process.env[key]));}
async function readPublic(path:string){
 const response=await fetch(MAIN_SITE_ORIGIN+path,{headers:{Accept:"text/html,application/json"},next:{revalidate:60},redirect:"error",signal:AbortSignal.timeout(15000)});
 if(!response.ok)throw new Error("Main website public data unavailable.");
 const reader=response.body?.getReader();if(!reader)throw new Error("Empty public response.");
 const chunks:Uint8Array[]=[];let size=0;
 while(true){const part=await reader.read();if(part.done)break;size+=part.value.length;if(size>4_000_000){await reader.cancel();throw new Error("Public response too large.");}chunks.push(part.value);}
 return new TextDecoder().decode(Buffer.concat(chunks));
}
const string=(value:unknown)=>typeof value==="string"?value:"";
const strings=(value:unknown)=>Array.isArray(value)?value.filter((v):v is string=>typeof v==="string"):[];
const specs=(value:unknown):Record<string,string>=>value && typeof value==="object"?Object.fromEntries(Object.entries(value).filter((entry):entry is [string,string]=>typeof entry[1]==="string")):{};
function media(value:unknown){const path=string(value);if(!path)return "";try{const url=new URL((path.startsWith("/") || path.startsWith("https://"))?path:`/media/${path}`,MAIN_SITE_ORIGIN);return url.origin===MAIN_SITE_ORIGIN && !url.username && !url.password?url.href:"";}catch{return "";}}
function product(value:unknown):Product|null{
 if(!value || typeof value!=="object")return null;const p=value as Record<string,unknown>;
 if(!string(p.id)||!string(p.name)||!string(p.category))return null;
 const variations=(Array.isArray(p.variations)?p.variations:[]).flatMap(v=>{
  if(!v || typeof v!=="object" || v.active!==true || !string(v.id)||!string(v.sku))return [];
  return [{id:string(v.id),sku:string(v.sku),name:string(v.name),size:string(v.size),dimensions:string(v.dimensions),material:string(v.material),finish:string(v.finish),colour:string(v.colour),specifications:specs(v.specifications),images:strings(v.images).map(media).filter(Boolean),active:true,available:v.available===true,sortOrder:Number(v.sortOrder)||0,isDefault:v.isDefault===true}];
 });
 const clean=safeProduct({id:string(p.id),name:string(p.name),sku:string(p.sku)||null,category:string(p.category),description:string(p.description),keyFeatures:string(p.keyFeatures),image:media(p.image)||null,images:strings(p.images).map(media).filter(Boolean),finishes:strings(p.finishes),specifications:specs(p.specifications),pdf:media(p.pdf)||undefined,variations});
 return clean;
}
export async function mainSiteCategories():Promise<WebCategory[]>{
 const response=JSON.parse(await readPublic("/api/web/categories"));if(!Array.isArray(response.categories))throw new Error("Public categories unavailable.");
 return response.categories.filter((c:Record<string,unknown>)=>c.published===true && string(c.id)).map((c:Record<string,unknown>)=>({id:string(c.id),slug:string(c.slug),name:publicText(c.name,200),short:publicText(c.short,100),description:publicText(c.description),image:media(c.image),parentId:string(c.parentId)||null,published:true,sortOrder:Number(c.sortOrder)||0,version:Number(c.version)||1}));
}
export async function mainSiteProducts():Promise<Product[]>{return publishedProductsFromHtml(await readPublic("/products")).map(product).filter((p):p is Product=>!!p);}
export async function mainSiteSources(query:string):Promise<AskSource[]>{
 const pages:[[string,string],...Array<[string,string]>]=[["/","INOX perspective and home"],["/about","About INOX"],["/privacy","INOX privacy policy"],["/contact","Contact INOX"],["/catalogues","INOX catalogues"],["/blog","INOX journal"]];
 const results=await Promise.allSettled(pages.map(async([path,title])=>{const text=publicMainText(await readPublic(path));const chunks:AskSource[]=[];for(let i=0;i<text.length;i+=1200)chunks.push({title,href:MAIN_SITE_ORIGIN+path,text:text.slice(i,i+1500)});return chunks;}));
 return results.flatMap(result=>result.status==="fulfilled"?result.value:[]);
}
