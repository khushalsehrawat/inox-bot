// Shared by the product form and server fallback; SKUs fit the existing 100-character column.
export function productSkuFromName(name) {
  if (typeof name !== 'string') return '';
  const normalized = name.normalize('NFKD').replace(/\p{M}+/gu, '')
    .replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-+|-+$/g, '').toUpperCase();
  let sku = '';
  for (const character of normalized) {
    if (sku.length + character.length > 100) break;
    sku += character;
  }
  return sku.replace(/-+$/g, '');
}
