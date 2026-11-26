"use client";

import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { Crop, RotateCw, X } from "lucide-react";

export function imagePreviewUrl(url: string) {
  if (url.startsWith("/api/web/product-media/")) return `/api/admin/product-media?filename=${encodeURIComponent(url.split('/').at(-1) || '')}`;
  if (url.startsWith("/api/web/category-images/")) return url.replace('/api/web/category-images/', '/api/admin/web-categories/media/');
  return url.startsWith('/') || url.startsWith('blob:') ? url : `/media/${url}`;
}

export async function uploadAdminImage(file: Blob, endpoint = "/api/admin/product-media") {
  const response = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': file.type }, body: file });
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || 'Image upload failed. Please try again.');
  return data.url as string;
}

export function AdminImageEditor({ src, onSave, onCancel }: {
  src: string; onSave: (file: Blob) => Promise<void>; onCancel: () => void;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const fullPreview = useRef<HTMLCanvasElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const gesture = useRef<{ pointer: number; x: number; y: number; corner: string; crop: { x: number; y: number; width: number; height: number } } | null>(null);
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [ratio, setRatio] = useState('free');
  const [crop, setCrop] = useState({ x: 0, y: 0, width: 1, height: 1 });
  const [rotation, setRotation] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const sideways = rotation % 180 !== 0;
  const imageWidth = image ? (sideways ? image.naturalHeight : image.naturalWidth) : 1;
  const imageHeight = image ? (sideways ? image.naturalWidth : image.naturalHeight) : 1;

  function chooseShape(value: string) {
    setRatio(value);
    if (value === 'free' || value === 'original') { setCrop({ x: 0, y: 0, width: 1, height: 1 }); return; }
    const normalizedAspect = Number(value) / (imageWidth / imageHeight);
    const width = Math.min(1, normalizedAspect);
    const height = width / normalizedAspect;
    setCrop({ x: (1 - width) / 2, y: (1 - height) / 2, width, height });
  }

  function startDrag(event: ReactPointerEvent<HTMLDivElement>, corner = 'move') {
    if (busy || !image || gesture.current) return;
    event.preventDefault(); event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    gesture.current = { pointer: event.pointerId, x: event.clientX, y: event.clientY, corner, crop };
  }

  function drag(event: ReactPointerEvent<HTMLDivElement>) {
    const current = gesture.current;
    const bounds = stage.current?.getBoundingClientRect();
    if (!current || current.pointer !== event.pointerId || !bounds || busy) return;
    const dx = (event.clientX - current.x) / bounds.width;
    const dy = (event.clientY - current.y) / bounds.height;
    const initial = current.crop;
    if (current.corner === 'move') {
      setCrop({ ...initial, x: Math.max(0, Math.min(1 - initial.width, initial.x + dx)), y: Math.max(0, Math.min(1 - initial.height, initial.y + dy)) });
      return;
    }
    const left = current.corner.includes('w');
    const top = current.corner.includes('n');
    const anchorX = left ? initial.x + initial.width : initial.x;
    const anchorY = top ? initial.y + initial.height : initial.y;
    const maxWidth = left ? anchorX : 1 - anchorX;
    const maxHeight = top ? anchorY : 1 - anchorY;
    let width = Math.max(Math.min(0.08, maxWidth), Math.min(maxWidth, initial.width + (left ? -dx : dx)));
    let height = Math.max(Math.min(0.08, maxHeight), Math.min(maxHeight, initial.height + (top ? -dy : dy)));
    if (ratio !== 'free') {
      const aspect = (ratio === 'original' ? imageWidth / imageHeight : Number(ratio)) / (imageWidth / imageHeight);
      width = Math.min(Math.abs(dx) > Math.abs(dy) ? width : height * aspect, maxWidth, maxHeight * aspect);
      height = width / aspect;
    }
    setCrop({ x: left ? anchorX - width : anchorX, y: top ? anchorY - height : anchorY, width, height });
  }

  function endDrag(event: ReactPointerEvent<HTMLDivElement>) {
    if (gesture.current?.pointer === event.pointerId) gesture.current = null;
  }

  useEffect(() => {
    let active = true;
    setImage(null); setError(''); setCrop({ x: 0, y: 0, width: 1, height: 1 }); setRatio('free'); setRotation(0);
    const picture = new Image();
    picture.onload = () => { if (active) setImage(picture); };
    picture.onerror = () => { if (active) setError('Unable to open this image. Try replacing it.'); };
    picture.src = imagePreviewUrl(src);
    return () => { active = false; };
  }, [src]);

  useEffect(() => {
    if (!image || !canvas.current) return;
    const rotated = document.createElement('canvas');
    const sideways = rotation % 180 !== 0;
    rotated.width = sideways ? image.naturalHeight : image.naturalWidth;
    rotated.height = sideways ? image.naturalWidth : image.naturalHeight;
    const context = rotated.getContext('2d');
    if (!context) return;
    context.translate(rotated.width / 2, rotated.height / 2);
    context.rotate(rotation * Math.PI / 180);
    context.drawImage(image, -image.naturalWidth / 2, -image.naturalHeight / 2);
    if (fullPreview.current) {
      const previewScale = Math.min(1, 1000 / Math.max(rotated.width, rotated.height));
      fullPreview.current.width = Math.max(1, Math.round(rotated.width * previewScale));
      fullPreview.current.height = Math.max(1, Math.round(rotated.height * previewScale));
      fullPreview.current.getContext('2d')?.drawImage(rotated, 0, 0, fullPreview.current.width, fullPreview.current.height);
    }
    const cropWidth = rotated.width * crop.width;
    const cropHeight = rotated.height * crop.height;
    const scale = Math.min(1, 1800 / Math.max(cropWidth, cropHeight));
    canvas.current.width = Math.max(1, Math.round(cropWidth * scale));
    canvas.current.height = Math.max(1, Math.round(cropHeight * scale));
    canvas.current.getContext('2d')?.drawImage(rotated,
      rotated.width * crop.x,
      rotated.height * crop.y,
      cropWidth, cropHeight, 0, 0, canvas.current.width, canvas.current.height);
  }, [image, crop, rotation]);

  async function apply() {
    setBusy(true); setError('');
    try {
      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.current?.toBlob(result => result ? resolve(result) : reject(new Error('Could not prepare the cropped image.')), 'image/webp', 0.92);
      });
      await onSave(blob);
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not save the image.'); }
    finally { setBusy(false); }
  }

  return <section className="admin-image-cropper" aria-label="Crop image editor">
    <header><div><strong>Crop photo</strong><p>Drag the corners to crop. Drag inside the frame to move it.</p></div><button type="button" aria-label="Close image editor" disabled={busy} onClick={onCancel}><X size={18}/></button></header>
    <div className="admin-crop-preview admin-phone-crop">{!image && !error && <p>Loading image…</p>}
      <div ref={stage} className="admin-crop-stage" style={{ aspectRatio: `${imageWidth} / ${imageHeight}`, maxWidth: `${Math.min(600, 400 * imageWidth / imageHeight)}px` }} hidden={!image}>
        <canvas ref={fullPreview} aria-label="Full photo"/>
        <div className="admin-crop-frame" role="group" aria-label="Crop area. Use arrow keys to move." tabIndex={busy ? -1 : 0}
          style={{ left: `${crop.x * 100}%`, top: `${crop.y * 100}%`, width: `${crop.width * 100}%`, height: `${crop.height * 100}%` }}
          onPointerDown={event => startDrag(event)} onPointerMove={drag} onPointerUp={endDrag} onPointerCancel={endDrag} onLostPointerCapture={endDrag}
          onKeyDown={event => {
            if (busy || !['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(event.key)) return;
            event.preventDefault(); const step = event.shiftKey ? 0.05 : 0.01;
            setCrop(current => ({ ...current, x: Math.max(0, Math.min(1 - current.width, current.x + (event.key === 'ArrowLeft' ? -step : event.key === 'ArrowRight' ? step : 0))), y: Math.max(0, Math.min(1 - current.height, current.y + (event.key === 'ArrowUp' ? -step : event.key === 'ArrowDown' ? step : 0))) }));
          }}>
          <span className="admin-crop-thirds" aria-hidden="true"/>
          {(['nw','ne','sw','se'] as const).map(corner => <div key={corner} className={`admin-crop-handle admin-crop-${corner}`} role="button" tabIndex={busy ? -1 : 0} aria-label={`Resize crop ${corner}`} onPointerDown={event => startDrag(event, corner)} onKeyDown={event => {
            if (busy || !['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(event.key)) return;
            event.stopPropagation(); event.preventDefault();
            gesture.current = { pointer: -1, x: 0, y: 0, corner, crop };
            const bounds = stage.current?.getBoundingClientRect();
            if (bounds) drag({ pointerId: -1, clientX: event.key === 'ArrowLeft' ? -bounds.width * .02 : event.key === 'ArrowRight' ? bounds.width * .02 : 0, clientY: event.key === 'ArrowUp' ? -bounds.height * .02 : event.key === 'ArrowDown' ? bounds.height * .02 : 0 } as ReactPointerEvent<HTMLDivElement>);
            gesture.current = null;
          }}/>) }
        </div>
      </div>
      <canvas ref={canvas} aria-label="Cropped image preview" hidden/>
    </div>
    <fieldset disabled={busy || !image} className="admin-crop-controls">
      <label>Shape<select aria-label="Shape" value={ratio} onChange={e => chooseShape(e.target.value)}><option value="free">Free crop</option><option value="original">Original</option><option value="1">Square · 1:1</option><option value="1.3333333333">Landscape · 4:3</option><option value="0.75">Portrait · 3:4</option><option value="1.7777777778">Wide · 16:9</option></select></label>
      <button type="button" className="upload-secondary-button" onClick={() => { setRotation((rotation + 90) % 360); setRatio('free'); setCrop({ x: 0, y: 0, width: 1, height: 1 }); }}><RotateCw size={15}/>Rotate</button>
      <button type="button" className="upload-secondary-button" onClick={() => { setRatio('free'); setCrop({ x: 0, y: 0, width: 1, height: 1 }); setRotation(0); }}>Reset</button>
    </fieldset>
    {error && <p role="alert" className="form-error">{error}</p>}
    <footer><button type="button" className="upload-secondary-button" disabled={busy} onClick={onCancel}>Cancel</button><button type="button" className="upload-primary-button" disabled={busy || !image} onClick={() => void apply()}><Crop size={15}/>{busy ? 'Applying…' : 'Apply crop'}</button></footer>
  </section>;
}

export function AdminImageGallery({ images, onChange, disabled = false, onBusyChange, allowCrop = true }: {
  images: string[]; onChange: (images: string[]) => void; disabled?: boolean; onBusyChange?: (busy: boolean) => void; allowCrop?: boolean;
}) {
  const [editing, setEditing] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function add(files: File[], replace?: number) {
    if (!files.length) return;
    setError('');
    if ((replace === undefined ? images.length + files.length : images.length) > 10) { setError('Use up to 10 images. Remove a photo before adding more.'); return; }
    if (files.some(file => !['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 8 * 1024 * 1024)) { setError('Choose JPEG, PNG or WebP images up to 8 MB each.'); return; }
    setBusy(true); onBusyChange?.(true);
    try {
      const next = [...images];
      for (const file of files) {
        const url = await uploadAdminImage(file);
        if (replace === undefined) next.push(url); else next[replace] = url;
      }
      onChange(next);
    } catch (e) { setError(e instanceof Error ? e.message : 'Image upload failed.'); }
    finally { setBusy(false); onBusyChange?.(false); }
  }
  return <div className="admin-image-gallery">
    <div className="admin-image-gallery-toolbar"><span>{images.length} / 10 images</span><label className="upload-secondary-button">{busy ? 'Uploading…' : 'Add images'}<input aria-label="Add gallery images" type="file" multiple accept="image/jpeg,image/png,image/webp" disabled={disabled || busy || editing !== null || images.length >= 10} onChange={e => { void add(Array.from(e.target.files || [])); e.target.value = ''; }}/></label></div>
    <div className="admin-media-grid">{images.map((url, index) => <article className="admin-media-card" key={`${url}-${index}`}><img src={imagePreviewUrl(url)} alt={`Image ${index + 1}`}/><span>{index === 0 ? 'Cover photo' : `Image ${index + 1}`}</span><div className="admin-media-actions">
      {allowCrop && <button type="button" disabled={disabled || busy || editing !== null} onClick={() => setEditing(index)}><Crop size={14}/>Crop</button>}
      <label>Replace<input type="file" aria-label={`Replace image ${index + 1}`} accept="image/jpeg,image/png,image/webp" disabled={disabled || busy || editing !== null} onChange={e => { void add(Array.from(e.target.files || []), index); e.target.value = ''; }}/></label>
      {index > 0 && <button type="button" disabled={disabled || busy || editing !== null} onClick={() => onChange([url, ...images.filter((_, i) => i !== index)])}>Make cover</button>}
      <button type="button" disabled={disabled || busy || editing !== null} onClick={() => onChange(images.filter((_, i) => i !== index))}>Remove</button>
    </div></article>)}</div>
    {allowCrop && editing !== null && images[editing] && <AdminImageEditor key={images[editing]} src={images[editing]} onCancel={() => setEditing(null)} onSave={async blob => {
      setBusy(true); onBusyChange?.(true);
      try { const url = await uploadAdminImage(blob); onChange(images.map((existing, index) => index === editing ? url : existing)); setEditing(null); }
      finally { setBusy(false); onBusyChange?.(false); }
    }}/>}
    {error && <p role="alert" className="form-error">{error}</p>}
  </div>;
}
