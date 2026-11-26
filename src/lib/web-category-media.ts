import { withTaxonomy } from "./web-taxonomy";
import { readWebsiteMedia } from "./website-media";
export async function categoryMedia(filename: string, admin = false) {
  if (!/^[a-f0-9-]{36}\.webp$/.test(filename))
    return new Response(null, { status: 404 });
  try {
    const visible =
      admin ||
      await withTaxonomy(async store => (await store.list(true)).some(c => c.image === `/api/web/category-images/${filename}`));
    if (!visible)
      return new Response(null, {
        status: 404,
        headers: { "Cache-Control": "no-store" },
      });
    const bytes = await readWebsiteMedia(`/api/web/category-images/${filename}`);
    return new Response(new Uint8Array(bytes), {
      headers: {
        "Content-Type": "image/webp",
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return new Response(null, { status: 404 });
  }
}
