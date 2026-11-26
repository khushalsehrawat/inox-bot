import "server-only";
import { withTaxonomy, usesMysql, invalidateWebCatalogue } from './web-taxonomy';
import { websitePool, mysqlTransaction } from './web-mysql.mjs';
import { mysqlStore } from './web-mysql-store.mjs';
import { money, selectVariation } from './variations.mjs';
import { TaxonomyError } from './web-taxonomy-validation.mjs';
export async function variationPrices(publicOnly = false) {
  return withTaxonomy(async store => {
    const categories = await store.list(true), products = await store.productDrafts();
    return products.filter(p => !publicOnly || (p.webVisible && categories.some(c => c.id === (p.subcategory || p.category)))).flatMap(p => {
      const selected = selectVariation(p.variations);
      return (p.variations || []).filter(v => !publicOnly || v.active).map(v => ({ product_id:p.id, variation_id:v.id, name:p.name, category:p.subcategory || p.category, sku:v.sku, mrp:v.mrp, sellingPrice:v.sellingPrice, amount:v.sellingPrice === null ? null : Math.round(Number(v.sellingPrice) * 100), isDefault:v.id === selected?.id, version:p.version }));
    });
  });
}
export async function savePrices(changes: { variationId: string; mrp: unknown; sellingPrice: unknown; version: number }[]) {
  if (!Array.isArray(changes) || !changes.length || changes.length > 500 || new Set(changes.map(c => c.variationId)).size !== changes.length) throw new TaxonomyError(422,'Choose 1–500 unique variation prices.');
  const validated = changes.map(c => ({...c,mrp:money(c.mrp),sellingPrice:money(c.sellingPrice)}));
  const work = async (store: ReturnType<typeof mysqlStore>) => {
    const products = await store.productDrafts();
    if (validated.some(c => !products.some(p => p.version === c.version && p.variations?.some(v => v.id === c.variationId)))) throw new TaxonomyError(409,'Unknown variation or changed product. Refresh before saving.');
    for (const p of products) {
      if (!p.variations?.some(v => validated.some(c => c.variationId === v.id))) continue;
      await store.saveProduct({...p,variations:p.variations.map(v => { const c = validated.find(c => c.variationId === v.id); return c ? {...v,mrp:c.mrp,sellingPrice:c.sellingPrice} : v; })});
    }
  };
  if (usesMysql()) await mysqlTransaction(async connection => { await work(mysqlStore(connection) as ReturnType<typeof mysqlStore>); });
  else {
    if (validated.length !== 1) throw new TaxonomyError(422,'Bulk price writes require the isolated MySQL test database.');
    await withTaxonomy(work);
  }
  invalidateWebCatalogue();
  return variationPrices();
}
export async function priceHistory() {
  return withTaxonomy(store => store.priceHistory());
}
