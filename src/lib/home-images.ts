export type HomeImage = { id: string; name: string; section: string; src: string; alt: string; zoom?: number; positionX?: number; positionY?: number };
export const homeImages: HomeImage[] = [
  { id: "hero", zoom: 0.95, name: "Main banner", section: "Hero", src: "editorial/editorial-kitchen.webp", alt: "Conceptual kitchen interior with limestone island and oak cabinetry" },
  { id: "story", name: "Our story", section: "INOX perspective", src: "editorial/editorial-wardrobe.webp", alt: "Conceptual oak wardrobe interior with integrated lighting" },
  { id: "catalogue", name: "Catalogue cover", section: "Catalogues", src: "editorial/editorial-kitchen.webp", alt: "Conceptual kitchen editorial cover" },
  { id: "events", name: "Events introduction", section: "Events", src: "events/architecture-stock.webp", alt: "Stock photograph of a minimalist museum courtyard with a glass and concrete facade" },
  ...[
    ["exhibitions", "INOX at Exhibitions", "Stock photograph of exhibition stands in a bright contemporary convention hall"],
    ["shoots", "INOX Shoots", "Stock photograph of a professional production camera in a studio"],
    ["workshops", "Workshops", "Stock photograph of interior design material samples arranged on a marble table"],
    ["webinars", "Webinars", "Stock photograph of a considered conference interior in natural light"],
  ].map(([id, name, alt]) => ({ id, name, section: "Events", src: `events/${id}-stock.webp`, alt })),
];
export function homeCollectionImage(c: { slug: string; name: string; image: string }) {
  return /(?:slides?|fittings?).*hinges?|hinges?.*(?:slides?|fittings?)/i.test(`${c.slug} ${c.name}`)
    ? "editorial/slides-hinges-still-life.webp"
    : c.slug === "hardware" || /architectural[\s-]+hardware/i.test(`${c.slug} ${c.name}`)
      ? "editorial/architectural-hardware-profiles.webp"
      : c.image || (c.slug === "facade" ? "editorial/editorial-facade.webp" : "");
}
