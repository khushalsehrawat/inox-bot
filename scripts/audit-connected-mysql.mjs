// Read-only schema/grant audit. Credentials stay in memory; records are never printed.
import fs from 'node:fs';
import path from 'node:path';
import { parseEnv } from 'node:util';
import { createHash } from 'node:crypto';
import mysql from 'mysql2/promise';
const [source,output]=process.argv.slice(2);
if(!source || !output)throw Error('Usage: node scripts/audit-connected-mysql.mjs <private-env-file> <new-private-audit-file>');
const env=parseEnv(fs.readFileSync(source,'utf8'));
const names=['web_schema_versions','web_categories','web_products','web_variations','web_variation_prices','web_price_history','web_media','web_product_images','web_product_pdfs','web_enquiries'];
let connection;
try {
  connection=await mysql.createConnection({host:env.WEB_MYSQL_HOST || env.DB_HOST,port:Number(env.WEB_MYSQL_PORT || env.DB_PORT || 3306),database:env.WEB_MYSQL_DATABASE || env.DB_NAME,user:env.WEB_MYSQL_USER || env.DB_USER,password:env.WEB_MYSQL_PASSWORD || env.DB_PASSWORD,connectTimeout:10000,multipleStatements:false,ssl:env.DB_TLS==='true' || env.WEB_MYSQL_SSL_CA?{rejectUnauthorized:true,...(env.WEB_MYSQL_SSL_CA || env.DB_CA_FILE?{ca:fs.readFileSync(path.resolve(path.dirname(source),env.WEB_MYSQL_SSL_CA || env.DB_CA_FILE))}:{})}:undefined});
  await connection.query('SET SESSION TRANSACTION READ ONLY');await connection.beginTransaction();
  const [identity]=await connection.query('SELECT DATABASE() AS database_name,VERSION() AS version');
  if(identity[0].database_name!=='u439578485_inox')throw Object.assign(new Error('Unexpected database identity'),{code:'UNEXPECTED_DATABASE'});
  const [tables]=await connection.query('SELECT TABLE_NAME,TABLE_TYPE,ENGINE FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() ORDER BY TABLE_NAME');
  const [columns]=await connection.query('SELECT TABLE_NAME,COLUMN_NAME,COLUMN_TYPE,IS_NULLABLE,COLUMN_KEY FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() ORDER BY TABLE_NAME,ORDINAL_POSITION');
  const [indexes]=await connection.query('SELECT TABLE_NAME,INDEX_NAME,NON_UNIQUE,SEQ_IN_INDEX,COLUMN_NAME FROM information_schema.STATISTICS WHERE TABLE_SCHEMA=DATABASE() ORDER BY TABLE_NAME,INDEX_NAME,SEQ_IN_INDEX');
  const [grants]=await connection.query('SHOW GRANTS FOR CURRENT_USER');
  await connection.rollback();
  const report={auditedAt:new Date().toISOString(),identity:identity[0],tables,columns,indexes,grants,collisions:tables.filter(t=>names.includes(t.TABLE_NAME))};
  fs.mkdirSync(path.dirname(output),{recursive:true});fs.writeFileSync(output,JSON.stringify(report,null,2),{mode:0o600,flag:'wx'});
  const grantText=JSON.stringify(grants);
  console.log(JSON.stringify({status:'READ_ONLY_AUDIT_COMPLETE',database:identity[0].database_name,version:identity[0].version,tableCount:tables.length,websiteTables:tables.filter(t=>t.TABLE_NAME.startsWith('web_')).map(t=>t.TABLE_NAME),collisions:report.collisions.map(t=>t.TABLE_NAME),sharedAuthTablesPresent:['users','architect_profiles','website_customers'].map(name=>({name,present:tables.some(t=>t.TABLE_NAME===name)})),currentAccountHasGrantOption:/WITH GRANT OPTION/i.test(grantText),currentAccountHasCreateUser:/CREATE USER|ALL PRIVILEGES ON \*\.\*/i.test(grantText),auditFile:output,schemaFingerprint:createHash('sha256').update(JSON.stringify({tables,columns,indexes})).digest('hex')}));
} catch(error) {console.log(JSON.stringify({status:'AUDIT_FAILED',code:error.code || error.name}));process.exitCode=1;}
finally {if(connection)await connection.end();}
