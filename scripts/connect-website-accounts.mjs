import fs from 'node:fs';
import nextEnv from '@next/env';
import { websitePool } from '../src/lib/web-mysql.mjs';
nextEnv.loadEnvConfig(process.cwd());
const statements = fs.readFileSync('migrations/website/004_website_accounts.sql','utf8').replace(/^--.*$/gm,'').split(';').map(s=>s.trim()).filter(Boolean);
const names = ['web_users','web_user_sessions','web_auth_limits'];
if (statements.length !== 4 || names.some((name,i)=>!statements[i].startsWith(`CREATE TABLE ${name} (`)) || statements[3] !== 'INSERT INTO web_schema_versions(version) VALUES(4)') throw Error('Unexpected migration scope');
if (!process.argv.includes('--apply')) { console.log('PLAN: create web_users, web_user_sessions, web_auth_limits; record website schema version 4. No app tables accessed.'); process.exit(0); }
const pool=websitePool();
const db=await pool.getConnection();
try {
  const [lock]=await db.query("SELECT GET_LOCK('web_accounts_migration_4',10) AS acquired");
  if(lock[0].acquired!==1) throw Error('Migration locked');
  const [versions]=await db.query('SELECT version FROM web_schema_versions ORDER BY version');
  const [tables]=await db.execute('SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME IN (?,?,?)',names);
  if(versions.some(row=>row.version===4) && tables.length===3) { console.log('Website accounts migration already applied.'); }
  else {
    if(tables.length || versions.some(row=>row.version===4) || !versions.some(row=>row.version===3)) throw Error('Unexpected migration state; refusing changes. Inspect partial migration before retrying.');
    for(const sql of statements) await db.query(sql);
    console.log('PASS: three website-only tables created. Application tables untouched.');
  }
} finally {
  await db.query("SELECT RELEASE_LOCK('web_accounts_migration_4')");db.release();await pool.end();
}
