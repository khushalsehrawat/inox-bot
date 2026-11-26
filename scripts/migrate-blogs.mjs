import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';

// This archive is used only by this explicit import, never by website requests.
export async function legacyBlogs() {
  return JSON.parse(await readFile(new URL('./migrations/legacy-blog-posts.json', import.meta.url), 'utf8'));
}
export async function importLocalBlogs(directory) {
  const destination = join(directory, 'blog-posts.json');
  await mkdir(directory, { recursive: true });
  try { await readFile(destination); return { alreadyImported: true }; }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
  await writeFile(destination, JSON.stringify(await legacyBlogs()), { flag: 'wx', mode: 0o640 });
  return { imported: (await legacyBlogs()).length };
}
export async function importMysqlBlogs(pool) {
  const posts = await legacyBlogs();
  await pool.execute('CREATE TABLE IF NOT EXISTS web_blog_posts (slug VARCHAR(191) PRIMARY KEY, version INT NOT NULL, body JSON NOT NULL)');
  await pool.execute('CREATE TABLE IF NOT EXISTS web_blog_migrations (id VARCHAR(191) PRIMARY KEY, applied_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP)');
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [marker] = await connection.execute('INSERT IGNORE INTO web_blog_migrations(id) VALUES(?)', ['legacy-blogs-v1']);
    if (!marker.affectedRows) { await connection.rollback(); return { alreadyImported: true }; }
    let imported = 0;
    for (const post of posts) {
      const [result] = await connection.execute('INSERT IGNORE INTO web_blog_posts(slug,version,body) VALUES(?,?,?)', [post.slug, post.version, JSON.stringify(post)]);
      imported += result.affectedRows;
    }
    const [rows] = await connection.execute('SELECT slug FROM web_blog_posts');
    if (!posts.every(post => rows.some(row => row.slug === post.slug))) throw new Error('Blog import verification failed.');
    await connection.commit();
    return { imported, preserved: posts.length - imported, verified: posts.length };
  } catch (error) { await connection.rollback(); throw error; }
  finally { connection.release(); }
}
async function main() {
  if (process.argv[2] === '--local') {
    if (!process.argv[3]) throw new Error('Pass an explicit development data directory.');
    console.log(JSON.stringify(await importLocalBlogs(resolve(process.argv[3]))));
    return;
  }
  const { default: env } = await import('@next/env');
  env.loadEnvConfig(process.cwd());
  const { websitePool } = await import('../src/lib/web-mysql.mjs');
  const pool = websitePool();
  try {
    // Preserve a private snapshot of existing database articles before importing.
    const [tables] = await pool.execute("SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='web_blog_posts'");
    const [existing] = tables.length ? await pool.execute('SELECT slug,version,body FROM web_blog_posts') : [[]];
    const directory = resolve('.private-web-db/blog-backups');
    await mkdir(directory, { recursive: true });
    const backup = join(directory, `blogs-${randomUUID()}.json`);
    await writeFile(backup, JSON.stringify(existing), { flag: 'wx', mode: 0o600 });
    console.log(JSON.stringify({ ...await importMysqlBlogs(pool), backup }));
  } catch (error) {
    console.error(JSON.stringify({ status: 'BLOG_IMPORT_FAILED', code: error.code || error.name }));
    process.exitCode = 1;
  } finally { await pool.end(); }
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
