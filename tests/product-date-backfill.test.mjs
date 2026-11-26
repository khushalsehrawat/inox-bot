import test from 'node:test';
import assert from 'node:assert/strict';
import { recoverProductUpload } from '../src/lib/product-date-backfill.mjs';
import { productUploadHistory, recordProductUpload } from '../src/lib/product-upload-history.mjs';

test('recovered dates preserve product data and updates, and repeat runs do nothing', () => {
  const original = { id: 'old-product', name: 'Basket', images: ['photo'], uploadHistory: [{ batchId: 'edit', uploadedAt: '2026-10-28T11:00:00Z', action: 'updated' }] };
  const recovered = recoverProductUpload(original, '2026-10-23T11:16:40Z');
  assert.deepEqual(recovered.images, original.images);
  assert.equal(recovered.uploadHistory.length, 2);
  assert.equal(recovered.uploadHistory[0].source, 'hostinger-recovered');
  assert.equal(recovered.uploadHistory[0].uploadedAt, '2026-10-23T11:16:40.000Z');
  assert.equal(original.uploadHistory.length, 1);
  assert.equal(recoverProductUpload(recovered, '2026-10-23T11:16:40Z'), null);
  const edited = recordProductUpload({ id: original.id }, recovered, { batchId: 'next-edit', uploadedAt: '2026-10-29T11:00:00Z', source: 'admin' });
  assert.equal(edited.uploadHistory[0].source, 'hostinger-recovered');
  assert.equal(productUploadHistory([recovered]).find(day => day.date === '2026-10-23').created, 1);
  assert.equal(productUploadHistory([recovered]).find(day => day.date === '2026-10-23').uploads, 0);
});

test('missing or contradictory evidence never invents a date or replaces known creation history', () => {
  assert.equal(recoverProductUpload({ id: 'one' }, null), null);
  assert.equal(recoverProductUpload({ id: 'one' }, 'invalid'), null);
  assert.equal(recoverProductUpload({ id: 'one', uploadHistory: [{ action: 'created', uploadedAt: '2026-10-23T10:00:00Z' }] }, '2026-10-24T10:00:00Z'), null);
  assert.equal(recoverProductUpload({ id: 'one', uploadHistory: [{ action: 'updated', uploadedAt: '2026-10-23T10:00:00Z' }] }, '2026-10-24T10:00:00Z'), null);
});
