export type Variation = { id: string; sku: string; name: string; size: string; dimensions: string; material: string; finish: string; colour: string; specifications: Record<string,string>; images: string[]; mrp: string | null; sellingPrice: string | null; active: boolean; available: boolean; sortOrder: number; isDefault: boolean };
export type PublicVariation = Omit<Variation, 'mrp' | 'sellingPrice'>;
export function money(value: unknown): string | null;
export function validateVariations(rows: unknown): Variation[];
export function selectVariation<T extends PublicVariation>(rows?: T[]): T | undefined;
export function publicVariation(row: Variation): PublicVariation;
