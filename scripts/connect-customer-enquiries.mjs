import fs from 'node:fs';
import nextEnv from '@next/env';
import { websitePool } from '../src/lib/web-mysql.mjs';
nextEnv.loadEnvConfig(process.cwd());
const statements = fs.readFileSync('migrations/website/005_customer_enquiries.sql', 'utf8').replace(/^--.*$/gm, '').split(';').map(s => s.trim()).filter(Boolean);
if (statements.length !== 3 || !statements[0].startsWith('ALTER TABLE web_enquiries') || !statements[1].startsWith('CREATE TABLE web_customer_activity (') || statements[2] !== 'INSERT INTO web_schema_versions(version) VALUES(5)') throw Error('Unexpected migration scope');
if (!process.argv.includes('--apply')) {
  console.log('PLAN: add enquiry ownership/status and website account activity; existing guest enquiries stay unclaimed.');
  process.exit(0);
}
const pool = websitePool();
const db = await pool.getConnection();
let locked = false;
try {
  const [lock] = await db.query("SELECT GET_LOCK('web_customer_enquiries_5',10) AS acquired");
  if (lock[0].acquired !== 1) throw Error('Migration locked');
  locked = true;
  const [versions] = await db.query('SELECT version FROM web_schema_versions ORDER BY version');
  const [tables] = await db.query("SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='web_customer_activity'");
  const [columns] = await db.query("SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='web_enquiries' AND COLUMN_NAME IN ('customer_id','status','updated_at')");
  if (versions.some(r => r.version === 5) && tables.length === 1 && columns.length === 3) {
    console.log('Customer enquiry migration already applied.');
  } else {
    if (!versions.some(r => r.version === 4) || versions.some(r => r.version === 5) || tables.length || columns.length) throw Error('Unexpected or partial migration state; inspect before retrying.');
    for (const sql of statements) await db.query(sql);
    console.log('PASS: website enquiries and account activity connected.');
  }
} finally {
  if (locked) await db.query("SELECT RELEASE_LOCK('web_customer_enquiries_5')");
  db.release();
  await pool.end();
}
