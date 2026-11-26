"use client";
import { useEffect, useRef, useState } from 'react';
import { Check, ChevronRight, FileText, ImagePlus, LoaderCircle, Package, Save, Upload, X } from 'lucide-react';
import type { ProductDraft } from '@/lib/web-taxonomy-store.mjs';
import type { WebCategory } from '@/lib/web-taxonomy-model';
import { categoryPath, isWithinCategory } from '@/lib/category-tree.mjs';
import { productSkuFromName } from '@/lib/product-sku.mjs';
import { AdminImageGallery } from "./admin-image-editor";
import { VariationEditor } from './variation-editor';
import { SpecificationEditor } from './specification-editor';
import { productContent } from '@/lib/product-content.mjs';

export function adminMediaUrl(url:string) {
  return `/api/admin/product-media?filename=${encodeURIComponent(url.split('/').at(-1) || '')}`;
}
type Props = {
  product:ProductDraft; categories:WebCategory[]; busy:boolean; ready:boolean; error:string;
  onChange:(product:ProductDraft)=>void; onBusyChange:(busy:boolean)=>void; onClose:()=>void;
  onUpload:(files:File[],kind:'images'|'pdf')=>Promise<void>;
  onSubmit:(product:ProductDraft)=>Promise<void>; onSaveLocal?:()=>void;
};
export function ProductUploadEditor({product:p,categories,busy,ready,error,onChange,onBusyChange,onClose,onUpload,onSubmit,onSaveLocal}:Props) {
  const [pendingPhotos,setPendingPhotos]=useState<{url:string;name:string}[]>([]);
  const temporaryUrls=useRef<string[]>([]);
  useEffect(()=>()=>{temporaryUrls.current.forEach(url=>URL.revokeObjectURL(url));},[]);
  async function uploadPhotos(files:File[]) {
    if(!files.length)return;
    temporaryUrls.current.forEach(url=>URL.revokeObjectURL(url));
    const previews=files.filter(file=>file.type.startsWith('image/')).slice(0,10).map(file=>({url:URL.createObjectURL(file),name:file.name}));
    temporaryUrls.current=previews.map(p=>p.url);setPendingPhotos(previews);
    try {await onUpload(files,'images');} finally {temporaryUrls.current.forEach(url=>URL.revokeObjectURL(url));temporaryUrls.current=[];setPendingPhotos([]);}
  }
  const generatedSku=p.version ? p.sku : productSkuFromName(p.name);
  const content=productContent(p);
  const patch=(values:Partial<ProductDraft>)=>onChange({...p,...values});
  const checks=[{label:'Product name',done:!!p.name.trim()},{label:'Product SKU',done:!!generatedSku},{label:'Category',done:!!p.category},{label:'Variation details',done:!!p.variations?.length && p.variations.every(v=>v.sku.trim())}];
  const completed=checks.filter(c=>c.done).length;
  return <section className="product-editor upload-editor" aria-labelledby="upload-editor-title">
    <header className="upload-editor-header"><div className="upload-heading-icon"><Package size={22}/></div><div><span className="eyebrow">PRODUCT STUDIO</span><h2 id="upload-editor-title">{p.version?'Edit product':'Add a new product'}</h2><p>A few details. A beautiful product page.</p></div><button type="button" className="upload-icon-button" aria-label="Close product editor" disabled={busy} onClick={onClose}><X size={20}/></button></header>
    <nav className="upload-step-nav" aria-label="Product setup sections">{[['basics','Details'],['media','Photos & PDF'],['variations','Variations'],['publish','Review']].map(([id,label],i)=><a key={id} href={`#upload-${id}`}><span>{i+1}</span>{label}</a>)}</nav>
    <form className="upload-editor-form" onSubmit={async e=>{e.preventDefault();await onSubmit({...p,name:p.name.trim(),sku:generatedSku,appVisible:false});}}>
      <fieldset disabled={busy} className="upload-form-fields">
        <section className="upload-section" id="upload-basics"><div className="upload-section-heading"><span>01</span><div><h3>Start with the essentials</h3><p>Help customers find and understand this product.</p></div></div>
          <label>Product name <span className="required-mark">*</span><input aria-label="Product name" autoFocus required maxLength={200} value={p.name} placeholder="e.g. Soft-close kitchen basket" onChange={e=>patch({name:e.target.value,sku:p.version ? p.sku : productSkuFromName(e.target.value)})}/></label>
          <div className="upload-field-grid"><label>SKU <span className="required-mark">*</span><input aria-label="SKU" readOnly value={generatedSku} placeholder="Generated from product name"/><small>Existing references are preserved when editing. New references are generated from the name.</small></label><label>Category <span className="required-mark">*</span><select aria-label="Category" required value={p.category} onChange={e=>patch({category:e.target.value,subcategory:''})}><option value="">Choose a collection</option>{categories.filter(c=>!c.parentId).map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label></div>
          <label>Subcategory <span className="field-optional">optional</span><select value={p.subcategory || ''} onChange={e=>patch({subcategory:e.target.value})}><option value="">No subcategory</option>{categories.filter(c=>c.id!==p.category && isWithinCategory(categories,c.id,p.category)).map(c=><option key={c.id} value={c.id}>{categoryPath(categories,c.id).slice(1).map(c=>c.name).join(' / ')}</option>)}</select></label>
          <label>Product overview<textarea rows={3} maxLength={3000} value={content.description} placeholder="Describe its intended use using verified facts." onChange={e=>patch({...content,description:e.target.value})}/></label>
          <section className="upload-key-features" aria-labelledby="upload-key-features-heading"><h3 id="upload-key-features-heading">Key features</h3><p>Highlight the product’s benefits using verified facts. Enter one feature per line.</p><label>Key features<textarea rows={4} maxLength={3000} value={content.keyFeatures} placeholder={'Soft-close operation\nEasy to clean\nAdjustable installation'} onChange={e=>patch({...content,keyFeatures:e.target.value})}/></label></section>
          <details className="upload-extra-details"><summary>Shared finishes & technical details <span>Optional</span></summary><div className="upload-details-content"><p>These details apply to every variation unless you enter a different value there.</p><label>Available finishes<input value={p.finish} placeholder="e.g. Chrome, Matt black" onChange={e=>patch({finish:e.target.value})}/></label><SpecificationEditor value={p.specifications} category={categories.find(c=>c.id===p.category)?.name || ""} onChange={specifications=>patch({specifications})}/></div></details>
        </section>
        <section className="upload-section" id="upload-media"><div className="upload-section-heading"><span>02</span><div><h3>Make it look its best</h3><p>Add clear product photos and an optional datasheet.</p></div></div>
          <label className="product-file-drop" onDragOver={e=>e.preventDefault()} onDrop={e=>{e.preventDefault();if(!busy)void uploadPhotos(Array.from(e.dataTransfer.files));}}><ImagePlus size={28}/><strong>{p.images.length?'Replace product photos':'Choose product photos'}</strong><span>JPG, PNG or WebP · up to 10 images · 8 MB each</span><span className="upload-file-button"><Upload size={15}/>Browse images</span><input aria-label="Product images" type="file" multiple accept="image/png,image/jpeg,image/webp" onChange={e=>void uploadPhotos(Array.from(e.target.files || []))}/></label>
          {(pendingPhotos.length>0 || p.images.length>0) && <div className="upload-photo-preview" aria-label="Product image preview"><img src={pendingPhotos[0]?.url || adminMediaUrl(p.images[0])} alt={pendingPhotos.length?'Selected product image preview':'Product cover preview'}/><div><strong>{pendingPhotos.length?'Uploading your photos...':'Cover photo preview'}</strong><small>{pendingPhotos[0]?.name || `${p.images.length} uploaded photo${p.images.length===1?'':'s'}`}</small><span>{pendingPhotos.length?'Your selection is visible while it uploads.':'This is the first image customers will see.'}</span></div></div>}
          {pendingPhotos.length>1 && <div className="upload-image-list">{pendingPhotos.map(photo=><div className="upload-image-tile" key={photo.url}><img src={photo.url} alt={`Uploading ${photo.name}`}/></div>)}</div>}
          <AdminImageGallery images={p.images} allowCrop={false} disabled={busy} onBusyChange={onBusyChange} onChange={images=>patch({images})}/>
          <p className="image-studio-hint">To crop photos, save this product and open Image Studio from the sidebar.</p>
          <div className="upload-pdf-row"><FileText size={25}/><div><strong>Product datasheet</strong><small>{p.pdf?'PDF uploaded and ready':'Optional PDF · up to 10 MB'}</small></div><label className="upload-secondary-button">{p.pdf?'Replace PDF':'Add PDF'}<input aria-label="Product PDF" type="file" accept="application/pdf" onChange={e=>void onUpload(Array.from(e.target.files || []),'pdf')}/></label>{p.pdf && <button type="button" className="upload-icon-button" aria-label="Remove PDF" onClick={()=>patch({pdf:''})}><X size={17}/></button>}</div>
        </section>
        <section className="upload-section" id="upload-variations"><div className="upload-section-heading"><span>03</span><div><h3>Set options & prices</h3><p>Add one option for a simple product, or several sizes and finishes.</p></div></div><VariationEditor value={p.variations || []} disabled={busy} onBusyChange={onBusyChange} onChange={variations=>patch({variations})}/></section>
        <section className="upload-section" id="upload-publish"><div className="upload-section-heading"><span>04</span><div><h3>Ready for your collection?</h3><p>Choose where this product appears, then save your changes.</p></div></div><div className="upload-review"><div><span className="eyebrow">Product preview</span><h4>{p.name || "Untitled product"}</h4><p>{generatedSku || "Reference required"} / {categories.find(c=>c.id===(p.subcategory || p.category))?.name || "Category required"}</p><p>{p.description || "Recommended: add a factual product overview."}</p></div><dl><div><dt>Media</dt><dd>{p.images.length} photos ? {p.pdf ? "PDF attached" : "No datasheet"}</dd></div><div><dt>Variations</dt><dd>{p.variations?.length || 0} options ? {p.variations?.filter(v=>v.mrp!==null).length || 0} with MRP</dd></div><div><dt>Visibility</dt><dd>{p.webVisible ? "Published after save" : "Hidden draft"}</dd></div></dl></div><p className="upload-review-note">Required: name, reference, category and valid variations. Recommended: photography, overview and verified specifications. Prices and PDF are optional.</p><div className="upload-readiness"><strong>{completed} of {checks.length} essentials complete</strong><div className="upload-progress-track"><span style={{width:`${completed/checks.length*100}%`}}/></div><div className="upload-checklist">{checks.map(c=><span key={c.label} className={c.done?'complete':''}><Check size={13}/>{c.label}</span>)}</div></div>
          <label className="upload-toggle-row"><div><strong>Publish on the website</strong><small>{p.webVisible?'Customers can browse this product after you save.':'Keep it hidden from customers until you are ready.'}</small></div><input type="checkbox" checked={p.webVisible} onChange={e=>patch({webVisible:e.target.checked})}/></label>
          <label className="upload-toggle-row"><div><strong>Feature this product</strong><small>Mark it as a featured product in your catalogue.</small></div><input type="checkbox" checked={p.featured} onChange={e=>patch({featured:e.target.checked})}/></label>
        </section>
      </fieldset>
      {error && <p role="alert" className="form-error upload-error">{error}</p>}
      <footer className="upload-editor-footer"><div><strong>{busy?'Saving your changes…':p.webVisible?'Ready to go live':'Save for later'}</strong><small>{busy?'Please keep this window open.':'Prices are visible only to authorized customers.'}</small></div><div className="upload-footer-actions">{onSaveLocal && <button type="button" className="upload-secondary-button" disabled={busy} onClick={onSaveLocal}><Save size={15}/>Save local draft</button>}<button type="submit" className="upload-primary-button" disabled={busy || !ready}>{busy?<LoaderCircle size={17} className="upload-spinner"/>:<Check size={17}/>} {busy?'Please wait…':p.webVisible?'Publish to website':'Save hidden product'}{!busy && <ChevronRight size={15}/>}</button></div></footer>
    </form>
  </section>;
}
