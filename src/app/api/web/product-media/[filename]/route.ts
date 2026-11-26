import { getHomeImages } from "@/lib/home-image-store";
import { getEventAlbums } from "@/lib/event-store";
import { getBlogPosts } from "@/lib/blog-store";
import { getWebProducts } from "@/lib/web-taxonomy";
import { readWebsiteMedia } from "@/lib/website-media";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(req: Request, { params }: { params: Promise<{ filename: string }> }) {
  const { filename } = await params;
  if (!/^[a-f0-9-]{36}\.(webp|pdf)$/.test(filename)) return new Response(null, { status: 404 });
  try {
    const url = `/api/web/product-media/${filename}`;
    if (!(await getBlogPosts()).some(post => post.image === url) && !(await getEventAlbums()).some(album => album.photos.some(photo => photo.src === url)) && !(await getWebProducts()).some(p => p.images?.includes(url) || p.pdf === url || p.variations?.some(v => v.images.includes(url))) && !(await getHomeImages()).some(image => image.src === url)) return new Response(null, { status: 404 });
    // Upload names are unique and their contents are never replaced. Check
    // visibility before reusing cached bytes, so unpublishing still takes effect.
    const cacheHeaders = { "Cache-Control": "private, no-cache", ETag: `"${filename}"` };
    if (req.headers.get("if-none-match")?.split(",").some(tag => tag.trim().replace(/^W\//, "") === cacheHeaders.ETag || tag.trim() === "*")) {
      return new Response(null, { status: 304, headers: cacheHeaders });
    }
    const bytes = await readWebsiteMedia(url);
    return new Response(new Uint8Array(bytes), { headers: { ...cacheHeaders, "Content-Type": filename.endsWith("pdf") ? "application/pdf" : "image/webp", "X-Content-Type-Options": "nosniff", ...(filename.endsWith("pdf") ? { "Content-Disposition": 'attachment; filename="product-datasheet.pdf"' } : {}) } });
  } catch { return new Response(null, { status: 404 }); }
}
