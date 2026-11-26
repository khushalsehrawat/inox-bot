import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
const source=fs.readFileSync(new URL('../src/lib/ask-inox-core.ts',import.meta.url),'utf8');
const js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const core=await import(`data:text/javascript;base64,${Buffer.from(js).toString('base64')}`);
const variant={id:'black',sku:'BR-150-B',name:'Black',active:true,available:true,dimensions:'100 x 450 x 500 mm',finish:'Black',colour:'Black',material:'Steel',size:'150 mm cabinet',images:[],specifications:{Capacity:'3 bottles',MRP:'9999'},mrp:'9999',sellingPrice:'8888',sortOrder:0,isDefault:true};
const product={id:'rack',name:'Bottle rack',sku:'BR-PARENT',category:'kitchen-id',description:'Bottle storage\nDealer price: 4444',keyFeatures:'Pull-out',image:null,images:[],finishes:['Black','Chrome'],specifications:{Mounting:'Side mount',Price:'5555'},variations:[variant,{...variant,id:'chrome',sku:'BR-200-C',finish:'Chrome',colour:'Silver',size:'200 mm cabinet',dimensions:'150 x 450 x 500 mm'},{...variant,id:'hidden',sku:'PRIVATE-SKU',active:false}]};
test('Ask INOX exact SKU and conversational product lookup return authoritative variants',()=>{
  const exact=core.searchCatalogue([product],'Please show me BR-150-B');
  assert.deepEqual(exact.products[0].matchedVariationIds,['black']);
  const dictated=core.searchCatalogue([product],'SKU B R one five zero B');
  assert.deepEqual(dictated.products[0].matchedVariationIds,['black']);
  assert.deepEqual(core.searchCatalogue([product],'SKU बी आर एक पांच शून्य बी').products[0].matchedVariationIds,['black']);
  assert.equal(core.searchCatalogue([product],'I need a bottle rack').products[0].id,'rack');
  assert.equal(core.searchCatalogue([product],'BR-150-BX').products[0]?.matchedVariationIds.length || 0,0);
  assert.equal(core.searchCatalogue([product],'SKU BR-150-BX').products.length,0);
});
test('spoken reference numbers resolve exact published variants without substituting nearby references',()=>{
  const referenced={...product,variations:[{...variant,sku:'H6.01.101'}]};
  for(const query of ['Reference: H6.01.101','reference H six dot zero one dot one zero one','reference aitch six point oh one point one oh one','H 6 dot 0 1 dot 1 0 1']){
    assert.deepEqual(core.searchCatalogue([referenced],query).products[0]?.matchedVariationIds,['black'],query);
  }
  assert.equal(core.searchCatalogue([referenced],'reference H six dot zero one dot one zero two').products.length,0);
});

test('Ask INOX public projection strips prices, private fields and inactive variants',()=>{
  const result=core.safeProduct({...product,internalCost:'7777',mrp:'9999'});
  const json=JSON.stringify(result);
  for(const value of ['9999','8888','4444','5555','7777','PRIVATE-SKU','sellingPrice','internalCost'])assert.equal(json.includes(value),false,value);
  assert.equal(result.variations.length,2);
  assert.deepEqual(core.publicSpecs({'Internal clear opening':'150 mm'}),{'Internal clear opening':'150 mm'});
});
test('Ask INOX Hinglish measurement query requires internal versus external opening before fit',()=>{
  const query='Mere paas 150 mm ka cabinet hai, koi bottle rack milega?';
  const result=core.searchCatalogue([product],query);
  assert.equal(result.products[0].id,'rack');assert.match(result.clarification,/internal clear opening.*external cabinet width/);
  assert.match(core.searchCatalogue([product],'Will this fit my cabinet?','rack').clarification,/usable depth/);
});
test('Ask INOX follows the current product and remembers discussed products for comparisons',()=>{
  for(const question of ['Does this come in black?','क्या यह काले रंग में उपलब्ध है?'])assert.equal(core.searchCatalogue([product],question,'rack').products[0].id,'rack');
  const result=core.searchCatalogue([product],'Compare both variants',undefined,['rack']);
  assert.deepEqual(result.products[0].variations.map(v=>v.sku),['BR-150-B','BR-200-C']);
  assert.equal(core.searchCatalogue([product],'kitchen',undefined,[],{'kitchen-id':'Kitchen fittings'}).products.length,1);
});
test('Ask INOX unavailable products return no verified matches',()=>{
  const unknown=core.searchCatalogue([],'unicorn rack');
  assert.deepEqual(unknown.products,[]);
});
test('Ask INOX approved document search preserves brochure page citations',()=>{
  const source={title:'XCOMB brochure',text:'Honeycomb panel construction',href:'/media/example.pdf#page=7',page:7};
  assert.deepEqual(core.searchSources([source],'XCOMB panel'),[source]);
  assert.deepEqual(core.searchSources([source],'unicorn'),[]);
});

 test('INOX perspective and public policy questions retrieve website sources without a product match',()=>{
 const index=JSON.parse(fs.readFileSync(new URL('../src/lib/ask-inox-documents.json',import.meta.url),'utf8'));
 const result=core.searchSources(index.chunks,'What is INOX perspective?');
 assert.ok(result.some(s=>s.href==='/' && /best details|demand more/i.test(s.text)));
 assert.ok(result.some(s=>/perspective/i.test(s.text)));
 assert.ok(core.searchSources(index.chunks,'privacy policy').some(s=>s.href==='/privacy'));
 assert.equal(core.searchCatalogue([],'What is INOX perspective?').products.length,0);
 });
