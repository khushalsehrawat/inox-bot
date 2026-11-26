"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowRight, Pause, Play } from "lucide-react";
import { Picture } from "@/components/ui";

type Category = { id: string; name: string; short: string; image: string; framing?: { zoom?: number; positionX?: number; positionY?: number } };

export function CollectionStrip({ categories }: { categories: Category[] }) {
  const [paused, setPaused] = useState(false);
  const viewport = useRef<HTMLDivElement>(null);
  const sequence = useRef<HTMLDivElement>(null);
  const [loop, setLoop] = useState({ copies: 1, duration: 40 });
  useEffect(() => {
    if (!viewport.current || !sequence.current) return;
    const measure = () => {
      const width = sequence.current?.getBoundingClientRect().width || 0;
      const visible = viewport.current?.clientWidth || 0;
      if (!width || !visible) return;
      const copies = Math.max(1, Math.ceil(visible / width));
      // Each identical half covers the viewport; 30px/s keeps the pace consistent.
      const duration = width * copies / 30;
      setLoop(previous => previous.copies === copies && previous.duration === duration ? previous : { copies, duration });
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(viewport.current);
    observer.observe(sequence.current);
    return () => observer.disconnect();
  }, [categories]);
  if (!categories.length) return null;

  return (
    <section className="collection-ticker" aria-label="Shop collections">
      <button
        className="collection-ticker-toggle"
        type="button"
        aria-label={paused ? "Resume collection movement" : "Pause collection movement"}
        aria-pressed={paused}
        onClick={() => setPaused(!paused)}
      >
        {paused ? <Play size={14} /> : <Pause size={14} />}
      </button>
      <div ref={viewport} className="collection-ticker-viewport" tabIndex={0} aria-label="Scroll collections" onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) event.currentTarget.scrollLeft = 0; }}>
        <div className={`collection-ticker-track${paused ? " is-paused" : ""}`} style={{ animationDuration: `${loop.duration}s` }}>
          {[false, true].map((duplicate) => (
            <div className="collection-ticker-group" key={String(duplicate)} aria-hidden={duplicate || undefined}>
              {Array.from({ length: loop.copies }, (_, copy) => (
                <div className="collection-ticker-sequence" key={copy} ref={!duplicate && copy === 0 ? sequence : undefined} aria-hidden={duplicate || copy > 0 || undefined}>
                  {categories.map((category) => (
                    <Link key={category.id} href={`/products?category=${encodeURIComponent(category.id)}`} tabIndex={duplicate || copy > 0 ? -1 : undefined}>
                      <Picture framing={category.framing} src={category.image} alt={duplicate || copy > 0 ? "" : category.name} />
                      <span>{category.short}</span>
                      <ArrowRight size={15} aria-hidden="true" />
                    </Link>
                  ))}
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
