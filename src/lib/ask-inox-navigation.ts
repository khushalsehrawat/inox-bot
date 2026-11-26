import type { Product } from "./data";
import type { WebCategory } from "./web-taxonomy-model";
import { normalizeSku, publicText, searchCatalogue } from "./ask-inox-core";

export type NavigationTarget = { href:string; label:string };
export type NavigationResult = {
  navigationRequest:true;
  navigation?:NavigationTarget;
  navigationChoices?:NavigationTarget[];
  answer:string;
  blocked?:boolean;
};
const pages = [
  {href:"/",label:"Home",aliases:["home","homepage","होम","मुख्य पृष्ठ","मुखपृष्ठ"]},
  {href:"/products",label:"All products",aliases:["products","all products","product catalogue","प्रोडक्ट्स","सभी उत्पाद","उत्पाद"]},
  {href:"/about",label:"About INOX",aliases:["about","about us","about inox","our story","हमारे बारे में"]},
  {href:"/contact",label:"Contact INOX",aliases:["contact","contact us","contact inox","संपर्क"]},
  {href:"/catalogues",label:"Catalogues",aliases:["catalogues","catalogue","catalogs","catalog","brochures","brochure","कैटलॉग"]},
  {href:"/enquiry",label:"Your enquiry",aliases:["enquiry","enquiries","inquiry","my enquiry","your enquiry","basket","enquiry basket","cart","एन्क्वायरी","इन्क्वायरी"]},
  {href:"/blog",label:"INOX journal",aliases:["blog","blogs","journal","ब्लॉग"]},
  {href:"/xcomb",label:"XCOMB",aliases:["xcomb","x comb","एक्सकॉम्ब","एक्स कॉम्ब"]},
  {href:"/honeycomb",label:"Honeycomb",aliases:["honeycomb","honey comb","हनीकॉम्ब","हनी कॉम्ब"]},
  {href:"/facade",label:"Facade",aliases:["facade","facades","फसाड","फसाडे"]},
  {href:"/privacy",label:"Privacy policy",aliases:["privacy","privacy policy"]},
  {href:"/login",label:"Sign in",aliases:["login","log in","sign in"]},
  {href:"/signup",label:"Create account",aliases:["signup","sign up","register","create account"]},
  {href:"/account",label:"My account",aliases:["account","my account"]},
];
const normalize=(text:string)=>text.normalize("NFKC").toLowerCase().replace(/[^\p{L}\p{M}\p{N}]+/gu," ").trim().replace(/\s+/g," ");
function targetWords(text:string) {
  return normalize(text)
    .replace(/\b(please|could|can|would|you|take|bring|me|back|go|move|navigate|switch|open|visit|show|to|the|page|pages|category|categories|section|details|product details|kholo|khol|do|le|chalo|dikhao|par|pe|mujhe|zara)\b/g," ")
    .replace(/कृपया|खोलो|खोलिए|खोल|दिखाओ|दिखाइए|मुझे|ले चलो|ले चलिए|पर जाओ|पे जाओ|पेज|श्रेणी|कैटेगरी/g," ")
    .replace(/(^|\s)(पर|पे|को|में|दो)(?=\s|$)/g," ")
    .trim().replace(/\s+/g," ").replace(/^(?:product|blog post|blog article)\s+(?=.+)/,"");
}
export function isNavigationCommand(text:string) {
  if(/\b(don['’]?t|do not|never|not now|mat|how do|how can|kaise)\b|मत |नहीं|कैसे/i.test(text))return false;
  if(/^(what|how|why|explain|tell me|if i|when i|does|do you|is|are|will this|can this|would this|i need a|i want a|looking for)\b/i.test(text.trim()))return false;
  return /\b(go|move|navigate|switch|take me|bring me|open|visit|kholo|khol do|le chalo|par chalo|pe chalo)\b|खोलो|खोलिए|खोल दो|ले चल|पर जाओ|पे जाओ|दिखाओ|दिखाइए/i.test(text)
    || /\bshow me\b.*\b(page|category|section|details)\b/i.test(text);
}
/** Defense in depth before router.push. Existence/publication is checked on the server. */
export function isSafePublicNavigation(href:unknown):href is string {
  if(typeof href!=="string" || /[\\\u0000-\u0020%#]/.test(href) || !href.startsWith("/") || href.startsWith("//"))return false;
  if(pages.some(p=>p.href===href))return true;
  return /^\/products\?category=[a-zA-Z0-9_-]+$/.test(href)
    || /^\/products\/[a-zA-Z0-9_-]+(?:\?variation=[a-zA-Z0-9_-]+)?$/.test(href)
    || /^\/blog\/[a-z0-9-]+$/.test(href);
}
export function matchNavigationChoice(query:string,choices:NavigationTarget[]) {
  const target=targetWords(query);
  if(target.length<3)return undefined;
  const matches=choices.filter(c=>c.href===query.trim() || normalize(c.label)===target || normalize(c.label).startsWith(`${target} `));
  return matches.length===1?matches[0]:undefined;
}
function answerFor(destination:NavigationTarget,query:string):NavigationResult {
  const answer=/[\u0900-\u097f]/.test(query)?`${destination.label} खोल रहा हूँ।`:/\b(kholo|khol|chalo|dikhao|mujhe)\b/i.test(query)?`${destination.label} khol raha hoon.`:`Opening ${destination.label}.`;
  return {navigationRequest:true,navigation:destination,answer};
}
function candidates(choices:NavigationTarget[]):NavigationResult {
  const unique=[...new Map(choices.map(c=>[c.href,c])).values()].slice(0,6);
  return unique.length===1?{navigationRequest:true,navigation:unique[0],answer:`Opening ${unique[0].label}.`}
    :{navigationRequest:true,navigationChoices:unique,answer:unique.length?"Which one would you like to open? Choose a destination below, or say its full name or SKU.":"I couldn’t find that public page, category or product. Please share its name or SKU."};
}
export function resolveNavigation(
  query:string,categories:WebCategory[],products:Product[],contextId?:string,
  posts:{slug:string;title:string;published:boolean}[]=[],
):NavigationResult {
  const raw=query.trim(), target=targetWords(raw);
  // Never treat URLs, admin/API routes or internal screens as model-selected destinations.
  if(/:\/\/|javascript:|data:|\\|^\/\/|\b(admin|administration|api|dashboard)\b|ask-inox-widget|%|[\u0000-\u001f]/i.test(raw))
    return {navigationRequest:true,blocked:true,answer:"I can open public INOX pages, categories and products. Please choose a public destination."};
  const requestedPath=raw.match(/(?:^|\s)(\/[^\s]+)/)?.[1];
  const page=pages.find(p=>p.href===(requestedPath || raw) || p.aliases.some(alias=>normalize(alias)===target));
  if(page)return answerFor({href:page.href,label:page.label},raw);

  const published=categories.filter(c=>{
    const seen=new Set<string>();let node:WebCategory|undefined=c;
    while(node){if(!node.published || seen.has(node.id))return false;seen.add(node.id);if(!node.parentId)return true;node=categories.find(p=>p.id===node!.parentId);}
    return false;
  });
  const visible=products.filter(p=>published.some(c=>c.id===p.category));
  const available:NavigationTarget[]=[
    ...published.map(c=>({href:`/products?category=${encodeURIComponent(c.id)}`,label:publicText(c.name,200)})),
    ...visible.flatMap(p=>[{href:`/products/${encodeURIComponent(p.id)}`,label:publicText(p.name,200)},...(p.variations || []).filter(v=>v.active).map(v=>({href:`/products/${encodeURIComponent(p.id)}?variation=${encodeURIComponent(v.id)}`,label:`${publicText(p.name,200)} · ${v.sku}`}))]),
    ...posts.filter(p=>p.published && /^[a-z0-9-]+$/.test(p.slug)).map(p=>({href:`/blog/${p.slug}`,label:publicText(p.title,240)})),
  ].filter(p=>isSafePublicNavigation(p.href));
  if(requestedPath){
    const route=available.find(p=>p.href===requestedPath);
    return route?answerFor(route,raw):candidates([]);
  }
  if(/^(this|current|that|this one|that one|this product|current product|that product|yeh|ye|yeh product|यह|यह उत्पाद)$/.test(target)){
    const p=visible.find(p=>p.id===contextId);
    return p?answerFor({href:`/products/${encodeURIComponent(p.id)}`,label:publicText(p.name,200)},raw):candidates([]);
  }
  const exact=searchCatalogue(visible,raw).products.filter(p=>p.matchedVariationIds.length || (!!p.sku && normalizeSku(p.sku)===normalizeSku(target)));
  if(exact.length){
    return candidates(exact.flatMap(p=>p.matchedVariationIds.length?p.matchedVariationIds.map(id=>({href:`${p.href}?variation=${encodeURIComponent(id)}`,label:`${p.name} · ${p.variations?.find(v=>v.id===id)?.sku}`})):[{href:p.href,label:p.name}]));
  }
  const translated=target.replace(/रसोई|किचन/g,"kitchen").replace(/अलमारी|वार्डरोब|वॉर्डरोब/g,"wardrobe").replace(/हार्डवेयर/g,"hardware").replace(/पैंट्री/g,"pantry");
  const terms=translated.split(" ").filter(Boolean);
  const ranked=published.map(c=>{
    const labels=[c.name,c.short,c.slug,c.id].map(normalize);
    return {c,score:labels.includes(translated)?100:terms.length && terms.every(t=>labels.some(l=>l.split(" ").includes(t)))?60:0};
  }).filter(r=>r.score>0).sort((a,b)=>b.score-a.score);
  if(ranked.length){const best=ranked[0].score;return candidates(ranked.filter(r=>r.score===best).map(({c})=>({href:`/products?category=${encodeURIComponent(c.id)}`,label:publicText(c.name,200)})));}
  const named=visible.filter(p=>normalize(p.name)===target);
  if(named.length)return candidates(named.map(p=>({href:`/products/${encodeURIComponent(p.id)}`,label:publicText(p.name,200)})));
  const matching=visible.filter(p=>terms.length && terms.every(t=>normalize(`${p.name} ${p.sku || ""}`).split(" ").includes(t)));
  if(matching.length)return candidates(matching.map(p=>({href:`/products/${encodeURIComponent(p.id)}`,label:publicText(p.name,200)})));
  const blog=posts.filter(p=>p.published && normalize(p.title)===target);
  return candidates(blog.map(p=>({href:`/blog/${p.slug}`,label:publicText(p.title,240)})).filter(p=>isSafePublicNavigation(p.href)));
}
