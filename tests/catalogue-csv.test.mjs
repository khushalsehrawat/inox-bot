import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { openTaxonomy } from '../src/lib/web-taxonomy-store.mjs';
import { prepareCatalogueImport } from '../src/lib/catalogue-import.mjs';
import { catalogueCSV, catalogueRows, readCatalogueCSV } from '../src/lib/catalogue-csv.mjs';
function setup(){const store=openTaxonomy(':memory:',[{id:'kitchen',name:'Kitchen'}]);return store;}
function input(sku='OPTION-1'){return {productSku:'BASKET',productName:'Basket',category:'kitchen',sku,description:'Line one, "quoted"\nLine two',active:'true',available:'true',webVisible:'true'};}
test('new CSV import publishes, exported IDs permit SKU edits, images and prices survive round trip',()=>{
 const s=setup();try{
  s.saveProducts(prepareCatalogueImport([input()],s.list(),[]));
  let p=s.productDrafts()[0];assert.equal(p.webVisible,true);
  const image=`/api/web/product-media/${randomUUID()}.webp`;
  p=s.saveProduct({...p,images:[image],variations:p.variations.map(v=>({...v,images:[image],mrp:'100.00',sellingPrice:'80.00'}))});
  const rows=readCatalogueCSV(catalogueCSV(catalogueRows([p])));
  rows[0].productSku='RENAMED';rows[0].sku='RENAMED-OPTION';rows[0].productName='Renamed basket';
  s.saveProducts(prepareCatalogueImport(rows,s.list(),s.productDrafts()));
  const saved=s.productDrafts();assert.equal(saved.length,1);assert.equal(saved[0].id,p.id);assert.equal(saved[0].sku,'RENAMED');assert.equal(saved[0].variations[0].id,p.variations[0].id);assert.deepEqual(saved[0].images,[image]);assert.deepEqual(saved[0].variations[0].images,[image]);assert.equal(saved[0].variations[0].sellingPrice,'80.00');assert.equal(saved[0].description,p.description);
  assert.throws(()=>prepareCatalogueImport(rows,s.list(),saved),/changed/);
 }finally{s.close();}
});
test('atomic bulk save rolls back earlier writes when a later product fails',()=>{
 const s=setup();try{const drafts=prepareCatalogueImport([input(),{...input('SECOND-1'),productSku:'SECOND',productName:'Second'}],s.list(),[]);drafts[1].category='missing';assert.throws(()=>s.saveProducts(drafts));assert.equal(s.productDrafts().length,0);}finally{s.close();}
});
test('CSV preserves special characters, leading zero SKUs and formula-like text',()=>{
 const row={...input('00123'),productName:'=Example',description:'Quotes " and commas,\nnew line'};
 assert.deepEqual(readCatalogueCSV(catalogueCSV([row]))[0].description,row.description);assert.equal(readCatalogueCSV(catalogueCSV([row]))[0].productName,row.productName);assert.equal(readCatalogueCSV(catalogueCSV([row]))[0].sku,'00123');
 assert.throws(()=>readCatalogueCSV('productSku,productName,category,sku\nA,B,kitchen,C,extra'),/Row 2/);
 assert.throws(()=>readCatalogueCSV('productSku,productName,category,sku,images\nA,B,kitchen,C,test'),/Unknown column/);
 for(const description of ["'-quoted", "'plain", '-dash', '@text']) assert.equal(readCatalogueCSV(catalogueCSV([{...row,description}]))[0].description,description);
});
test('invalid flags, duplicate rows and variation collisions fail before save',()=>{
 const s=setup();try{assert.throws(()=>prepareCatalogueImport([{...input(),active:'yes'}],s.list(),[]),/Row 2.*active/);assert.throws(()=>prepareCatalogueImport([input(),input()],s.list(),[]),/Duplicate/);s.saveProducts(prepareCatalogueImport([input()],s.list(),[]));assert.throws(()=>prepareCatalogueImport([{...input(),productSku:'OTHER',productName:'Other'}],s.list(),s.productDrafts()),/Basket/);}finally{s.close();}
});
test('partial spreadsheet edits preserve omitted variations and cannot use another product ID',()=>{
 const s=setup();try{s.saveProducts(prepareCatalogueImport([input(),input('OPTION-2')],s.list(),[]));const p=s.productDrafts()[0];const rows=readCatalogueCSV(catalogueCSV(catalogueRows([p]))).slice(0,1);rows[0].sku='UPDATED';const [draft]=prepareCatalogueImport(rows,s.list(),[p]);assert.equal(draft.variations.length,2);assert.throws(()=>prepareCatalogueImport([{...rows[0],productId:randomUUID()}],s.list(),[p]),/ID not found/);}finally{s.close();}
});
