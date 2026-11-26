"use client";
import { selectVariation } from "@/lib/variations.mjs";
import { ProductPrice } from "./customer-account";
import { categoryPath, isWithinCategory } from "@/lib/category-tree.mjs";
import { flattenCategories } from "@/lib/web-taxonomy-model";
import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import {
  ArrowRight,
  Search,
  X,
  Package,
  Plus,
  SlidersHorizontal,
  Check,
  Eye,
  ArrowUpRight,
} from "lucide-react";
import { type Product } from "@/lib/data";
import { useWebTaxonomy } from "./web-taxonomy-provider";
import { addToBasket } from "@/lib/basket";
import { AnimatePresence, motion } from "motion/react";
import { useMotionPreferences, editorialEase } from "./motion-system";
import { FilterProgress } from "./page-loading";
import { CollectionPicker } from "./collection-picker";
export function AddToEnquiry({ product, variationId, beforeAdd }: { product: Product; variationId?: string; beforeAdd?: () => Promise<boolean> }) {
  const [added, setAdded] = useState(0);
  const [checking, setChecking] = useState(false);
  const selected=product.variations?.find(v=>v.id===variationId) || selectVariation(product.variations);
  const { reduced } = useMotionPreferences();
  return (
    <motion.button
      disabled={checking || !selected?.active || !selected.available}
      tabIndex={0}
      className="button dark enquiry-add"
      whileTap={reduced ? undefined : { scale: 0.98 }}
      onClick={async () => {
        setChecking(true);
        try {
          if (beforeAdd && !await beforeAdd()) return;
          addToBasket(product.id, selected?.id);
          setAdded((n) => n + 1);
        } finally { setChecking(false); }
      }}
    >
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.span
          key={added}
          className="enquiry-button-content"
          initial={reduced ? false : { opacity: 0, y: 7 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: reduced ? 0 : -7 }}
          transition={{ duration: 0.22 }}
        >
          {added ? <Check size={16} /> : <Plus size={16} />}
          <span aria-live="polite">
            {added ? "Added to enquiry" : "Add to enquiry"}
          </span>
        </motion.span>
      </AnimatePresence>
    </motion.button>
  );
}
export function ProductImage({ product }: { product: Product }) {
  const image=selectVariation(product.variations)?.images[0] || product.image;
  return (
    <div className="product-image">
      {image ? (
        <>
          <img src={image} alt={product.name} loading="lazy" decoding="async" />
        </>
      ) : (
        <>
          <Package size={42} strokeWidth={1} />
          <span>Product photography awaiting original asset</span>
        </>
      )}
    </div>
  );
}
export function CatalogueBrowser({
  products,
  initialCategory = "all",
}: {
  products: Product[];
  initialCategory?: string;
}) {
  const { categories } = useWebTaxonomy();
  const { reduced } = useMotionPreferences();
  const [isPending, startTransition] = useTransition();
  const [pagination, setPagination] = useState({ category: initialCategory, search: "", page: 1 });
  const [category, setCategory] = useState(initialCategory),
    [search, setSearch] = useState(""),
    [preview, setPreview] = useState<Product | null>(null);
  const modal = useRef<HTMLDialogElement>(null);
  const resultsHeading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    setCategory(initialCategory);
  }, [initialCategory]);
  useEffect(() => {
    setPagination({ category, search, page: 1 });
  }, [category, search]);
  const filtered = products.filter(
    (p) =>
      (category === "all" ||
        p.category === category ||
        isWithinCategory(categories, p.category, category)) &&
      `${p.name} ${p.sku || ""} ${(p.variations || []).filter(v=>v.active).map(v=>`${v.sku} ${v.size} ${v.finish} ${v.material}`).join(" ")}`.toLowerCase().includes(search.toLowerCase()),
  );
  const pageSize = 9;
  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const page = pagination.category === category && pagination.search === search
    ? Math.min(pagination.page, pageCount)
    : 1;
  const pageStart = (page - 1) * pageSize;
  const visibleProducts = filtered.slice(pageStart, pageStart + pageSize);
  function changePage(nextPage: number) {
    setPagination({ category, search, page: nextPage });
    resultsHeading.current?.scrollIntoView({ behavior: reduced ? "instant" : "smooth", block: "start" });
    resultsHeading.current?.focus({ preventScroll: true });
  }
  return (
    <div className="catalogue-layout">
      <CollectionPicker categories={categories} value={category} onChange={id => startTransition(() => setCategory(id))} />
      <aside className="category-nav">
        <div className="filter-heading">
          <SlidersHorizontal size={17} />
          <span>Browse collections</span>
        </div>
        <button
          aria-pressed={category === "all"}
          className={category === "all" ? "active" : ""}
          onClick={() => startTransition(() => setCategory("all"))}
        >
          <span>All products</span>
        </button>
        {categories
          .filter((c) => !c.parentId)
          .map((c) => (
            <div className="category-group" key={c.id}>
              <button
                aria-pressed={category === c.id}
                className={category === c.id ? "active" : ""}
                onClick={() => startTransition(() => setCategory(c.id))}
              >
                <span>{c.name}</span>
              </button>
              {(category === c.id ||
                isWithinCategory(categories, category, c.id)) && (
                <div className="subcategory-nav">
                  {flattenCategories(categories)
                    .filter(
                      (child) =>
                        child.id !== c.id &&
                        isWithinCategory(categories, child.id, c.id),
                    )
                    .map((child) => (
                      <button
                        key={child.id}
                        style={{
                          paddingLeft: `${Math.max(0, categoryPath(categories, child.id).length - 2) * 12}px`,
                        }}
                        aria-pressed={category === child.id}
                        className={category === child.id ? "active" : ""}
                        onClick={() =>
                          startTransition(() => setCategory(child.id))
                        }
                      >
                        {child.name}
                      </button>
                    ))}
                </div>
              )}
            </div>
          ))}
        <div className="aside-note">
          <h3>
            A detail for
            <br />
            every space.
          </h3>
          <p>Need help finding the right fitting?</p>
          <Link className="text-link" href="/contact">
            Talk to <mark className="inox-word">INOX</mark>{" "}
            <ArrowRight size={14} />
          </Link>
        </div>
      </aside>
      <div aria-busy={isPending} className="catalogue-results">
        {isPending && <FilterProgress />}
        <div className="catalogue-results-heading">
          <div>
            <span className="eyebrow">Find your finishing touch</span>
            <h2 ref={resultsHeading} tabIndex={-1}>
              {category === "all"
                ? "All products"
                : categories.find((c) => c.id === category)?.name ||
                  "Collection"}
            </h2>
          </div>
          <Link href="/enquiry" className="catalogue-basket-link">
            View enquiry <ArrowUpRight size={16} />
          </Link>
        </div>
        <div className="catalogue-toolbar">
          <label className="search">
            <Search size={17} />
            <input
              aria-label="Search products by name or SKU"
              placeholder="Search products or SKU"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {search && (
              <button
                type="button"
                className="search-clear"
                aria-label="Clear search"
                onClick={() => setSearch("")}
              >
                <X size={16} />
              </button>
            )}
          </label>
          <span className="catalogue-product-total">
            <SlidersHorizontal size={15} /> {filtered.length} product
            {filtered.length !== 1 ? "s" : ""}
          </span>
        </div>
        {(category !== "all" || search) && (
          <div className="catalogue-active-filters">
            <span>
              {category === "all"
                ? "All collections"
                : categoryPath(categories, category)
                    .map((c) => c.name)
                    .join(" / ")}
              {search ? ` / ?${search}?` : ""}
            </span>
            <button
              onClick={() => {
                setSearch("");
                startTransition(() => setCategory("all"));
              }}
            >
              Clear filters <X size={13} />
            </button>
          </div>
        )}
        <AnimatePresence mode="popLayout" initial={false}>
          {filtered.length ? (
            <motion.div
              key="products"
              className="product-grid"
              initial={reduced ? false : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: reduced ? 0 : 0.28, ease: editorialEase }}
            >
              {visibleProducts.map((p) => (
                <article className="product-card" key={p.id}>
                  <Link href={`/products/${p.id}`}>
                    <ProductImage product={p} />
                  </Link>
                  <div className="product-card-body">
                    <span className="eyebrow">
                      {categories.find((c) => c.id === p.category)?.name}
                    </span>
                    <h3>
                      <Link href={`/products/${p.id}`}>{p.name}</Link>
                    </h3>
                    <small>Reference: {selectVariation(p.variations)?.sku || p.sku || "Available on enquiry"}</small>
                    <ProductPrice id={p.id} />
                    <div className="card-actions">
                      <Link
                        className="product-detail-button"
                        href={`/products/${p.id}`}
                      >
                        View details <ArrowRight size={14} />
                      </Link>
                      <button
                        className="product-preview-button"
                        onClick={() => {
                          setPreview(p);
                          modal.current?.showModal();
                        }}
                      >
                        <Eye size={15} /> Quick preview
                      </button>
                    </div>
                    <AddToEnquiry product={p} />
                  </div>
                </article>
              ))}
            </motion.div>
          ) : (
            <motion.div
              key={`empty-${category}`}
              className="empty-state"
              initial={reduced ? false : { opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: reduced ? 0 : 0.25 }}
            >
              <Package size={36} strokeWidth={1} />
              <h3>
                {search
                  ? "No matching products."
                  : "The finer details are on their way."}
              </h3>
              <p>
                {search
                  ? "Try another name or SKU."
                  : "Product records for this collection have not been supplied yet. Explore the collection catalogue or speak to our team."}
              </p>
              <Link className="button outline" href="/catalogues">
                Explore catalogues <ArrowRight size={15} />
              </Link>
            </motion.div>
          )}
        </AnimatePresence>
        {filtered.length > 0 && (
          <nav className="catalogue-pagination" aria-label="Product pages">
            <span className="catalogue-product-total" aria-live="polite">
              Showing {pageStart + 1}–{Math.min(pageStart + pageSize, filtered.length)} of {filtered.length} products
            </span>
            {pageCount > 1 && <div className="catalogue-pagination-controls">
              <button type="button" className="button outline" disabled={page === 1} onClick={() => changePage(page - 1)}>
                Previous
              </button>
              <span aria-live="polite">Page {page} of {pageCount}</span>
              <button type="button" className="button outline" disabled={page === pageCount} onClick={() => changePage(page + 1)}>
                Next
              </button>
            </div>}
          </nav>
        )}
      </div>
      <dialog
        ref={modal}
        className="preview-dialog"
        onClick={(e) => {
          if (e.target === modal.current) modal.current.close();
        }}
      >
        <button
          className="dialog-close icon-button"
          aria-label="Close preview"
          onClick={() => modal.current?.close()}
        >
          <X />
        </button>
        {preview && (
          <>
            <ProductImage product={preview} />
            <span className="eyebrow">Quick preview</span>
            <h2>{preview.name}</h2>
            <ProductPrice id={preview.id} />
            <p>{preview.description}</p>
            <Link
              className="button dark"
              href={`/products/${preview.id}`}
              onClick={() => modal.current?.close()}
            >
              View product <ArrowRight size={16} />
            </Link>
          </>
        )}
      </dialog>
    </div>
  );
}
