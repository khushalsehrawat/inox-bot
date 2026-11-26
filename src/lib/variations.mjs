import { TaxonomyError } from './web-taxonomy-validation.mjs';
const fail = message => { throw new TaxonomyError(422, message); };
export function money(value) {
  if (value === null || value === '' || value === undefined) return null;
  if (!/^\d{1,8}(\.\d{1,2})?$/.test(String(value))) fail('Enter INR with at most two decimal places.');
  return Number(value).toFixed(2);
}
export function validateVariations(rows) {
  if (!Array.isArray(rows) || !rows.length || rows.length > 100) fail('Add between 1 and 100 variations.');
  const ids = new Set(), skus = new Set();
  const result = rows.map((r, i) => {
    if (!r || typeof r !== 'object') fail('Invalid variation.');
    const text = (key, max = 200) => { const v = r[key] ?? ''; if (typeof v !== 'string' || v.length > max) fail(`Invalid variation ${key}.`); return v.trim(); };
    const id = text('id', 36), sku = text('sku', 100), name = sku;
    if (!/^[a-f0-9-]{36}$/.test(id) || !sku || ids.has(id) || skus.has(sku.toLowerCase())) fail('Variations need unique IDs and SKUs.');
    ids.add(id); skus.add(sku.toLowerCase());
    const mrp = money(r.mrp), sellingPrice = money(r.sellingPrice);
    if ((mrp === null) !== (sellingPrice === null) || (mrp !== null && Number(sellingPrice) > Number(mrp))) fail('Provide both MRP and selling price; selling price cannot exceed MRP.');
    const images = r.images ?? [];
    if (!Array.isArray(images) || images.length > 10 || images.some(v => typeof v !== 'string' || !/^\/api\/web\/product-media\/[a-f0-9-]{36}\.webp$/.test(v))) fail('Upload valid variation images.');
    const specifications = r.specifications ?? {};
    if (!specifications || Array.isArray(specifications) || typeof specifications !== 'object' || Object.keys(specifications).length > 50 || Object.entries(specifications).some(([k,v]) => !k || k.length > 100 || typeof v !== 'string' || v.length > 1000)) fail('Invalid variation specifications.');
    if (typeof r.active !== 'boolean' || typeof r.available !== 'boolean') fail('Choose variation availability.');
    return { id, sku, name, size: text('size'), dimensions: text('dimensions'), material: text('material'), finish: text('finish'), colour: text('colour'), specifications, images, mrp, sellingPrice, active: r.active, available: r.available, sortOrder: i, isDefault: r.isDefault === true };
  });
  const selected = selectVariation(result);
  return result.map(r => ({ ...r, isDefault: r.id === selected?.id }));
}
export function selectVariation(rows = []) {
  const ordered = [...rows].sort((a,b) => a.sortOrder - b.sortOrder || a.id.localeCompare(b.id));
  const available = ordered.filter(v => v.active && v.available);
  return available.find(v => v.isDefault) || available[0] || ordered.find(v => v.active) || ordered[0];
}
export function publicVariation(row) {
  const {id,sku,name,size,dimensions,material,finish,colour,specifications,images,active,available,sortOrder,isDefault}=row;
  return {id,sku,name,size,dimensions,material,finish,colour,specifications,images,active,available,sortOrder,isDefault};
}
