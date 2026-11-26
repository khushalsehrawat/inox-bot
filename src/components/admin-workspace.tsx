"use client";
import { categoryPath, isWithinCategory } from "@/lib/category-tree.mjs";
import Link from "next/link";
import { HighlightInox } from "./highlight-inox";
import { BrandLogo } from "./brand-logo";
import { adminMediaUrl, ProductUploadEditor } from "./product-upload-editor";
import { CatalogueImport } from "./catalogue-import";
import { HomeImagesAdmin } from "./home-images-admin";
import { EventsAdmin } from "./events-admin";
import { BlogsAdmin } from "./blogs-admin";
import { AdminImageStudio } from "./admin-image-studio";
import { DraftDrawer } from "./draft-drawer";
import { Fragment, useState, useEffect, useRef } from "react";
import {
  ArrowLeft,
  Plus,
  Package,
  Files,
  Inbox,
  Upload,
  Download,
  Search,
  X,
  LayoutDashboard,
  Check,
  LogOut,
  AlertCircle,
  Images,
  FolderTree,
  UsersRound,
  BadgeIndianRupee,
  House,
  BookOpen,
  ArrowUpRight,
  ChevronRight,
  Menu,
  ShieldCheck,
} from "lucide-react";
import { categories as defaultCategories, products, type Product } from "@/lib/data";
import { WebsiteCustomers } from "./website-customers";
import { WebsiteEnquiriesAdmin } from "./website-enquiries-admin";
import { ProductPricesAdmin } from "./product-prices-admin";
import { CategoryManager } from "./category-manager";
import { useWebTaxonomy } from "./web-taxonomy-provider";
import type { WebCategory } from "@/lib/web-taxonomy-model";
import {
  validateImport,
  importHeaders,
  csvCell,
  matchImage,
} from "@/lib/import.mjs";
type Draft = import("@/lib/web-taxonomy-store.mjs").ProductDraft;
const blank: Draft = {
  id: "",
  sku: "",
  name: "",
  category: "kitchen",
  description: "",
  keyFeatures: "",
  status: "Draft",
  featured: false,
  webVisible: true,
  appVisible: false,
  finish: "",
  specifications: "",
  images: [],
  pdf: "",
  variations: [],
};
type ImportRow = ReturnType<typeof validateImport>[number];
function download(name: string, content: string, type = "text/csv") {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}
export function AdminWorkspace() {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [productError, setProductError] = useState("");
  const productErrorDialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (productError) productErrorDialog.current?.showModal();
    else productErrorDialog.current?.close();
  }, [productError]);
  useEffect(() => {
    if (!mobileNavOpen) return;
    const close = (event: KeyboardEvent) => { if (event.key === "Escape") setMobileNavOpen(false); };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [mobileNavOpen]);
  const { categories: publicCategories } = useWebTaxonomy();
  const [webCategories, setWebCategories] = useState<WebCategory[]>(
    publicCategories.length
      ? publicCategories
      : defaultCategories.map((c, i) => ({
          ...c,
          slug: c.id,
          parentId: null,
          published: true,
          sortOrder: i,
          version: 1,
        })),
  );
  const categories = webCategories.filter((c) => !c.parentId);
  const [websiteProducts, setWebsiteProducts] = useState<Product[]>(products);
  const [productsLoaded, setProductsLoaded] = useState(false);

  const [mode, setMode] = useState<"login" | "local" | "live">("login"),
    [tab, setTab] = useState("Products"),
    [drafts, setDrafts] = useState<Draft[]>([]),
    [editing, setEditing] = useState<Draft | null>(null),
    [search, setSearch] = useState(""),
    [productCategory, setProductCategory] = useState(""),
    [notice, setNotice] = useState(""),
    [error, setError] = useState(""),
    [selected, setSelected] = useState<string[]>([]),
    [imports, setImports] = useState<ImportRow[]>([]),
    [busy, setBusy] = useState(false),
    [catalogues, setCatalogues] = useState<
      { name: string; category: string; published: boolean }[]
    >([]),
    [matched, setMatched] = useState<{ name: string; sku: string | null }[]>(
      [],
    );
  useEffect(() => {
    try {
      const data = JSON.parse(
        localStorage.getItem("inox-admin-drafts") || "[]",
      );
      if (Array.isArray(data))
        setDrafts(
          data.filter(
            (d) =>
              d &&
              typeof d.id === "string" &&
              typeof d.sku === "string" &&
              typeof d.name === "string" &&
              Array.isArray(d.images),
          ),
        );
    } catch {}
  }, []);
  useEffect(() => {
    fetch("/api/admin/session", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.authenticated) setMode("live");
      })
      .catch(() => {});
  }, []);
  useEffect(() => {
    if (mode === "live") {
      fetch("/api/admin/web-categories", { cache: "no-store" })
        .then(async (r) => {
          const data = await r.json();
          if (!r.ok) throw new Error(data.message);
          setWebCategories(data.categories);
        })
        .catch((e) => setError(e.message));
    }
    if (mode === "local") {
      try {
        const saved = JSON.parse(
          localStorage.getItem("inox-web-category-drafts") || "null",
        );
        if (
          Array.isArray(saved) &&
          saved.every(
            (c) =>
              c &&
              typeof c.id === "string" &&
              typeof c.name === "string" &&
              typeof c.slug === "string" &&
              (c.parentId === null || typeof c.parentId === "string"),
          )
        )
          setWebCategories(saved);
      } catch {}
    }
  }, [mode]);
  async function loadProducts() {
    const response = await fetch("/api/admin/products", { cache: "no-store" });
    const data = await response.json();
    if (!response.ok) throw new Error(data.message);
    setWebsiteProducts(data.products);
    if (Array.isArray(data.categories)) setWebCategories(data.categories);
    setDrafts(data.drafts);
    setProductsLoaded(true);
  }
  useEffect(() => {
    if (mode === "live") loadProducts().catch(e => setError(e.message));
  }, [mode, tab]);
  useEffect(() => {
    if (mode !== "live") return;
    const reload = () => { loadProducts().catch(e => setError(e.message)); };
    window.addEventListener("focus", reload);
    return () => window.removeEventListener("focus", reload);
  }, [mode]);
  async function publishProduct(product: Draft, close = false) {
    setBusy(true); setError(""); setNotice("");
    try {
      const response = await fetch("/api/admin/products", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ operation: "save", product }) });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        const message = typeof data?.message === "string" && data.message.trim()
          ? data.message
          : response.status === 422
            ? "Please check the required product fields and try again."
            : "The server could not save the product. Please try again.";
        throw new Error(message);
      }
      setDrafts(current => [...current.filter(d => d.id !== product.id), data.product]);
      await loadProducts();
      setNotice(product.webVisible ? "Product published. Open Products on the website to see it." : "Product saved on the server and hidden from the website.");
      if (close) setEditing(null);
    } catch (e) {
      const message = e instanceof TypeError
        ? "Could not connect to the server. Check your connection and try again."
        : e instanceof Error ? e.message : "Unable to save the product. Please try again.";
      setError(message);
      setProductError(message);
    }
    finally { setBusy(false); }
  }
  async function uploadProductFiles(files: File[], kind: "images" | "pdf") {
    if (!editing || !files.length) return;
    if (kind === "images" && files.length > 10) { setError("Choose up to 10 product images."); return; }
    const editingId = editing.id;
    setBusy(true); setError("");
    try {
      const urls: string[] = [];
      for (const file of files) {
        const response = await fetch("/api/admin/product-media", { method: "POST", headers: { "Content-Type": file.type || (kind === "pdf" ? "application/pdf" : "application/octet-stream") }, body: file });
        const data = await response.json();
        if (!response.ok) throw new Error(data.message);
        urls.push(data.url);
      }
      setEditing(current => current?.id === editingId ? { ...current, ...(kind === "images" ? { images: urls } : { pdf: urls[0] }) } : current);
    } catch (e) { setError(e instanceof Error ? e.message : "File upload failed."); }
    finally { setBusy(false); }
  }
  function categoriesChanged(next: WebCategory[]) {
    if (mode === "local")
      localStorage.setItem("inox-web-category-drafts", JSON.stringify(next));
    setWebCategories(next);
  }
  function save(next: Draft[]) {
    try {
      localStorage.setItem("inox-admin-drafts", JSON.stringify(next));
      setDrafts(next);
    } catch {
      setError(
        "Device storage is full. Export your draft data before continuing.",
      );
    }
  }
  async function login(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const form = new FormData(e.currentTarget);
      const r = await fetch("/api/admin/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(Object.fromEntries(form)),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.message);
      setNotice(
        "Signed in to website administration. Publish products to make them visible on the website.",
      );
      setMode("live");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to sign in.");
    } finally {
      setBusy(false);
    }
  }
  if (mode === "login")
    return (
      <main className="admin-login">
        <section className="admin-login-story">
          <Link className="brand" href="/">
            <BrandLogo priority />
          </Link>
          <div>
            <span className="eyebrow">The details behind the design</span>
            <h1>
              A considered space.
              <br />
              For everything <mark className="inox-word">INOX</mark>.
            </h1>
            <p>One workspace for your products, imagery and everything in between.</p>
            <div className="admin-login-features"><span><Package size={17} /> Curate your collection</span><span><Images size={17} /> Shape your website</span><span><ShieldCheck size={17} /> Secure administrator access</span></div>
          </div>
          <Link className="text-link" href="/">
            <ArrowLeft size={16} /> Back to website
          </Link>
        </section>
        <section className="admin-login-form">
          <form onSubmit={login}>
            <span className="eyebrow">
              <mark className="inox-word">INOX</mark> administration
            </span>
            <div className="admin-login-lock"><ShieldCheck size={24} /></div>
            <h2>Welcome back.</h2>
            <p>
              Sign in with your website administrator account.
            </p>
            <label>
              Email address
              <input
                type="email"
                name="email"
                autoComplete="username"
                required
                maxLength={254}
              />
            </label>
            <label>
              Password
              <input
                type="password"
                name="password"
                autoComplete="current-password"
                required
                maxLength={256}
              />
            </label>
            <button className="button dark" disabled={busy}>
              {busy ? "Signing in…" : "Sign in securely"}
            </button>
            {error && (
              <p role="alert" className="form-error">
                <HighlightInox text={error} />
              </p>
            )}
          </form>
        </section>
      </main>
    );
  const productPath = (d:Draft) => categoryPath(webCategories,d.subcategory || d.category);
  const categoryLabel = (d:Draft) => productPath(d).map(c=>c.name).join(' / ') || 'Uncategorized';
  const matchesCategory = (d:Draft, id:string) => id==='uncategorized' ? !productPath(d).length : isWithinCategory(webCategories,d.subcategory || d.category,id);
  const searched = drafts.filter(d=>`${d.name} ${d.sku} ${categoryLabel(d)}`.toLowerCase().includes(search.toLowerCase()));
  const filtered = searched.filter(d=>!productCategory || matchesCategory(d,productCategory)).sort((a,b)=>categoryLabel(a).localeCompare(categoryLabel(b)) || a.name.localeCompare(b.name));
  const activeRoot = categoryPath(webCategories,productCategory)[0];
  const uncategorizedCount = drafts.filter(d=>!productPath(d).length).length;
  return (
    <div className="admin-app">
      <aside className={`admin-sidebar${mobileNavOpen ? " admin-nav-open" : ""}`}>
        <Link className="brand admin-brand" href="/">
          <div className="admin-brand-emblem"><BrandLogo /></div>
          <div className="admin-brand-wordmark"><strong>INOX<span>DECOR</span></strong><small>Administration</small></div>
        </Link>
        <button type="button" className="admin-mobile-toggle" aria-controls="admin-navigation" aria-expanded={mobileNavOpen} onClick={() => setMobileNavOpen(!mobileNavOpen)}>
          {mobileNavOpen ? <X size={20} /> : <Menu size={20} />}<span>{mobileNavOpen ? "Close menu" : "Menu"}</span>
        </button>
        <nav id="admin-navigation" aria-label="Administration">
          {[
            { name: "Catalogue", items: [["Products", Package], ["Categories", FolderTree], ["Product Prices", BadgeIndianRupee], ["Bulk import", Upload]] },
            { name: "Website & media", items: [["Home Section", House], ["Blogs", BookOpen], ["Events", Images], ["Image Studio", Images], ["Catalogues", BookOpen]] },
            { name: "Customers", items: [["Enquiries", Inbox], ["Website Customers", UsersRound]] },
          ].map(group => <div className="admin-nav-group" key={group.name}>
            <span className="admin-nav-label">{group.name}</span>
            {group.items.map(([label, Icon]) => {
              const I = Icon as typeof Package;
              return <button type="button" key={String(label)} className={tab === label ? "active" : ""} aria-current={tab === label ? "page" : undefined} onClick={() => {
                setTab(String(label)); setError(""); setNotice(""); setMobileNavOpen(false);
              }}><I size={18} strokeWidth={1.7} /><span>{String(label)}</span>{tab === label && <ChevronRight className="admin-nav-chevron" size={15} />}</button>;
            })}
          </div>)}
        </nav>
        <div className="admin-sidebar-footer">
          <Link href="/" className="admin-site-link"><ArrowUpRight size={17} />View website</Link>
          <div className="admin-account"><span className="admin-avatar">AD</span><div><strong>Administrator</strong><small>{mode === "live" ? "Website workspace" : "Local workspace"}</small></div>
            <button type="button" aria-label="Sign out" title="Sign out" onClick={async () => { await fetch("/api/admin/session", { method: "DELETE" }); setMode("login"); }}><LogOut size={18} /></button>
          </div>
        </div>
      </aside>
      <main className="admin-main" id="main">
        <header className="admin-top">
          <div className="admin-breadcrumb"><LayoutDashboard size={16} /><span>Workspace</span><ChevronRight size={13} /><strong>{tab}</strong></div>
          <div className="admin-top-actions"><span className="admin-session-indicator"><span />{mode === "live" ? "Connected" : "Local drafts"}</span><span className="admin-top-avatar" aria-label="Administrator">AD</span></div>
        </header>
        <div className="admin-content">
          <div className="admin-title">
            <div>
              <span className="eyebrow admin-page-kicker">INOX / BRAND WORKSPACE</span>
              <h1>{tab}</h1>
            </div>
            {tab === "Products" && (
              <button
                className="button dark"
                onClick={() => {
                  setEditing({ ...blank, id: crypto.randomUUID(), category: categories[0]?.id || "" });
                  setError("");
                }}
              >
                <Plus size={17} />
                Add product
              </button>
            )}
          </div>
          <p className="integration-note">
            {{
              Products: "Your collection, beautifully organised. Add, edit and publish products in one place.",
              Categories: "Bring structure to your collection with clear categories and subcategories.",
              "Product Prices": "Manage pricing, make bulk adjustments and review your price history.",
              "Bulk import": "Grow your catalogue with a simple, guided spreadsheet import.",
              "Home Section": "Set the scene. Curate the images and framing across your homepage.",
              Blogs: "Create and publish stories with a cover image, headings and paragraphs.",
              "Image Studio": "A dedicated space to refine your product and variation photography.",
              Catalogues: "Organise your digital catalogues and the collections they belong to.",
              Enquiries: "Keep track of incoming conversations and new project possibilities.",
              "Website Customers": "Your customer directory, with account activity in one place.",
            }[tab]}
          </p>
          {notice && (
            <p className="form-feedback" role="status">
              <HighlightInox text={notice} />
            </p>
          )}
          {error && (
            <p className="form-error" role="alert">
              <HighlightInox text={error} />
            </p>
          )}
          {tab === "Home Section" && (mode === "live" ? <HomeImagesAdmin /> : <p className="table-panel padded">Sign in to manage live homepage images.</p>)}
          {tab === "Events" && (mode === "live" ? <EventsAdmin /> : <p className="table-panel padded">Sign in to manage live event galleries.</p>)}
          {tab === "Blogs" && (mode === "live" ? <BlogsAdmin /> : <p className="table-panel padded">Sign in to create and manage blogs.</p>)}
          <div hidden={tab !== "Image Studio"}>
            {mode === "live" ? <AdminImageStudio products={drafts} onSaved={loadProducts}/> : tab === "Image Studio" && <p className="table-panel padded">Sign in to manage and save catalogue images.</p>}
          </div>
          {tab === "Website Customers" && <WebsiteCustomers />}
          {tab === "Product Prices" && <ProductPricesAdmin products={websiteProducts} />}
          {tab === "Categories" && (
            <CategoryManager
              products={websiteProducts}
              live={mode === "live"}
              categories={webCategories}
              onChange={categoriesChanged}
              onSaved={loadProducts}
              draftReferences={drafts}
            />
          )}
          {tab === "Products" && (
            <>
              <div className="admin-stats">
                <div>
                  <span><Package size={17} /> Total products</span>
                  <strong>{drafts.length}</strong>
                </div>
                <div>
                  <span><Check size={17} /> Live on website</span>
                  <strong>
                    {drafts.filter((d) => d.version && d.webVisible).length}
                  </strong>
                </div>
                <div>
                  <span><FolderTree size={17} /> Categories</span>
                  <strong>{webCategories.length}</strong>
                </div>
              </div>
              <section className="admin-category-browser" aria-labelledby="admin-category-heading">
                <div className="admin-category-intro"><div><h2 id="admin-category-heading">Browse by category</h2><p>Choose a collection to manage its products and subcategories.</p></div><span>{filtered.length} of {drafts.length} products</span></div>
                <div className="admin-category-options" role="group" aria-label="Product categories">
                  <button type="button" aria-pressed={!productCategory} onClick={()=>{setProductCategory('');setSelected([]);}}><span>All products</span><strong>{drafts.length}</strong></button>
                  {categories.map(category=><button type="button" key={category.id} aria-pressed={activeRoot?.id===category.id} onClick={()=>{setProductCategory(category.id);setSelected([]);}}><span>{category.name}</span><strong>{drafts.filter(d=>matchesCategory(d,category.id)).length}</strong></button>)}
                  {uncategorizedCount>0 && <button type="button" aria-pressed={productCategory==='uncategorized'} onClick={()=>{setProductCategory('uncategorized');setSelected([]);}}><span>Uncategorized</span><strong>{uncategorizedCount}</strong></button>}
                </div>
                {activeRoot && webCategories.some(c=>c.id!==activeRoot.id && isWithinCategory(webCategories,c.id,activeRoot.id)) && <label className="admin-subcategory-filter">Subcategory<select aria-label="Filter product subcategory" value={productCategory} onChange={e=>{setProductCategory(e.target.value);setSelected([]);}}><option value={activeRoot.id}>All {activeRoot.name}</option>{webCategories.filter(c=>c.id!==activeRoot.id && isWithinCategory(webCategories,c.id,activeRoot.id)).map(c=><option key={c.id} value={c.id}>{categoryPath(webCategories,c.id).slice(1).map(part=>part.name).join(' / ')}</option>)}</select></label>}
              </section>
              <div className="table-panel">
                <div className="catalogue-toolbar">
                  <label className="search">
                    <Search size={17} />
                    <input
                      placeholder="Search products, SKU or category"
                      value={search}
                      onChange={(e) => {setSearch(e.target.value);setSelected([]);}}
                      aria-label="Search drafts"
                    />
                  </label>
                  <button
                    className="button outline"
                    onClick={() =>
                      download(
                        "inox-product-drafts.json",
                        JSON.stringify(drafts, null, 2),
                        "application/json",
                      )
                    }
                  >
                    <Download size={16} />
                    Export drafts
                  </button>
                </div>
                {selected.length > 0 && (
                  <div className="bulk-actions">
                    <span>{selected.length} selected</span>
                    <button
                      onClick={() => {
                        save(
                          drafts.map((d) =>
                            selected.includes(d.id) && !d.version
                              ? { ...d, status: "Ready" }
                              : d,
                          ),
                        );
                        setSelected([]);
                      }}
                    >
                      Mark ready
                    </button>
                    <button
                      onClick={() => {
                        save(
                          drafts.map((d) =>
                            selected.includes(d.id) && !d.version
                              ? { ...d, status: "Draft" }
                              : d,
                          ),
                        );
                        setSelected([]);
                      }}
                    >
                      Return to draft
                    </button>
                  </div>
                )}
                <div className="table-scroll">
                  <table>
                    <thead>
                      <tr>
                        <th>
                          <input
                            type="checkbox"
                            aria-label="Select all visible products"
                            checked={
                              filtered.some(d => !d.version) &&
                              filtered.filter(d => !d.version).every((d) => selected.includes(d.id))
                            }
                            onChange={(e) =>
                              setSelected(
                                e.target.checked
                                  ? filtered.filter(d => !d.version).map((d) => d.id)
                                  : [],
                              )
                            }
                          />
                        </th>
                        <th>Product / SKU</th>
                        <th>Category</th>
                        <th>Status</th>
                        <th>Channels</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.map((d,index) => (
                        <Fragment key={d.id}>
                        {(index===0 || categoryLabel(filtered[index-1])!==categoryLabel(d)) && <tr className="admin-category-group"><th colSpan={6} scope="rowgroup"><span>{categoryLabel(d)}</span><small>{filtered.filter(product=>categoryLabel(product)===categoryLabel(d)).length} products</small></th></tr>}
                        <tr key={d.id}>
                          <td>
                            <input
                              type="checkbox"
                              aria-label={`Select ${d.name}`}
                              disabled={Boolean(d.version)}
                              checked={selected.includes(d.id)}
                              onChange={(e) =>
                                setSelected(
                                  e.target.checked
                                    ? [...selected, d.id]
                                    : selected.filter((id) => id !== d.id),
                                )
                              }
                            />
                          </td>
                          <td>
                            <div className="admin-product-summary">
                              <div className="admin-product-thumbnail">
                                <Package size={24} aria-hidden="true" />
                                {d.images[0] && <img
                                  key={d.images[0]}
                                  src={d.images[0].startsWith("/api/web/product-media/") ? adminMediaUrl(d.images[0]) : d.images[0]}
                                  alt={`${d.name} cover photo`}
                                  width={64}
                                  height={64}
                                  loading="lazy"
                                  onError={(event) => { event.currentTarget.style.display = "none"; }}
                                />}
                              </div>
                              <div>
                                <strong>{d.name}</strong>
                                <small>{d.sku}</small>
                              </div>
                            </div>
                          </td>
                          <td>
                            {categoryLabel(d)}
                          </td>
                          <td>
                            <span className="status-tag" data-status={d.status.toLowerCase()}>{d.status}</span>
                          </td>
                          <td>
                            {[d.webVisible && "Web", d.appVisible && "App"]
                              .filter(Boolean)
                              .join(" · ") || "None"}
                          </td>
                          <td className="admin-actions">
                            <button
                              className="admin-action"
                              onClick={() => {
                                setEditing(d);
                                setError("");
                              }}
                            >
                              Edit
                            </button>
                            <button className="admin-action" disabled={busy || !productsLoaded} onClick={() => publishProduct({ ...d, webVisible: d.version ? !d.webVisible : true })}>
                              {d.version ? (d.webVisible ? "Unpublish" : "Publish") : "Publish to website"}
                            </button>
                            {d.version && <a className="admin-action" href={`/products/${d.id}`} target="_blank" rel="noreferrer">View product</a>}
                            {!d.version && <button
                              className="admin-action danger"
                              onClick={() => {
                                if (
                                  window.confirm(
                                    `Remove local draft “${d.name}”?`,
                                  )
                                ) {
                                  save(drafts.filter((x) => x.id !== d.id));
                                  setSelected(
                                    selected.filter((id) => id !== d.id),
                                  );
                                }
                              }}
                            >
                              Remove local draft
                            </button>}
                          </td>
                        </tr>
                        </Fragment>
                      ))}
                    </tbody>
                  </table>
                </div>
                {!filtered.length && (
                  <div className="empty-state">
                    <Package size={30} />
                    <h3>
                      {search || productCategory
                        ? "No products match these filters."
                        : "Your collection begins here."}
                    </h3>
                    <p>{search || productCategory ? 'Try another category or clear your search.' : 'Add a product or prepare a bulk import.'}</p>
                  </div>
                )}
              </div>
            </>
          )}
          {tab === "Bulk import" && mode === "live" && <CatalogueImport categories={webCategories} onSaved={loadProducts}/>}
          {tab === "Bulk import" && mode === "local" && (
            <div className="admin-panels">
              <section className="table-panel padded">
                <span className="eyebrow">01 / Product records</span>
                <h2>From spreadsheet to collection.</h2>
                <p>
                  Export Excel as UTF-8 CSV. Required columns: sku, name,
                  category. Preview every row before saving valid rows as local
                  drafts.
                </p>
                <button
                  className="button outline"
                  onClick={() =>
                    download(
                      "inox-import-template.csv",
                      importHeaders.join(",") + "\r\n",
                    )
                  }
                >
                  <Download size={16} />
                  Download template
                </button>
                <label className="upload-zone">
                  <Upload />
                  <strong>Choose a CSV file</strong>
                  <span>Up to 2 MB · 2,000 rows</span>
                  <input
                    type="file"
                    accept=".csv,text/csv"
                    onChange={async (e) => {
                      setError("");
                      setImports([]);
                      const f = e.target.files?.[0];
                      if (!f) return;
                      try {
                        if (f.size > 2 * 1024 * 1024)
                          throw new Error("CSV must be smaller than 2 MB.");
                        setImports(
                          validateImport(
                            await f.text(),
                            drafts.map((d) => d.sku),
                            webCategories,
                          ),
                        );
                      } catch (err) {
                        setError(
                          err instanceof Error ? err.message : "Invalid file",
                        );
                      }
                    }}
                  />
                </label>
                {imports.length > 0 && (
                  <>
                    <p>
                      {imports.filter((r) => !r.errors.length).length} valid ·{" "}
                      {imports.filter((r) => r.errors.length).length} invalid.
                      Invalid rows will be skipped.
                    </p>
                    <div className="table-scroll">
                      <table>
                        <thead>
                          <tr>
                            <th>Row</th>
                            <th>SKU</th>
                            <th>Name</th>
                            <th>Validation</th>
                          </tr>
                        </thead>
                        <tbody>
                          {imports.map((r) => (
                            <tr key={r.row}>
                              <td>{r.row}</td>
                              <td>{r.value.sku}</td>
                              <td>{r.value.name}</td>
                              <td>{r.errors.join("; ") || "Ready"}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <div className="form-actions">
                      <button
                        className="button dark"
                        disabled={!imports.some((r) => !r.errors.length)}
                        onClick={() => {
                          const valid = imports.filter((r) => !r.errors.length);
                          save([
                            ...drafts,
                            ...valid.map((r) => ({
                              ...blank,
                              id: crypto.randomUUID(),
                              sku: r.value.sku,
                              name: r.value.name,
                              category: r.value.category,
                              subcategory: r.value.subcategory || "",
                              description: r.value.description || "",
                              finish: r.value.finish || "",
                              featured: r.value.featured === "true",
                              webVisible: r.value.webVisible !== "false",
                              appVisible: false,
                            })),
                          ]);
                          setImports([]);
                          setNotice(
                            `${valid.length} local drafts saved. No products have been published.`,
                          );
                        }}
                      >
                        <Check size={16} />
                        Confirm valid rows as drafts
                      </button>
                      <button
                        className="button outline"
                        onClick={() =>
                          download(
                            "inox-import-errors.csv",
                            [
                              ["row", "sku", "errors"].map(csvCell).join(","),
                              ...imports
                                .filter((r) => r.errors.length)
                                .map((r) =>
                                  [r.row, r.value.sku, r.errors.join("; ")]
                                    .map(csvCell)
                                    .join(","),
                                ),
                            ].join("\r\n"),
                          )
                        }
                      >
                        Export errors
                      </button>
                    </div>
                  </>
                )}
              </section>
              <section className="table-panel padded">
                <span className="eyebrow">02 / Product images</span>
                <h2>Match images to SKUs.</h2>
                <p>
                  Use SKU.jpg or SKU__02.jpg for multiple images. This step
                  validates filenames; remote upload is awaiting integration.
                </p>
                <input
                  type="file"
                  multiple
                  accept="image/jpeg,image/png,image/webp"
                  aria-label="Select images to match"
                  onChange={(e) =>
                    setMatched(
                      Array.from(e.target.files || []).map((f) => ({
                        name: f.name,
                        sku:
                          f.size <= 8 * 1024 * 1024 &&
                          ["image/jpeg", "image/png", "image/webp"].includes(
                            f.type,
                          )
                            ? matchImage(
                                f.name,
                                drafts.map((d) => d.sku),
                              )
                            : null,
                      })),
                    )
                  }
                />
                {matched.map((m, i) => (
                  <p key={i}>
                    {m.name} —{" "}
                    {m.sku ? `Matched: ${m.sku}` : "Unmatched or invalid file"}
                  </p>
                ))}
              </section>
            </div>
          )}
          {tab === "Catalogues" && (
            <section className="table-panel padded">
              <h2>Collection documents.</h2>
              <p>
                Select multiple PDFs to prepare an upload list. File contents
                are not uploaded or saved in this local workspace.
              </p>
              <label className="upload-zone">
                <Files />
                <strong>Select catalogue PDFs</strong>
                <span>Maximum 50 MB per file</span>
                <input
                  type="file"
                  multiple
                  accept="application/pdf,.pdf"
                  onChange={async (e) => {
                    const valid = [];
                    const errors = [];
                    for (const f of Array.from(e.target.files || [])) {
                      const magic = await f.slice(0, 5).text();
                      if (f.size > 50 * 1024 * 1024 || magic !== "%PDF-")
                        errors.push(f.name);
                      else
                        valid.push({
                          name: f.name.replace(/\.pdf$/i, ""),
                          category: "kitchen",
                          published: false,
                        });
                    }
                    setCatalogues([...catalogues, ...valid]);
                    setError(
                      errors.length ? `Invalid PDFs: ${errors.join(", ")}` : "",
                    );
                  }}
                />
              </label>
              {catalogues.map((c, i) => (
                <div className="catalogue-edit" key={i}>
                  <label>
                    Title
                    <input
                      value={c.name}
                      onChange={(e) =>
                        setCatalogues(
                          catalogues.map((v, n) =>
                            n === i ? { ...v, name: e.target.value } : v,
                          ),
                        )
                      }
                    />
                  </label>
                  <label>
                    Category
                    <select
                      value={c.category}
                      onChange={(e) =>
                        setCatalogues(
                          catalogues.map((v, n) =>
                            n === i ? { ...v, category: e.target.value } : v,
                          ),
                        )
                      }
                    >
                      {categories.map((c) => (
                        <option value={c.id} key={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <span className="status-tag">Pending upload</span>
                  <button
                    className="icon-button"
                    aria-label={`Remove ${c.name}`}
                    onClick={() =>
                      setCatalogues(catalogues.filter((_, n) => n !== i))
                    }
                  >
                    <X size={17} />
                  </button>
                </div>
              ))}
            </section>
          )}
          {tab === "Enquiries" && <WebsiteEnquiriesAdmin />}
        </div>
      </main>
      <dialog
        ref={productErrorDialog}
        className="admin-product-error-dialog"
        aria-labelledby="product-error-title"
        aria-describedby="product-error-description"
        onClose={() => setProductError("")}
      >
        <button type="button" className="admin-product-error-close" aria-label="Close error popup" onClick={() => setProductError("")}><X size={20} /></button>
        <div className="admin-product-error-symbol"><AlertCircle size={28} /></div>
        <h2 id="product-error-title">We couldn’t save this product</h2>
        <p id="product-error-description">{productError}</p>
        <p className="admin-product-error-hint">Your entries are still here. Review the issue above, then try again.</p>
        <button type="button" className="admin-product-error-confirm" autoFocus onClick={() => setProductError("")}>Got it, review product</button>
      </dialog>
      {editing && (
        <DraftDrawer onClose={() => { if (!busy) setEditing(null); }}>
          <ProductUploadEditor
            product={editing} categories={webCategories} busy={busy} ready={productsLoaded}
            error={error} onChange={setEditing} onBusyChange={setBusy}
            onClose={() => setEditing(null)} onUpload={uploadProductFiles}
            onSubmit={product => publishProduct(product, true)}
            onSaveLocal={!editing.version ? () => { save([...drafts.filter(d => d.id !== editing.id), editing]); setEditing(null); setNotice("Local draft saved on this device. Publish it when ready."); } : undefined}
          />
        </DraftDrawer>
      )}
    </div>
  );
}
