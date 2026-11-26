type CategoryNode = { id: string; parentId: string | null };
export function productCategoryFields(categories: CategoryNode[], leafId: string): { category: string; subcategory: string };
export function moveCategoryOrder<T extends CategoryNode & { name: string; sortOrder: number; version: number }>(categories: T[], id: string, direction: string, version: number): T[];
export function categoryPath<T extends CategoryNode>(
  categories: T[],
  id: string | null | undefined,
): T[];
export function isWithinCategory<T extends CategoryNode>(
  categories: T[],
  id: string | null | undefined,
  ancestorId: string,
): boolean;
export function orderCategoryImports<
  T extends { parentSlug?: unknown; slug?: unknown },
>(rows: T[], existing: { slug: string }[]): T[];
