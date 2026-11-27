// Read JSON data already sent to anonymous visitors. Never execute page scripts.
export function publishedProductsFromHtml(html) {
 const frames=[];
 for(const match of html.matchAll(/<script\b[^>]*>self\.__next_f\.push\((.*?)\)<\/script>/gs)){
  try{const frame=JSON.parse(match[1]);if(frame[0]===1 && typeof frame[1]==='string')frames.push(frame[1]);}catch{}
 }
 const rows=new Map();
 for(const line of frames.join('').split('\n')){
  const match=line.match(/^([0-9a-f]+):(.*)$/);
  if(match)try{rows.set(match[1],JSON.parse(match[2]));}catch{}
 }
 const resolve=(value,depth=0)=>{
  if(depth>30)throw new Error('Public catalogue nesting limit exceeded.');
  if(typeof value==='string' && /^\$[0-9a-f]+$/.test(value) && rows.has(value.slice(1)))return resolve(rows.get(value.slice(1)),depth+1);
  if(Array.isArray(value))return value.map(v=>resolve(v,depth+1));
  if(value && typeof value==='object')return Object.fromEntries(Object.entries(value).map(([k,v])=>[k,resolve(v,depth+1)]));
  return value;
 };
 const find=value=>{
  if(!value || typeof value!=='object')return null;
  if(!Array.isArray(value) && Array.isArray(value.products))return resolve(value.products);
  for(const child of Object.values(value)){const result=find(child);if(result)return result;}
  return null;
 };
 for(const row of rows.values()){const result=find(row);if(result)return result;}
 throw new Error('Main website public catalogue format changed. No products were inferred.');
}
export function publicMainText(html){
 const main=html.match(/<main\b[^>]*>([\s\S]*?)<\/main>/i)?.[1];
 if(!main)return '';
 return main.replace(/<(script|style|svg)\b[^>]*>[\s\S]*?<\/\1>/gi,' ').replace(/<[^>]+>/g,' ').replace(/&#x([0-9a-f]+);/gi,(_,n)=>String.fromCodePoint(parseInt(n,16))).replace(/&#(\d+);/g,(_,n)=>String.fromCodePoint(Number(n))).replace(/&nbsp;/g,' ').replace(/&amp;/g,'&').replace(/&quot;/g,'"').replace(/&#x27;/g,"'").replace(/\s+/g,' ').trim();
}
