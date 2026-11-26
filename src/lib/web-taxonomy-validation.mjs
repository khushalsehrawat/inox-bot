export class TaxonomyError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}
const fail = (message, status = 422) => {
  throw new TaxonomyError(status, message);
};
export function validateCategory(input) {
  if (!input || typeof input !== "object" || Array.isArray(input))
    fail("Invalid category.");
  const text = (key, max, required = false) => {
    const value = input[key] ?? "";
    if (
      typeof value !== "string" ||
      value.length > max ||
      (required && !value.trim())
    )
      fail(`${key} is required or exceeds ${max} characters.`);
    return value.trim();
  };
  const name = text("name", 80, true),
    slug = text("slug", 80, true),
    short = text("short", 40) || name.slice(0, 40),
    description = text("description", 500),
    image = text("image", 300);
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug))
    fail("Use lowercase letters, numbers and hyphens for the slug.");
  if (
    image &&
    !(
      /^[/]?api\/web\/category-images\/[a-f0-9-]{36}\.webp$/.test(image) ||
      /^[A-Za-z0-9][A-Za-z0-9/_ .-]*\.(png|jpe?g|webp)$/i.test(image)
    )
  )
    fail("Choose an uploaded image or a local media image.");
  if (image.includes("..") || image.includes("\\")) fail("Invalid image path.");
  if (
    input.parentId !== null &&
    (typeof input.parentId !== "string" ||
      !input.parentId ||
      input.parentId.length > 80)
  )
    fail("Select a valid parent category.");
  if (typeof input.published !== "boolean") fail("Choose published or draft.");
  if (
    !Number.isInteger(input.sortOrder) ||
    input.sortOrder < 0 ||
    input.sortOrder > 100000
  )
    fail("Sort order must be an integer from 0 to 100000.");
  return {
    name,
    slug,
    short,
    description,
    image,
    parentId: input.parentId,
    published: input.published,
    sortOrder: input.sortOrder,
  };
}
