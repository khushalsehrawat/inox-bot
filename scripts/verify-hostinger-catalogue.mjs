// Read-only verification: compare real Hostinger records with a running website.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import nextEnv from '@next/env';
import { websitePool } from '../src/lib/web-mysql.mjs';
import { mysqlStore } from '../src/lib/web-mysql-store.mjs';
import { categoryPath } from '../src/lib/category-tree.mjs';
import { catalogueDriver } from '../src/lib/catalogue-driver.mjs';
import { createWebsiteAdminSession, websiteAdminConfig } from '../src/lib/website-admin-auth.mjs';

nextEnv.loadEnvConfig(process.cwd());
const base = new URL(process.argv[2] || 'http://127.0.0.1:5173').origin;
assert.equal(catalogueDriver(), 'mysql');
const pool = websitePool();
try {
  const store = mysqlStore();
  const saved = await store.productDrafts();
  const categories = await store.list();
  const published = saved.filter(p => p.webVisible && categoryPath(categories, p.subcategory || p.category).every(c => c.published));
  const headers = { Cookie: `inox_website_admin=${createWebsiteAdminSession(websiteAdminConfig())}` };
  const response = await fetch(`${base}/api/admin/products`, { headers });
  assert.equal(response.status, 200, 'Website administrator must be accessible');
  const admin = await response.json();
  assert.deepEqual(admin.drafts.map(p => p.id).sort(), saved.map(p => p.id).sort(), 'Website must use the same Hostinger catalogue');
  const listing = await fetch(`${base}/products`);
  assert.equal(listing.status, 200);
  const html = await listing.text();
  let pages = 0, files = 0;
  const checked = new Set();
  for (const product of published) {
    assert.ok(html.includes(product.id), 'Published product missing from catalogue');
    const page = await fetch(`${base}/products/${product.id}`);
    assert.equal(page.status, 200);
    assert.ok((await page.text()).includes(product.name.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#x27;')), 'Product detail missing its name');
    pages++;
    for (const url of [...product.images, ...product.variations.filter(v => v.active).flatMap(v => v.images), ...(product.pdf ? [product.pdf] : [])]) {
      if (checked.has(url)) continue;
      checked.add(url);
      assert.match(url, /^\/api\/web\/product-media\//);
      const [rows] = await pool.execute('SELECT m.sha256,c.content FROM web_media m JOIN web_media_content c ON c.url=m.url WHERE m.url=?', [url]);
      assert.equal(rows.length, 1, 'Uploaded file must exist in Hostinger');
      const media = await fetch(base + url);
      assert.equal(media.status, 200);
      const digest = bytes => createHash('sha256').update(bytes).digest('hex');
      assert.equal(digest(rows[0].content), rows[0].sha256);
      assert.equal(digest(Buffer.from(await media.arrayBuffer())), rows[0].sha256);
      files++;
    }
  }
  console.log(JSON.stringify({ status: 'PASS', savedProducts: saved.length, publishedProducts: published.length, productPages: pages, hostingerMediaVerified: files, adminMatchesHostinger: true, databaseWrites: 0 }));
} finally {
  await pool.end();
}
