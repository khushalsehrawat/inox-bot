import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { validateVariations, selectVariation, publicVariation, money } from '../src/lib/variations.mjs';
import { prepareCatalogueImport } from '../src/lib/catalogue-import.mjs';
import { openTaxonomy } from '../src/lib/web-taxonomy-store.mjs';
const variation=(extra={})=>({id:randomUUID(),sku:randomUUID(),name:'Standard',active:true,available:true,isDefault:false,mrp:'1234.50',sellingPrice:'999.99',images:[],specifications:{},...extra});
const categories=[{id:'kitchen',name:'Kitchen',slug:'kitchen',parentId:null,published:true}];
test('default normalization chooses active available row in order and removes duplicate defaults',()=>{
 const a=variation({isDefault:true,available:false}),b=variation(),c=variation({isDefault:true});
 const rows=validateVariations([a,b,c]);assert.equal(selectVariation(rows).id,c.id);assert.equal(rows.filter(v=>v.isDefault).length,1);
 const fallback=validateVariations([a,b]);assert.equal(selectVariation(fallback).id,b.id);
 assert.equal(selectVariation(validateVariations([variation({active:false}),b])).id,b.id);
});
test('money is exact to two decimals and rejects invalid or excessive prices',()=>{
 assert.equal(money('0'),'0.00');assert.equal(money('99999999.99'),'99999999.99');
 for(const value of ['1.001',-1,'Infinity','1e3','100000000.00'])assert.throws(()=>money(value));
 assert.throws(()=>validateVariations([variation({mrp:'10',sellingPrice:'11'})]));
 assert.throws(()=>validateVariations([variation({mrp:null})]));
 const a=variation();assert.throws(()=>validateVariations([a,{...a,id:randomUUID()}]),/unique/);
});
test('public variation projection removes all stored price fields',()=>{
 const v=publicVariation({...validateVariations([variation()])[0],amount:42,privateCost:17});assert.equal('mrp' in v,false);assert.equal('sellingPrice' in v,false);assert.equal('amount' in v,false);assert.equal('privateCost' in v,false);assert.doesNotMatch(JSON.stringify(v),/1234\.50|999\.99/);
});
test('variation imports group parents, normalize defaults, reject unrelated overwrites and cross-product SKUs',()=>{
 const row={productSku:'PRODUCT-A',productName:'Basket',category:'kitchen',variationName:'Small',sku:'SMALL',mrp:'100',sellingPrice:'80'};
 const products=prepareCatalogueImport([row,{...row,sku:'LARGE',variationName:'Large',isDefault:'true'},{...row,productSku:'PRODUCT-B',sku:'OTHER'}],categories,[]);
 assert.equal(products.length,2);assert.equal(products[0].variations.length,2);assert.equal(products[0].variations.find(v=>v.isDefault).sku,'LARGE');assert.equal(products[0].webVisible,true);
 assert.throws(()=>prepareCatalogueImport([row],categories,products),/version is missing/);
 assert.throws(()=>prepareCatalogueImport([row,{...row,productSku:'PRODUCT-B'}],categories,[]),/already used by product/);
 assert.throws(()=>prepareCatalogueImport([row,{...row,productName:'Mismatch',sku:'OTHER'}],categories,[]),/agree/);
});
test('product and variation prices persist after close; rejected saves do not change the product',()=>{
 const file=join(mkdtempSync(join(tmpdir(),'inox-variations-')),'catalogue.sqlite');let store=openTaxonomy(file,categories);
 const draft={id:randomUUID(),sku:'BASKET',name:'Basket',category:'kitchen',webVisible:true,images:[],pdf:'',variations:[variation(),variation()]};
 const saved=store.saveProduct(draft);store.close();store=openTaxonomy(file,categories);
 assert.equal(store.productDrafts()[0].variations[1].sellingPrice,'999.99');
 assert.throws(()=>store.saveProduct({...saved,variations:[variation({sellingPrice:'99999999.999'})]}));
 assert.equal(store.productDrafts()[0].version,1);
 const next=store.saveProduct({...saved,variations:saved.variations.map((v,i)=>({...v,sellingPrice:i?'900.00':'800.00'}))});assert.equal(next.variations[0].sellingPrice,'800.00');store.close();
});
