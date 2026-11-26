// Explicit opt-in. This script refuses a shared/production database name and requires an EMPTY schema.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { websitePool } from '../src/lib/web-mysql.mjs';
import { mysqlStore } from '../src/lib/web-mysql-store.mjs';
if(process.env.WEB_MYSQL_ISOLATED_TEST !== 'yes' || !/^inox_web_test_[a-z0-9_]+$/.test(process.env.WEB_MYSQL_DATABASE || ''))throw Error('Set WEB_MYSQL_ISOLATED_TEST=yes and use an empty inox_web_test_* schema.');
const pool=websitePool();
try {
 const [tables]=await pool.query('SHOW TABLES');assert.equal(tables.length,0,'Use a fresh, empty isolated database.');
 await pool.query('CREATE TABLE mobile_sentinel(id INT PRIMARY KEY, value VARCHAR(100) NOT NULL)');await pool.execute('INSERT INTO mobile_sentinel VALUES(?,?)',[1,'unchanged-mobile-fixture']);
 const sql=await readFile(new URL('../migrations/website/001_catalogue.sql',import.meta.url),'utf8');
 for(const statement of sql.split(';').map(s=>s.trim()).filter(Boolean))await pool.query(statement);
 for(const name of ['002_website_customers.sql','003_media_content.sql']){
  const migration=await readFile(new URL(`../migrations/website/${name}`,import.meta.url),'utf8');
  for(const statement of migration.replace(/^--.*$/gm,'').split(';').map(s=>s.trim()).filter(Boolean))await pool.query(statement);
 }
 const store=mysqlStore();const category=await store.create({name:'Kitchen',slug:'kitchen',short:'Kitchen',description:'',image:'',parentId:null,published:true,sortOrder:0});
 const variation={id:randomUUID(),sku:'TEST-ONE',name:'Small',active:true,available:true,isDefault:true,mrp:'100.00',sellingPrice:'80.00',images:[],specifications:{Material:'Steel'}};
 const draft={id:randomUUID(),sku:'TEST-PARENT',name:'Test basket',category:category.id,webVisible:true,images:[],pdf:'',variations:[variation,{...variation,id:randomUUID(),sku:'TEST-TWO',isDefault:false}]};
 const saved=await store.saveProduct(draft);assert.equal(saved.variations.length,2);assert.equal(saved.version,1);
 const updated=await store.saveProduct({...saved,variations:saved.variations.map(v=>({...v,sellingPrice:'70.50'}))});assert.equal(updated.variations[0].sellingPrice,'70.50');
 await assert.rejects(store.saveProduct({...updated,variations:[{...variation,sellingPrice:'101.00'}]}));assert.equal((await store.productDrafts())[0].version,2);
 // Force a failure AFTER parent/variation SQL writes: missing media metadata violates the FK.
 await assert.rejects(store.saveProduct({...updated,name:'Must roll back',images:[`/api/web/product-media/${randomUUID()}.webp`]}));
 assert.equal((await store.productDrafts())[0].version,2);assert.equal((await store.productDrafts())[0].name,'Test basket');
 await assert.rejects(store.saveProduct({...draft,id:randomUUID(),sku:'OTHER-PARENT'}));assert.equal((await store.productDrafts()).length,1);
 const [history]=await pool.query('SELECT * FROM web_price_history');assert.equal(history.length,4);
 const concurrent=await Promise.allSettled([store.saveProduct({...updated,description:'Editor one'}),store.saveProduct({...updated,description:'Editor two'})]);assert.equal(concurrent.filter(r=>r.status==='fulfilled').length,1);assert.equal(concurrent.filter(r=>r.status==='rejected').length,1);
 const [after]=await pool.query('SHOW TABLES');assert.equal(after.length,13);const [sentinel]=await pool.query('SELECT * FROM mobile_sentinel');assert.deepEqual(sentinel,[{id:1,value:'unchanged-mobile-fixture'}]);console.log('PASS isolated migration, product+variations, exact prices, history, rollback, identity isolation. Test tables retained for inspection.');
}finally{await pool.end();}
