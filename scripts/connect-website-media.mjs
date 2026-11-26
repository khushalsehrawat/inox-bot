// Explicit website-only migration and checksum-verified import of upload bytes.
import fs from 'node:fs';
import path from 'node:path';
import {parseEnv} from 'node:util';
import {createHash} from 'node:crypto';
import mysql from 'mysql2/promise';
const env=parseEnv(fs.readFileSync('.env.local','utf8'));
if(env.WEB_MYSQL_DATABASE!=='u439578485_inox')throw Error('Unexpected database');
const sql=fs.readFileSync('migrations/website/003_media_content.sql','utf8').replace(/^--.*$/gm,'');
const statements=sql.split(';').map(s=>s.trim()).filter(Boolean);
if(statements.length!==2 || !statements[0].startsWith('CREATE TABLE web_media_content (') || statements[1]!=='INSERT INTO web_schema_versions(version) VALUES(3)')throw Error('Unexpected migration scope');
const digest=bytes=>createHash('sha256').update(bytes).digest('hex');
const c=await mysql.createConnection({host:env.WEB_MYSQL_HOST,port:Number(env.WEB_MYSQL_PORT||3306),database:env.WEB_MYSQL_DATABASE,user:env.WEB_MYSQL_USER,password:env.WEB_MYSQL_PASSWORD,multipleStatements:false,ssl:env.WEB_MYSQL_SSL_CA?{ca:fs.readFileSync(env.WEB_MYSQL_SSL_CA),rejectUnauthorized:true}:undefined});
try{
 const [versions]=await c.execute('SELECT version FROM web_schema_versions ORDER BY version');
 if(versions.map(v=>v.version).join(',')!=='1,2')throw Error('Unexpected migration state; stop rather than retry');
 const [collisions]=await c.execute("SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='web_media_content'");
 if(collisions.length)throw Error('Table collision; stop');
 const [packet]=await c.query('SELECT @@max_allowed_packet AS bytes');
 if(Number(packet[0].bytes)<12*1024*1024)throw Error('Server packet limit too small for 10MB PDF uploads');
 const [media]=await c.execute('SELECT url,byte_length,sha256 FROM web_media');
 const files=media.map(m=>{
  const match=/^\/api\/web\/(product-media|category-images)\/([a-f0-9-]{36}\.(?:webp|pdf))$/.exec(m.url);
  if(!match)throw Error('Unexpected media reference');
  const bytes=fs.readFileSync(path.join(env.WEB_CATALOGUE_DATA_DIR,match[1]==='product-media'?'product-media':'media',match[2]));
  if(bytes.length!==m.byte_length||digest(bytes)!==m.sha256)throw Error('Source media checksum mismatch');
  return {...m,bytes};
 });
 if(!process.argv.includes('--apply')){console.log(JSON.stringify({status:'PLAN_VALID',files:files.length,bytes:files.reduce((n,f)=>n+f.bytes.length,0),packetLimit:Number(packet[0].bytes)}));}
 else{
  await c.query(statements[0]);
  await c.beginTransaction();
  try{
   for(const f of files){await c.execute('INSERT INTO web_media_content(url,content) VALUES(?,?)',[f.url,f.bytes]);const [saved]=await c.execute('SELECT content FROM web_media_content WHERE url=?',[f.url]);if(digest(saved[0].content)!==f.sha256)throw Error('Stored content mismatch');}
   await c.query(statements[1]);await c.commit();
  }catch(e){await c.rollback();throw e;}
  const report={appliedAt:new Date().toISOString(),table:'web_media_content',migrationSha256:digest(sql),files:files.map(f=>({url:f.url,bytes:f.byte_length,sha256:f.sha256})),mobileWrites:0};
  fs.writeFileSync('.private-web-db/website-media-cutover.json',JSON.stringify(report,null,2),{flag:'wx',mode:0o600});
  console.log(JSON.stringify({status:'PASS',files:files.length,storedInDatabase:true,mobileWrites:0}));
 }
}catch(e){console.error(JSON.stringify({status:'STOPPED_DO_NOT_RETRY_BLINDLY',code:e.code||'VALIDATION',message:e.code?'Database operation failed':e.message}));process.exitCode=1;}
finally{await c.end();}
