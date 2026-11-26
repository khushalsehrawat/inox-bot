// Harness for the isolated loopback-only server started for this task, never Hostinger.
import mysql from 'mysql2/promise';
import { randomBytes } from 'node:crypto';
import { spawn } from 'node:child_process';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { createServer } from 'node:net';
const admin=await mysql.createConnection({host:'127.0.0.1',port:33317,user:'root',password:''});
const database=`inox_web_test_${randomBytes(6).toString('hex')}`,password=randomBytes(24).toString('hex'),user=`web_test_${randomBytes(4).toString('hex')}`;
const env={...process.env,WEB_MYSQL_HOST:'127.0.0.1',WEB_MYSQL_PORT:'33317',WEB_MYSQL_DATABASE:database,WEB_MYSQL_USER:user,WEB_MYSQL_PASSWORD:password,WEB_MYSQL_ISOLATED_TEST:'yes',WEB_MYSQL_SSL_CA:'',WEB_UNIFIED_MYSQL:'yes',WEB_UNIFIED_DATA_DIR:mkdtempSync(join(tmpdir(),'inox-mysql-media-'))};
const run=script=>new Promise((resolve,reject)=>{const child=spawn(process.execPath,[script],{env,stdio:'inherit',windowsHide:true});child.on('error',reject);child.on('exit',code=>code===0?resolve():reject(Error(`${script} failed (${code})`)));});
try {
 await admin.query(`CREATE DATABASE ${database} CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
 await admin.query(`CREATE USER '${user}'@'127.0.0.1' IDENTIFIED BY ?`,[password]);
 // Only this brand-new isolated test schema is granted DDL for the migration test.
 await admin.query(`GRANT ALL PRIVILEGES ON ${database}.* TO '${user}'@'127.0.0.1'`);
 await run('scripts/test-website-mysql.mjs');
 await admin.query(`REVOKE ALL PRIVILEGES ON ${database}.* FROM '${user}'@'127.0.0.1'`);
 const [tables]=await admin.query(`SHOW TABLES FROM ${database}`);
 for(const row of tables){const name=Object.values(row)[0];if(!/^web_[a-z_]+$/.test(name))continue;await admin.query(`GRANT SELECT,INSERT,UPDATE,DELETE ON ${database}.${name} TO '${user}'@'127.0.0.1'`);}
 await admin.query(`INSERT INTO ${database}.web_categories(id,slug,name,short,description,image,parent_id,published,sort_order) VALUES('kitchen','browser-kitchen','Browser Kitchen','Kitchen','','',NULL,1,0)`);
 const runtime=await mysql.createConnection({host:env.WEB_MYSQL_HOST,port:33317,user,password,database});
 try{await assert.rejects(runtime.query("UPDATE mobile_sentinel SET value='forbidden'"));await assert.rejects(runtime.query('CREATE TABLE forbidden_ddl(id INT)'));}finally{await runtime.end();}
 await run('scripts/test-unified-catalogue.mjs');
 // Start a fresh production app process against the same database and media directory.
 const socket=createServer();await new Promise(r=>socket.listen(0,'127.0.0.1',r));const port=socket.address().port;await new Promise(r=>socket.close(r));
 const app=spawn(process.execPath,['node_modules/next/dist/bin/next','start','--hostname','127.0.0.1','--port',String(port)],{env:{...env,NODE_ENV:'production',WEB_DATABASE_DRIVER:'mysql',WEB_CATALOGUE_DATA_DIR:env.WEB_UNIFIED_DATA_DIR,WEB_TEST_DIST_DIR:''},windowsHide:true,stdio:['ignore','pipe','pipe']});
 let logs='';app.stdout.on('data',v=>{logs+=v;});app.stderr.on('data',v=>{logs+=v;});
 try {
  for(let i=0;i<120&&!logs.includes('Ready');i++){if(app.exitCode!==null)throw Error(logs);await new Promise(r=>setTimeout(r,250));}assert.match(logs,/Ready/);
  const [saved]=await admin.query(`SELECT id FROM ${database}.web_products WHERE sku LIKE 'PARENT-%'`);const response=await fetch(`http://127.0.0.1:${port}/products/${saved[0].id}`);assert.equal(response.status,200);const html=await response.text();assert.match(html,/Unified test basket/);assert.doesNotMatch(html,/777\.77|1888\.88/);
  const [files]=await admin.query(`SELECT * FROM ${database}.web_media`);assert.ok(files.length >= 3);
  for(const file of files){const r=await fetch(`http://127.0.0.1:${port}${file.url}`);assert.equal(r.status,200);const bytes=Buffer.from(await r.arrayBuffer());assert.equal(createHash('sha256').update(bytes).digest('hex'),file.sha256);}
  console.log('PASS fresh production app process reads persisted products and serves identical image/PDF bytes from durable storage.');
 }finally{if(app.exitCode===null){const exited=new Promise(r=>app.once('exit',r));app.kill();await exited;}app.stdout.destroy();app.stderr.destroy();}
 const [sentinel]=await admin.query(`SELECT * FROM ${database}.mobile_sentinel`);assert.deepEqual(sentinel,[{id:1,value:'unchanged-mobile-fixture'}]);
 console.log(`PASS local MySQL-compatible integration with table-scoped runtime privileges; non-website sentinel unchanged. Retained schema: ${database}.`);
} finally { await admin.end(); }
