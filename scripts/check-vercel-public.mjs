// Production smoke check with no DB, provider credentials, writes or real enquiries.
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {createServer} from 'node:net';
const probe=createServer();await new Promise(r=>probe.listen(0,'127.0.0.1',r));const port=probe.address().port;await new Promise(r=>probe.close(r));
const env={...process.env,NODE_ENV:'production',VERCEL:'1',PORT:String(port),HOSTNAME:'127.0.0.1'};
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
  const r=await fetch(base+path);assert.equal(r.status,200,path);const html=await r.text();assert.match(html,/live catalogue is temporarily unavailable/i,path);
 }
 const options={method:'POST',headers:{'Content-Type':'application/json',Origin:base},body:JSON.stringify({action:'start',path:'/'})};
 const start=await fetch(base+'/api/ask-inox',options);assert.equal(start.status,200);
 const cookie=start.headers.get('set-cookie').split(';')[0];
 const result=await fetch(base+'/api/ask-inox',{...options,headers:{...options.headers,Cookie:cookie},body:JSON.stringify({action:'lookup',query:'What is INOX perspective?'})});
 assert.equal(result.status,200);const lookup=await result.json();assert.equal(lookup.products.length,0);assert.ok(lookup.sources.some(s=>/perspective/i.test(s.text)));
 console.log('PASS: Vercel-style production pages, enabled bot, redacted diagnostics and public knowledge lookup work without database/provider credentials. No provider calls or enquiries made.');
} finally {app.kill();}
