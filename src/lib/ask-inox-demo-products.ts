import type { Product } from "./data";
import { categories } from "./data";
import type { WebCategory } from "./web-taxonomy-model";
// Synthetic test records, never actual INOX specifications or availability.
export function demoCatalogueEnabled(env=process.env) {
 if(env.ASK_INOX_DEMO_PRODUCTS==="false")return false;
 const configured=["WEB_MYSQL_HOST","WEB_MYSQL_DATABASE","WEB_MYSQL_USER","WEB_MYSQL_PASSWORD"].some(key=>!!env[key]);
 return !configured && (env.ASK_INOX_DEMO_PRODUCTS==="true" || env.VERCEL==="1");
}
export const demoCategories:WebCategory[]=categories.map((c,i)=>({...c,slug:c.id,parentId:null,published:true,sortOrder:i,version:1}));
const samples=[
 ["Bottle rack","kitchen","100 x 450 x 500 mm"],
 ["Tandem drawer","kitchen","450 x 450 x 180 mm"],
 ["Corner basket","kitchen","600 x 450 x 400 mm"],
 ["Cutlery tray","organisers","400 x 400 x 50 mm"],
 ["Tall pantry pull-out","pantry","300 x 500 x 1600 mm"],
 ["Wardrobe basket","wardrobe","600 x 450 x 150 mm"],
 ["Shoe rack","wardrobe","600 x 350 x 180 mm"],
 ["Trouser pull-out","wardrobe","500 x 450 x 120 mm"],
 ["Cabinet handle","hardware","160 x 25 x 30 mm"],
 ["Soft-close hinge","hardware","60 x 40 x 20 mm"],
];
export const demoProducts:Product[]=samples.map(([name,category,dimensions],i)=>{
 const reference=`DEMO.${String(i+1).padStart(2,"0")}`;
 const image=`/media/${category==="wardrobe"?"wardrobe.png":category==="hardware"?"honeycomb.png":"kitchen.png"}`;
 return {id:`demo-product-${i+1}`,name:`[Demo] ${name}`,sku:reference,category,image,images:[image],description:"Synthetic product for testing Ask INOX only. Dimensions, finishes and imagery are illustrative, not actual INOX product claims. Not available to order.",specifications:{"Data source":"Demo only ? not a real INOX product",Dimensions:dimensions,"Image":"Representative category image"},finishes:["Black","Chrome"],variations:["Black","Chrome"].map((finish,j)=>({id:`demo-variant-${i+1}-${j+1}`,sku:`${reference}.${101+j}`,name:finish,size:"Demo dimensions only",dimensions,material:"Illustrative steel",finish,colour:finish,specifications:{"Data source":"Synthetic demonstration variant"},images:[image],active:true,available:true,sortOrder:j,isDefault:j===0}))};
});
