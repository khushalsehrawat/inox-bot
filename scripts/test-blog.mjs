import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createServer } from 'node:http';
import { randomUUID } from 'node:crypto';
import { hashWebsiteAdminPassword } from '../src/lib/website-admin-auth.mjs';
import { importLocalBlogs } from './migrate-blogs.mjs';
const listen=s=>new Promise(resolve=>s.listen(0,'127.0.0.1',resolve));
const auth=createServer((req,res)=>{res.setHeader('Content-Type','application/json');if(req.url==='/api/v1/auth/me'){res.statusCode=req.headers.authorization==='Bearer isolated-customer'?200:401;res.end(JSON.stringify({success:res.statusCode===200,data:{user:{id:'test-customer',email:'customer@example.test',role:'architect'}}}));}else {res.statusCode=404;res.end('{}');}});
await listen(auth);
const portServer=createServer();await listen(portServer);const port=portServer.address().port;await new Promise(r=>portServer.close(r));
const base=`http://127.0.0.1:${port}`,directory=process.env.WEB_UNIFIED_DATA_DIR || mkdtempSync(join(process.cwd(),'.test-web-taxonomy-blog-'));
await importLocalBlogs(directory);
const env={...process.env,NODE_ENV:'development',WEB_TEST_DIST_DIR:`.next-taxonomy-e2e/run-${randomUUID()}`,WEB_DATABASE_DRIVER:'sqlite',WEB_MYSQL_HOST:'',WEB_MYSQL_DATABASE:'',WEB_MYSQL_USER:'',WEB_MYSQL_PASSWORD:'',WEB_CATALOGUE_DATA_DIR:directory,WEB_ADMIN_EMAIL:'website-admin@example.test',WEB_ADMIN_PASSWORD_HASH:await hashWebsiteAdminPassword('Isolated-test-admin9!'),WEB_ADMIN_SESSION_SECRET:'isolated-test-secret-'.repeat(3),INOX_API_ORIGIN:`http://127.0.0.1:${auth.address().port}`,WEB_UNIFIED_TEST_URL:base};

const server=spawn(process.execPath,['node_modules/next/dist/bin/next','dev','--webpack','--hostname','127.0.0.1','--port',String(port)],{env,windowsHide:true,stdio:['ignore','pipe','pipe']});
let logs='';server.stdout.on('data',v=>{logs+=v;});server.stderr.on('data',v=>{logs+=v;});
try{
 for(let i=0;i<120&&!logs.includes('Ready');i++){if(server.exitCode!==null)throw Error(logs);await new Promise(r=>setTimeout(r,500));}
 assert.match(logs,/Ready/);
 const browser=spawn(process.execPath,['node_modules/@playwright/test/cli.js','test','tests/browser/blog.spec.ts',...process.argv.slice(2)],{env,stdio:'inherit',windowsHide:true});
 const code=await new Promise(r=>browser.once('exit',r));assert.equal(code,0);
 console.log(`PASS. Isolated blog and comment fixtures retained for inspection at ${directory}. No production connection was used.`);
}catch(error){console.error(logs);throw error;}
finally{if(server.exitCode===null){const exited=new Promise(r=>server.once('exit',r));server.kill();await exited;}server.stdout.destroy();server.stderr.destroy();await new Promise(r=>auth.close(r));}
