import type { WebCategory, CategoryInput } from "./web-taxonomy-model";
export type ProductDraft = {
  id: string; sku: string; name: string; category: string; subcategory?: string;
  description: string; keyFeatures?: string; status: "Draft" | "Ready" | "Published"; featured: boolean;
  webVisible: boolean; appVisible: boolean; finish: string; specifications: string;
  images: string[]; pdf: string; version?: number; variations?: import("./variations.mjs").Variation[];
};
export class TaxonomyError extends Error {
  status: number;
  constructor(status: number, message: string);
}
export function validateCategory(input: unknown): CategoryInput;
export function openTaxonomy(
  path: string,
  seeds?: {
    id: string;
    name: string;
    short?: string;
    description?: string;
    image?: string;
  }[],
  seedProducts?: { id: string; category: string; sku?: string | null }[],
): {
  productDrafts(): ProductDraft[];
  priceHistory(): Record<string,unknown>[];
  saveProduct(input: unknown): ProductDraft;
  saveProducts(inputs: unknown[]): ProductDraft[];
  uploadHistory(): { date: string; created: number; updated: number; total: number; uploads: number }[];
  list(publicOnly?: boolean): WebCategory[];
  transfer(sourceId: string, destinationId: string): number;
  move(id: string, direction: string, version: number): void;
  create(input: unknown): WebCategory;
  update(id: string, input: unknown, version: number): WebCategory;
  remove(id: string, version: number): void;
  assign(productId: string, categoryId: string): void;
  assignments(): Record<string, string>;
  import(rows: unknown[]): WebCategory[];
  close(): void;
};
