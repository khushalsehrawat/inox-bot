import { siteUrl } from "@/lib/data";
import { getWebProducts } from "@/lib/web-taxonomy";
import { getBlogPosts } from "@/lib/blog-store";
export const dynamic = "force-dynamic";
export default async function sitemap() {
  return [
    "",
    "/products",
    "/facade",
    "/xcomb",
    "/catalogues",
    "/about",
    "/contact",
    "/privacy",
    "/blog",
    ...(await getBlogPosts()).map(post => `/blog/${post.slug}`),
    ...(await getWebProducts()).map((p) => `/products/${p.id}`),
  ].map((path) => ({ url: `${siteUrl}${path}` }));
}
