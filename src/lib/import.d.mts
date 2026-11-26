export const importHeaders: string[];
export function parseCSV(text: string): string[][];
export function validateImport(
  text: string,
  existing?: string[],
  taxonomy?: { id: string; slug: string; parentId: string | null }[],
): { row: number; value: Record<string, string>; errors: string[] }[];
export function csvCell(value: unknown): string;
export function matchImage(filename: string, skus: string[]): string | null;
