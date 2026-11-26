"use client";
import { useEffect, useState } from "react";
import type { HomeImage } from "@/lib/home-images";
import { AdminImageEditor, imagePreviewUrl, uploadAdminImage } from "./admin-image-editor";

export function HomeImagesAdmin() {
  const [images, setImages] = useState<HomeImage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<HomeImage | null>(null);
  const [source, setSource] = useState("");
  const [busy, setBusy] = useState(false);
  async function load() {
    setLoading(true); setError("");
    try {
      const response = await fetch("/api/admin/home-images", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message);
      setImages(data.images.filter((image: HomeImage) => image.section !== "Events"));
    } catch (e) { setError(e instanceof Error ? e.message : "Could not load homepage images."); }
    finally { setLoading(false); }
  }
  useEffect(() => { void load(); }, []);
  useEffect(() => () => { if (source.startsWith("blob:")) URL.revokeObjectURL(source); }, [source]);
  async function save(file?: Blob) {
    if (!editing) return;
    setBusy(true); setError(""); setNotice("");
    try {
      const src = file ? await uploadAdminImage(file) : editing.src;
      const response = await fetch("/api/admin/home-images", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: editing.id, src, alt: editing.alt, zoom: editing.zoom ?? 1, positionX: editing.positionX ?? 50, positionY: editing.positionY ?? 50 }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message);
      setImages(current => current.map(image => image.id === editing.id ? data.image : image));
      setNotice(`${editing.name} updated on the homepage.`);
      setEditing(null); setSource("");
    } catch (e) { setError(e instanceof Error ? e.message : "Could not save the image."); throw e; }
    finally { setBusy(false); }
  }
  return <section className="home-images-admin">
    <p>Event cards and photo galleries are managed in the Events tab.</p>
    <p>Adjust zoom and position to frame your homepage images, or replace and crop them. View the live homepage images by name. Replace or crop an image, then save to update the homepage. Collection images here apply to the homepage only.</p>
    <div className="home-images-toolbar">
      <label>Find an image<input type="search" placeholder="Search by name or section" value={search} onChange={e => setSearch(e.target.value)} /></label>
      <a className="button outline" href="/" target="_blank" rel="noreferrer">View homepage</a>
      <button className="button outline" onClick={load} disabled={loading || busy}>Refresh images</button>
    </div>
    {error && <p role="alert" className="form-error">{error}</p>}
    {notice && <p role="status" className="form-feedback">{notice}</p>}
    {loading ? <p role="status">Loading homepage images...</p> : <div className="home-images-grid">
      {images.filter(image => `${image.name} ${image.section}`.toLowerCase().includes(search.toLowerCase())).map(image => <article className="table-panel home-image-card" key={image.id}>
        {/* Admin previews also support authenticated media URLs. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {image.src ? <div className="home-framing-preview"><img src={imagePreviewUrl(image.src)} alt={image.alt} style={{ scale: image.zoom ?? 1, objectPosition: `${image.positionX ?? 50}% ${image.positionY ?? 50}%` }} /></div> : <div className="home-image-empty">No image selected</div>}
        <div className="padded"><span className="eyebrow">{image.section}</span><h2>{image.name}</h2><p>{image.alt}</p>
          <button className="button dark" disabled={busy} onClick={() => { setEditing({ ...image }); setSource(image.src); setError(""); setNotice(""); }}>Edit / replace image</button>
        </div>
      </article>)}
    </div>}
    {!loading && images.length > 0 && !images.some(image => `${image.name} ${image.section}`.toLowerCase().includes(search.toLowerCase())) && <p>No homepage images match your search.</p>}
    {editing && <div className="table-panel padded home-image-edit">
      <h2>Edit {editing.name}</h2>
      <div className={`home-framing-preview ${editing.id === "hero" ? "home-framing-hero" : ""}`}>
        <img src={imagePreviewUrl(source)} alt={editing.alt} style={{ scale: editing.zoom ?? 1, objectPosition: `${editing.positionX ?? 50}% ${editing.positionY ?? 50}%` }} />
      </div>
      <fieldset disabled={busy} className="home-framing-controls">
        <legend>Zoom and position</legend>
        <p>Zoom out to move the image back. Below 100%, space may appear around the image. The homepage frame may crop differently on mobile.</p>
        <div className="home-zoom-buttons">
          <button type="button" className="button outline" onClick={() => setEditing({ ...editing, zoom: Math.max(.5, Math.round(((editing.zoom ?? 1) - .05) * 100) / 100) })}>Zoom out ?</button>
          <output>{Math.round((editing.zoom ?? 1) * 100)}%</output>
          <button type="button" className="button outline" onClick={() => setEditing({ ...editing, zoom: Math.min(2, Math.round(((editing.zoom ?? 1) + .05) * 100) / 100) })}>Zoom in +</button>
        </div>
        <label>Zoom<input type="range" min="50" max="200" step="1" value={Math.round((editing.zoom ?? 1) * 100)} onChange={e => setEditing({ ...editing, zoom: Number(e.target.value) / 100 })} /></label>
        <label>Horizontal position<input type="range" min="0" max="100" value={editing.positionX ?? 50} onChange={e => setEditing({ ...editing, positionX: Number(e.target.value) })} /></label>
        <label>Vertical position<input type="range" min="0" max="100" value={editing.positionY ?? 50} onChange={e => setEditing({ ...editing, positionY: Number(e.target.value) })} /></label>
        <div className="home-zoom-buttons">
          <button type="button" className="button outline" onClick={() => setEditing({ ...editing, zoom: 1, positionX: 50, positionY: 50 })}>Reset framing</button>
          <button type="button" className="button dark" disabled={source.startsWith("blob:")} onClick={() => { void save().catch(() => {}); }}>{busy ? "Saving..." : "Save zoom and position"}</button>
        </div>
        {source.startsWith("blob:") && <p>Apply the replacement crop below to save the new image with this framing.</p>}
      </fieldset>
      <label>Image description<input maxLength={500} value={editing.alt} disabled={busy} onChange={e => setEditing({ ...editing, alt: e.target.value })} /></label>
      <label>Choose replacement (JPEG, PNG or WebP, up to 8 MB)<input type="file" accept="image/jpeg,image/png,image/webp" disabled={busy} onChange={e => {
        const file = e.target.files?.[0];
        if (!file) return;
        if (file.size > 8 * 1024 * 1024 || !["image/jpeg", "image/png", "image/webp"].includes(file.type)) { setError("Choose a JPEG, PNG or WebP image up to 8 MB."); return; }
        setSource(URL.createObjectURL(file)); setError("");
      }} /></label>
      <AdminImageEditor key={source} src={source} onSave={save} onCancel={() => { if (!busy) { setEditing(null); setSource(""); } }} />
    </div>}
  </section>;
}
