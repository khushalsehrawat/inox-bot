"use client";

import { useEffect, useState } from 'react';
import { Images, Save, Search } from 'lucide-react';
import type { ProductDraft } from '@/lib/web-taxonomy-store.mjs';
import { AdminImageGallery } from './admin-image-editor';

export function AdminImageStudio({ products, onSaved }: { products: ProductDraft[]; onSaved: () => Promise<void> }) {
  const [changes, setChanges] = useState<Record<string, ProductDraft>>({});
  const [selected, setSelected] = useState('');
  const [variation, setVariation] = useState('');
  const [search, setSearch] = useState('');
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const product = changes[selected] || products.find(p => p.id === selected);
  const option = product?.variations?.find(v => v.id === variation);
  const pending = Object.values(changes);
  useEffect(() => {
    if (!pending.length) return;
    const keepChanges = (event: BeforeUnloadEvent) => { event.preventDefault(); };
    window.addEventListener('beforeunload', keepChanges);
    return () => window.removeEventListener('beforeunload', keepChanges);
  }, [pending.length]);
  const matching = products.filter(p => `${p.name} ${p.sku}`.toLowerCase().includes(search.toLowerCase()));

  async function save() {
    setBusy(true); setError(''); setMessage('');
    let saved = 0;
    try {
      for (const draft of pending) {
        const response = await fetch('/api/admin/products', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ operation: 'save', product: draft }) });
        const data = await response.json();
        if (!response.ok) throw new Error(`${draft.name}: ${data.message || 'Could not save image changes.'}`);
        saved++;
        setChanges(current => { const next = { ...current }; delete next[draft.id]; return next; });
      }
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not save. Your remaining changes are still here.'); }
    finally {
      if (saved) {
        setMessage(`Saved image changes for ${saved} product${saved === 1 ? '' : 's'}.`);
        try { await onSaved(); } catch { setError('Images were saved. Refresh the admin panel to load the latest products.'); }
      }
      setBusy(false);
    }
  }

  return <section className="admin-image-studio" aria-labelledby="image-studio-title">
    <header className="image-studio-heading"><div><span className="eyebrow">MEDIA WORKSPACE</span><h2 id="image-studio-title"><Images size={24}/>Image Studio</h2><p>Add, crop and replace photos across your catalogue. Save when your changes are ready.</p></div><button type="button" className="upload-primary-button" disabled={!pending.length || busy || uploading} onClick={() => void save()}><Save size={16}/>{busy ? 'Saving…' : `Save changes${pending.length ? ` (${pending.length} products)` : ''}`}</button></header>
    {message && <p role="status" className="image-studio-notice">{message}</p>}
    {error && <p role="alert" className="form-error">{error}</p>}
    <div className="image-studio-layout"><aside className="image-studio-products"><label className="image-studio-search"><Search size={16}/><input aria-label="Search products in Image Studio" placeholder="Search name or SKU" value={search} onChange={e => setSearch(e.target.value)}/></label><div className="image-studio-product-list">{matching.map(p => <button type="button" key={p.id} disabled={busy || uploading} aria-pressed={selected === p.id} onClick={() => { setSelected(p.id); setVariation(''); }}><strong>{p.name}</strong><small>{p.sku}{changes[p.id] ? ' · Unsaved changes' : ''}</small></button>)}{!matching.length && <p>No products found.</p>}</div></aside>
      <div className="image-studio-workbench">{product ? <><div className="image-studio-product-heading"><h3>{product.name}</h3><label>Photo group<select aria-label="Photo group" disabled={busy || uploading} value={variation} onChange={e => setVariation(e.target.value)}><option value="">Product photos</option>{product.variations?.map(v => <option key={v.id} value={v.id}>Variation · {v.sku || v.name}</option>)}</select></label></div><p className="image-studio-hint">The first photo is the cover. Changes stay in this section until you save. Up to 10 photos per group.</p>
      <AdminImageGallery key={`${product.id}-${variation}`} images={option ? option.images : product.images} disabled={busy} onBusyChange={setUploading} onChange={images => {
        setChanges(current => ({ ...current, [product.id]: option ? { ...product, variations: (product.variations || []).map(v => v.id === option.id ? { ...v, images } : v) } : { ...product, images } }));
        setMessage('');
      }}/></> : <div className="image-studio-empty"><Images size={40}/><h3>Select a product to start</h3><p>Manage product and variation photos here, without opening the full product editor.</p></div>}</div>
    </div>
    {pending.length > 0 && <p className="image-studio-hint">{pending.length} product{pending.length === 1 ? '' : 's'} with unsaved changes. Save before leaving Image Studio.</p>}
  </section>;
}
