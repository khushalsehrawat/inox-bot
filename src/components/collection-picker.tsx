"use client";

import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown, Search, SlidersHorizontal, X } from "lucide-react";
import { categoryPath, isWithinCategory } from "@/lib/category-tree.mjs";
import { flattenCategories, type WebCategory } from "@/lib/web-taxonomy-model";

export function CollectionPicker({ categories, value, onChange }: {
  categories: WebCategory[]; value: string; onChange: (id: string) => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false), [search, setSearch] = useState("");
  const collections = flattenCategories(categories);
  const selected = categories.find(category => category.id === value);
  const query = search.trim().toLowerCase();
  const matches = collections.filter(category => !query || categoryPath(categories, category.id).some(parent => parent.name.toLowerCase().includes(query)));
  useEffect(() => {
    if (!open) return;
    const previous = document.documentElement.style.overflow;
    document.documentElement.style.overflow = "hidden";
    return () => { document.documentElement.style.overflow = previous; };
  }, [open]);
  useEffect(() => {
    const media = matchMedia("(min-width: 761px)");
    const closeOnDesktop = () => { if (media.matches) dialog.current?.close(); };
    media.addEventListener("change", closeOnDesktop);
    return () => media.removeEventListener("change", closeOnDesktop);
  }, []);
  function choose(id: string) {
    onChange(id);
    dialog.current?.close();
  }
  function option(id: string, name: string, depth = 0) {
    const active = value === id;
    return <button type="button" key={id} className={`collection-picker-option${active ? " is-selected" : ""}${depth ? " is-child" : ""}`} aria-pressed={active} onClick={() => choose(id)}>
      <span className="collection-picker-option-name"><span>{name}</span>{depth > 1 && <small>{categoryPath(categories, id).slice(1, -1).map(parent => parent.name).join(" / ")}</small>}</span>
      <span className="collection-picker-check" aria-hidden="true">{active && <Check size={13} strokeWidth={2} />}</span>
    </button>;
  }
  return <div className="mobile-collection-picker">
    <span className="filter-heading"><SlidersHorizontal size={17} aria-hidden="true" />Browse collections</span>
    <button ref={trigger} type="button" className="collection-picker-trigger" aria-haspopup="dialog" aria-expanded={open} aria-controls="collection-picker-dialog" onClick={() => { setSearch(""); dialog.current?.showModal(); setOpen(true); }}>
      <span><strong>{selected?.name || "All products"}</strong><small>{selected?.parentId ? categoryPath(categories, selected.id).slice(0, -1).map(parent => parent.name).join(" / ") : "Explore the INOX collection"}</small></span><ChevronDown size={18} aria-hidden="true" />
    </button>
    <dialog ref={dialog} id="collection-picker-dialog" className="collection-picker-dialog" aria-labelledby="collection-picker-title" onClick={event => { if (event.target === dialog.current) dialog.current.close(); }} onClose={() => { setOpen(false); trigger.current?.focus({ preventScroll: true }); }}>
      <div className="collection-picker-surface">
        <header className="collection-picker-header"><div><span className="eyebrow">The INOX collections</span><h2 id="collection-picker-title">Find your collection.</h2></div><button type="button" className="collection-picker-close" aria-label="Close collection picker" onClick={() => dialog.current?.close()}><X size={20} /></button></header>
        <label className="collection-picker-search"><Search size={17} aria-hidden="true" /><input type="search" aria-label="Search collections" placeholder="Search collections" value={search} onChange={event => setSearch(event.target.value)} /></label>
        <div className="collection-picker-options" role="group" aria-label="Collections">
          {!query && option("all", "All products")}
          {categories.filter(category => !category.parentId).map(root => {
            const children = matches.filter(category => category.id === root.id || isWithinCategory(categories, category.id, root.id));
            if (!children.length) return null;
            return <section className="collection-picker-group" key={root.id} aria-label={root.name}>{query && !children.some(child => child.id === root.id) && <p className="collection-picker-group-label">{root.name}</p>}{children.map(category => option(category.id, category.name, categoryPath(categories, category.id).length - 1))}</section>;
          })}
          {query && !matches.length && <p className="collection-picker-empty">No collections found. Try another name.</p>}
        </div>
        <footer className="collection-picker-footer">Considered details. Extraordinary spaces.</footer>
      </div>
    </dialog>
  </div>;
}
