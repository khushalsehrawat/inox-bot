// Default is read-only. --apply changes only missing product creation history.
import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import assert from 'node:assert/strict';
import nextEnv from '@next/env';
import { websitePool } from '../src/lib/web-mysql.mjs';
import { recoverProductUpload } from '../src/lib/product-date-backfill.mjs';
import { productUploadHistory } from '../src/lib/product-upload-history.mjs';

nextEnv.loadEnvConfig(process.cwd(), true, { info() {}, error() {} });
const apply = process.argv.includes('--apply');
const pool = websitePool();
let connection;
let receipt;
try {
  connection = await pool.getConnection();
  await connection.query("SET time_zone='+00:00'");
  if (!apply) await connection.query('SET TRANSACTION READ ONLY');
  await connection.beginTransaction();
  const [identity] = await connection.query('SELECT DATABASE() AS name');
  assert.equal(identity[0].name, 'u439578485_inox', 'Unexpected Hostinger database.');
  if (apply) await connection.query('SELECT version FROM web_schema_versions WHERE version=1 FOR UPDATE');
  const [rows] = await connection.query(`SELECT id,sku,body,version FROM web_products ORDER BY id${apply ? ' FOR UPDATE' : ''}`);
  // SQL formats UTC explicitly: mysql2 otherwise interprets timestamps in the workstation timezone.
  const [dates] = await connection.query("SELECT v.product_id,DATE_FORMAT(MIN(h.changed_at),'%Y-%m-%dT%H:%i:%sZ') AS earliestSave FROM web_variations v JOIN web_price_history h ON h.variation_id=v.id GROUP BY v.product_id");
  const plans = [];
  const unrecorded = [];
  const products = [];
  for (const row of rows) {
    const original = typeof row.body === 'string' ? JSON.parse(row.body) : row.body;
    const recovered = recoverProductUpload(original, dates.find(d => d.product_id === row.id)?.earliestSave);
    products.push(recovered || original);
    if (!recovered) {
      if (!(original.uploadHistory || []).some(e => e.action === 'created')) unrecorded.push(row.id);
      continue;
    }
    const { uploadHistory: oldHistory, ...oldFields } = original;
    const { uploadHistory: newHistory, ...newFields } = recovered;
    assert.deepEqual(newFields, oldFields);
    plans.push({ id: row.id, sku: row.sku, version: row.version, before: original, after: recovered });
  }
  if (apply && plans.length) {
    const directory = path.join(process.cwd(), '.private-web-db');
    fs.mkdirSync(directory, { recursive: true });
    receipt = path.join(directory, `product-date-backfill-${randomUUID()}.json`);
    fs.writeFileSync(receipt, JSON.stringify({ status: 'prepared', capturedAt: new Date().toISOString(), database: identity[0].name, products: plans }, null, 2), { mode: 0o600, flag: 'wx' });
    for (const plan of plans) {
      const [result] = await connection.execute('UPDATE web_products SET body=?,version=version+1 WHERE id=? AND version=?', [JSON.stringify(plan.after), plan.id, plan.version]);
      assert.equal(result.affectedRows, 1, 'Product changed while recovering dates.');
    }
    const [verified] = await connection.query('SELECT id,body,version FROM web_products');
    for (const plan of plans) {
      const saved = verified.find(p => p.id === plan.id);
      assert.deepEqual(typeof saved.body === 'string' ? JSON.parse(saved.body) : saved.body, plan.after);
      assert.equal(saved.version, plan.version + 1);
    }
    await connection.commit();
    const backup = JSON.parse(fs.readFileSync(receipt, 'utf8'));
    fs.writeFileSync(receipt, JSON.stringify({ ...backup, status: 'committed', committedAt: new Date().toISOString() }, null, 2), { mode: 0o600 });
  } else await connection.rollback();
  console.log(JSON.stringify({ status: apply ? 'APPLIED' : 'DRY_RUN', totalProducts: rows.length, recoveredProducts: plans.length, alreadyRecorded: rows.length - plans.length - unrecorded.length, missingEvidence: unrecorded.length, dates: productUploadHistory(products), backup: receipt || null }));
} catch (error) {
  if (connection) await connection.rollback().catch(() => {});
  console.log(JSON.stringify({ status: 'FAILED', code: error.code || error.name, backup: receipt || null }));
  process.exitCode = 1;
} finally {
  if (connection) connection.release();
  await pool.end();
}
