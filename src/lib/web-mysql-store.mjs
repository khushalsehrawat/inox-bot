import { randomUUID } from 'node:crypto';
import { uploadBatch, recordProductUpload, productUploadHistory } from './product-upload-history.mjs';
import { websitePool, mysqlTransaction } from './web-mysql.mjs';
import { validateCategory, TaxonomyError } from './web-taxonomy-validation.mjs';
import { categoryPath, isWithinCategory, orderCategoryImports, moveCategoryOrder, productCategoryFields } from './category-tree.mjs';
import { validateVariations, publicVariation } from './variations.mjs';
const fail = (message, status = 422) => { throw new TaxonomyError(status, message); };
const json = v => typeof v === 'string' ? JSON.parse(v) : v;
export function mysqlStore(connection = websitePool()) {
  const query = async (sql, values = []) => (await connection.execute(sql, values))[0];
  const list = async (publicOnly = false) => {
    const rows = await query('SELECT * FROM web_categories ORDER BY sort_order,name,id');
    const all = rows.map(r => ({ id:r.id, slug:r.slug, name:r.name, short:r.short, description:r.description, image:r.image, parentId:r.parent_id, published:!!r.published, sortOrder:r.sort_order, version:r.version }));
    return publicOnly ? all.filter(c => categoryPath(all,c.id).every(p => p.published)) : all;
  };
  const productDrafts = async () => {
    const products = await query('SELECT id,body,version,category_id FROM web_products ORDER BY id');
    const categories = await list();
    const rows = await query('SELECT v.*,p.mrp,p.selling_price FROM web_variations v JOIN web_variation_prices p ON p.variation_id=v.id ORDER BY v.sort_order,v.id');
    const variationsByProduct = new Map();
    for (const v of rows) {
      if (!variationsByProduct.has(v.product_id)) variationsByProduct.set(v.product_id, []);
      variationsByProduct.get(v.product_id).push({ ...json(v.body), mrp:v.mrp, sellingPrice:v.selling_price });
    }
    return products.map(p => ({ ...json(p.body), ...productCategoryFields(categories,p.category_id), version:p.version, variations:variationsByProduct.get(p.id) || [] }));
  };
  const writeCategory = async (input,id,version) => {
    await query("SELECT version FROM web_schema_versions WHERE version=1 FOR UPDATE");
    const data = validateCategory(input), all = await list();
    const current = all.find(c => c.id === id);
    if (id && !current) fail('Category not found.',404);
    if (current && current.version !== version) fail('Category changed. Refresh first.',409);
    if (data.parentId && (!all.some(c => c.id === data.parentId) || isWithinCategory(all,data.parentId,id))) fail('Invalid category parent.');
    if (all.some(c => c.id !== id && (c.slug === data.slug || (c.parentId === data.parentId && c.name.toLowerCase() === data.name.toLowerCase())))) fail('Category already exists.',409);
    const values = [data.slug,data.name,data.short,data.description,data.image,data.parentId,Number(data.published),data.sortOrder];
    if (current) await query('UPDATE web_categories SET slug=?,name=?,short=?,description=?,image=?,parent_id=?,published=?,sort_order=?,version=version+1 WHERE id=?', [...values,id]);
    else { id = randomUUID(); await query('INSERT INTO web_categories(slug,name,short,description,image,parent_id,published,sort_order,id) VALUES(?,?,?,?,?,?,?,?,?)',[...values,id]); }
    const categories = await list();
    for (const row of await query('SELECT id,body,category_id FROM web_products')) {
      const body = json(row.body), fields = productCategoryFields(categories,row.category_id);
      if (body.category !== fields.category || (body.subcategory || '') !== fields.subcategory)
        await query('UPDATE web_products SET body=?,version=version+1 WHERE id=?',[JSON.stringify({...body,...fields}),row.id]);
    }
    return categories.find(c => c.id === id);
  };
  const saveProduct = async (input, batch = uploadBatch()) => {
    await query('SELECT version FROM web_schema_versions WHERE version=1 FOR UPDATE');
    const { validateProductDraft } = await import('./website-product-validation.mjs');
    const all = await list(), existing = await productDrafts();
    const draft = recordProductUpload(validateProductDraft(input,all,existing),existing.find(p=>p.id===input.id),batch);
    // Lock the parent before comparing versions; concurrent edits must never win silently.
    const locked = await query('SELECT version FROM web_products WHERE id=? FOR UPDATE',[draft.id]);
    if (locked.length && locked[0].version !== input.version) fail('Product changed. Reload first.',409);
    const { variations, version, ...body } = draft;
    if (locked.length) await query('UPDATE web_products SET sku=?,category_id=?,body=?,version=version+1 WHERE id=?',[draft.sku,draft.subcategory || draft.category,JSON.stringify(body),draft.id]);
    else await query('INSERT INTO web_products(id,sku,category_id,body) VALUES(?,?,?,?)',[draft.id,draft.sku,draft.subcategory || draft.category,JSON.stringify(body)]);
    const previous = existing.find(p => p.id === draft.id)?.variations || [];
    for (const v of variations) {
      const owner = await query('SELECT product_id FROM web_variations WHERE id=?',[v.id]);
      if (owner.length && owner[0].product_id !== draft.id) fail('Variation belongs to another product.',409);
      if (owner.length) await query('UPDATE web_variations SET sku=?,body=?,sort_order=? WHERE id=? AND product_id=?',[v.sku,JSON.stringify(publicVariation(v)),v.sortOrder,v.id,draft.id]);
      else await query('INSERT INTO web_variations(id,product_id,sku,body,sort_order) VALUES(?,?,?,?,?)',[v.id,draft.id,v.sku,JSON.stringify(publicVariation(v)),v.sortOrder]);
      const old = previous.find(p => p.id === v.id);
      if (!old || old.mrp !== v.mrp || old.sellingPrice !== v.sellingPrice) await query('INSERT INTO web_price_history(variation_id,old_mrp,old_selling_price,new_mrp,new_selling_price,actor) VALUES(?,?,?,?,?,?)',[v.id,old?.mrp ?? null,old?.sellingPrice ?? null,v.mrp,v.sellingPrice,'website-admin']);
      await query('INSERT INTO web_variation_prices(variation_id,mrp,selling_price) VALUES(?,?,?) ON DUPLICATE KEY UPDATE mrp=VALUES(mrp),selling_price=VALUES(selling_price)',[v.id,v.mrp,v.sellingPrice]);
    }
    for (const v of previous.filter(p => !variations.some(v => v.id === p.id))) await query('DELETE FROM web_variations WHERE id=? AND product_id=?',[v.id,draft.id]);
    await query('DELETE FROM web_product_images WHERE product_id=?',[draft.id]);
    for (const [variationId,images] of [['',draft.images],...variations.map(v => [v.id,v.images])]) for (const [i,url] of images.entries()) await query('INSERT INTO web_product_images(product_id,variation_id,url,sort_order) VALUES(?,?,?,?)',[draft.id,variationId,url,i]);
    await query('DELETE FROM web_product_pdfs WHERE product_id=?',[draft.id]);
    if (draft.pdf) await query('INSERT INTO web_product_pdfs(product_id,url) VALUES(?,?)',[draft.id,draft.pdf]);
    return (await productDrafts()).find(p => p.id === draft.id);
  };
  const atomic = work => connection === websitePool() ? mysqlTransaction(c => work(mysqlStore(c))) : work(api);
  const api = { list, productDrafts, priceHistory:() => query('SELECT * FROM web_price_history ORDER BY id DESC LIMIT 500'), _query:query, saveProduct: input => atomic(s => s._saveProduct(input)), _saveProduct:saveProduct,
    saveProducts: inputs => atomic(async s => { const batch=uploadBatch('spreadsheet'); const saved=[]; for(const input of inputs) saved.push(await s._saveProduct(input,batch)); return saved; }),
    uploadHistory: async () => productUploadHistory(await productDrafts()),
    transfer: (sourceId,destinationId) => atomic(async s => {
      await s._query('SELECT version FROM web_schema_versions WHERE version=1 FOR UPDATE');
      const all = await s.list();
      if (!all.some(c => c.id === destinationId) || (sourceId !== '*' && !all.some(c => c.id === sourceId))) fail('Choose an existing source and destination category.');
      if (sourceId === destinationId) fail('Choose a different destination category.');
      const fields = productCategoryFields(all,destinationId);
      const affected = (await s._query('SELECT id,body,category_id FROM web_products FOR UPDATE'))
        .filter(row => row.category_id !== destinationId && (sourceId === '*' || isWithinCategory(all,row.category_id,sourceId)));
      for (const row of affected) await s._query('UPDATE web_products SET category_id=?,body=?,version=version+1 WHERE id=?',[destinationId,JSON.stringify({...json(row.body),...fields}),row.id]);
      return affected.length;
    }),
    move: (id,direction,version) => atomic(async s => {
      await s._query('SELECT version FROM web_schema_versions WHERE version=1 FOR UPDATE');
      let ordered;
      try { ordered = moveCategoryOrder(await s.list(),id,direction,version); }
      catch (error) { fail(error.message,409); }
      for (const c of ordered) await s._query('UPDATE web_categories SET sort_order=?,version=version+1 WHERE id=?',[c.sortOrder,c.id]);
    }),
    create: input => atomic(s => s._writeCategory(input)), update:(id,input,version) => atomic(s => s._writeCategory(input,id,version)), _writeCategory:writeCategory,
    assignments:async () => Object.fromEntries((await query('SELECT id,category_id FROM web_products')).map(p => [p.id,p.category_id])),
    remove:(id,version) => atomic(async s => {
      await s._query('SELECT version FROM web_schema_versions WHERE version=1 FOR UPDATE');
      const all = await s.list(), current = all.find(c => c.id === id);
      if (!current) fail('Category not found.',404);
      if (current.version !== version) fail('Category changed. Refresh first.',409);
      if (all.some(c => c.parentId === id)) fail('Remove or move subcategories first.',409);
      const affected = await s._query('SELECT id,body FROM web_products WHERE category_id=? FOR UPDATE',[id]);
      if (!current.parentId && affected.length) fail('Reassign products before deleting this category.',409);
      if (current.parentId) {
        const root = categoryPath(all,id)[0];
        for (const row of affected) {
          const body = {...json(row.body),category:root.id,subcategory:''};
          await s._query('UPDATE web_products SET category_id=?,body=?,version=version+1 WHERE id=?',[root.id,JSON.stringify(body),row.id]);
        }
      }
      const r = await s._query('DELETE FROM web_categories WHERE id=? AND version=?',[id,version]);
      if (!r.affectedRows) fail('Category changed.',409);
    }),
    assign:(productId,categoryId) => atomic(async s => {
      await s._query('SELECT version FROM web_schema_versions WHERE version=1 FOR UPDATE');
      const all = await s.list();
      if (!all.some(c => c.id === categoryId)) fail('Choose an existing category.');
      const rows = await s._query('SELECT body FROM web_products WHERE id=? FOR UPDATE',[productId]);
      if (!rows.length) fail('Product not found.',404);
      const body = { ...json(rows[0].body), ...productCategoryFields(all,categoryId) };
      await s._query('UPDATE web_products SET category_id=?,body=?,version=version+1 WHERE id=?',[categoryId,JSON.stringify(body),productId]);
    }),
    import: rows => atomic(async s => { if (!Array.isArray(rows) || !rows.length || rows.length > 500) fail('Import 1–500 categories.'); const ordered = orderCategoryImports(rows,await s.list()); const result=[]; for(const row of ordered) { const parent = (await s.list()).find(c => c.slug === row.parentSlug); result.push(await s._writeCategory({...row,parentId:parent?.id ?? null})); } return result; }), close:() => {} };
  return api;
}
