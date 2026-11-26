import { validateProductDraft } from "./website-product-validation.mjs";
import { uploadBatch, recordProductUpload, productUploadHistory } from './product-upload-history.mjs';
import {
  categoryPath,
  isWithinCategory,
  orderCategoryImports,
  moveCategoryOrder,
  productCategoryFields,
} from "./category-tree.mjs";
import { DatabaseSync } from "node:sqlite";
import { randomUUID } from "node:crypto";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";

import { TaxonomyError, validateCategory } from "./web-taxonomy-validation.mjs";
export { TaxonomyError, validateCategory };
const fail = (message, status = 422) => {
  throw new TaxonomyError(status, message);
};
export function openTaxonomy(path, seeds = [], seedProducts = []) {
  if (path !== ":memory:") mkdirSync(dirname(path), { recursive: true });
  const db = new DatabaseSync(path);
  db.exec(`PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;
 CREATE TABLE IF NOT EXISTS web_taxonomy_meta(key TEXT PRIMARY KEY,value TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS web_categories(id TEXT PRIMARY KEY,slug TEXT NOT NULL UNIQUE,name TEXT NOT NULL,short TEXT NOT NULL,description TEXT NOT NULL,image TEXT NOT NULL,parent_id TEXT REFERENCES web_categories(id) ON DELETE RESTRICT,published INTEGER NOT NULL CHECK(published IN(0,1)),sort_order INTEGER NOT NULL,version INTEGER NOT NULL DEFAULT 1);
 CREATE TABLE IF NOT EXISTS web_product_categories(product_id TEXT PRIMARY KEY,category_id TEXT NOT NULL REFERENCES web_categories(id) ON DELETE RESTRICT);
 CREATE TABLE IF NOT EXISTS web_products(id TEXT PRIMARY KEY,sku TEXT NOT NULL COLLATE NOCASE UNIQUE,body TEXT NOT NULL,version INTEGER NOT NULL DEFAULT 1);`);
  db.exec(`CREATE TABLE IF NOT EXISTS web_price_history(id INTEGER PRIMARY KEY AUTOINCREMENT,variation_id TEXT NOT NULL,old_mrp TEXT,old_selling_price TEXT,new_mrp TEXT,new_selling_price TEXT,actor TEXT NOT NULL,changed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`);
  const transaction = (work) => {
    db.exec("BEGIN IMMEDIATE");
    try {
      const result = work();
      db.exec("COMMIT");
      return result;
    } catch (error) {
      db.exec("ROLLBACK");
      throw error;
    }
  };
  const map = (row) => {
    const { parent_id, sort_order, ...rest } = row;
    return {
      ...rest,
      parentId: parent_id,
      published: Boolean(rest.published),
      sortOrder: sort_order,
    };
  };
  const list = (publicOnly = false) => {
    const all = db
      .prepare("SELECT * FROM web_categories ORDER BY sort_order,name,id")
      .all()
      .map(map);
    return publicOnly
      ? all.filter((c) => {
          const path = categoryPath(all, c.id);
          return path.length && path.every((p) => p.published);
        })
      : all;
  };
  const write = (input, id, version) => {
    const data = validateCategory(input),
      all = list();
    const current = id ? all.find((c) => c.id === id) : null;
    if (id && !current) fail("Category no longer exists.", 404);
    if (current && current.version !== version)
      fail(
        "This category changed in another session. Refresh before saving.",
        409,
      );
    if (data.parentId) {
      const parent = all.find((c) => c.id === data.parentId);
      if (!parent) fail("Choose an existing parent category.");
      if (id && isWithinCategory(all, parent.id, id))
        fail(
          "A category cannot be its own parent or be moved inside its descendants.",
        );
    }
    if (
      all.some(
        (c) =>
          c.id !== id &&
          (c.slug === data.slug ||
            (c.parentId === data.parentId &&
              c.name.toLowerCase() === data.name.toLowerCase())),
      )
    )
      fail("A category with this slug or sibling name already exists.", 409);
    const values = [
      data.slug,
      data.name,
      data.short,
      data.description,
      data.image,
      data.parentId,
      Number(data.published),
      data.sortOrder,
    ];
    if (current)
      db.prepare(
        "UPDATE web_categories SET slug=?,name=?,short=?,description=?,image=?,parent_id=?,published=?,sort_order=?,version=version+1 WHERE id=?",
      ).run(...values, id);
    else {
      id = randomUUID();
      db.prepare(
        "INSERT INTO web_categories(slug,name,short,description,image,parent_id,published,sort_order,id) VALUES(?,?,?,?,?,?,?,?,?)",
      ).run(...values, id);
    }
    // Reparenting a branch also changes the root stored on its products.
    for (const row of db.prepare('SELECT p.id,p.body,a.category_id FROM web_products p JOIN web_product_categories a ON a.product_id=p.id').all()) {
      const body = JSON.parse(row.body);
      const fields = productCategoryFields(list(), row.category_id);
      if (body.category !== fields.category || (body.subcategory || "") !== fields.subcategory)
        db.prepare('UPDATE web_products SET body=?,version=version+1 WHERE id=?').run(JSON.stringify({ ...body, ...fields }), row.id);
    }
    return list().find((c) => c.id === id);
  };
  transaction(() => {
    if (
      !db
        .prepare("SELECT 1 FROM web_taxonomy_meta WHERE key='initialized'")
        .get()
    ) {
      for (const [i, c] of seeds.entries())
        db.prepare(
          "INSERT INTO web_categories(id,slug,name,short,description,image,parent_id,published,sort_order) VALUES(?,?,?,?,?,?,NULL,1,?)",
        ).run(
          c.id,
          c.id,
          c.name,
          c.short || c.name,
          c.description || "",
          c.image || "",
          i,
        );
      for (const p of seedProducts)
        if (seeds.some((c) => c.id === p.category))
          db.prepare(
            "INSERT INTO web_product_categories(product_id,category_id) VALUES(?,?)",
          ).run(p.id, p.category);
      db.prepare(
        "INSERT INTO web_taxonomy_meta VALUES('initialized','1')",
      ).run();
    }
  });
  const productDrafts = () => db.prepare("SELECT p.body,p.version,a.category_id FROM web_products p LEFT JOIN web_product_categories a ON a.product_id=p.id ORDER BY p.rowid DESC").all().map(row => {
    const body = JSON.parse(row.body);
    return { ...body, ...productCategoryFields(list(), row.category_id || body.subcategory || body.category), version: row.version };
  });
  const writeProduct = (input, batch = uploadBatch()) => {
    const existing = productDrafts();
    const draft = recordProductUpload(validateProductDraft(input, list(), existing), existing.find(p => p.id === input.id), batch);
    const {id,sku,category,subcategory} = draft;
    const previous=productDrafts().find(p=>p.id===id)?.variations || [];
    for(const v of draft.variations) {
      const old=previous.find(row=>row.id===v.id);
      if(!old || old.mrp !== v.mrp || old.sellingPrice !== v.sellingPrice) db.prepare('INSERT INTO web_price_history(variation_id,old_mrp,old_selling_price,new_mrp,new_selling_price,actor) VALUES(?,?,?,?,?,?)').run(v.id,old?.mrp ?? null,old?.sellingPrice ?? null,v.mrp,v.sellingPrice,'website-admin');
    }
    db.prepare("INSERT INTO web_products(id,sku,body) VALUES(?,?,?) ON CONFLICT(id) DO UPDATE SET sku=excluded.sku,body=excluded.body,version=web_products.version+1").run(id, sku, JSON.stringify(draft));
    db.prepare("INSERT INTO web_product_categories VALUES(?,?) ON CONFLICT(product_id) DO UPDATE SET category_id=excluded.category_id").run(id, subcategory || category);
    return productDrafts().find(p => p.id === id);
  };
  const saveProduct = (input) => transaction(() => writeProduct(input));
  return {
    priceHistory: () => db.prepare('SELECT * FROM web_price_history ORDER BY id DESC LIMIT 500').all(),
    productDrafts,
    saveProduct,
    saveProducts: (inputs) => transaction(() => { const batch = uploadBatch('spreadsheet'); return inputs.map(input => writeProduct(input, batch)); }),
    uploadHistory: () => productUploadHistory(productDrafts()),
    list,
    transfer: (sourceId, destinationId) => transaction(() => {
      const all = list();
      if (!all.some(c => c.id === destinationId) || (sourceId !== "*" && !all.some(c => c.id === sourceId)))
        fail("Choose an existing source and destination category.");
      if (sourceId === destinationId) fail("Choose a different destination category.");
      const fields = productCategoryFields(all, destinationId);
      const affected = db.prepare('SELECT product_id,category_id FROM web_product_categories').all()
        .filter(row => row.category_id !== destinationId && (sourceId === "*" || isWithinCategory(all, row.category_id, sourceId)));
      for (const row of affected) {
        const product = db.prepare('SELECT body FROM web_products WHERE id=?').get(row.product_id);
        if (product) db.prepare('UPDATE web_products SET body=?,version=version+1 WHERE id=?').run(JSON.stringify({ ...JSON.parse(product.body), ...fields }), row.product_id);
        db.prepare('UPDATE web_product_categories SET category_id=? WHERE product_id=?').run(destinationId, row.product_id);
      }
      return affected.length;
    }),
    move: (id, direction, version) => transaction(() => {
      let ordered;
      try { ordered = moveCategoryOrder(list(), id, direction, version); }
      catch (error) { fail(error.message, 409); }
      for (const c of ordered) db.prepare('UPDATE web_categories SET sort_order=?,version=version+1 WHERE id=?').run(c.sortOrder, c.id);
    }),
    create: (input) => transaction(() => write(input)),
    update: (id, input, version) =>
      transaction(() => write(input, id, version)),
    remove: (id, version) =>
      transaction(() => {
        const current = list().find((c) => c.id === id);
        if (!current) fail("Category not found.", 404);
        if (current.version !== version)
          fail("Refresh before deleting this category.", 409);
        if (list().some((c) => c.parentId === id))
          fail(
            "Remove or move subcategories before deleting this category.",
            409,
          );
        if (!current.parentId &&
          db
            .prepare("SELECT 1 FROM web_product_categories WHERE category_id=?")
            .get(id)
        )
          fail("Reassign products before deleting this category.", 409);
        if (current.parentId) {
          const root = categoryPath(list(), id)[0];
          const affected = db.prepare('SELECT p.id,p.body FROM web_products p JOIN web_product_categories a ON a.product_id=p.id WHERE a.category_id=?').all(id);
          for (const row of affected)
            db.prepare('UPDATE web_products SET body=?,version=version+1 WHERE id=?').run(JSON.stringify({ ...JSON.parse(row.body), category: root.id, subcategory: "" }), row.id);
          db.prepare('UPDATE web_product_categories SET category_id=? WHERE category_id=?').run(root.id, id);
        }
        db.prepare("DELETE FROM web_categories WHERE id=?").run(id);
      }),
    assign: (productId, categoryId) =>
      transaction(() => {
        if (!seedProducts.some((p) => p.id === productId) && !productDrafts().some(p => p.id === productId))
          fail("Only existing website products can be assigned here.", 404);
        if (!list().some((c) => c.id === categoryId))
          fail("Select an existing category.");
        db.prepare(
          "INSERT INTO web_product_categories VALUES(?,?) ON CONFLICT(product_id) DO UPDATE SET category_id=excluded.category_id",
        ).run(productId, categoryId);
        const row = db.prepare('SELECT body FROM web_products WHERE id=?').get(productId);
        if (row) db.prepare('UPDATE web_products SET body=?,version=version+1 WHERE id=?').run(JSON.stringify({ ...JSON.parse(row.body), ...productCategoryFields(list(), categoryId) }), productId);
      }),
    assignments: () =>
      Object.fromEntries(
        db
          .prepare("SELECT product_id,category_id FROM web_product_categories")
          .all()
          .map((r) => [r.product_id, r.category_id]),
      ),
    import: (rows) =>
      transaction(() => {
        if (!Array.isArray(rows) || !rows.length || rows.length > 500)
          fail("Import between 1 and 500 rows.");
        const imported = [];
        let ordered;
        try {
          ordered = orderCategoryImports(rows, list());
        } catch (error) {
          fail(error.message);
        }
        for (const row of ordered) {
          const parent = row.parentSlug
            ? list().find((c) => c.slug === row.parentSlug)
            : null;
          if (row.parentSlug && !parent)
            fail(`Unknown parent slug: ${row.parentSlug}`);
          imported.push(write({ ...row, parentId: parent?.id ?? null }));
        }
        return imported;
      }),
    close: () => db.close(),
  };
}
