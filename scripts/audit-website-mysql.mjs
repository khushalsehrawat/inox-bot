// READ ONLY. Run against production only after approval. Never logs credentials or records.
import { websitePool } from '../src/lib/web-mysql.mjs';
import { writeFile } from 'node:fs/promises';
const pool=websitePool();
try {
 const [tables]=await pool.query('SELECT TABLE_NAME,TABLE_TYPE,ENGINE FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() ORDER BY TABLE_NAME');
 const [columns]=await pool.query('SELECT TABLE_NAME,COLUMN_NAME,COLUMN_TYPE,IS_NULLABLE,COLUMN_KEY FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() ORDER BY TABLE_NAME,ORDINAL_POSITION');
 const [grants]=await pool.query('SHOW GRANTS FOR CURRENT_USER');
 const [indexes]=await pool.query('SELECT TABLE_NAME,INDEX_NAME,NON_UNIQUE,SEQ_IN_INDEX,COLUMN_NAME FROM information_schema.STATISTICS WHERE TABLE_SCHEMA=DATABASE() ORDER BY TABLE_NAME,INDEX_NAME,SEQ_IN_INDEX');
 const names=['web_schema_versions','web_categories','web_products','web_variations','web_variation_prices','web_price_history','web_media','web_product_images','web_product_pdfs','web_enquiries'];
 const collisions=tables.filter(t=>names.includes(t.TABLE_NAME));
 const report={auditedAt:new Date().toISOString(),database:process.env.WEB_MYSQL_DATABASE,tables,columns,indexes,grants,collisions};
 const output=process.argv[2];if(!output)throw Error('Pass a new audit JSON output path.');
 await writeFile(output,JSON.stringify(report,null,2),{flag:'wx',mode:0o600});
 console.log(`Read-only audit saved. Tables: ${tables.length}; proposed name collisions: ${collisions.length}. Review table-specific privileges before migration.`);
}finally{await pool.end();}
