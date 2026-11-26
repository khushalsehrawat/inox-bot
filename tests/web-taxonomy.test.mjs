import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  openTaxonomy,
  validateCategory,
} from "../src/lib/web-taxonomy-store.mjs";
import { validateImport } from "../src/lib/import.mjs";
import { randomUUID } from "node:crypto";
const variation = () => ({id:randomUUID(),sku:randomUUID(),name:"Standard",active:true,available:true,mrp:"100.00",sellingPrice:"80.00",images:[],specifications:{}});
const seed = [{ id: "kitchen", name: "Kitchen", short: "Kitchen", image: "" }];
const products = [{ id: "product-1", category: "kitchen" }];
const input = (name, extra = {}) => ({
  name,
  slug: name.toLowerCase().replaceAll(" ", "-"),
  short: "",
  description: "",
  image: "",
  parentId: null,
  published: true,
  sortOrder: 0,
  ...extra,
});

test("product assignments and category reparenting keep stored product paths in sync in both directions", () => {
  const path = join(mkdtempSync(join(tmpdir(), "inox-category-sync-")), "taxonomy.sqlite");
  let store = openTaxonomy(path, seed);
  const other = store.create(input("Other"));
  const branch = store.create(input("Branch", { parentId: "kitchen" }));
  const leaf = store.create(input("Leaf", { parentId: branch.id }));
  const product = store.saveProduct({ id: randomUUID(), sku: "SYNC-1", name: "Sync product", category: "kitchen", subcategory: leaf.id, webVisible: true, variations: [variation()] });
  store.update(branch.id, { ...branch, parentId: other.id }, branch.version);
  let saved = store.productDrafts().find(p => p.id === product.id);
  assert.equal(saved.category, other.id);
  assert.equal(saved.subcategory, leaf.id);
  assert.equal(store.assignments()[product.id], leaf.id);
  assert.equal(saved.version, product.version + 1);
  assert.throws(() => store.saveProduct(product), /changed/);
  store.assign(product.id, "kitchen");
  saved = store.productDrafts().find(p => p.id === product.id);
  assert.equal(saved.category, "kitchen");
  assert.equal(saved.subcategory, "");
  saved = store.saveProduct({ ...saved, category: other.id, subcategory: leaf.id });
  assert.equal(store.assignments()[product.id], leaf.id);
  store.close();
  store = openTaxonomy(path, seed);
  try {
    assert.equal(store.productDrafts()[0].category, other.id);
    assert.equal(store.productDrafts()[0].subcategory, leaf.id);
    assert.equal(store.productDrafts()[0].version, saved.version);
  } finally { store.close(); }
});

test("removing Wardrobe subcategories moves products to the main category and persists", () => {
  const path = join(mkdtempSync(join(tmpdir(), "inox-remove-subcategory-")), "taxonomy.sqlite");
  let store = openTaxonomy(path, seed);
  const wardrobe = store.create(input("Wardrobe"));
  const branch = store.create(input("Accessories", { parentId: wardrobe.id }));
  const leaf = store.create(input("Hangers", { parentId: branch.id }));
  const product = store.saveProduct({ id: randomUUID(), sku: "WARDROBE-1", name: "Hanger", category: wardrobe.id, subcategory: leaf.id, webVisible: true, variations: [variation()] });
  assert.throws(() => store.remove(branch.id, branch.version), /subcategories/);
  assert.throws(() => store.remove(leaf.id, leaf.version + 1), /Refresh/);
  assert.equal(store.assignments()[product.id], leaf.id);
  store.remove(leaf.id, leaf.version);
  assert.equal(store.assignments()[product.id], wardrobe.id);
  store.remove(branch.id, branch.version);
  store.close();
  store = openTaxonomy(path, seed);
  try {
    const saved = store.productDrafts()[0];
    assert.equal(saved.category, wardrobe.id);
    assert.equal(saved.subcategory, "");
    assert.equal(saved.webVisible, true);
    assert.deepEqual(saved.variations, product.variations);
    assert.equal(saved.version, product.version + 1);
    assert.equal(store.assignments()[product.id], wardrobe.id);
    assert.equal(store.list().some(c => c.id === leaf.id || c.id === branch.id), false);
    assert.throws(() => store.remove(wardrobe.id, wardrobe.version), /Reassign products/);
    assert.throws(() => store.saveProduct(product), /changed/);
  } finally { store.close(); }
});

test("bulk transfer includes descendants, preserves product data, validates destinations and persists", () => {
  const path = join(mkdtempSync(join(tmpdir(), "inox-transfer-")), "taxonomy.sqlite");
  let store = openTaxonomy(path, seed);
  const child = store.create(input("Drawers", { parentId: "kitchen" }));
  const target = store.create(input("Wardrobe"));
  const destination = store.create(input("Accessories", { parentId: target.id }));
  const create = (sku, category, subcategory = "") => store.saveProduct({ id: randomUUID(), sku, name: sku, category, subcategory, webVisible: true, variations: [variation()] });
  const rootProduct = create("ROOT-1", "kitchen");
  const childProduct = create("CHILD-1", "kitchen", child.id);
  const unrelated = create("OTHER-1", target.id);
  assert.throws(() => store.transfer("kitchen", "missing"), /existing/);
  assert.throws(() => store.transfer("kitchen", "kitchen"), /different/);
  assert.equal(store.assignments()[childProduct.id], child.id);
  assert.equal(store.transfer("kitchen", destination.id), 2);
  for (const original of [rootProduct, childProduct]) {
    const saved = store.productDrafts().find(p => p.id === original.id);
    assert.equal(saved.category, target.id);
    assert.equal(saved.subcategory, destination.id);
    assert.equal(saved.version, original.version + 1);
    assert.deepEqual(saved.variations, original.variations);
    assert.equal(store.assignments()[original.id], destination.id);
    assert.throws(() => store.saveProduct(original), /changed/);
  }
  assert.equal(store.productDrafts().find(p => p.id === unrelated.id).version, unrelated.version);
  assert.equal(store.transfer("kitchen", destination.id), 0);
  assert.equal(store.transfer("*", target.id), 2);
  assert.equal(store.list().length, 4);
  store.close();
  store = openTaxonomy(path, seed);
  try {
    assert.ok(store.productDrafts().every(p => p.category === target.id && p.subcategory === ""));
    assert.ok(Object.values(store.assignments()).every(id => id === target.id));
  } finally { store.close(); }
});

test("moving categories persists sibling order without hiding categories or moving children", () => {
  const store = openTaxonomy(":memory:", seed);
  try {
    const a = store.create(input("Alpha"));
    const b = store.create(input("Beta"));
    const child = store.create(input("Child", { parentId: a.id }));
    store.move(b.id, "up", b.version);
    assert.deepEqual(store.list(true).filter(c => !c.parentId).map(c => c.id), [b.id, a.id, "kitchen"]);
    assert.equal(store.list(true).find(c => c.id === child.id).parentId, a.id);
    assert.equal(store.list(true).length, 4);
    assert.throws(() => store.move(b.id, "down", b.version), /changed/);
    const current = store.list().find(c => c.id === b.id);
    store.move(b.id, "down", current.version);
    assert.deepEqual(store.list(true).filter(c => !c.parentId).map(c => c.id), [a.id, b.id, "kitchen"]);
  } finally { store.close(); }
});

test("dragging places categories before or after any sibling and rejects a different parent", () => {
  const store = openTaxonomy(":memory:", seed);
  try {
    const a = store.create(input("Alpha", { sortOrder: 1 }));
    const b = store.create(input("Beta", { sortOrder: 2 }));
    const child = store.create(input("Child", { parentId: a.id }));
    store.move(b.id, "before:kitchen", b.version);
    assert.deepEqual(store.list(true).filter(c => !c.parentId).map(c => c.id), [b.id, "kitchen", a.id]);
    const current = store.list().find(c => c.id === b.id);
    assert.throws(() => store.move(b.id, `after:${child.id}`, current.version), /same parent/);
    assert.equal(store.list().find(c => c.id === b.id).version, current.version);
    store.move(b.id, `after:${a.id}`, current.version);
    assert.deepEqual(store.list(true).filter(c => !c.parentId).map(c => c.id), ["kitchen", a.id, b.id]);
  } finally { store.close(); }
});

test("published product records persist, protect SKUs and versions, and can be unpublished without data loss", () => {
  const path = join(mkdtempSync(join(tmpdir(), "inox-products-")), "products.sqlite");
  let store = openTaxonomy(path, seed, products);
  const draft = { variations:[variation()], id: randomUUID(), sku: "REAL-PRODUCT-1", name: "Uploaded product", category: "kitchen", description: "Uploaded description", specifications: "Material: Steel", finish: "Grey", images: [], pdf: "", webVisible: true, featured: false };
  const saved = store.saveProduct(draft);
  assert.equal(saved.version, 1);
  assert.equal(saved.status, "Published");
  assert.equal(store.assignments()[saved.id], "kitchen");
  assert.throws(() => store.saveProduct({ ...draft, id: randomUUID() }), /SKU already exists/);
  assert.throws(() => store.saveProduct(draft), /changed/);
  store.close();
  store = openTaxonomy(path, seed, products);
  assert.equal(store.productDrafts()[0].name, draft.name);
  const hidden = store.saveProduct({ ...saved, webVisible: false });
  assert.equal(hidden.version, 2);
  assert.equal(hidden.webVisible, false);
  assert.equal(hidden.description, draft.description);
  assert.throws(() => store.remove("kitchen", 1), /Reassign products/);
  store.close();
});
test("publishing validates category ancestry, publication and real uploaded media paths", () => {
  const store = openTaxonomy(":memory:", seed, products);
  const hidden = store.create(input("Hidden", { published: false }));
  const child = store.create(input("Child", { parentId: hidden.id }));
  const draft = { variations:[variation()], id: randomUUID(), sku: "NEW-PRODUCT", name: "New product", category: "kitchen", webVisible: true, images: [], finish: "", specifications: "", pdf: "" };
  assert.throws(() => store.saveProduct({ ...draft, category: "missing" }), /existing category/);
  assert.throws(() => store.saveProduct({ ...draft, category: hidden.id, subcategory: child.id }), /category first/);
  assert.throws(() => store.saveProduct({ ...draft, images: ["only-a-filename.jpg"] }), /Upload/);
  assert.throws(() => store.saveProduct({ ...draft, images: ["https://other.example/file.webp"] }), /Upload/);
  assert.throws(() => store.saveProduct({ ...draft, pdf: "old-file.pdf" }), /Upload/);
  assert.throws(() => store.saveProduct({ ...draft, name: "" }), /name/);
  assert.equal(store.productDrafts().length, 0);
  const saved = store.saveProduct({ ...draft, images: [`/api/web/product-media/${randomUUID()}.webp`] });
  const other = store.create(input("Other"));
  store.assign(saved.id, other.id);
  assert.equal(store.assignments()[saved.id], other.id);
  store.close();
});
test("web categories persist across reopening and initial seeds are not restored after deliberate deletion", () => {
  const path = join(
    mkdtempSync(join(tmpdir(), "inox-taxonomy-")),
    "store.sqlite",
  );
  let store = openTaxonomy(path, seed, products);
  const created = store.create(input("Pantry"));
  store.close();
  store = openTaxonomy(path, seed, products);
  assert.equal(store.list().find((c) => c.id === created.id)?.name, "Pantry");
  store.remove(created.id, created.version);
  store.close();
  store = openTaxonomy(path, seed, products);
  assert.equal(store.list().length, 1);
  store.close();
});
test("draft parents hide subcategories and publication recovers the tree", () => {
  const store = openTaxonomy(":memory:", seed, products);
  const parent = store.create(input("Pantry", { published: false }));
  const child = store.create(input("Pull outs", { parentId: parent.id }));
  assert.ok(!store.list(true).some((c) => c.id === child.id));
  store.update(parent.id, { ...parent, published: true }, parent.version);
  assert.ok(store.list(true).some((c) => c.id === child.id));
  store.close();
});
test("rejects duplicates, cycles, stale updates and referenced category deletion", () => {
  const store = openTaxonomy(":memory:", seed, products);
  assert.throws(
    () => store.create(input("Kitchen", { slug: "different-slug" })),
    /already exists/,
  );
  const root = store.create(input("Storage"));
  const child = store.create(input("Drawers", { parentId: root.id }));
  const grandchild = store.create(input("Third level", { parentId: child.id }));
  assert.ok(store.list(true).some((c) => c.id === grandchild.id));
  assert.throws(
    () =>
      store.update(root.id, { ...root, parentId: grandchild.id }, root.version),
    /descendants/,
  );
  store.remove(grandchild.id, grandchild.version);
  assert.throws(() => store.remove(root.id, root.version), /subcategories/);
  store.assign("product-1", child.id);
  assert.throws(() => store.remove(child.id, child.version + 1), /Refresh/);
  store.update(child.id, { ...child, name: "New drawers" }, child.version);
  assert.throws(
    () => store.update(child.id, child, child.version),
    /another session/,
  );
  assert.throws(
    () => store.assign("invented-product", root.id),
    /existing website/,
  );
  store.close();
});
test("CSV category import resolves new parents and rolls back the whole operation on errors", () => {
  const store = openTaxonomy(":memory:", seed, products);
  store.import(
    [
      { ...input("Hinges"), parentSlug: "Fittings" },
      { ...input("Fittings"), slug: "Fittings".toLowerCase() },
    ].map((r) => ({ ...r, parentSlug: r.parentSlug?.toLowerCase() })),
  );
  assert.ok(store.list().find((c) => c.slug === "hinges")?.parentId);
  const count = store.list().length;
  assert.throws(
    () =>
      store.import([
        input("Valid"),
        { ...input("Invalid"), parentSlug: "missing" },
      ]),
    /Unknown parent/,
  );
  assert.equal(store.list().length, count);
  store.close();
});
test("validates image paths, text lengths, status and order without accepting arbitrary files", () => {
  assert.throws(
    () => validateCategory(input("Bad", { image: "../../secret.png" })),
    /image/,
  );
  assert.throws(
    () =>
      validateCategory(input("Bad", { image: "https://example.com/file.svg" })),
    /uploaded image/,
  );
  assert.throws(
    () => validateCategory(input("Bad", { sortOrder: -1 })),
    /Sort order/,
  );
  assert.throws(
    () => validateCategory(input("Bad", { published: "true" })),
    /published/,
  );
  assert.throws(() => validateCategory(input("a".repeat(81))), /80 characters/);
});
test("product CSV validates custom web category/subcategory slugs and normalizes stable IDs", () => {
  const taxonomy = [
    { id: "root-uuid", slug: "fittings", parentId: null },
    { id: "child-uuid", slug: "hinges", parentId: "root-uuid" },
  ];
  const rows = validateImport(
    "sku,name,category,subcategory\nA,Hinge,fittings,hinges\nB,Other,fittings,missing",
    [],
    taxonomy,
  );
  assert.deepEqual(rows[0].errors, []);
  assert.equal(rows[0].value.category, "root-uuid");
  assert.equal(rows[0].value.subcategory, "child-uuid");
  assert.ok(rows[1].errors.length);
});

test("deep descendants inherit publication and CSV imports resolve unordered multi-level trees", () => {
  const store = openTaxonomy(":memory:", seed, products);
  store.import([
    { ...input("Leaf"), parentSlug: "branch" },
    { ...input("Branch"), parentSlug: "tree" },
    input("Tree"),
  ]);
  const tree = store.list().find((c) => c.slug === "tree");
  const leaf = store.list().find((c) => c.slug === "leaf");
  store.assign("product-1", leaf.id);
  assert.ok(store.list(true).some((c) => c.id === leaf.id));
  const hidden = store.update(
    tree.id,
    { ...tree, published: false },
    tree.version,
  );
  assert.ok(!store.list(true).some((c) => c.id === leaf.id));
  store.update(tree.id, { ...hidden, published: true }, hidden.version);
  assert.ok(store.list(true).some((c) => c.id === leaf.id));
  const count = store.list().length;
  assert.throws(
    () =>
      store.import([
        { ...input("Cycle one"), parentSlug: "cycle-two" },
        { ...input("Cycle two"), parentSlug: "cycle-one" },
      ]),
    /circular/,
  );
  assert.equal(store.list().length, count);
  const rows = validateImport(
    "sku,name,category,subcategory\nA,Deep product,tree,leaf",
    [],
    store.list(),
  );
  assert.deepEqual(rows[0].errors, []);
  assert.equal(rows[0].value.subcategory, leaf.id);
  store.close();
});
