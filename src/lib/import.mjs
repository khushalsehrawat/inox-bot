import { isWithinCategory } from "./category-tree.mjs";
export const importHeaders = [
  "sku",
  "name",
  "category",
  "subcategory",
  "description",
  "finish",
  "featured",
  "webVisible",
];
export function parseCSV(text) {
  const rows = [];
  let row = [],
    cell = "",
    quoted = false;
  text = text.replace(/^\uFEFF/, "");
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') {
      if (quoted && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (!quoted && cell !== "")
        throw new Error("Unexpected quote in CSV.");
      else quoted = !quoted;
    } else if (c === "," && !quoted) {
      row.push(cell);
      cell = "";
    } else if ((c === "\n" || c === "\r") && !quoted) {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(cell);
      if (row.some((v) => v.trim())) rows.push(row);
      row = [];
      cell = "";
    } else cell += c;
  }
  if (quoted) throw new Error("An enclosing quote is missing.");
  row.push(cell);
  if (row.some((v) => v.trim())) rows.push(row);
  return rows;
}
export function validateImport(text, existing = [], taxonomy) {
  const rows = parseCSV(text);
  if (rows.length < 2)
    throw new Error("Include a header and at least one product.");
  if (rows.length > 2001)
    throw new Error("Import at most 2,000 products at a time.");
  const headers = rows.shift().map((s) => s.trim());
  if (new Set(headers).size !== headers.length)
    throw new Error("Duplicate column names.");
  for (const h of ["sku", "name", "category"])
    if (!headers.includes(h)) throw new Error(`Missing required column: ${h}.`);
  const seen = new Set(existing.map((s) => s.trim().toLowerCase()));
  return rows.map((values, index) => {
    const value = Object.fromEntries(
      headers.map((h, i) => [h, (values[i] || "").trim()]),
    );
    const errors = [];
    if (values.length !== headers.length)
      errors.push("Column count does not match header");
    if (!/^[A-Za-z0-9][A-Za-z0-9._/-]{0,79}$/.test(value.sku))
      errors.push("SKU must be 1–80 characters (letters, numbers, . _ / -)");
    if (seen.has(value.sku.toLowerCase())) errors.push("Duplicate SKU");
    seen.add(value.sku.toLowerCase());
    if (!value.name || value.name.length > 200)
      errors.push("Name is required (max 200 characters)");
    if (taxonomy) {
      const root = taxonomy.find(
        (c) =>
          !c.parentId && (c.id === value.category || c.slug === value.category),
      );
      if (!root) errors.push("Unknown category");
      else value.category = root.id;
      if (value.subcategory) {
        const child = taxonomy.find(
          (c) =>
            root &&
            c.id !== root.id &&
            isWithinCategory(taxonomy, c.id, root.id) &&
            (c.id === value.subcategory || c.slug === value.subcategory),
        );
        if (!child)
          errors.push("Subcategory does not belong to the selected category");
        else value.subcategory = child.id;
      }
    } else if (
      ![
        "kitchen",
        "wardrobe",
        "hardware",
        "facade",
        "xcomb",
        "organisers",
        "pantry",
      ].includes(value.category)
    )
      errors.push("Unknown category");
    if ((value.description || "").length > 3000)
      errors.push("Description exceeds 3,000 characters");
    for (const h of ["featured", "webVisible", "appVisible"])
      if (value[h] && !["true", "false"].includes(value[h]))
        errors.push(`${h} must be true or false`);
    return { row: index + 2, value, errors };
  });
}
export function csvCell(value) {
  const text = String(value ?? "");
  const safe = /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
  return `"${safe.replaceAll('"', '""')}"`;
}
export function matchImage(filename, skus) {
  const base = filename.replace(/\.(png|jpe?g|webp)$/i, "");
  return (
    [...skus]
      .sort((a, b) => b.length - a.length)
      .find(
        (s) =>
          base.toLowerCase() === s.toLowerCase() ||
          base.toLowerCase().startsWith(s.toLowerCase() + "__"),
      ) || null
  );
}
