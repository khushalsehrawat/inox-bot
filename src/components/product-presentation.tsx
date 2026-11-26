"use client";
import { useRef, useState } from "react";
import Image from "next/image";
import { AnimatePresence, motion } from "motion/react";
import { ChevronDown, ChevronLeft, ChevronRight, Expand, Package, X } from "lucide-react";
import type { Product } from "@/lib/data";
import { editorialEase, useMotionPreferences } from "./motion-system";

export function ProductGallery({ product }: { product: Product }) {
  const [selected,setSelected]=useState(0);
  const zoom=useRef<HTMLDialogElement>(null);
  const {reduced}=useMotionPreferences();
  const gallery=product.images?.length?product.images:product.image?[product.image]:[];
  if(!gallery.length)return <div className="detail-image-empty"><Package size={42} strokeWidth={1}/><span>Product imagery</span><p>Photos for this product are coming soon.</p></div>;
  const active=gallery[selected] || gallery[0];
  const move=(offset:number)=>setSelected(current=>(current+offset+gallery.length)%gallery.length);
  return <div className="product-gallery">
    <div className="gallery-stage">
      <AnimatePresence initial={false}><motion.div key={selected} className="gallery-view" initial={reduced?false:{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} transition={{duration:reduced?0:0.2,ease:editorialEase}}><Image src={active} unoptimized alt={`${product.name}, image ${selected+1}`} fill sizes="(max-width: 760px) 100vw, 52vw" priority/></motion.div></AnimatePresence>
      <span className="detail-image-count">{String(selected+1).padStart(2,'0')} / {String(gallery.length).padStart(2,'0')}</span>
      <button type="button" className="detail-gallery-expand" aria-label="Enlarge product image" onClick={()=>zoom.current?.showModal()}><Expand size={17}/></button>
      {gallery.length>1 && <div className="detail-gallery-arrows"><button type="button" aria-label="Previous product image" onClick={()=>move(-1)}><ChevronLeft size={17}/></button><button type="button" aria-label="Next product image" onClick={()=>move(1)}><ChevronRight size={17}/></button></div>}
    </div>
    {gallery.length>1 && <div className="gallery-thumbnails" aria-label="Product images">{gallery.map((url,i)=><button type="button" key={`${url}-${i}`} aria-label={`Show image ${i+1}`} aria-pressed={selected===i} onClick={()=>setSelected(i)}><span className="thumbnail-image"><Image src={url} unoptimized alt="" fill sizes="64px"/></span></button>)}</div>}
    <dialog ref={zoom} className="detail-zoom-dialog" aria-label={`${product.name} image preview`} onClick={e=>{if(e.target===zoom.current)zoom.current.close();}}><button type="button" className="detail-zoom-close" aria-label="Close image preview" onClick={()=>zoom.current?.close()}><X size={21}/></button><img src={active} alt={`${product.name}, enlarged image ${selected+1}`}/>{gallery.length>1 && <div className="detail-zoom-navigation"><button type="button" aria-label="Previous enlarged image" onClick={()=>move(-1)}><ChevronLeft size={20}/></button><span>{selected+1} / {gallery.length}</span><button type="button" aria-label="Next enlarged image" onClick={()=>move(1)}><ChevronRight size={20}/></button></div>}</dialog>
  </div>;
}
export function SpecificationPanel({
  specifications,
}: {
  specifications: Record<string, string>;
}) {
  return <section className="spec-section" id="product-specification-section"><details className="spec-disclosure"><summary><h2>Specifications</h2><ChevronDown size={20} aria-hidden="true"/></summary>{!Object.keys(specifications).length && <p className="detail-spec-empty">Contact our team for technical details and project requirements.</p>}<dl>{Object.entries(specifications).map(([key,value])=><div key={key}><dt>{key}</dt><dd>{value}</dd></div>)}</dl></details></section>;
}
