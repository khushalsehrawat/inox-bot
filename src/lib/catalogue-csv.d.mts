import type { ProductDraft } from './web-taxonomy-store.mjs';
export const catalogueHeaders: string[];
export function catalogueRows(products: ProductDraft[]): Record<string, unknown>[];
export function catalogueCSV(rows: Record<string, unknown>[]): string;
export function readCatalogueRows(matrix: unknown[][]): Record<string, string>[];
export function readCatalogueCSV(text: string): Record<string, string>[];
