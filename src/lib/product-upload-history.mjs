import { randomUUID } from 'node:crypto';

export function uploadBatch(source = 'admin') {
  return { batchId: randomUUID(), uploadedAt: new Date().toISOString(), source };
}

export function recordProductUpload(product, previous, batch) {
  return { ...product, uploadHistory: [...(previous?.uploadHistory || []), {
    ...batch, action: previous ? 'updated' : 'created',
  }] };
}

export function productUploadHistory(products) {
  const days = new Map();
  const date = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' });
  for (const product of products) {
    for (const entry of product.uploadHistory || []) {
      const day = date.format(new Date(entry.uploadedAt));
      if (!days.has(day)) days.set(day, { date: day, created: 0, updated: 0, batches: new Set() });
      const summary = days.get(day);
      summary[entry.action]++;
      if (entry.source !== 'hostinger-recovered') summary.batches.add(entry.batchId);
    }
  }
  return [...days.values()].sort((a, b) => b.date.localeCompare(a.date)).map(day => ({
    date: day.date, created: day.created, updated: day.updated, total: day.created + day.updated, uploads: day.batches.size,
  }));
}
