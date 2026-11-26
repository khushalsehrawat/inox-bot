// Read-only export. Does not delete SQLite, write MySQL, or change mobile data.
import { DatabaseSync } from 'node:sqlite';
import { readFile, writeFile, readdir, mkdir, copyFile } from 'node:fs/promises';
import { createHash, randomUUID } from 'node:crypto';
import { join, resolve } from 'node:path';
const [sourceArg,outputArg]=process.argv.slice(2);
if(!sourceArg || !outputArg)throw Error('Usage: node scripts/export-website-sqlite.mjs <existing-data-directory> <new-export-directory>');
const source=resolve(sourceArg),output=resolve(outputArg);
await mkdir(output,{recursive:false});
const db=new DatabaseSync(join(source,'taxonomy.sqlite'),{readOnly:true});
let categories,products,assignments;
try {db.exec('BEGIN');categories=db.prepare('SELECT * FROM web_categories').all();products=db.prepare('SELECT body,version FROM web_products').all().map(r=>({...JSON.parse(r.body),version:r.version}));assignments=db.prepare('SELECT * FROM web_product_categories').all();db.exec('COMMIT');}finally{db.close();}
let prices=[];
try {const priceDb=new DatabaseSync(join(source,'customers.sqlite'),{readOnly:true});try{prices=priceDb.prepare('SELECT product_id,amount FROM product_prices').all();}finally{priceDb.close();}}catch(error){if(error.code !== 'ERR_SQLITE_ERROR')throw error;console.log('No legacy price table available; inspect legacyPrices in export.');}
const prepared=products.map(p=>{const price=prices.find(r=>r.product_id===p.id);return {...p,variations:p.variations?.length?p.variations:[{id:randomUUID(),sku:p.sku,name:'Standard',size:'',dimensions:'',material:'',finish:'',colour:'',specifications:{},images:[],mrp:price?(price.amount/100).toFixed(2):null,sellingPrice:price?(price.amount/100).toFixed(2):null,active:true,available:true,isDefault:true,sortOrder:0}]};});
const files=[];
for(const directory of ['product-media','media']){
 let entries=[];try{entries=await readdir(join(source,directory),{withFileTypes:true});}catch(error){if(error.code !== 'ENOENT')throw error;}
 if(entries.length)await mkdir(join(output,directory));
 for(const entry of entries){if(!entry.isFile())continue;const bytes=await readFile(join(source,directory,entry.name));await copyFile(join(source,directory,entry.name),join(output,directory,entry.name));files.push({path:`${directory}/${entry.name}`,size:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')});}
}
const body=JSON.stringify({exportedAt:new Date().toISOString(),categories,products:prepared,assignments,legacyPrices:prices,files},null,2);
await writeFile(join(output,'website-export.json'),body,{flag:'wx',mode:0o600});
console.log(`Exported ${products.length} saved products and ${files.length} media files. Manifest SHA256: ${createHash('sha256').update(body).digest('hex')}. Review legacy price defaults before import. SQLite source unchanged.`);
