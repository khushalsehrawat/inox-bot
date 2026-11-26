import Link from "next/link";
import { CatalogueBrowser } from "@/components/catalogue-browser";
import { getWebProducts } from "@/lib/web-taxonomy";
export const metadata = {
  title: "Products",
  description:
    "Explore INOX interior solutions and select products for your project enquiry.",
};
export default async function Products({
  searchParams,
}: {
  searchParams: Promise<{ category?: string }>;
}) {
  const { category } = await searchParams;
  return (
    <main className="wrap inner-page products-page" id="main">
      <header className="collection-intro"><nav className="breadcrumbs" aria-label="Breadcrumb"><Link href="/">Home</Link><span aria-hidden="true">/</span><span aria-current="page">Products</span></nav><span className="eyebrow">The INOX collection</span><h1>Products, precisely considered.</h1><p>Explore architectural hardware, fittings and accessories for your project.</p></header>
      <CatalogueBrowser
        products={await getWebProducts()}
        initialCategory={category || "all"}
      />
    </main>
  );
}
