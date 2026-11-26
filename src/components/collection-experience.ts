export type CollectionFrame = {
  src: string; label: string; description?: string;
  annotations?: { label: string; x: number; y: number }[];
};

/** Only reviewed assets and factual captions belong here. */
export type CollectionMedia = {
  alternate?: CollectionFrame;
  sequence?: CollectionFrame[];
  video?: { src: string; poster?: string; label: string };
  model?: { src: string; poster: string; label: string };
};

export type LivingCollection = {
  id: string; name: string; description: string; image: string; number: number;
  framing?: { zoom?: number; positionX?: number; positionY?: number; alt?: string };
  experience?: CollectionMedia;
};

export const mediaPath = (src: string) => src.startsWith("/") || /^https?:\/\//.test(src) ? src : `/media/${src}`;

// Reveal the photograph without deforming the hardware.
export function collectionTreatment(collection: Pick<LivingCollection, "id" | "name">) {
  const category = `${collection.id} ${collection.name}`.toLowerCase();
  if (/light|cabonate/.test(category)) return "light";
  if (/hinge|telescop|profile|alumin|architect|hardware/.test(category)) return "detail";
  if (/wardrobe|organis/.test(category)) return "vertical";
  if (/kitchen|pantry|storage/.test(category)) return "horizontal";
  return "material";
}
