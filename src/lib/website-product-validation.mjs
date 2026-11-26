import { TaxonomyError } from './web-taxonomy-validation.mjs';
import { categoryPath, isWithinCategory } from './category-tree.mjs';
import { validateVariations } from './variations.mjs';
import { productSkuFromName } from './product-sku.mjs';
import { productContent } from './product-content.mjs';
export function validateProductDraft(input, categories, existing = []) {
  const fail = message => { throw new TaxonomyError(422,message); };
  if (!input || typeof input !== 'object' || Array.isArray(input)) fail('Invalid product.');
  const text = (key,max,required=false) => { const v=input[key] ?? ''; if (typeof v !== 'string' || v.length > max || (required && !v.trim())) fail(`Invalid product ${key}.`); return v.trim(); };
  const name=text('name',200,true);
  const id=text('id',100,true), sku=text('sku',100) || productSkuFromName(name), category=text('category',100,true), subcategory=text('subcategory',100);
  if (!sku) fail('Enter a product name containing letters or numbers to generate its SKU.');
  if (!/^[a-f0-9-]{36}$/.test(id)) fail('Invalid product ID.');
  const current=existing.find(p => p.id === id);
  if ((current && current.version !== input.version) || (!current && input.version !== undefined)) throw new TaxonomyError(409,'Product changed. Reload before saving.');
  if (existing.some(p => p.id !== id && p.sku.toLowerCase() === sku.toLowerCase())) fail('Product SKU already exists.');
  if (!categories.some(c => c.id === category && !c.parentId) || (subcategory && (subcategory === category || !isWithinCategory(categories,subcategory,category)))) fail('Choose an existing category and matching subcategory.');
  if (typeof input.webVisible !== 'boolean') fail('Choose product visibility.');
  if (input.webVisible && !categoryPath(categories,subcategory || category).every(c => c.published)) fail('Publish the category first.');
  const images=input.images ?? [], pdf=text('pdf',200);
  if (!Array.isArray(images) || images.length > 10 || images.some(url => typeof url !== 'string' || !/^\/api\/web\/product-media\/[a-f0-9-]{36}\.webp$/.test(url))) fail('Upload valid product images.');
  if (pdf && !/^\/api\/web\/product-media\/[a-f0-9-]{36}\.pdf$/.test(pdf)) fail('Upload a valid PDF.');
  const variations=validateVariations(input.variations);
  for (const variation of variations) {
    const owner=existing.find(p => p.id !== id && (p.variations || []).some(v => v.id === variation.id || v.sku.toLowerCase() === variation.sku.toLowerCase()));
    if (owner) fail(`Variation "${variation.sku}" has an ID or SKU already used by product "${owner.name}" (Product SKU: ${owner.sku}). Use a unique variation SKU; if you copied this variation, remove it and add a new one.`);
  }
  const content=productContent({description:text('description',3000),keyFeatures:input.keyFeatures === undefined ? undefined : text('keyFeatures',3000)});
  return {id,sku,name:text('name',200,true),...content,category,subcategory,specifications:text('specifications',10000),finish:text('finish',500),images:[...new Set(images)],pdf,webVisible:input.webVisible,featured:input.featured === true,appVisible:false,status:input.webVisible?'Published':'Draft',variations};
}
