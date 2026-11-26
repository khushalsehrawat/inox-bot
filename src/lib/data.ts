export const categories = [
  {
    id: "kitchen",
    name: "Kitchen Fittings",
    short: "Kitchens",
    image: "editorial/editorial-kitchen.webp",
    description: "Hinges, drawer system, lift-ups, corner solutions and more for smarter kitchens.",
  },
  {
    id: "wardrobe",
    name: "Wardrobe Fittings",
    short: "Wardrobes",
    image: "editorial/editorial-wardrobe.webp",
    description: "Organisers, pull-outs, baskets, shoe racks and accessories for well-planned wardrobes.",
  },
  {
    id: "hardware",
    name: "Architectural Hardware",
    short: "Hardware",
    image: "editorial/editorial-hardware.webp",
    description: "Hinges, profiles and precision hardware built for performanceand durability.",
  },
  {
    id: "organisers",
    name: "Organisers & Accessories",
    short: "Organisers",
    image: "editorial/organisers-accessories.jpg",
    description: "Premium organisers and accessories that bring order, brauty and ease to daily life.",
  },
  {
    id: "pantry",
    name: "Pantry & Storage Solutions",
    short: "Pantry",
    image: "editorial/pantry-storage.jpg",
    description: "Tall units, pull-out storage and intelligent solutions for every storage need.",
  },
];
export interface Product {
  id: string;
  name: string;
  sku: string | null;
  category: string;
  image: string | null;
  images?: string[];
  description: string;
  keyFeatures?: string;
  specifications: Record<string, string>;
  finishes: string[];
  pdf?: string;
  variations?: import("./variations.mjs").PublicVariation[];
}
// Runtime catalogue records come only from the website data service.
export const products: Product[] = [];
export const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
