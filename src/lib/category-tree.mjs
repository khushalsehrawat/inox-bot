export function categoryPath(categories, id) {
  const path = [],
    seen = new Set();
  while (id) {
    if (seen.has(id)) return [];
    seen.add(id);
    const category = categories.find((c) => c.id === id);
    if (!category) return [];
    path.unshift(category);
    id = category.parentId;
  }
  return path;
}
export function isWithinCategory(categories, id, ancestorId) {
  return categoryPath(categories, id).some((c) => c.id === ancestorId);
}
export function productCategoryFields(categories, leafId) {
  const path = categoryPath(categories, leafId);
  if (!path.length) throw new Error("Choose an existing product category.");
  return { category: path[0].id, subcategory: path.length > 1 ? leafId : "" };
}
export function orderCategoryImports(rows, existing) {
  const pending = [...rows],
    ordered = [],
    available = new Set(existing.map((c) => c.slug));
  while (pending.length) {
    const index = pending.findIndex(
      (r) => !r.parentSlug || available.has(r.parentSlug),
    );
    if (index < 0)
      throw new Error("Unknown parent slug or circular category hierarchy.");
    const [row] = pending.splice(index, 1);
    ordered.push(row);
    available.add(row.slug);
  }
  return ordered;
}
export function moveCategoryOrder(categories, id, direction, version) {
  const current = categories.find(c => c.id === id);
  if (!current) throw new Error("Category no longer exists. Refresh first.");
  if (current.version !== version) throw new Error("Category changed. Refresh first.");
  if (typeof direction !== "string") throw new Error("Choose a valid category position.");
  const siblings = categories.filter(c => c.parentId === current.parentId)
    .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name) || a.id.localeCompare(b.id));
  const index = siblings.findIndex(c => c.id === id);
  if (direction.startsWith("before:") || direction.startsWith("after:")) {
    const [placement, targetId] = direction.split(":");
    if (targetId === id) return [];
    const remaining = siblings.filter(c => c.id !== id);
    const target = remaining.findIndex(c => c.id === targetId);
    if (target < 0) throw new Error("Drop within the same parent category. Refresh if categories changed.");
    remaining.splice(target + (placement === "after" ? 1 : 0), 0, current);
    return remaining.map((c, sortOrder) => ({ ...c, sortOrder }));
  }
  if (direction !== "up" && direction !== "down") throw new Error("Choose a valid category position.");
  const target = index + (direction === "up" ? -1 : 1);
  if (target < 0 || target >= siblings.length) return [];
  [siblings[index], siblings[target]] = [siblings[target], siblings[index]];
  return siblings.map((c, sortOrder) => ({ ...c, sortOrder }));
}
