import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { productSkuFromName } from '../src/lib/product-sku.mjs';
import { validateVariations } from '../src/lib/variations.mjs';
test('product SKU replaces runs of spaces and punctuation with one hyphen',()=>{
  assert.equal(productSkuFromName('  Soft close / Kitchen & Basket (600 mm)  '),'SOFT-CLOSE-KITCHEN-BASKET-600-MM');
  assert.equal(productSkuFromName('INOX---Basket___Chrome'),'INOX-BASKET-CHROME');
  assert.equal(productSkuFromName('Caf\u00e9 Shelf'),'CAFE-SHELF');
  assert.equal(productSkuFromName(' !@#$ '),'');
  assert.equal(productSkuFromName('a'.repeat(200)).length,100);
  assert.ok(!productSkuFromName('x'.repeat(99)+' shelf').endsWith('-'));
});
test('variations save with SKU only, using it as the compatible display label',()=>{
  const [saved]=validateVariations([{id:randomUUID(),sku:'INOX-600-CH',active:true,available:true,mrp:null,sellingPrice:null}]);
  assert.equal(saved.sku,'INOX-600-CH');assert.equal(saved.name,'INOX-600-CH');
});
