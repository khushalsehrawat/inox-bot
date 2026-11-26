// Explicit additive website-only migration. Never changes shared authentication.
import fs from 'node:fs';
import { parseEnv } from 'node:util';
import mysql from 'mysql2/promise';
import { createHash } from 'node:crypto';
const env = parseEnv(fs.readFileSync('.env.local','utf8'));
if (env.WEB_MYSQL_DATABASE !== 'u439578485_inox') throw Error('Unexpected database');
const sql = fs.readFileSync('migrations/website/002_website_customers.sql','utf8').replace(/^--.*$/gm,'');
const statements = sql.split(';').map(s=>s.trim()).filter(Boolean);
if (statements.length!==2 || !statements[0].startsWith('CREATE TABLE web_customers (') || statements[1]!=='INSERT INTO web_schema_versions(version) VALUES(2)') throw Error('Unexpected migration scope');
if (!process.argv.includes('--apply')) { console.log('PLAN_VALID: create web_customers and record website schema version 2 only.'); process.exit(0); }
const c = await mysql.createConnection({host:env.WEB_MYSQL_HOST,port:Number(env.WEB_MYSQL_PORT||3306),database:env.WEB_MYSQL_DATABASE,user:env.WEB_MYSQL_USER,password:env.WEB_MYSQL_PASSWORD,multipleStatements:false,ssl:env.WEB_MYSQL_SSL_CA?{ca:fs.readFileSync(env.WEB_MYSQL_SSL_CA),rejectUnauthorized:true}:undefined});
try {
  const [tables] = await c.execute("SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='web_customers'");
  const [version] = await c.execute('SELECT version FROM web_schema_versions ORDER BY version');
  if (tables.length || version.length!==1 || version[0].version!==1) throw Error('Unexpected migration state; refusing writes');
  for (const statement of statements) await c.query(statement);
  fs.writeFileSync('.private-web-db/website-customers-cutover.json',JSON.stringify({appliedAt:new Date().toISOString(),migrationSha256:createHash('sha256').update(sql).digest('hex'),createdTables:['web_customers'],mobileWrites:0},null,2),{flag:'wx',mode:0o600});
  console.log('PASS: web_customers created; shared authentication tables untouched.');
} catch(e) { console.error(JSON.stringify({status:'STOPPED_DO_NOT_RETRY_BLINDLY',code:e.code||'VALIDATION'})); process.exitCode=1; }
finally { await c.end(); }
