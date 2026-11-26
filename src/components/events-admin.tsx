"use client";
import { useEffect, useState } from "react";
import type { EventAlbum, EventPhoto } from "@/lib/event-albums";
import { imagePreviewUrl, uploadAdminImage } from "./admin-image-editor";

export function EventsAdmin() {
  const [albums, setAlbums] = useState<EventAlbum[]>([]);
  const [draft, setDraft] = useState<EventAlbum | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  async function load() {
    setLoading(true); setError("");
    try {
      const response = await fetch("/api/admin/events", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message);
      setAlbums(data.albums); setDraft(null); setDirty(false);
    } catch (e) { setError(e instanceof Error ? e.message : "Could not load events."); }
    finally { setLoading(false); }
  }
  useEffect(() => { void load(); }, []);
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => { e.preventDefault(); };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);
  function change(patch: Partial<EventAlbum>) { setDraft(current => current ? { ...current, ...patch } : null); setDirty(true); setNotice(""); }
  function select(album: EventAlbum) {
    if (dirty && !window.confirm("Discard unsaved event changes?")) return;
    setDraft(structuredClone(album)); setDirty(false); setError(""); setNotice("");
  }
  function updatePhoto(index: number, patch: Partial<EventPhoto>) {
    if (!draft) return;
    const photos = draft.photos.map((p,i) => i === index ? { ...p, ...patch } : p);
    change({ photos, cover: draft.cover.src === draft.photos[index].src ? photos[index] : draft.cover });
  }
  async function upload(files: File[], replace?: number) {
    if (!draft || !files.length) return;
    if (replace === undefined && draft.photos.length + files.length > 250) { setError("Keep up to 250 photos in an event."); return; }
    if (files.some(f => !["image/jpeg", "image/png", "image/webp"].includes(f.type) || f.size > 25 * 1024 * 1024)) { setError("Choose JPEG, PNG or WebP photos up to 25 MB each."); return; }
    setBusy(true); setError(""); setNotice("");
    try {
      for (let i=0;i<files.length;i++) {
        setNotice(`Uploading photo ${i+1} of ${files.length}...`);
        const src = await uploadAdminImage(files[i], "/api/admin/events/upload");
        setDraft(current => {
          if (!current) return current;
          const photo: EventPhoto = { src, alt: replace === undefined ? `${current.title} - ${files[i].name.replace(/\.[^.]+$/, "")}`.slice(0,500) : current.photos[replace].alt, city: replace === undefined ? current.location : current.photos[replace].city };
          const photos = replace === undefined ? [...current.photos, photo] : current.photos.map((p,index) => index === replace ? photo : p);
          return { ...current, photos, cover: replace !== undefined && current.cover.src === current.photos[replace].src ? photo : current.cover };
        });
        setDirty(true);
      }
      setNotice("Photos uploaded. Save event to publish your changes.");
    } catch (e) { setError(e instanceof Error ? e.message : "Upload failed. Successfully uploaded photos remain in your draft."); setNotice(""); }
    finally { setBusy(false); }
  }
  async function save() {
    if (!draft) return;
    setBusy(true); setError(""); setNotice("");
    try {
      const response = await fetch("/api/admin/events", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(draft) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message);
      setAlbums(current => current.map(a => a.id === data.album.id ? data.album : a));
      setDraft(data.album); setDirty(false); setNotice("Event saved. Refresh the homepage to see your changes.");
    } catch (e) { setError(e instanceof Error ? e.message : "Could not save event."); }
    finally { setBusy(false); }
  }
  return <section className="events-admin">
    <p>Manage the six event stories on your homepage. Edit a story, choose a cover, and arrange its gallery. Changes go live when you save the event.</p>
    <div className="home-images-toolbar"><a className="button outline" href="/#events" target="_blank" rel="noreferrer">Preview events</a><button className="button outline" disabled={busy || loading} onClick={() => { if (!dirty || window.confirm("Discard unsaved event changes and refresh?")) void load(); }}>Refresh events</button></div>
    {error && <p role="alert" className="form-error">{error}</p>}
    {notice && <p role="status" className="form-feedback">{notice}</p>}
    {loading ? <p role="status">Loading events...</p> : <>
      <div className="events-admin-albums">{albums.map(album => <button key={album.id} className={`table-panel event-admin-album ${draft?.id === album.id ? "selected" : ""}`} disabled={busy} onClick={() => select(album)}><img src={imagePreviewUrl(album.cover.src)} alt={album.cover.alt}/><span><strong>{album.title}</strong><small>{album.photos.length} photos / {album.location}</small></span></button>)}</div>
      {draft && <div className="table-panel padded event-admin-editor">
        <div className="event-admin-heading"><h2>Edit {albums.find(a => a.id === draft.id)?.title}</h2><span>{dirty ? "Unsaved changes" : "Saved"}</span><button className="button dark" disabled={busy || !dirty} onClick={save}>{busy ? "Please wait..." : "Save changes"}</button></div>
        <fieldset disabled={busy}>
          <div className="event-admin-fields"><label>Event title<input maxLength={120} value={draft.title} onChange={e => change({title:e.target.value})}/></label><label>Location<input maxLength={100} value={draft.location} onChange={e => change({location:e.target.value})}/></label><label>Category label<input maxLength={100} value={draft.label} onChange={e => change({label:e.target.value})}/></label></div>
          <label>Event details<textarea aria-label="Event details" rows={4} maxLength={2000} value={draft.description} onChange={e => change({description:e.target.value})}/></label>
          <label className="event-admin-upload">Add gallery photos (JPEG, PNG or WebP, up to 25 MB each)<input type="file" multiple accept="image/jpeg,image/png,image/webp" onChange={e => { const files = Array.from(e.target.files || []); e.target.value = ""; void upload(files); }}/></label>
          <p>Choose a cover below. Use Earlier / Later to change the gallery order. Removing a photo affects this story only.</p>
          <div className="event-admin-photos">{draft.photos.map((photo,index) => <article className="event-admin-photo" key={photo.src}>
            <img loading="lazy" src={imagePreviewUrl(photo.src)} alt={photo.alt}/><span className="event-admin-photo-number">Photo {index+1}{draft.cover.src === photo.src ? " / Cover" : ""}</span>
            <label>Image description<input maxLength={500} value={photo.alt} onChange={e => updatePhoto(index,{alt:e.target.value})}/></label><label>Photo location<input maxLength={100} value={photo.city} onChange={e => updatePhoto(index,{city:e.target.value})}/></label>
            <div className="event-admin-actions"><button className="button outline" disabled={draft.cover.src === photo.src} onClick={() => change({cover:photo})}>Use as cover</button><button className="button outline" disabled={index === 0} onClick={() => { const photos = [...draft.photos]; [photos[index-1],photos[index]] = [photos[index],photos[index-1]]; change({photos}); }}>Earlier</button><button className="button outline" disabled={index === draft.photos.length-1} onClick={() => { const photos = [...draft.photos]; [photos[index+1],photos[index]] = [photos[index],photos[index+1]]; change({photos}); }}>Later</button></div>
            <label>Replace photo<input type="file" accept="image/jpeg,image/png,image/webp" onChange={e => {const files = Array.from(e.target.files || []); e.target.value = ""; void upload(files,index); }}/></label>
            <button className="button outline" disabled={draft.photos.length === 1} onClick={() => { const photos = draft.photos.filter((_,i) => i !== index); change({photos,cover:draft.cover.src === photo.src ? photos[0] : draft.cover}); }}>Remove photo</button>
          </article>)}</div>
        </fieldset>
        <div className="event-admin-save"><span>{draft.photos.length} photos {dirty ? " / Unsaved changes" : ""}</span><button className="button dark" disabled={busy || !dirty} onClick={save}>{busy ? "Please wait..." : "Save event"}</button><button className="button outline" disabled={busy || !dirty} onClick={() => select(albums.find(a => a.id === draft.id)!)}>Discard changes</button></div>
      </div>}
    </>}
  </section>;
}
