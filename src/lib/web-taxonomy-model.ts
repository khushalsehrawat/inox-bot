export interface WebCategory {
  id: string;
  slug: string;
  name: string;
  short: string;
  description: string;
  image: string;
  parentId: string | null;
  published: boolean;
  sortOrder: number;
  version: number;
}
export type CategoryInput = Omit<WebCategory, "id" | "version">;
export function flattenCategories(categories: WebCategory[]) {
  const walk = (
    parentId: string | null,
    seen = new Set<string>(),
  ): WebCategory[] =>
    categories
      .filter((c) => c.parentId === parentId && !seen.has(c.id))
      .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name) || a.id.localeCompare(b.id))
      .flatMap((c) => [c, ...walk(c.id, new Set([...seen, c.id]))]);
  return walk(null);
}
