"use client";
import {
  categoryPath,
  isWithinCategory,
  orderCategoryImports,
  moveCategoryOrder,
} from "@/lib/category-tree.mjs";
import { useEffect, useRef, useState } from "react";
import { Plus, Download, RefreshCw, ImagePlus, GripVertical, X } from "lucide-react";
import { products as referenceProducts, type Product } from "@/lib/data";
import type { WebCategory, CategoryInput } from "@/lib/web-taxonomy-model";
import { flattenCategories } from "@/lib/web-taxonomy-model";
import { validateCategory } from "@/lib/web-taxonomy-validation.mjs";
import { parseCSV, csvCell } from "@/lib/import.mjs";
import { useWebTaxonomy } from "./web-taxonomy-provider";
import { DraftDrawer } from "./draft-drawer";
import { HighlightInox } from "./highlight-inox";
import { AdminImageEditor, uploadAdminImage } from "./admin-image-editor";
type PreviewRow = {
  row: number;
  value: Record<string, unknown>;
  errors: string[];
};
const empty: CategoryInput = {
  name: "",
  slug: "",
  short: "",
  parentId: null,
  description: "",
  image: "",
  published: false,
  sortOrder: 0,
};
const csvHeaders = [
  "name",
  "slug",
  "parentSlug",
  "description",
  "published",
  "sortOrder",
];
const slugify = (name: string) =>
  name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
function download(filename: string, content: string) {
  const url = URL.createObjectURL(
    new Blob([content], { type: "text/csv;charset=utf-8" }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
export function CategoryManager({
  live,
  categories,
  onChange,
  onSaved,
  draftReferences,
  products = referenceProducts,
}: {
  live: boolean;
  products?: Product[];
  categories: WebCategory[];
  onChange: (categories: WebCategory[]) => void;
  onSaved?: () => Promise<void>;
  draftReferences: { category: string; subcategory?: string }[];
}) {
  const [cropImage, setCropImage] = useState<string | null>(null);
  const [transferSource, setTransferSource] = useState("");
  const [transferDestination, setTransferDestination] = useState("");
  const transferCount = products.filter(p => {
    const assigned = p.category;
    return assigned !== transferDestination && (transferSource === "*" || isWithinCategory(categories, assigned, transferSource));
  }).length;
  const [editing, setEditing] = useState<
      (CategoryInput & { id?: string; version?: number }) | null
    >(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [rows, setRows] = useState<PreviewRow[]>([]),
    [assignments, setAssignments] = useState<Record<string, string>>({});
  const [dragging, setDragging] = useState<string | null>(null);
  const [dropPosition, setDropPosition] = useState<string | null>(null);
  const drag = useRef<{ category: WebCategory; destination: string | null } | null>(null);
  const { refresh } = useWebTaxonomy();
  useEffect(() => { setCropImage(null); }, [editing?.id, editing === null]);
  const roots = categories.filter((c) => !c.parentId);
  async function load() {
    setError("");
    try {
      const response = await fetch("/api/admin/web-categories", {
          cache: "no-store",
        }),
        data = await response.json();
      if (!response.ok) throw new Error(data.message);
      onChange(data.categories);
      setAssignments(data.assignments);
      await onSaved?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load categories.");
    }
  }
  useEffect(() => {
    if (live) void load();
    if (!live) return;
    const reload = () => { void load(); };
    window.addEventListener("focus", reload);
    return () => window.removeEventListener("focus", reload);
  }, [live]);
  function validatePreview(input: unknown, id?: string) {
    const data = validateCategory(input);
    if (data.parentId) {
      const parent = categories.find((c) => c.id === data.parentId);
      if (!parent || (id && isWithinCategory(categories, parent.id, id)))
        throw new Error(
          "Choose a parent outside this category and its descendants.",
        );
    }
    if (
      categories.some(
        (c) =>
          c.id !== id &&
          (c.slug === data.slug ||
            (c.parentId === data.parentId &&
              c.name.toLowerCase() === data.name.toLowerCase())),
      )
    )
      throw new Error("This slug or sibling category name already exists.");
    return data;
  }
  async function mutate(body: Record<string, unknown>) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      if (live) {
        const response = await fetch("/api/admin/web-categories", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          }),
          data = await response.json();
        if (!response.ok) throw new Error(data.message);
        onChange(data.categories);
        setAssignments(data.assignments);
        await refresh();
        await onSaved?.();
        setNotice(
          body.operation === "transfer"
            ? `${data.transferred} products transferred. Products and website categories are now updated.`
            : "Website categories saved. Published changes are now available on the web catalogue.",
        );
      } else {
        let next = [...categories];
        if (body.operation === "move") {
          const ordered = moveCategoryOrder(categories, body.id as string, body.direction as string, body.version as number);
          next = next.map(c => {
            const moved = ordered.find(row => row.id === c.id);
            return moved ? { ...moved, version: c.version + 1 } : c;
          });
        }
        if (body.operation === "create" || body.operation === "update") {
          const id = body.id as string | undefined;
          const data = validatePreview(body.category, id);
          next = id
            ? next.map((c) =>
                c.id === id ? { ...data, id, version: c.version + 1 } : c,
              )
            : [...next, { ...data, id: crypto.randomUUID(), version: 1 }];
        }
        if (body.operation === "delete") {
          if (
            categories.some((c) => c.parentId === body.id) ||
            draftReferences.some(
              (d) => d.category === body.id || d.subcategory === body.id,
            ) ||
            products.some((p) => (assignments[p.id] || p.category) === body.id)
          )
            throw new Error(
              "Reassign products and remove subcategories before deletion.",
            );
          next = next.filter((c) => c.id !== body.id);
        }
        if (body.operation === "import") {
          const imported = body.rows as Record<string, unknown>[];
          for (const row of orderCategoryImports(imported, next)) {
            const parent = row.parentSlug
              ? next.find((c) => c.slug === row.parentSlug)
              : null;
            if (row.parentSlug && !parent)
              throw new Error("Unknown parent slug.");
            const data = validateCategory({
              ...row,
              parentId: parent?.id ?? null,
            });
            if (
              next.some(
                (c) =>
                  c.slug === data.slug ||
                  (c.parentId === data.parentId &&
                    c.name.toLowerCase() === data.name.toLowerCase()),
              )
            )
              throw new Error("Duplicate category in import.");
            next.push({ ...data, id: crypto.randomUUID(), version: 1 });
          }
        }
        onChange(next);
        setNotice(
          "Local category draft saved on this browser. Sign in to publish changes to the website.",
        );
      }
      setEditing(null);
      setRows([]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to save categories.");
    } finally {
      setBusy(false);
    }
  }
  async function upload(file: File) {
    setBusy(true);
    setError("");
    try {
      if (file.size > 8 * 1024 * 1024)
        throw new Error("Choose an image up to 8 MB.");
      const response = await fetch("/api/admin/web-categories/uploads", {
          method: "POST",
          headers: { "Content-Type": file.type },
          body: file,
        }),
        data = await response.json();
      if (!response.ok) throw new Error(data.message);
      setEditing((current) =>
        current ? { ...current, image: data.url } : current,
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed.");
    } finally {
      setBusy(false);
    }
  }
  async function preview(file: File) {
    setError("");
    setRows([]);
    try {
      if (file.size > 2 * 1024 * 1024)
        throw new Error("Use a CSV smaller than 2 MB.");
      const parsed = parseCSV(await file.text()),
        headers = parsed.shift()?.map((h) => h.trim());
      if (!headers?.includes("name") || !headers.includes("slug"))
        throw new Error("CSV requires name and slug columns.");
      if (
        new Set(headers).size !== headers.length ||
        parsed.length > 500 ||
        !parsed.length
      )
        throw new Error("Use unique headers and between 1 and 500 rows.");
      const seen = new Set(categories.map((c) => c.slug));
      const seenNames = new Set(
        categories.map(
          (c) =>
            `${categories.find((p) => p.id === c.parentId)?.slug || ""}:${c.name.toLowerCase()}`,
        ),
      );
      const result = parsed.map((values, index) => {
        const row = Object.fromEntries(
          headers.map((h, i) => [h, values[i]?.trim() || ""]),
        );
        const value: Record<string, unknown> = {
          ...row,
          short: "",
          image: "",
          published: row.published === "true",
          sortOrder: row.sortOrder ? Number(row.sortOrder) : 0,
          parentId: null,
        };
        const errors: string[] = [];
        if (values.length !== headers.length)
          errors.push("Column count mismatch");
        if (row.published && !["true", "false"].includes(row.published))
          errors.push("published must be true or false");
        try {
          validateCategory(value);
        } catch (e) {
          errors.push(e instanceof Error ? e.message : "Invalid category");
        }
        if (seen.has(row.slug)) errors.push("Duplicate slug");
        seen.add(row.slug);
        const siblingKey = `${row.parentSlug || ""}:${(row.name || "").toLowerCase()}`;
        if (seenNames.has(siblingKey))
          errors.push("Duplicate name within this parent");
        seenNames.add(siblingKey);
        return { row: index + 2, value, errors };
      });
      const available = new Set(categories.map((c) => c.slug));
      let pending = result.filter((r) => !r.errors.length);
      while (pending.length) {
        const ready = pending.filter(
          (r) =>
            !r.value.parentSlug || available.has(String(r.value.parentSlug)),
        );
        if (!ready.length) {
          pending.forEach((r) =>
            r.errors.push("Unknown parent slug or circular hierarchy"),
          );
          break;
        }
        ready.forEach((r) => available.add(String(r.value.slug)));
        pending = pending.filter((r) => !ready.includes(r));
      }
      setRows(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to read CSV.");
    }
  }
  return (
    <div className="category-management">
      <div className="integration-note">
        <HighlightInox
          text={
            live
              ? "Live website categories. These records and images belong only to this website; mobile app categories are untouched."
              : "Local preview only. Create category drafts here, or sign in with your INOX administrator account to publish website changes."
          }
        />
      </div>
      <div className="category-actions">
        <button
          className="button dark"
          disabled={busy}
          onClick={() => {
            setEditing({ ...empty });
            setError("");
          }}
        >
          <Plus size={16} />
          Add category
        </button>
        <button
          className="button outline"
          disabled={busy || !roots.length}
          onClick={() => {
            setEditing({ ...empty, parentId: roots[0].id });
            setError("");
          }}
        >
          <Plus size={16} />
          Add subcategory
        </button>
        {live && (
          <button
            className="button outline"
            disabled={busy}
            onClick={() => void load()}
          >
            <RefreshCw size={15} />
            Refresh
          </button>
        )}
      </div>
      {notice && (
        <p className="form-feedback" role="status">
          <HighlightInox text={notice} />
        </p>
      )}
      {error && !editing && (
        <p className="form-error" role="alert">
          <HighlightInox text={error} />
        </p>
      )}
      <p className="data-note" id="category-drag-help">Drag the grip to reorder categories within the same parent. Release to save automatically. Keyboard: use the grip's Up and Down arrow keys.</p>
      <section className="table-panel">
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Category / slug</th>
                <th>Parent</th>
                <th>Order</th>
                <th>Website status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {flattenCategories(categories).map((c) => {
                const parent = categories.find((p) => p.id === c.parentId);
                const siblings = flattenCategories(categories).filter(p => p.parentId === c.parentId);
                const position = siblings.findIndex(p => p.id === c.id);
                return (
                  <tr key={c.id} data-category-row={c.id}
                    className={[dragging === c.id ? "category-dragging" : "", dropPosition === `before:${c.id}` ? "category-drop-before" : "", dropPosition === `after:${c.id}` ? "category-drop-after" : ""].join(" ")}>
                    <td>
                      <strong className={c.parentId ? "category-child" : ""}>
                        {"\u2014 ".repeat(
                          Math.max(
                            0,
                            categoryPath(categories, c.id).length - 1,
                          ),
                        )}
                        {c.name}
                      </strong>
                      <small>{c.slug}</small>
                    </td>
                    <td>{parent?.name || "Top level"}</td>
                    <td>
                      <button type="button" className="category-drag-handle"
                        aria-label={`Drag to reorder ${c.name}`} aria-describedby="category-drag-help"
                        disabled={busy || siblings.length < 2}
                        onKeyDown={event => {
                          if (event.key !== "ArrowUp" && event.key !== "ArrowDown") return;
                          event.preventDefault();
                          void mutate({ operation: "move", id: c.id, direction: event.key === "ArrowUp" ? "up" : "down", version: c.version });
                        }}
                        onPointerDown={event => {
                          if (busy || event.button !== 0) return;
                          event.preventDefault();
                          event.currentTarget.setPointerCapture(event.pointerId);
                          drag.current = { category: c, destination: null };
                          setDragging(c.id);
                        }}
                        onPointerMove={event => {
                          if (!drag.current) return;
                          const row = document.elementFromPoint(event.clientX, event.clientY)?.closest<HTMLElement>("[data-category-row]");
                          const target = categories.find(item => item.id === row?.dataset.categoryRow);
                          let destination: string | null = null;
                          if (row && target && target.id !== c.id && target.parentId === c.parentId) {
                            const bounds = row.getBoundingClientRect();
                            destination = `${event.clientY < bounds.top + bounds.height / 2 ? "before" : "after"}:${target.id}`;
                          }
                          drag.current.destination = destination;
                          setDropPosition(destination);
                          if (event.clientY > window.innerHeight - 70) window.scrollBy(0, 14);
                          else if (event.clientY < 100) window.scrollBy(0, -14);
                        }}
                        onPointerUp={() => {
                          const active = drag.current;
                          drag.current = null;
                          setDragging(null);
                          setDropPosition(null);
                          if (active?.destination) void mutate({ operation: "move", id: active.category.id, direction: active.destination, version: active.category.version });
                        }}
                        onLostPointerCapture={() => { drag.current = null; setDragging(null); setDropPosition(null); }}
                        onPointerCancel={() => { drag.current = null; setDragging(null); setDropPosition(null); }}>
                        <GripVertical size={20} aria-hidden="true" /><span>{position + 1}</span>
                      </button>
                    </td>
                    <td>
                      <span className="status-tag">
                        {!c.published
                          ? "Draft"
                          : parent && !parent.published
                            ? "Hidden by parent"
                            : "Published"}
                      </span>
                    </td>
                    <td className="admin-actions">
                      <button
                        className="admin-action"
                        disabled={busy}
                        onClick={() => {
                          setEditing(c);
                          setError("");
                        }}
                      >
                        Edit
                      </button>
                      <button
                        className="admin-action"
                        disabled={busy}
                        onClick={() =>
                          void mutate({
                            operation: "update",
                            id: c.id,
                            version: c.version,
                            category: { ...c, published: !c.published },
                          })
                        }
                      >
                        {c.published ? "Unpublish" : "Publish"}
                      </button>
                      <button
                        className="admin-action danger"
                        disabled={busy}
                        onClick={() => {
                          if (
                            window.confirm(
                              c.parentId && live
                                ? `Remove subcategory “${c.name}”? Its products will move to “${categoryPath(categories, c.id)[0]?.name}”. Remove any child subcategories first.`
                                : `Remove category “${c.name}”? Categories with products or subcategories cannot be removed.`,
                            )
                          )
                            void mutate({
                              operation: "delete",
                              id: c.id,
                              version: c.version,
                              confirmed: true,
                            });
                        }}
                      >
                        Remove
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
      {live && <section className="table-panel padded">
        <h2>Transfer all products</h2>
        <p>Move every product from a category and its subcategories to any category. Categories stay in place.</p>
        <form onSubmit={event => {
          event.preventDefault();
          void mutate({ operation: "transfer", sourceId: transferSource, destinationId: transferDestination });
        }}>
          <div className="category-actions">
            <label>From category
              <select required value={transferSource} disabled={busy} onChange={event => setTransferSource(event.target.value)}>
                <option value="">Choose source</option>
                <option value="*">All categories</option>
                {flattenCategories(categories).map(c => <option key={c.id} value={c.id}>{categoryPath(categories, c.id).map(p => p.name).join(" / ")}</option>)}
              </select>
            </label>
            <label>To category
              <select required value={transferDestination} disabled={busy} onChange={event => setTransferDestination(event.target.value)}>
                <option value="">Choose destination</option>
                {flattenCategories(categories).filter(c => c.id !== transferSource).map(c => <option key={c.id} value={c.id}>{categoryPath(categories, c.id).map(p => p.name).join(" / ")}{c.published ? "" : " (draft)"}</option>)}
              </select>
            </label>
            <button className="button dark" disabled={busy || !transferSource || !transferDestination || transferSource === transferDestination || !transferCount}>
              {busy ? "Saving…" : `Transfer ${transferCount} products`}
            </button>
          </div>
          {transferDestination && categoryPath(categories, transferDestination).some(c => !c.published) && <p className="data-note">The destination is unpublished. Transferred products will be hidden on the website until its category is published.</p>}
        </form>
      </section>}
      <section className="table-panel padded">
        <h2>Import categories & subcategories.</h2>
        <p>
          Use UTF-8 CSV. Parent slugs can refer to existing categories or new
          categories at any level in the same file. Preview first; invalid rows
          are skipped only when you confirm the valid rows.
        </p>
        <div className="category-actions">
          <button
            className="button outline"
            onClick={() =>
              download(
                "inox-web-categories-template.csv",
                csvHeaders.join(",") + "\r\n",
              )
            }
          >
            <Download size={15} />
            Category CSV template
          </button>
          <button
            className="button outline"
            onClick={() =>
              download(
                "inox-web-categories.csv",
                [
                  csvHeaders.map(csvCell).join(","),
                  ...flattenCategories(categories).map((c) =>
                    [
                      c.name,
                      c.slug,
                      categories.find((p) => p.id === c.parentId)?.slug || "",
                      c.description,
                      c.published,
                      c.sortOrder,
                    ]
                      .map(csvCell)
                      .join(","),
                  ),
                ].join("\r\n"),
              )
            }
          >
            Export categories
          </button>
          <label className="category-file-label">
            Choose category CSV
            <input
              type="file"
              accept=".csv,text/csv"
              disabled={busy}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void preview(file);
              }}
            />
          </label>
        </div>
        {rows.length > 0 && (
          <>
            <p>
              {rows.filter((r) => !r.errors.length).length} valid /{" "}
              {rows.filter((r) => r.errors.length).length} invalid rows
            </p>
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Row</th>
                    <th>Name</th>
                    <th>Slug</th>
                    <th>Parent slug</th>
                    <th>Validation</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.row}>
                      <td>{r.row}</td>
                      <td>{String(r.value.name)}</td>
                      <td>{String(r.value.slug)}</td>
                      <td>{String(r.value.parentSlug || "—")}</td>
                      <td>{r.errors.join("; ") || "Ready"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <button
              className="button dark"
              disabled={busy || !rows.some((r) => !r.errors.length)}
              onClick={() =>
                void mutate({
                  operation: "import",
                  rows: rows
                    .filter((r) => !r.errors.length)
                    .map((r) => r.value),
                })
              }
            >
              Confirm valid categories
            </button>
          </>
        )}
      </section>
      {live && (
        <section className="table-panel padded">
          <h2>Assign existing website products.</h2>
          <p>
            This changes only a website product’s category. Publish new products from the Products tab before assigning them here.
          </p>
          {products.map((p) => (
            <div className="category-assignment" key={p.id}>
              <label>
                {p.name}
                <select
                  value={assignments[p.id] || p.category}
                  onChange={(e) =>
                    setAssignments({ ...assignments, [p.id]: e.target.value })
                  }
                >
                  {flattenCategories(categories).map((c) => (
                    <option key={c.id} value={c.id}>
                      {categoryPath(categories, c.id)
                        .slice(0, -1)
                        .map((p) => p.name)
                        .join(" / ")}
                      {c.parentId ? " / " : ""}
                      {c.name}
                      {c.published ? "" : " (draft)"}
                    </option>
                  ))}
                </select>
              </label>
              <button
                className="button outline"
                disabled={busy}
                onClick={() =>
                  void mutate({
                    operation: "assign",
                    productId: p.id,
                    categoryId: assignments[p.id] || p.category,
                  })
                }
              >
                Save website assignment
              </button>
            </div>
          ))}
        </section>
      )}
      {editing && (
        <DraftDrawer onClose={() => !busy && setEditing(null)}>
          <section
            className="product-editor"
            aria-labelledby="category-editor-title"
          >
            <div className="admin-title">
              <h2 id="category-editor-title">
                {editing.id ? "Edit category" : "New category"}
              </h2>
              <button
                className="icon-button"
                disabled={busy}
                aria-label="Close category editor"
                onClick={() => setEditing(null)}
              >
                <X />
              </button>
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void mutate({
                  operation: editing.id ? "update" : "create",
                  id: editing.id,
                  version: editing.version,
                  category: editing,
                });
              }}
            >
              <label>
                Category name
                <input
                  autoFocus
                  required
                  maxLength={80}
                  value={editing.name}
                  onChange={(e) =>
                    setEditing({
                      ...editing,
                      name: e.target.value,
                      slug: editing.id ? editing.slug : slugify(e.target.value),
                    })
                  }
                />
              </label>
              <label>
                Slug
                <input
                  required
                  pattern="[a-z0-9]+(-[a-z0-9]+)*"
                  maxLength={80}
                  value={editing.slug}
                  onChange={(e) =>
                    setEditing({ ...editing, slug: e.target.value })
                  }
                />
              </label>
              <label>
                Parent category
                <select
                  value={editing.parentId || ""}
                  onChange={(e) =>
                    setEditing({ ...editing, parentId: e.target.value || null })
                  }
                >
                  <option value="">None — top-level category</option>
                  {flattenCategories(categories)
                    .filter(
                      (c) =>
                        !editing.id ||
                        !isWithinCategory(categories, c.id, editing.id),
                    )
                    .map((c) => (
                      <option key={c.id} value={c.id}>
                        {categoryPath(categories, c.id)
                          .map((p) => p.name)
                          .join(" / ")}
                      </option>
                    ))}
                </select>
              </label>
              <label>
                Short navigation label
                <input
                  maxLength={40}
                  value={editing.short}
                  onChange={(e) =>
                    setEditing({ ...editing, short: e.target.value })
                  }
                />
              </label>
              <label>
                Description
                <textarea
                  maxLength={500}
                  value={editing.description}
                  onChange={(e) =>
                    setEditing({ ...editing, description: e.target.value })
                  }
                />
              </label>
              <label>
                Sort order
                <input
                  type="number"
                  required
                  min="0"
                  max="100000"
                  value={editing.sortOrder}
                  onChange={(e) =>
                    setEditing({
                      ...editing,
                      sortOrder: Number(e.target.value),
                    })
                  }
                />
              </label>
              <label>
                Collection image (optional)
                <input
                  maxLength={300}
                  placeholder="editorial/example.webp"
                  value={editing.image}
                  onChange={(e) =>
                    setEditing({ ...editing, image: e.target.value })
                  }
                />
              </label>
              {editing.image && (
                <img
                  className="category-image-preview"
                  src={
                    editing.image.startsWith("/api/web/")
                      ? editing.image.replace(
                          "/api/web/category-images/",
                          "/api/admin/web-categories/media/",
                        )
                      : `/media/${editing.image}`
                  }
                  alt="Category image preview"
                />
              )}
              <label className="category-file-label">
                <ImagePlus size={16} />
                Upload category image
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  disabled={!live || busy}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) void upload(file);
                  }}
                />
                <small>
                  {live
                    ? "JPEG, PNG or WebP up to 8 MB."
                    : "Sign in to upload images to the website."}
                </small>
              </label>
              {editing.image && live && <button type="button" className="upload-secondary-button" disabled={busy} onClick={() => setCropImage(editing.image)}>Crop collection image</button>}
              {cropImage && <AdminImageEditor key={cropImage} src={cropImage} onCancel={() => setCropImage(null)} onSave={async blob => {
                setBusy(true);
                try {
                  const image = await uploadAdminImage(blob, '/api/admin/web-categories/uploads');
                  setEditing(current => current ? { ...current, image } : current);
                  setCropImage(null);
                } finally { setBusy(false); }
              }}/>}
              <label className="check-label">
                <input
                  type="checkbox"
                  checked={editing.published}
                  onChange={(e) =>
                    setEditing({ ...editing, published: e.target.checked })
                  }
                />
                Published on the website
              </label>
              <p className="data-note">
                A draft parent hides its subcategories and their products. Slugs
                must be unique; no mobile catalogue records are changed.
              </p>
              {error && (
                <p role="alert" className="form-error">
                  <HighlightInox text={error} />
                </p>
              )}
              <button className="button dark" disabled={busy}>
                {busy
                  ? "Saving…"
                  : live
                    ? "Save website category"
                    : "Save local category"}
              </button>
            </form>
          </section>
        </DraftDrawer>
      )}
    </div>
  );
}
