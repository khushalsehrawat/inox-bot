export function recoverProductUpload(product, earliestSave) {
  if ((product.uploadHistory || []).some(event => event.action === 'created')) return null;
  if (typeof earliestSave !== 'string' || !Number.isFinite(Date.parse(earliestSave))) return null;
  const uploadedAt = new Date(earliestSave).toISOString();
  if ((product.uploadHistory || []).some(event => Date.parse(event.uploadedAt) < Date.parse(uploadedAt))) return null;
  return { ...product, uploadHistory: [{
    batchId: `hostinger-recovered-${product.id}`,
    uploadedAt,
    source: 'hostinger-recovered',
    action: 'created',
    evidence: 'Earliest surviving Hostinger product variation save record; original upload time may be earlier.',
  }, ...(product.uploadHistory || [])] };
}
