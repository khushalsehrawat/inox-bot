import type { ProductDraft } from './web-taxonomy-store.mjs';
import type { WebCategory } from './web-taxonomy-model';
export function prepareCatalogueImport(rows: unknown, categories: WebCategory[], existing: ProductDraft[]): ProductDraft[];
