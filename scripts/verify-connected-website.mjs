// Read-only smoke test against the configured database and a task-owned local app.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { parseEnv } from 'node:util';
import { createHash } from 'node:crypto';
import { createServer } from 'node:net';
import { spawn } from 'node:child_process';
import { websiteAdminConfig, createWebsiteAdminSession } from '../src/lib/website-admin-auth.mjs';
const env = parseEnv(fs.readFileSync('.env.local','utf8'));
Object.assign(process.env,env);
const {websitePool} = await import('../src/lib/web-mysql.mjs');
const {mysqlStore} = await import('../src/lib/web-mysql-store.mjs');
const pool=websitePool();
const directory=fs.mkdtempSync(path.join(os.tmpdir(),'inox-connected-readonly-'));
// Deliberately empty: image/PDF serving must work with NO deployment-local files.
const socket=createServer();await new Promise(r=>socket.listen(0,'127.0.0.1',r));const port=socket.address().port;await new Promise(r=>socket.close(r));
const base=`http://127.0.0.1:${port}`;
const server=spawn(process.execPath,['node_modules/next/dist/bin/next','start','--hostname','127.0.0.1','--port',String(port)],{env:{...process.env,...env,NODE_ENV:'production',WEB_TEST_DIST_DIR:'',WEB_CATALOGUE_DATA_DIR:directory},windowsHide:true,stdio:['ignore','pipe','pipe']});
let ready=false;server.stdout.on('data',b=>{if(b.toString().includes('Ready'))ready=true;});server.stderr.on('data',()=>{});
const digest=bytes=>createHash('sha256').update(bytes).digest('hex');
const testUploads=[];
try {
  for(let i=0;i<100&&!ready;i++){if(server.exitCode!==null)throw Error('Production app failed to start');await new Promise(r=>setTimeout(r,200));}
  assert.ok(ready);
  const store=mysqlStore();const saved=await store.productDrafts();assert.equal(saved.length,2);
  const categories=await fetch(`${base}/api/web/categories`);assert.equal(categories.status,200);assert.ok((await categories.json()).categories.length>0);
  for(const route of ['/','/products'])assert.equal((await fetch(base+route)).status,200);
  const headers={Cookie:`inox_website_admin=${createWebsiteAdminSession(websiteAdminConfig(env))}`};
  const admin=await fetch(`${base}/api/admin/products`,{headers});assert.equal(admin.status,200);assert.equal((await admin.json()).drafts.length,saved.length);
  const customers=await fetch(`${base}/api/admin/website-customers`,{headers});assert.equal(customers.status,200);assert.ok(Array.isArray((await customers.json()).customers));
  assert.equal((await fetch(`${base}/api/admin/website-customers`)).status,401);
  const prices=await fetch(`${base}/api/customer/prices`);assert.equal(prices.status,401);assert.ok(!('prices' in await prices.json()));
  if(process.argv.includes('--test-uploads')){
    const sharp=(await import('sharp')).default;
    const png=await sharp({create:{width:12,height:12,channels:3,background:'#722b40'}}).png().toBuffer();
    for(const [endpoint,type,bytes] of [['/api/admin/product-media','image/png',png],['/api/admin/product-media','application/pdf',Buffer.from('%PDF-1.4\n1 0 obj<</Type/Catalog>>endobj\n%%EOF\n')],['/api/admin/web-categories/uploads','image/png',png]]){
      const response=await fetch(base+endpoint,{method:'POST',headers:{...headers,Origin:base,'Content-Type':type},body:bytes});assert.equal(response.status,201);
      const {url}=await response.json();assert.match(url,/^\/api\/web\/(product-media|category-images)\/[a-f0-9-]{36}\.(webp|pdf)$/);testUploads.push(url);
      const [stored]=await pool.execute('SELECT c.content,m.sha256 FROM web_media_content c JOIN web_media m ON m.url=c.url WHERE c.url=?',[url]);assert.equal(stored.length,1);assert.equal(digest(stored[0].content),stored[0].sha256);
      const preview=url.includes('/product-media/')?`/api/admin/product-media?filename=${url.split('/').at(-1)}`:`/api/admin/web-categories/media/${url.split('/').at(-1)}`;
      const shown=await fetch(base+preview,{headers});assert.equal(shown.status,200);assert.equal(digest(Buffer.from(await shown.arrayBuffer())),stored[0].sha256);
      assert.equal((await fetch(base+url)).status,404,'Unpublished uploads must stay private');
    }
  }
  let pages=0,files=0;
  for(const product of saved.filter(p=>p.webVisible)){
    const response=await fetch(`${base}/products/${product.id}`);assert.equal(response.status,200);const html=await response.text();assert.ok(html.includes(product.name));assert.doesNotMatch(html,/"sellingPrice"\s*:|"mrp"\s*:/);
    pages++;
    const urls=new Set([...product.images,...product.variations.filter(v=>v.active).flatMap(v=>v.images),...(product.pdf?[product.pdf]:[])]);
    for(const url of urls){const [metadata]=await pool.execute('SELECT sha256 FROM web_media WHERE url=?',[url]);assert.equal(metadata.length,1);const image=await fetch(base+url);assert.equal(image.status,200);assert.equal(digest(Buffer.from(await image.arrayBuffer())),metadata[0].sha256);files++;}
  }
  const before=JSON.parse(fs.readFileSync('.private-web-db/website-cutover-before.json','utf8'));
  const connection=await pool.getConnection();
  try {
    await connection.query('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ');await connection.query('SET TRANSACTION READ ONLY');await connection.beginTransaction();
    for(const table of before.tables){const name='`'+table.name.replaceAll('`','``')+'`';const [ddl]=await connection.query(`SHOW CREATE TABLE ${name}`);const [rows]=await connection.query(`SELECT * FROM ${name}`);assert.equal(digest(JSON.stringify(ddl)),table.schemaSha256,`App schema changed: ${table.name}`);assert.equal(digest(JSON.stringify(rows.map(r=>digest(JSON.stringify(r))).sort())),table.dataSha256,`App records changed: ${table.name}`);}
    await connection.rollback();
  }finally{connection.release();}
  const report={checkedAt:new Date().toISOString(),database:env.WEB_MYSQL_DATABASE,products:saved.length,productPages:pages,publicFileChecks:files,adminAndPublicShareDatabase:true,anonymousPricesBlocked:true,websiteCustomerAdminReadable:true,appTablesVerifiedUnchanged:before.tables.length,uploadsVerified:testUploads.length,localMediaFiles:0};
  fs.writeFileSync('.private-web-db/connected-website-verification.json',JSON.stringify(report,null,2),{mode:0o600});
  console.log(JSON.stringify({status:'PASS',...report}));
} finally {
  // Only UUID uploads created by this invocation; existing product media untouched.
  for(const url of testUploads)await pool.execute('DELETE FROM web_media WHERE url=?',[url]);
  if(server.exitCode===null){const ended=new Promise(r=>server.once('exit',r));server.kill();await ended;}
  server.stdout.destroy();server.stderr.destroy();await pool.end();
}
