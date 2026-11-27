export type BasketItem = { id: string; variationId?: string; quantity: number };
export function readBasket(): BasketItem[] {
  try {
    const value = JSON.parse(localStorage.getItem("inox-enquiry") || "[]");
    return Array.isArray(value)
      ? value.filter(
          (v) =>
            typeof v.id === "string" && !v.id.startsWith("demo-product-") &&
            Number.isInteger(v.quantity) &&
            v.quantity > 0 &&
            v.quantity <= 999,
        )
      : [];
  } catch {
    return [];
  }
}
export function saveBasket(items: BasketItem[]) {
  localStorage.setItem("inox-enquiry", JSON.stringify(items));
  window.dispatchEvent(new Event("basket-change"));
}
export function addToBasket(id: string, variationId?: string) {
  const items = readBasket();
  const item = items.find((i) => i.id === id && i.variationId === variationId);
  if (item) item.quantity = Math.min(item.quantity + 1, 999);
  else items.push({ id, variationId, quantity: 1 });
  saveBasket(items);
}
