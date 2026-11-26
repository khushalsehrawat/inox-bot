// Explicit operator-run cutover; never invoked by the app or build.
// Only the reviewed web_ migration and website records may be written.
import fs from 'node:fs';
import path from 'node:path';
import { parseEnv } from 'node:util';
import { createHash } from 'node:crypto';
import mysql from 'mysql2/promise';
import { validateProductDraft } from '../src/lib/website-product-validation.mjs';

const apply = process.argv.includes('--apply');
const env = parseEnv(fs.readFileSync('.env.local', 'utf8'));
const source = '.private-web-db/website-before-mysql';
const receipt = '.private-web-db/website-cutover';
const exported = JSON.parse(fs.readFileSync(path.join(source, 'website-export.json'), 'utf8'));
const hash = value => createHash('sha256').update(value).digest('hex');
const categories = exported.categories.map(c => ({ ...c, parentId: c.parent_id, published: !!c.published }));
const products = exported.products.map(p => { const input = { ...p }; delete input.version; return validateProductDraft(input, categories, []); });
const media = exported.files.filter(f => f.path.startsWith('product-media/')).map(f => {
  const bytes = fs.readFileSync(path.join(source, f.path));
  if (hash(bytes) !== f.sha256) throw Error('Media checksum mismatch');
  return { ...f, url: `/api/web/product-media/${path.basename(f.path)}`, mime: f.path.endsWith('.pdf') ? 'application/pdf' : 'image/webp' };
});
const knownMedia = new Set(media.map(f => f.url));
for (const p of products) for (const url of [...p.images, ...p.variations.flatMap(v => v.images), ...(p.pdf ? [p.pdf] : [])]) {
  if (!knownMedia.has(url)) throw Error('Missing referenced media');
}
const sql = fs.readFileSync('migrations/website/001_catalogue.sql', 'utf8').replace(/^--.*$/gm, '');
const statements = sql.split(';').map(s => s.trim()).filter(Boolean);
const names = statements.filter(s => /^CREATE TABLE /.test(s)).map(s => /^CREATE TABLE (web_[a-z_]+) /.exec(s)?.[1]);
if (names.length !== 10 || names.some(n => !n) || statements.some(s => !/^CREATE TABLE web_[a-z_]+ /.test(s) && s !== 'INSERT INTO web_schema_versions(version) VALUES(1)')) throw Error('Migration outside approved website scope');
if (!apply) { console.log(JSON.stringify({ status: 'PLAN_VALID', categories: categories.length, products: products.length, variations: products.reduce((n,p) => n+p.variations.length,0), media: media.length, tables: names, migrationSha256: hash(sql) })); process.exit(0); }
if (env.WEB_MYSQL_DATABASE !== 'u439578485_inox') throw Error('Unexpected database');
if (fs.existsSync(`${receipt}.json`)) throw Error('Cutover receipt exists; do not rerun');
Object.assign(process.env, env);
const connection = await mysql.createConnection({ host: env.WEB_MYSQL_HOST, port: Number(env.WEB_MYSQL_PORT || 3306), database: env.WEB_MYSQL_DATABASE, user: env.WEB_MYSQL_USER, password: env.WEB_MYSQL_PASSWORD, multipleStatements: false, connectTimeout: 10000, supportBigNumbers: true, bigNumberStrings: true, ssl: env.WEB_MYSQL_SSL_CA ? { ca: fs.readFileSync(env.WEB_MYSQL_SSL_CA), rejectUnauthorized: true } : undefined });
const quote = name => '`' + name.replaceAll('`', '``') + '`';
async function snapshot(tables) {
  await connection.query('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ');
  await connection.query('SET TRANSACTION READ ONLY');
  await connection.query('START TRANSACTION WITH CONSISTENT SNAPSHOT');
  try {
    const result = [];
    for (const table of tables) {
      const [ddl] = await connection.query(`SHOW CREATE TABLE ${quote(table)}`);
      const [rows] = await connection.query(`SELECT * FROM ${quote(table)}`);
      const rowHashes = rows.map(r => hash(JSON.stringify(r))).sort();
      result.push({ name: table, ddl, rows, count: rows.length, dataSha256: hash(JSON.stringify(rowHashes)), schemaSha256: hash(JSON.stringify(ddl)) });
    }
    await connection.commit(); return result;
  } catch (e) { await connection.rollback(); throw e; }
}
try {
  const [existing] = await connection.query('SELECT TABLE_NAME,TABLE_TYPE FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() ORDER BY TABLE_NAME');
  if (existing.some(t => t.TABLE_NAME.startsWith('web_'))) throw Error('Website table collision; refusing all writes');
  const tables = existing.map(t => t.TABLE_NAME);
  const before = await snapshot(tables);
  fs.writeFileSync(`${receipt}-before.json`, JSON.stringify({ capturedAt:new Date().toISOString(), database:env.WEB_MYSQL_DATABASE, tables:before }), {flag:'wx',mode:0o600});
  // DDL auto-commits. Never retry a partially applied migration automatically.
  for (const statement of statements) await connection.query(statement);
  const { mysqlStore } = await import('../src/lib/web-mysql-store.mjs');
  await connection.beginTransaction();
  try {
    const remaining = [...categories];
    const inserted = new Set();
    while (remaining.length) {
      const index = remaining.findIndex(c => !c.parentId || inserted.has(c.parentId));
      if (index < 0) throw Error('Invalid category tree');
      const [c] = remaining.splice(index,1);
      await connection.execute('INSERT INTO web_categories(id,slug,name,short,description,image,parent_id,published,sort_order,version) VALUES(?,?,?,?,?,?,?,?,?,?)',[c.id,c.slug,c.name,c.short,c.description,c.image,c.parentId,Number(c.published),c.sort_order,c.version]);
      inserted.add(c.id);
    }
    for (const f of media) await connection.execute('INSERT INTO web_media(url,mime,byte_length,sha256) VALUES(?,?,?,?)',[f.url,f.mime,f.size,f.sha256]);
    const store = mysqlStore(connection);
    for (const product of products) await store.saveProduct(product);
    const saved = await store.productDrafts();
    if (saved.length !== products.length) throw Error('Product count mismatch');
    for (const p of products) {
      const actual = saved.find(s => s.id === p.id);
      if (!actual || actual.sku !== p.sku || JSON.stringify(actual.variations) !== JSON.stringify(p.variations)) {
        // Compare values independent of JSON object property ordering.
        if (!actual || actual.variations.length !== p.variations.length || p.variations.some(v => !actual.variations.some(a => a.id === v.id && a.sku === v.sku && a.mrp === v.mrp && a.sellingPrice === v.sellingPrice))) throw Error('Saved product verification failed');
      }
    }
    await connection.commit();
  } catch(e) { await connection.rollback(); throw e; }
  const after = await snapshot(tables);
  const comparisons = before.map(b => { const a = after.find(t => t.name === b.name); return { name:b.name, schemaUnchanged:b.schemaSha256===a.schemaSha256, recordsUnchanged:b.dataSha256===a.dataSha256, beforeCount:b.count, afterCount:a.count }; });
  const report = { completedAt:new Date().toISOString(), database:env.WEB_MYSQL_DATABASE, migrationSha256:hash(sql), createdTables:names, products:products.length, variations:products.reduce((n,p)=>n+p.variations.length,0), media:media.length, comparisons, sharedAccountRiskAccepted:true, fullRestoreVerificationDeferred:true };
  fs.writeFileSync(`${receipt}.json`,JSON.stringify(report,null,2),{flag:'wx',mode:0o600});
  console.log(JSON.stringify({status:'WEBSITE_TABLES_CONNECTED',products:report.products,variations:report.variations,media:report.media,appTables:tables.length,allAppSchemasUnchanged:comparisons.every(c=>c.schemaUnchanged),allAppRecordsUnchanged:comparisons.every(c=>c.recordsUnchanged),receipt:`${receipt}.json`}));
} catch(e) { console.error(JSON.stringify({status:'STOPPED_DO_NOT_RETRY_BLINDLY',code:e.code||'CUTOVER_VALIDATION',message:e.code?'Database operation failed; inspect private state before retry':e.message}));process.exitCode=1; }
finally { await connection.end(); const {websitePool}=await import('../src/lib/web-mysql.mjs'); await websitePool().end(); }
