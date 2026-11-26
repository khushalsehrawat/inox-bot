import test from 'node:test';
import assert from 'node:assert/strict';
import { catalogueDriver } from '../src/lib/catalogue-driver.mjs';

test('missing driver preserves the Hostinger catalogue when credentials exist', () => {
  assert.equal(catalogueDriver({ WEB_MYSQL_HOST: 'database.example' }), 'mysql');
  assert.equal(catalogueDriver({ NODE_ENV: 'production' }), 'mysql');
});
test('isolated local SQLite remains available only outside production', () => {
  assert.equal(catalogueDriver({}), 'sqlite');
  assert.equal(catalogueDriver({ WEB_DATABASE_DRIVER: 'sqlite', WEB_MYSQL_HOST: 'database.example' }), 'sqlite');
  assert.throws(() => catalogueDriver({ NODE_ENV: 'production', WEB_DATABASE_DRIVER: 'sqlite' }));
  assert.throws(() => catalogueDriver({ WEB_DATABASE_DRIVER: 'myslq' }));
});
