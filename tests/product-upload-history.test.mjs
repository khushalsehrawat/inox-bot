import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { openTaxonomy } from '../src/lib/web-taxonomy-store.mjs';
import { productUploadHistory } from '../src/lib/product-upload-history.mjs';

const product = sku => ({id:randomUUID(),sku,name:sku,category:'kitchen',webVisible:false,variations:[{id:randomUUID(),sku:`${sku}-1`,active:true,available:true}]});

test('upload counts persist, distinguish creates and updates, and ignore supplied history',()=>{
  const path=join(mkdtempSync(join(tmpdir(),'inox-upload-history-')),'catalogue.sqlite');
  let store=openTaxonomy(path,[{id:'kitchen',name:'Kitchen'}]);
  const saved=store.saveProducts([product('ONE'),product('TWO')]);
  assert.deepEqual(store.uploadHistory().map(({date,...counts})=>counts),[{created:2,updated:0,total:2,uploads:1}]);
  store.saveProduct({...saved[0],name:'Updated',uploadHistory:[{uploadedAt:'2000-01-01',action:'created'}]});
  const before=store.uploadHistory();
  assert.equal(before[0].created,2);assert.equal(before[0].updated,1);assert.equal(before[0].uploads,2);
  assert.throws(()=>store.saveProducts([product('THREE'),{...product('FOUR'),category:'missing'}]));
  assert.deepEqual(store.uploadHistory(),before);
  store.close();store=openTaxonomy(path);
  try{assert.deepEqual(store.uploadHistory(),before);}finally{store.close();}
});

test('daily totals use Indian calendar dates and shared batches count once',()=>{
  const batch={batchId:'one',uploadedAt:'2026-10-28T20:00:00Z',action:'created'};
  const result=productUploadHistory([{uploadHistory:[batch]},{uploadHistory:[batch,{batchId:'two',uploadedAt:'2026-10-28T18:00:00Z',action:'updated'}]},{}]);
  assert.deepEqual(result,[{date:'2026-10-29',created:2,updated:0,total:2,uploads:1},{date:'2026-10-28',created:0,updated:1,total:1,uploads:1}]);
});
