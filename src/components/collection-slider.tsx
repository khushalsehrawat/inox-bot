"use client";

import { useEffect, useRef, useState, type CSSProperties, type MouseEvent } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, ArrowRight, ArrowUpRight, Pause, Play } from "lucide-react";
import { collectionTreatment, mediaPath, type LivingCollection } from "./collection-experience";
import { useCollectionMotion } from "./use-collection-motion";
import "./living-collections.css";

function CollectionRow({ collections, paused, automatic, onManual, row }: {
  collections: LivingCollection[]; paused: boolean; automatic: boolean; row: number;
  onManual: () => void;
}) {
  const viewport = useRef<HTMLDivElement>(null);
  const track = useRef<HTMLDivElement>(null);
  const group = useRef<HTMLDivElement>(null);
  const [copies, setCopies] = useState(1);
  const gesture = useRef({ x: 0, y: 0, moved: false });
  useCollectionMotion({ viewport, track, group, automatic, paused, reverse: row === 1, speed: row ? 17 : 23 });

  useEffect(() => {
    const el = viewport.current;
    if (!el) return;
    const measure = () => {
      const card = el.querySelector<HTMLElement>(".collection-tile");
      if (!card) return;
      const gap = parseFloat(getComputedStyle(el).getPropertyValue("--living-gap"));
      setCopies(Math.max(1, Math.ceil(el.clientWidth / ((card.offsetWidth + gap) * collections.length))));
    };
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    measure();
    return () => observer.disconnect();
  }, [collections.length]);

  function navigate(event: MouseEvent<HTMLAnchorElement>) {
    if (event.detail > 0 && gesture.current.moved) event.preventDefault();
  }

  return <div ref={viewport} className="living-row" role="region" aria-label={"Collection row " + (row + 1)} tabIndex={0}
    onFocusCapture={event => { if ((event.target as HTMLElement).matches(":focus-visible")) onManual(); }}
    onKeyDown={event => {
      if (event.target !== event.currentTarget || !["ArrowLeft", "ArrowRight"].includes(event.key)) return;
      event.preventDefault(); onManual();
      event.currentTarget.scrollBy({ left: (event.key === "ArrowRight" ? 1 : -1) * event.currentTarget.clientWidth * .8, behavior: "instant" });
    }}
    onPointerDown={event => { gesture.current = { x: event.clientX, y: event.clientY, moved: false }; }}
    onPointerMove={event => {
      if (event.buttons || event.pointerType === "touch") {
        if (Math.hypot(event.clientX - gesture.current.x, event.clientY - gesture.current.y) > 9) gesture.current.moved = true;
      }
    }}>
    <div ref={track} className="living-track">
      {[0, 1, 2].map(duplicate => <div key={duplicate} ref={duplicate === 0 ? group : undefined} className="living-group" aria-hidden={duplicate > 0 || undefined}>
        {Array.from({ length: copies }, (_, copy) => collections.map(collection => {
          const hidden = duplicate > 0 || copy > 0;
          return <article key={copy + "-" + collection.id} className="collection-tile" data-treatment={collectionTreatment(collection)} aria-hidden={hidden || undefined}
            style={{ "--reveal-delay": Math.min(collection.number * 70, 350) + "ms" } as CSSProperties}>
            <Link href={"/products?category=" + encodeURIComponent(collection.id)} prefetch={false} className="collection-tile-link" tabIndex={hidden ? -1 : undefined}
              onClick={navigate}>
              <div className="collection-visual">
                <Image src={mediaPath(collection.image)} alt={hidden ? "" : collection.framing?.alt || collection.name + " collection"} fill
                  sizes="(max-width: 600px) 78vw, (max-width: 900px) 42vw, 280px" unoptimized={collection.image.startsWith("/api/")}
                  style={{ objectPosition: (collection.framing?.positionX ?? 50) + "% " + (collection.framing?.positionY ?? 50) + "%", scale: collection.framing?.zoom ?? 1 }} />
                <span className="living-image-wash" aria-hidden="true" />
                <span className="living-card-reveal" aria-hidden="true"><span>Discover the collection</span><ArrowUpRight size={18} /></span>
              </div>
              <div className="collection-caption">
                <span className="collection-index" aria-hidden="true">{String(collection.number).padStart(2, "0")}</span>
                <h3>{collection.name}</h3><span className="collection-open" aria-hidden="true"><ArrowUpRight size={18} /></span>
              </div>
            </Link>
          </article>;
        }))}
      </div>)}
    </div>
  </div>;
}

export function CollectionSlider({ categories }: { categories: LivingCollection[] }) {
  const root = useRef<HTMLDivElement>(null);
  const cursor = useRef<HTMLSpanElement>(null);
  const [paused, setPaused] = useState(false);
  const [manual, setManual] = useState(false);
  const [desktop, setDesktop] = useState(false);
  const [hovering, setHovering] = useState(false);
  const automatic = desktop && !manual;

  useEffect(() => {
    const media = matchMedia("(min-width: 901px) and (hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference)");
    const update = () => setDesktop(media.matches);
    update(); media.addEventListener("change", update);
    const observer = new IntersectionObserver(entries => {
      if (!entries.some(entry => entry.isIntersecting)) return;
      root.current?.classList.add("has-entered"); observer.disconnect();
    }, { threshold: .08 });
    if (root.current) observer.observe(root.current);
    return () => { media.removeEventListener("change", update); observer.disconnect(); };
  }, []);

  function slide(direction: number) {
    setManual(true);
    requestAnimationFrame(() => root.current?.querySelectorAll<HTMLElement>(".living-row").forEach(el => {
      el.scrollBy({ left: direction * el.clientWidth * .78, behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth" });
    }));
  }

  if (!categories.length) return null;
  const rows = [categories.filter((_, i) => i % 2 === 0), categories.filter((_, i) => i % 2 === 1)].filter(row => row.length);
  return <div ref={root} className={"collection-slider living-collections" + (automatic ? " is-automatic" : " is-manual") + (hovering ? " is-examining" : "")}
    onPointerOver={event => { if (event.pointerType === "mouse") setHovering(!!(event.target as HTMLElement).closest(".collection-tile")); }}
    onPointerLeave={() => setHovering(false)}
    onPointerMove={event => {
      if (!desktop || !cursor.current || !root.current) return;
      const bounds = root.current.getBoundingClientRect();
      cursor.current.style.transform = "translate3d(" + (event.clientX - bounds.left + 18) + "px," + (event.clientY - bounds.top - 68) + "px,0)";
    }}>
    <div id="collection-slides" className="living-rows">
      {rows.map((collections, row) => <CollectionRow key={row} row={row} collections={collections} automatic={automatic}
        paused={paused || hovering} onManual={() => setManual(true)} />)}
    </div>
    <span ref={cursor} className="living-cursor" aria-hidden="true">Discover</span>
    <div className="collection-slider-controls">
      <span><i aria-hidden="true" />{automatic && !paused ? "Engineering in motion. Pause to discover." : "Take a closer look. Swipe or use the arrows."}</span>
      <div>
        {desktop && <button type="button" aria-label={paused || manual ? "Resume collection slideshow" : "Pause collection slideshow"} aria-pressed={paused || manual} aria-controls="collection-slides" onClick={() => {
          if (paused || manual) {
            root.current?.querySelectorAll<HTMLElement>(".living-row").forEach(el => { el.scrollLeft = 0; });
            setManual(false); setPaused(false);
          } else setPaused(true);
        }}>{paused || manual ? <Play size={16} /> : <Pause size={16} />}</button>}
        <button type="button" aria-label="Previous collections" aria-controls="collection-slides" onClick={() => slide(-1)}><ArrowLeft size={17} /></button>
        <button type="button" aria-label="Next collections" aria-controls="collection-slides" onClick={() => slide(1)}><ArrowRight size={17} /></button>
      </div>
    </div>
  </div>;
}
