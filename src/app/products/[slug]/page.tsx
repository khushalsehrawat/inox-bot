import { ProductVariations } from "@/components/product-variations";
import { notFound } from "next/navigation";
import Link from "next/link";
import { getWebProducts, getPublicWebCategories } from "@/lib/web-taxonomy";
import { ArrowLeft, ChevronRight } from "lucide-react";
// Product visibility and category assignments are read at request time.
// Do not enumerate routes from persistent storage during `next build`.
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const p = (await getWebProducts()).find((p) => p.id === slug);
  return { title: p?.name || "Product not found", description: p?.description };
}
export default async function ProductDetail({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const p = (await getWebProducts()).find((p) => p.id === slug);
  if (!p) notFound();
  const categories = (await getPublicWebCategories());
  return (
    <main className="wrap inner-page product-detail-page" id="main">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "Product",
            name: p.name,
            sku: p.sku,
            description: p.description,
            brand: { "@type": "Brand", name: "INOX" },
            color: p.finishes.join(", "),
          }).replace(/</g, "\\u003c"),
        }}
      />
      <div className="detail-page-top"><Link className="detail-back-link" href={`/products?category=${encodeURIComponent(p.category)}`}><ArrowLeft size={15}/>Back to collection</Link><nav className="breadcrumbs" aria-label="Breadcrumb"><Link href="/products">Products</Link><ChevronRight size={12}/><Link href={`/products?category=${encodeURIComponent(p.category)}`}>{categories.find(c=>c.id===p.category)?.name || 'Collection'}</Link><ChevronRight size={12}/><span aria-current="page">{p.name}</span></nav></div>
      <ProductVariations product={p} categoryName={categories.find(c=>c.id===p.category)?.name}/>

    </main>
  );
}
