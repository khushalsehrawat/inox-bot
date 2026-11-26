import { randomUUID } from 'node:crypto';
import { validateProductDraft } from './website-product-validation.mjs';
import { TaxonomyError } from './web-taxonomy-validation.mjs';
export function prepareCatalogueImport(rows,categories,existing) {
  const fail=message=>{throw new TaxonomyError(422,message);};
  if (!Array.isArray(rows) || !rows.length || rows.length > 500) fail('Import 1–500 variation rows.');
  const grouped=new Map();
  const bool=(value,fallback,label)=>{if(value === undefined)return fallback;if(!['true','false'].includes(String(value).trim().toLowerCase()))fail(`${label} must be true or false.`);return String(value).trim().toLowerCase()==='true';};
  for (const [index,row] of rows.entries()) {
    try {
      if(!row || typeof row !== 'object' || Array.isArray(row)) fail('Invalid row.');
      if(['images','pdf','variationImages'].some(k=>k in row)) fail('Upload images and PDFs through the admin panel only.');
      const sku=String(row.productSku || '').trim();
      if(!sku) fail('Every row needs productSku.');
      const current=row.productId ? existing.find(p=>p.id===row.productId) : existing.find(p=>p.sku.toLowerCase()===sku.toLowerCase());
      if(row.productId && !current) fail('Product ID not found. Download a fresh export.');
      if(current && (!row.version || Number(row.version)!==current.version)) fail(`Product "${current.name}" changed or version is missing. Download a fresh export.`);
      const key=current?.id || sku.toLowerCase();
      const category=categories.find(c=>!c.parentId && [c.id,c.slug,c.name].includes(row.category));
      if(!category) fail('Choose an existing category ID, slug or name.');
      const subcategory=row.subcategory ? categories.find(c=>[c.id,c.slug].includes(row.subcategory))?.id || row.subcategory : '';
      const fields={sku,name:row.productName,category:category.id,subcategory,description:row.description ?? current?.description ?? '',keyFeatures:row.keyFeatures ?? current?.keyFeatures ?? '',specifications:row.sharedSpecifications ?? current?.specifications ?? '',finish:row.productFinish ?? current?.finish ?? '',webVisible:bool(row.webVisible,current?.webVisible ?? true,'webVisible'),featured:bool(row.featured,current?.featured ?? false,'featured')};
      let entry=grouped.get(key);
      if(!entry){entry={fields,product:{...current,...fields,id:current?.id || randomUUID(),images:current?.images || [],pdf:current?.pdf || '',variations:[...(current?.variations || [])]},seen:new Set()};grouped.set(key,entry);}
      if(JSON.stringify(entry.fields)!==JSON.stringify(fields)) fail('Rows for the same product must agree on all product columns.');
      const previous=row.variationId ? current?.variations?.find(v=>v.id===row.variationId) : current?.variations?.find(v=>v.sku.toLowerCase()===String(row.sku).trim().toLowerCase());
      if(row.variationId && !previous) fail('Variation ID does not belong to this product. Download a fresh export.');
      const id=previous?.id || randomUUID();
      if(entry.seen.has(id) || entry.seen.has(String(row.sku).trim().toLowerCase())) fail('Duplicate variation row.');
      entry.seen.add(id);entry.seen.add(String(row.sku).trim().toLowerCase());
      let specifications=previous?.specifications || {};
      try{if(row.specifications !== undefined)specifications=row.specifications ? JSON.parse(row.specifications) : {};}catch{fail('Specifications must be a JSON object.');}
      const variation={...previous,id,sku:row.sku,specifications,images:previous?.images || [],...Object.fromEntries(['size','dimensions','material','finish','colour','mrp','sellingPrice'].map(k=>[k,row[k] ?? previous?.[k] ?? ''])),active:bool(row.active,previous?.active ?? true,'active'),available:bool(row.available,previous?.available ?? true,'available'),isDefault:bool(row.isDefault,previous?.isDefault ?? false,'isDefault')};
      entry.product.variations=entry.product.variations.filter(v=>v.id!==id).concat(variation);
    }catch(error){fail(`Row ${index+2}: ${error.message}`);}
  }
  const result=[];
  for(const {product} of grouped.values()) {
    try{const valid=validateProductDraft(product,categories,[...existing.filter(p=>!result.some(r=>r.id===p.id)),...result]);result.push({...valid,...(product.version !== undefined ? {version:product.version} : {})});}
    catch(error){fail(`Product "${product.name}": ${error.message}`);}
  }
  return result;
}
