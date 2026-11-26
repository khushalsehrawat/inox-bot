"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowRight, ArrowLeft, MapPin, X, Images } from "lucide-react";
import type { EventAlbum, EventPhoto } from "@/lib/event-albums";
import { Reveal } from "./motion-system";


export function HomeEvents({ albums }: { albums: EventAlbum[] }) {
  const [active, setActive] = useState<number | null>(null);
  const [view, setView] = useState<number | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const album = active === null ? null : albums[active];
  useEffect(() => {
    if (active !== null) dialog.current?.focus();
  }, [view, active]);
  useEffect(() => {
    if (active === null) return;
    const previous = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialog.current?.showModal();
    return () => { document.body.style.overflow = overflow; previous?.focus(); };
  }, [active]);
  const close = () => { setActive(null); setView(null); };
  const step = (direction: number) => { if (album) setView(i => ((i ?? 0) + direction + album.photos.length) % album.photos.length); };
  return (
    <section id="events" className="wrap home-events event-journal" aria-labelledby="home-events-title">
      <div className="journal-intro">
        <Reveal kind="aside"><span className="eyebrow">Events / The INOX journal</span><h2 id="home-events-title">Experience.<br/>Connect.<br/>Be <em>inspired.</em></h2></Reveal>
        <div className="journal-intro-side"><span className="journal-index">01 — 06 / Event stories</span><p>Real spaces. Fresh perspectives. Lasting connections. Step into our world of design, through moments from Pune and Indore.</p><span className="journal-hint"><Images size={16}/> Select a story to explore the gallery</span></div>
      </div>
      <div className="journal-grid">
        {albums.map((item,index) => <button className={`journal-card ${index < 2 ? "journal-featured" : ""}`} key={item.id} onClick={() => { setActive(index); setView(null); }} aria-haspopup="dialog">
          <div className="journal-card-image"><img src={item.cover.src} alt={item.cover.alt} loading="lazy"/><span className="journal-location"><MapPin size={12}/>{item.location}</span><span className="journal-photo-count"><Images size={13}/>{item.photos.length} photos</span><span className="journal-open"><ArrowRight size={22}/></span></div>
          <div className="journal-card-copy"><span className="journal-category">{item.label}<span>{String(index+1).padStart(2,"0")}</span></span><h3>{item.title}</h3><p>{item.description}</p><span className="journal-card-link">Explore story <ArrowRight size={15}/></span></div>
        </button>)}
      </div>
      <div className="journal-footer"><span>Good design brings people together.</span><a href="/contact?event=upcoming">Connect with INOX <ArrowRight size={16}/></a></div>
      {album && <dialog ref={dialog} tabIndex={-1} className={`event-gallery-dialog ${view !== null ? "is-viewing" : ""}`} aria-labelledby="event-gallery-title" onCancel={e => { e.preventDefault(); if(view !== null) setView(null); else close(); }} onClick={e => {if(e.target === e.currentTarget) close();}} onKeyDown={e => {if(view !== null && e.key === "ArrowRight") { e.preventDefault(); step(1); } if(view !== null && e.key === "ArrowLeft") { e.preventDefault(); step(-1); }}}>
        <div className="event-gallery-panel">
          <div className="event-gallery-toolbar"><span>INOX / {album.location}</span><button onClick={close} aria-label="Close event gallery"><X size={22}/></button></div>
          {view === null ? <><header className="event-gallery-intro"><span className="eyebrow">{album.label} · {album.photos.length} photographs</span><h2 id="event-gallery-title">{album.title}</h2><p>{album.description}</p></header><div className="event-gallery-grid">{album.photos.map((photo: EventPhoto,index) => <button key={photo.src} onClick={() => setView(index)} aria-label={`View ${photo.city} photograph ${index+1}`}><img src={photo.src} alt={photo.alt} loading="lazy"/><span>{photo.city} / {String(index+1).padStart(2,"0")}</span></button>)}</div></> : <div className="event-lightbox"><h2 id="event-gallery-title" className="sr-only">{album.title} — photograph {view+1}</h2><button className="event-back" onClick={() => setView(null)}><ArrowLeft size={16}/> Back to story</button><div className="event-lightbox-stage"><button onClick={() => step(-1)} aria-label="Previous photograph"><ArrowLeft/></button><img src={album.photos[view].src} alt={album.photos[view].alt}/><button onClick={() => step(1)} aria-label="Next photograph"><ArrowRight/></button></div><p aria-live="polite">{album.photos[view].city} <span>{view+1} / {album.photos.length}</span></p></div>}
        </div>
      </dialog>}
    </section>
  );
}
