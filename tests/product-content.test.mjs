import { test } from 'node:test';
import assert from 'node:assert/strict';
import { productContent } from '../src/lib/product-content.mjs';
import { validateProductDraft } from '../src/lib/website-product-validation.mjs';
import { randomUUID } from 'node:crypto';

test('legacy bullet features move out of the overview; an explicit empty field stays empty', () => {
  const description='Product overview\r\n- Soft close\r\n\u2022 Easy to clean';
  assert.deepEqual(productContent({description}), {description:'Product overview',keyFeatures:'Soft close\nEasy to clean'});
  assert.deepEqual(productContent({description,keyFeatures:''}), {description,keyFeatures:''});
});

test('product validation preserves separate features and rejects invalid input', () => {
  const draft={id:randomUUID(),name:'Basket',category:'kitchen',description:'Overview',keyFeatures:'Soft close\nEasy to clean',webVisible:false,variations:[{id:randomUUID(),sku:'BASKET-1',active:true,available:true,images:[],specifications:{},mrp:null,sellingPrice:null}]};
  const categories=[{id:'kitchen',parentId:null}];
  assert.equal(validateProductDraft(draft,categories).keyFeatures,draft.keyFeatures);
  assert.throws(()=>validateProductDraft({...draft,keyFeatures:42},categories),/keyFeatures/);
  assert.throws(()=>validateProductDraft({...draft,keyFeatures:'x'.repeat(3001)},categories),/keyFeatures/);
});
