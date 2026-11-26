import { parseCSV, csvCell } from './import.mjs';
export const catalogueHeaders = ['productId','version','productSku','productName','category','subcategory','description','keyFeatures','sharedSpecifications','productFinish','webVisible','featured','variationId','sku','size','dimensions','material','finish','colour','specifications','mrp','sellingPrice','active','available','isDefault'];
export function catalogueRows(products) {
  return products.flatMap(p => (p.variations || []).map(v => ({productId:p.id,version:p.version,productSku:p.sku,productName:p.name,category:p.category,subcategory:p.subcategory || '',description:p.description,keyFeatures:p.keyFeatures || '',sharedSpecifications:p.specifications,productFinish:p.finish,webVisible:p.webVisible,featured:p.featured,variationId:v.id,...Object.fromEntries(['sku','size','dimensions','material','finish','colour','mrp','sellingPrice','active','available','isDefault'].map(k=>[k,v[k] ?? ''])),specifications:JSON.stringify(v.specifications || {})})));
}
export function catalogueCSV(rows) {
  return '\uFEFF' + [catalogueHeaders,...rows.map(r=>catalogueHeaders.map(h=>r[h] ?? ''))].map(row=>row.map(value=>csvCell(String(value).startsWith("'") ? "'"+value : value)).join(',')).join('\r\n');
}
export function readCatalogueRows(matrix) {
  if (matrix.length < 2 || matrix.length > 501) throw Error('Include a header and 1–500 variation rows. Split larger exports into files of up to 500 rows.');
  const headers=matrix[0].map(h=>String(h).trim());
  if (new Set(headers).size !== headers.length) throw Error('Duplicate column names.');
  for(const h of headers) if(!catalogueHeaders.includes(h)) throw Error(`Unknown column: ${h}. Use the downloaded template. Images are managed in the admin panel.`);
  for(const h of ['productSku','productName','category','sku']) if(!headers.includes(h)) throw Error(`Missing required column: ${h}.`);
  return matrix.slice(1).map((values,i)=>{
    if(values.length !== headers.length) throw Error(`Row ${i+2}: column count does not match the header.`);
    return Object.fromEntries(headers.map((h,j)=>[h,String(values[j] ?? '').replace(/^'(?=['=+\-@\t\r])/,'')]));
  });
}
export function readCatalogueCSV(text) { return readCatalogueRows(parseCSV(text)); }

