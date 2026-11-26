"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight, X } from "lucide-react";
import { mediaPath, type CollectionFrame, type LivingCollection } from "./collection-experience";

export function CollectionExpansion({ collection, opener, onClose }: {
  collection: LivingCollection; opener: HTMLElement | null; onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const finish = useRef(onClose);
  const mounted = useRef(false);
  const session = useRef<{ marker: string; originalState: unknown; scrollY: number } | null>(null);
  const [step, setStep] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const [imageReady, setImageReady] = useState(false);
  const preview = opener?.querySelector("img")?.currentSrc;
  const media = collection.experience;
  const frames: CollectionFrame[] = [
    { src: collection.image, label: "Collection view" },
    ...(media?.alternate ? [media.alternate] : []), ...(media?.sequence || []),
    ...(media?.model ? [{ src: media.model.poster, label: media.model.label }] : []),
  ];
  const frame = frames[step];
  useEffect(() => { finish.current = onClose; }, [onClose]);

  useEffect(() => {
    const el = dialog.current;
    if (!el) return;
    mounted.current = true;
    const scrollY = session.current?.scrollY ?? window.scrollY;
    const previousStyle = { position: document.body.style.position, top: document.body.style.top, width: document.body.style.width, overflow: document.body.style.overflow };
    if (!session.current) {
      const originalState = history.state;
      const marker = "inox-collection-" + Date.now();
      session.current = { originalState, marker, scrollY };
      history.pushState({ ...originalState, collectionPreview: marker }, "", location.href);
    }
    const { originalState, marker } = session.current;
    // Save the real page position in history before fixed-body scroll locking.
    Object.assign(document.body.style, { position: "fixed", top: -scrollY + "px", width: "100%", overflow: "hidden" });
    const close = () => {
      // Strict Mode may deliver a queued close event after the dialog has reopened.
      if (el.open) return;
      if (history.state?.collectionPreview === marker) history.back();
      finish.current();
    };
    const back = () => { if (history.state?.collectionPreview !== marker) el.close(); };
    el.addEventListener("close", close);
    window.addEventListener("popstate", back);
    el.showModal();
    return () => {
      el.removeEventListener("close", close); window.removeEventListener("popstate", back);
      mounted.current = false;
      queueMicrotask(() => {
        if (!mounted.current && history.state?.collectionPreview === marker) history.replaceState(originalState, "", location.href);
      });
      el.close(); Object.assign(document.body.style, previousStyle);
      opener?.focus({ preventScroll: true }); window.scrollTo({ top: scrollY, behavior: "instant" });
    };
  }, [opener]);

  return <dialog ref={dialog} className="living-dialog" aria-labelledby="living-dialog-title"
    onKeyDown={event => {
      if (event.key !== "Tab") return;
      const items = [...event.currentTarget.querySelectorAll<HTMLElement>('button:not(:disabled), a[href], video[controls]')].filter(item => item.getClientRects().length);
      const first = items[0], last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    }}
    onClick={event => { if (event.target === event.currentTarget) dialog.current?.close(); }}>
    <div className="living-dialog-surface">
      <button type="button" className="living-dialog-close" aria-label="Close collection preview" onClick={() => dialog.current?.close()} autoFocus><X size={20} /></button>
      <div className="living-dialog-image" style={preview ? { backgroundImage: "url(" + JSON.stringify(preview) + ")", backgroundSize: "cover", backgroundPosition: (collection.framing?.positionX ?? 50) + "% " + (collection.framing?.positionY ?? 50) + "%" } : undefined}>
        <Image src={mediaPath(collection.image)} alt={collection.framing?.alt || collection.name} fill sizes="(max-width: 700px) 94vw, 60vw"
          unoptimized={collection.image.startsWith("/api/")} onLoad={() => setImageReady(true)}
          style={{ opacity: imageReady ? 1 : 0, objectPosition: (collection.framing?.positionX ?? 50) + "% " + (collection.framing?.positionY ?? 50) + "%", scale: collection.framing?.zoom ?? 1 }} />
        {step > 0 && !failed && <Image key={frame.src} src={mediaPath(frame.src)} alt={frame.label} fill sizes="(max-width: 700px) 94vw, 60vw"
          className={loaded ? "living-detail-image is-loaded" : "living-detail-image"} unoptimized={frame.src.startsWith("/api/")}
          onLoad={() => setLoaded(true)} onError={() => { setFailed(true); setLoaded(false); }} />}
        {step > 0 && loaded && !failed && frame.annotations?.map((annotation, index) => <span key={index} className="living-annotation"
          style={{ left: Math.min(80, Math.max(8, annotation.x)) + "%", top: Math.min(90, Math.max(8, annotation.y)) + "%" }}>{annotation.label}</span>)}
        <span className="living-dialog-image-label">INOX / {String(collection.number).padStart(2, "0")}</span>
      </div>
      <div className="living-dialog-copy">
        <span className="eyebrow">Living collections / {String(collection.number).padStart(2, "0")}</span>
        <h2 id="living-dialog-title">{collection.name}</h2>
        {collection.description && <p>{collection.description}</p>}
        {step > 0 && loaded && !failed && frame.description && <p className="living-detail-description">{frame.description}</p>}
        {frames.length > 1 && <div className="living-detail-steps" role="group" aria-label="Collection views">
          {frames.map((item, index) => <button key={index} type="button" aria-pressed={step === index} onClick={() => { setLoaded(false); setFailed(false); setStep(index); }}>{String(index + 1).padStart(2, "0")} / {item.label}</button>)}
        </div>}
        {media?.video && <video className="living-demo-video" controls playsInline preload="none" poster={mediaPath(media.video.poster || collection.image)} aria-label={media.video.label}>
          <source src={mediaPath(media.video.src)} /><a href={mediaPath(media.video.src)}>Watch {media.video.label}</a>
        </video>}
        {media?.model && <a className="text-link" href={mediaPath(media.model.src)} download>Download {media.model.label}<ArrowUpRight size={16} /></a>}
        <Link className="living-explore-link" href={"/products?category=" + encodeURIComponent(collection.id)}>Explore Collection <ArrowUpRight size={20} /></Link>
        <span className="living-dialog-note">The art of considered living.</span>
      </div>
    </div>
  </dialog>;
}
