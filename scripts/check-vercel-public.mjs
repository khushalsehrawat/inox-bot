// No provider calls, authenticated reads, database writes or real enquiries.
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {createServer} from 'node:net';
const connected=process.argv.includes('--main-site');
const probe=createServer();await new Promise(r=>probe.listen(0,'127.0.0.1',r));const port=probe.address().port;await new Promise(r=>probe.close(r));
const env={...process.env,ASK_INOX_CATALOGUE_SOURCE:connected?'main-site':'database',NODE_ENV:'production',VERCEL:'1',PORT:String(port),HOSTNAME:'127.0.0.1'};
for(const key of ['ASK_INOX_ENABLED','GEMINI_API_KEY','OPENAI_API_KEY','WEB_MYSQL_HOST','WEB_MYSQL_DATABASE','WEB_MYSQL_USER','WEB_MYSQL_PASSWORD'])delete env[key];
const app=spawn(process.execPath,['hostinger-build/server.js'],{env,stdio:'ignore'});
const base=`http://127.0.0.1:${port}`;
try {
 let ready=false;
 for(let i=0;i<80;i++){try{const r=await fetch(base+'/api/ask-inox');if(r.ok){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,250));}
 assert.ok(ready,'production server starts');
 const health=await (await fetch(base+'/api/ask-inox/health')).json();assert.equal(health.enabled,true);assert.equal(health.geminiConfigured,false);assert.equal(health.catalogue.demo,false);
 if(connected){assert.equal(health.catalogue.source,'https://inoxdecor.com');assert.equal(health.catalogue.available,true);}else assert.equal(health.catalogue.status,'configuration_missing');
 for(const path of ['/','/about','/products','/blog','/ask-inox-widget']){
  const r=await fetch(base+path);assert.equal(r.status,200,path);const html=await r.text();assert.match(html,connected?/Connected to the published catalogue/:/live catalogue is temporarily unavailable/i,path);assert.ok(!html.includes('10 synthetic test products'));
 }
 const options={method:'POST',headers:{'Content-Type':'application/json',Origin:base},body:JSON.stringify({action:'start',path:'/'})};
 const start=await fetch(base+'/api/ask-inox',options);assert.equal(start.status,200);const cookie=start.headers.get('set-cookie').split(';')[0];
 const post=body=>fetch(base+'/api/ask-inox',{...options,headers:{...options.headers,Cookie:cookie},body:JSON.stringify(body)});
 const response=await post({action:'lookup',query:'What is INOX perspective?'});assert.equal(response.status,200);const lookup=await response.json();assert.ok(lookup.sources.some(s=>/perspective/i.test(s.text)));
 if(connected){
  const exact=await (await post({action:'lookup',query:'SKU H6.01.101'})).json();assert.equal(exact.products.length,1);const product=exact.products[0];const variant=product.variations.find(v=>v.sku==='H6.01.101');assert.ok(variant);assert.ok(product.href.startsWith('https://inoxdecor.com/products/'));assert.ok(!JSON.stringify(product).includes('sellingPrice'));
  const spoken=await (await post({action:'lookup',query:'reference H six dot zero one dot one zero one'})).json();assert.equal(spoken.products[0].id,product.id);
  const nav=await (await post({action:'navigate',destination:'H6.01.101'})).json();assert.ok(JSON.stringify(nav).includes(product.id));
  if(variant.available){const validation=await post({action:'validate',productId:product.id,variationId:variant.id});assert.equal(validation.status,200);}
  const page=await fetch(base+'/products/'+encodeURIComponent(product.id));assert.equal(page.status,200);
  const blocked=await fetch(base+'/api/enquiries',{method:'POST',headers:{'Content-Type':'application/json',Origin:base},body:'{}'});assert.equal(blocked.status,409);
  console.log('PASS: real main-site reference lookup, spoken reference, product navigation, private-price exclusion and main-site-only submission guard.');
  if(process.argv.includes('--browser')){
   const {chromium}=await import('@playwright/test');const browser=await chromium.launch({headless:true,channel:process.env.ASK_TEST_BROWSER_CHANNEL || undefined});
   try{
    const page=await browser.newPage({viewport:{width:1280,height:900}});
    await page.route('**/*',route=>{const url=route.request().url();return url.startsWith(base) || url.startsWith('https://inoxdecor.com/')?route.continue():route.abort();});
    await page.goto(base+'/products/'+encodeURIComponent(product.id),{waitUntil:'domcontentloaded'});
    await page.getByRole('button',{name:'Select variation H6.01.101',exact:true}).click();
    await page.waitForFunction(()=>{const image=document.querySelector('.gallery-stage img');return image?.complete && image.naturalWidth>0;});
    if(variant.available){
     await page.getByRole('button',{name:'Add to enquiry',exact:true}).click();
     await page.goto(base+'/enquiry',{waitUntil:'domcontentloaded'});
     const item=page.locator('.basket-item').filter({hasText:'H6.01.101'});await item.waitFor();
     assert.equal(await item.getByRole('link',{name:'Open this variant on main site'}).getAttribute('href'),`https://inoxdecor.com/products/${product.id}?variation=${variant.id}`);
     assert.equal(await page.getByRole('button',{name:'Send enquiry',exact:true}).count(),0);
    }
    console.log('PASS: browser real reference, main-site product image and exact-variant enquiry handoff.');
   }finally{await browser.close();}
  }

 }
 console.log('PASS: production pages, bot and public knowledge retrieval. No provider calls or real enquiries.');
}finally{app.kill();}
