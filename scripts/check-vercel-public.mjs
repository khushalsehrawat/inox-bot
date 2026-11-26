// Production smoke check with no DB, provider credentials, writes or real enquiries.
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {createServer} from 'node:net';
const probe=createServer();await new Promise(r=>probe.listen(0,'127.0.0.1',r));const port=probe.address().port;await new Promise(r=>probe.close(r));
const demo=process.argv.includes('--demo');
const env={...process.env,ASK_INOX_DEMO_PRODUCTS:demo?'true':'false',NODE_ENV:'production',VERCEL:'1',PORT:String(port),HOSTNAME:'127.0.0.1'};
for(const key of ['ASK_INOX_ENABLED','GEMINI_API_KEY','OPENAI_API_KEY','WEB_MYSQL_HOST','WEB_MYSQL_DATABASE','WEB_MYSQL_USER','WEB_MYSQL_PASSWORD'])delete env[key];
const app=spawn(process.execPath,['hostinger-build/server.js'],{env,stdio:'ignore'});
const base=`http://127.0.0.1:${port}`;
try {
 let ready=false;
 for(let i=0;i<80;i++){try{const r=await fetch(base+'/api/ask-inox/health');if(r.ok){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,250));}
 assert.ok(ready,'production server starts');
 const health=await (await fetch(base+'/api/ask-inox/health')).json();
 assert.equal(health.enabled,true);assert.equal(health.geminiConfigured,false);assert.equal(health.catalogue.status,'configuration_missing');
 for(const path of ['/','/about','/products','/blog','/ask-inox-widget']){
  const r=await fetch(base+path);assert.equal(r.status,200,path);const html=await r.text();assert.match(html,demo?/Demo catalogue: 10 synthetic test products/i:/live catalogue is temporarily unavailable/i,path);
 }
 const options={method:'POST',headers:{'Content-Type':'application/json',Origin:base},body:JSON.stringify({action:'start',path:'/'})};
 const start=await fetch(base+'/api/ask-inox',options);assert.equal(start.status,200);
 const cookie=start.headers.get('set-cookie').split(';')[0];
 const result=await fetch(base+'/api/ask-inox',{...options,headers:{...options.headers,Cookie:cookie},body:JSON.stringify({action:'lookup',query:'What is INOX perspective?'})});
 assert.equal(result.status,200);const lookup=await result.json();if(!demo)assert.equal(lookup.products.length,0);assert.ok(lookup.sources.some(s=>/perspective/i.test(s.text)));
 if(demo){
  const list=await (await fetch(base+'/products')).text();assert.match(list,/Bottle rack/);assert.match(list,/Soft-close hinge/);
  const post=async body=>fetch(base+'/api/ask-inox',{...options,headers:{...options.headers,Cookie:cookie},body:JSON.stringify(body)});
  const exact=await (await post({action:'lookup',query:'SKU DEMO.01.101'})).json();assert.equal(exact.products.length,1);assert.deepEqual(exact.products[0].matchedVariationIds,['demo-variant-1-1']);assert.match(exact.notice,/DEMO CATALOGUE/);
  const validated=await post({action:'validate',productId:'demo-product-1',variationId:'demo-variant-1-1'});assert.equal(validated.status,200);
  const nav=await (await post({action:'navigate',destination:'DEMO.01.101'})).json();assert.ok(JSON.stringify(nav).includes('/products/demo-product-1'));
  const page=await fetch(base+'/products/demo-product-1');assert.equal(page.status,200);
  // Guard refuses before parsing or storing any enquiry or sending mail.
  const blocked=await fetch(base+'/api/enquiries',{method:'POST',headers:{'Content-Type':'application/json',Origin:base},body:'{}'});assert.equal(blocked.status,409);
  console.log('PASS: demo exact variant lookup, validation, navigation, product details and enquiry submission block.');
  if(process.argv.includes('--browser')){
   const {chromium}=await import('@playwright/test');const browser=await chromium.launch({headless:true,channel:process.env.ASK_TEST_BROWSER_CHANNEL || undefined});
   try {
    const page=await browser.newPage({viewport:{width:1280,height:900}});
    await page.goto(base+'/products/demo-product-1');
    await page.getByRole('button',{name:'Select variation DEMO.01.102',exact:true}).click();
    await page.getByRole('button',{name:'Add to enquiry',exact:true}).click();
    await page.goto(base+'/enquiry');
    await page.locator('.basket-item').filter({hasText:'DEMO.01.102'}).waitFor();
    assert.equal(await page.getByRole('button',{name:'Send enquiry',exact:true}).isDisabled(),true);
    console.log('PASS: browser selects Chrome variant, adds exact SKU to enquiry and shows review-only controls.');
   }finally{await browser.close();}
  }

 }
 console.log('PASS: Vercel-style production pages, enabled bot, redacted diagnostics and public knowledge lookup work without database/provider credentials. No provider calls or enquiries made.');
} finally {app.kill();}
