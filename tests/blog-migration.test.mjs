import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { importLocalBlogs, legacyBlogs } from '../scripts/migrate-blogs.mjs';

test('explicit blog import preserves all originals, saved edits and deliberate deletion', async () => {
  const directory = await mkdtemp(join(process.cwd(), '.test-web-taxonomy-blogs-migrate-'));
  const file = join(directory, 'blog-posts.json');
  const original = await legacyBlogs();
  assert.equal(original.length, 11);
  assert.equal(new Set(original.map(post => post.slug)).size, 11);
  assert.deepEqual(await importLocalBlogs(directory), { imported: 11 });
  const saved = JSON.parse(await readFile(file, 'utf8'));
  assert.deepEqual(saved, original);
  saved.shift();
  saved[0].title = 'An administrator edited this article';
  saved[0].published = false;
  await writeFile(file, JSON.stringify(saved));
  assert.deepEqual(await importLocalBlogs(directory), { alreadyImported: true });
  assert.deepEqual(JSON.parse(await readFile(file, 'utf8')), saved);
  await writeFile(file, '[]');
  await importLocalBlogs(directory);
  assert.deepEqual(JSON.parse(await readFile(file, 'utf8')), []);
});
