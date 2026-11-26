import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
const compile=source=>ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const url=source=>`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`;
const core=url(compile(fs.readFileSync(new URL('../src/lib/ask-inox-core.ts',import.meta.url),'utf8')));
const source=fs.readFileSync(new URL('../src/lib/ask-inox-navigation.ts',import.meta.url),'utf8').replace('"./ask-inox-core"',JSON.stringify(core));
const nav=await import(url(compile(source)));
const category=(id,name,published=true,parentId=null)=>({id,name,short:name,slug:id,published,parentId});
const categories=[category('kitchen','Kitchen fittings'),category('pantry','Pantry storage'),category('organisers','Storage accessories'),category('hidden','Hidden category',false),category('hidden-child','Hidden child',true,'hidden')];
const product={id:'rack',name:'Test bottle rack',sku:'BR-PARENT',category:'kitchen',image:null,description:'Bottle storage',finishes:[],specifications:{},variations:[{id:'black',sku:'BR-150-B',name:'Black',active:true,available:true,images:[],specifications:{},finish:'Black',colour:'Black',dimensions:'100 x 450 mm',size:'150 mm',material:'Steel',sortOrder:0,isDefault:true},{id:'inactive',sku:'PRIVATE-SKU',active:false,available:false,images:[],specifications:{}}]};
test('navigation understands English, Hindi and Hinglish commands without moving for questions or negation',()=>{
  for(const text of ['Go to the home page','Could you take me to kitchen fittings?','Kitchen category kholo','होम पेज खोलो','मुझे किचन कैटेगरी पर ले चलो','Open BR-150-B'])assert.equal(nav.isNavigationCommand(text),true,text);
  for(const text of ['Does this come in black?','Does this rack work in an open kitchen?','What happens if I say go home?','Do not open Home','Home page mat kholo','How can I open the kitchen page?'])assert.equal(nav.isNavigationCommand(text),false,text);
});
test('fixed public routes and published categories resolve to canonical site paths',()=>{
  for(const text of ['Go to the home page','Home page kholo','होम पेज खोलो'])assert.equal(nav.resolveNavigation(text,categories,[product]).navigation.href,'/');
  for(const text of ['Kitchen category kholo','Go to kitchen fittings','मुझे किचन कैटेगरी पर ले चलो'])assert.equal(nav.resolveNavigation(text,categories,[product]).navigation.href,'/products?category=kitchen');
  assert.equal(nav.resolveNavigation('Open Contact',[],[]).navigation.href,'/contact');
  assert.equal(nav.resolveNavigation('Open /about',[],[]).navigation.href,'/about');
});
test('exact SKU navigation verifies active variants and product references',()=>{
  const exact=nav.resolveNavigation('Open BR-150-B',categories,[product]);assert.equal(exact.navigation.href,'/products/rack?variation=black');
  assert.equal(nav.resolveNavigation('Open product Test bottle rack',categories,[product]).navigation.href,'/products/rack');
  assert.equal(nav.resolveNavigation('Open this product',categories,[product],'rack').navigation.href,'/products/rack');
  for(const text of ['Open PRIVATE-SKU','/products/rack?variation=inactive','Open BR-999-Z'])assert.equal(nav.resolveNavigation(text,categories,[product]).navigation,undefined,text);
});
test('ambiguous and unavailable destinations ask for clarification without guessing',()=>{
  const result=nav.resolveNavigation('Open storage category',categories,[product]);assert.equal(result.navigation,undefined);assert.equal(result.navigationChoices.length,2);
  assert.equal(nav.matchNavigationChoice('Pantry',result.navigationChoices).href,'/products?category=pantry');
  assert.equal(nav.matchNavigationChoice('Does this fit?',result.navigationChoices),undefined);
  assert.equal(nav.resolveNavigation('Open hidden category',categories,[product]).navigation,undefined);
  assert.equal(nav.resolveNavigation('/products?category=hidden-child',categories,[product]).navigation,undefined);
  assert.equal(nav.resolveNavigation('Open unicorn',categories,[product]).navigation,undefined);
});
test('navigation rejects external links, admin/API screens, script URLs and malformed routes',()=>{
  for(const href of ['https://evil.example','//evil.example','javascript:alert(1)','/admin','/api/enquiries','/ask-inox-widget','/products?category=x&next=https://evil.example','/%61dmin','/products/../admin','/products/rack#x']){
    assert.equal(nav.isSafePublicNavigation(href),false,href);assert.equal(nav.resolveNavigation(href,categories,[product]).navigation,undefined,href);
  }
  assert.equal(nav.resolveNavigation('Open admin',categories,[product]).blocked,true);
});
test('only published blog articles are navigable',()=>{
  const posts=[{slug:'public-guide',title:'Cabinet planning guide',published:true},{slug:'draft-guide',title:'Private draft',published:false}];
  assert.equal(nav.resolveNavigation('Open Cabinet planning guide',categories,[product],undefined,posts).navigation.href,'/blog/public-guide');
  assert.equal(nav.resolveNavigation('/blog/draft-guide',categories,[product],undefined,posts).navigation,undefined);
});
