// Hostinger runtime smoke with all DB, SMTP and provider credentials deliberately blank.
import {spawn} from 'node:child_process';
import {createServer} from 'node:net';
import assert from 'node:assert/strict';
const port=await new Promise(resolve=>{const s=createServer();s.listen(0,'127.0.0.1',()=>{const p=s.address().port;s.close(()=>resolve(p));});});
const base=`http://127.0.0.1:${port}`;
for(const enabled of [false,true]){
  const server=spawn(process.execPath,['hostinger-build/server.js'],{windowsHide:true,stdio:'ignore',env:{...process.env,NODE_ENV:'production',PORT:String(port),ASK_INOX_ENABLED:String(enabled),OPENAI_API_KEY:'',GEMINI_API_KEY:'',WEB_MYSQL_HOST:'',WEB_MYSQL_USER:'',WEB_MYSQL_PASSWORD:'',WEB_MYSQL_DATABASE:'',ENQUIRY_SMTP_USER:'',ENQUIRY_SMTP_APP_PASSWORD:''}});
  try{
    let ready=false;for(let i=0;i<100;i++){try{const r=await fetch(`${base}/api/ask-inox`);if(r.ok){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,200));}
    assert(ready,'Standalone readiness');
    assert.equal((await (await fetch(`${base}/api/ask-inox`)).json()).enabled,enabled);
    const post=async(data,cookie)=>fetch(`${base}/api/ask-inox`,{method:'POST',headers:{Origin:base,'Content-Type':'application/json',...(cookie?{Cookie:cookie}:{})},body:JSON.stringify(data)});
    const start=await post({action:'start'});assert.equal(start.status,enabled?200:404);
    if(enabled){
      const data=await start.json();assert.equal(data.mode,'gemini');assert.equal(data.liveAvailable,false);assert.equal(data.geminiAvailable,false);
      const cookie=start.headers.get('set-cookie').split(';')[0];
      const home=await post({action:'navigate',destination:'Home'},cookie);assert.equal(home.status,200);assert.equal((await home.json()).navigation.href,'/');
      const admin=await post({action:'navigate',destination:'/admin'},cookie);assert.equal(admin.status,200);assert.equal((await admin.json()).blocked,true);
    }
    for(const path of ['/fonts/manrope-variable.ttf','/ask-inox-audio-worklet.js','/ask-inox-bridge.js','/media/collection.pdf'])assert.equal((await fetch(base+path)).status,200,path);
    console.log(`Hostinger standalone: feature ${enabled?'on':'off'}, session boundary and bundled static assets passed.`);
  }finally{server.kill();await new Promise(resolve=>server.once('exit',resolve));}
}
console.log('No catalogue queries, provider connections, database writes or enquiries were made.');
