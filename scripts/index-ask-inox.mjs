// Explicit public-source allowlist. No crawling, DB reads, remote downloads, OCR or uploads.
import fs from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve, relative } from 'node:path';
import { spawnSync } from 'node:child_process';
import ts from 'typescript';
const root = process.cwd();
const manifestBytes = await fs.readFile('ask-inox.sources.json','utf8');
const manifest = JSON.parse(manifestBytes);
// Canonical text hashes survive Git line-ending conversion; binary PDFs stay exact.
const hash = (value, binary = false) => createHash('sha256').update(binary ? value : value.toString().replace(/\r\n/g, '\n')).digest('hex');
const privateText = /price|pricing|mrp|selling price|dealer|wholesale|confidential|internal only|₹|\bINR\b|\bRs\.?\s*\d/i;
const signatures = { 'ask-inox.sources.json': hash(manifestBytes) };
for (const source of manifest.sources.filter(s => s.path)) {
  const path = resolve(root,source.path);
  if (relative(root,path).startsWith('..')) throw new Error('Source must be inside checkout.');
  try { signatures[source.path] = hash(await fs.readFile(path), /\.pdf$/i.test(path)); } catch { signatures[source.path] = 'unavailable'; }
}
const destination = 'src/lib/ask-inox-documents.json';
if (process.argv.includes('--check')) {
  const saved = JSON.parse(await fs.readFile(destination,'utf8'));
  if (JSON.stringify(saved.signatures) !== JSON.stringify(signatures)) throw new Error('Ask INOX sources changed. Run npm run ask-inox:index, review the report, and commit the generated index.');
  console.log('Ask INOX approved-source index is current.');
  process.exit(0);
}
const chunks=[], report=[];
for (const source of manifest.sources) {
  const {title,href,path}=source;
  if (!source.approved || !path || signatures[path] === 'unavailable') { report.push({title,status:'unavailable',reason: !source.approved ? 'No separately approved source supplied.' : 'Source file unavailable.'}); continue; }
  const text = await fs.readFile(path);
  if (path.endsWith('.pdf')) {
    // pypdf is optional; absence must appear in the report instead of silently skipping a PDF.
    const result = spawnSync(process.env.ASK_INOX_PYTHON || 'python',['-c', 'import json,sys; from pypdf import PdfReader; r=PdfReader(sys.argv[1]); print(json.dumps([p.extract_text() or "" for p in r.pages]))',path],{encoding:'utf8',maxBuffer:16*1024*1024,windowsHide:true,timeout:120000});
    if (result.status !== 0) { report.push({title,status:'manual-review',reason:'PDF extraction unavailable. Install Python pypdf or supply reviewed text; no PDF text indexed.'}); continue; }
    const pages=JSON.parse(result.stdout), ocr=[], review=[], indexed=[];
    for (let i=0;i<pages.length;i++) {
      const content=pages[i].replace(/\s+/g,' ').trim();
      if (content.length < 60) { ocr.push(i+1); continue; }
      if (privateText.test(content)) { review.push(i+1); continue; }
      for(let offset=0;offset<content.length;offset+=1200) chunks.push({title,href:`${href}#page=${i+1}`,page:i+1,text:content.slice(offset,offset+1400)});
      indexed.push(i+1);
    }
    report.push({title,status:ocr.length || review.length ? 'manual-review' : 'indexed',pages:pages.length,indexedPages:indexed,needsOCR:ocr,excludedForPricingOrPrivateText:review});
    continue;
  }
  let content=[];
  if (path.endsWith('.html')) {
    content=[text.toString('utf8').replace(/<(script|style|svg)\b[^>]*>[\s\S]*?<\/\1>/gi,' ').replace(/<[^>]+>/g,' ').replace(/&nbsp;/g,' ').replace(/&amp;/g,'&').replace(/\s+/g,' ').trim()];
  } else {
    const file=ts.createSourceFile(path,text.toString('utf8'),ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
    let scope=file;
    if(source.collection) {
      const visit=node=>{if(ts.isVariableDeclaration(node) && node.name.getText(file)==='collections' && node.initializer && ts.isObjectLiteralExpression(node.initializer)) {scope=node.initializer.properties.find(p=>p.name?.getText(file)===source.collection) || file;}ts.forEachChild(node,visit);};
      visit(file);
    }
    const visit=node=>{
      if(source.collection && ts.isStringLiteral(node) && !/^(image|alt)$/.test(node.parent.name?.getText(file) || '')) content.push(node.text);
      else if(!source.collection && ts.isJsxText(node)) content.push(node.text);
      else if(!source.collection && ts.isPropertyAssignment(node) && node.name.getText(file)==='description' && ts.isStringLiteral(node.initializer)) content.push(node.initializer.text);
      ts.forEachChild(node,visit);
    };
    visit(scope);
  }
  const cleaned=content.map(s=>s.replace(/\s+/g,' ').trim()).filter(s=>s.length>18 && !/confidential|internal only|dealer price|wholesale|\bINR\s*\d/i.test(s) && !/^\/|\.(png|webp|jpg)$/.test(s)).join(' ');
  for(let offset=0;offset<cleaned.length;offset+=1200) chunks.push({title,href,text:cleaned.slice(offset,offset+1400)});
  report.push({title,status:cleaned ? 'indexed' : 'manual-review',characters:cleaned.length});
}
await fs.writeFile(destination,JSON.stringify({version:1,signatures,chunks},null,2)+'\n');
await fs.mkdir('docs',{recursive:true});
await fs.writeFile('docs/ask-inox-index-report.json',JSON.stringify({sources:report},null,2)+'\n');
console.log(JSON.stringify({chunks:chunks.length,report:'docs/ask-inox-index-report.json',sources:report}));
