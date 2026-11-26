"use client";
import { useEffect, useState } from 'react';
import type { Product } from '@/lib/data';
import { selectVariation } from '@/lib/variations.mjs';
import { ProductGallery, SpecificationPanel } from './product-presentation';
import { ProductPrice } from './customer-account';
import { AddToEnquiry } from './catalogue-browser';
import Link from 'next/link';
import { ArrowUpRight, Check, FileText, Layers } from 'lucide-react';
import { productContent } from '@/lib/product-content.mjs';
function orderedSpecifications(specifications:Record<string,string>) {
  const priority=['dimensions','size','colour','color','material','finish'];
  return Object.entries(specifications).filter(([name,value])=>name.trim() || value?.trim()).sort(([a],[b])=>{
    const rank=(key:string)=>{const index=priority.indexOf(key.toLowerCase());return index<0?priority.length:index;};
    return rank(a)-rank(b);
  });
}
function ProductDescription({text}:{text:string}) {
  const lines=text.split(/\r?\n/).map(line=>line.trim()).filter(Boolean);
  return <section className="detail-description-card" id="product-overview"><h2>Product overview</h2><div className="detail-description-copy">{lines.map((line,i)=><p key={i}>{line}</p>)}</div></section>;
}
export function ProductVariations({product,categoryName}:{product:Product;categoryName?:string}) {
  const content=productContent(product);
  const features=content.keyFeatures.split(/\r\n|\n|\r/).map(line=>line.trim().replace(/^[-*\u2022]\s+/, '')).filter(Boolean);
  const rows=(product.variations || []).filter(v=>v.active).sort((a,b)=>a.sortOrder-b.sortOrder);
  const [id,setId]=useState(selectVariation(rows)?.id);
  useEffect(() => { const requested=new URLSearchParams(window.location.search).get('variation'); if(rows.some(v => v.id === requested && v.active)) setId(requested!); },[rows]);
  const selected=rows.find(v => v.id === id) || selectVariation(rows);
  const images=selected?.images.length ? selected.images : product.images;
  const specifications={...product.specifications,...Object.fromEntries(Object.entries({Size:selected?.size,Dimensions:selected?.dimensions,Material:selected?.material,Finish:selected?.finish,Colour:selected?.colour}).filter(([,v]) => v)),...Object.fromEntries(Object.entries(selected?.specifications || {}).filter(([,v]) => v))} as Record<string,string>;
  const display={...product,sku:selected?.sku || product.sku,images,image:images?.[0] || product.image,specifications};
  function chooseVariation(variationId:string) {
    setId(variationId);
    const url=new URL(window.location.href);
    url.searchParams.set('variation',variationId);
    window.history.replaceState(null,'',url);
  }
  return <><div className="product-detail product-detail-layout"><div className="detail-gallery-column"><ProductGallery key={selected?.id} product={display}/></div>
    <section className="detail-summary" aria-label="Product details">
      <div className="detail-summary-top"><span className="eyebrow">{categoryName || 'The INOX collection'}</span><span className={`detail-availability ${selected?.available?'is-available':''}`}>{selected?.available && <Check size={12}/>}{selected?.available ? 'Available' : 'Currently unavailable'}</span></div>
      <h1>{product.name}</h1>
      <p className="sku detail-selected-sku" aria-live="polite">SKU: <span>{display.sku || 'Available on enquiry'}</span></p>
      {features.length>0 && <section className="detail-key-features" aria-labelledby="product-key-features-heading"><h2 id="product-key-features-heading">Key features</h2><ul>{features.map((feature,i)=><li key={i}>{feature}</li>)}</ul></section>}
      {rows.length > 0 && <div className="detail-variation-picker"><div className="detail-field-heading"><span id="variation-heading">Choose variation</span><span>{rows.length} {rows.length===1?'option':'options'}</span></div><div className="detail-variation-options" role="group" aria-label="Variation details">{rows.map((v,index)=>{
        const entries=orderedSpecifications({...Object.fromEntries(Object.entries({Dimensions:v.dimensions,Size:v.size,Colour:v.colour,Material:v.material,Finish:v.finish}).filter(([,value])=>value)),...Object.fromEntries(Object.entries(v.specifications || {}).filter(([,value])=>value))} as Record<string,string>);
        const preview=entries.slice(0,3);
        return <button type="button" key={v.id} className="detail-variation-option" aria-label={`Select variation ${v.sku}`} aria-pressed={selected?.id===v.id} onClick={()=>chooseVariation(v.id)}><span className="detail-option-title">{preview[0]?.[1] || `Option ${index+1}`}{selected?.id===v.id && <Check size={14} aria-hidden="true"/>}</span><span className="detail-option-meta">{preview.slice(1).map(([key,value])=><span className="detail-option-secondary" key={key}><span>{key}</span>{value}</span>)}</span>{entries.length>3 && <span className="detail-option-extra">+{entries.length-3} more details</span>}{!v.available && <span className="detail-option-stock">Currently unavailable</span>}</button>;
      })}</div><small>Choose an option to see its photos, pricing and full specifications.</small></div>}
      <div className="detail-selected-specifications"><SpecificationPanel specifications={Object.fromEntries(orderedSpecifications(specifications))}/></div>
      <div className="detail-price-block"><span className="detail-overline">Product pricing</span><ProductPrice id={product.id} variationId={selected?.id}/></div>
      <div className="detail-main-actions">{selected?.active && selected.available ? <AddToEnquiry key={selected.id} product={display} variationId={selected.id}/> : <p className="detail-unavailable-note">Ask our team about availability or explore another variation.</p>}<Link className="detail-advice-link" href={`/contact?product=${encodeURIComponent(product.id)}${selected?`&variation=${selected.id}`:''}`}>Discuss your project <ArrowUpRight size={15}/></Link></div>
      <div className="detail-utilities"><a href="#product-specification-section" onClick={()=>{const details=document.querySelector<HTMLDetailsElement>('#product-specification-section details');if(details)details.open=true;}}><Layers size={15}/>View specifications</a>{product.pdf && <a href={product.pdf}><FileText size={15}/>Download product datasheet</a>}</div>
    </section>
  </div>{content.description && <div className="detail-information-grid detail-overview-only"><ProductDescription text={content.description}/></div>}</>;
}
