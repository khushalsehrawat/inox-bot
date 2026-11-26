import { test } from "node:test";
import assert from "node:assert/strict";
import {
  parseCSV,
  validateImport,
  matchImage,
  csvCell,
} from "../src/lib/import.mjs";
test("handles BOM, quoted commas, embedded newlines, CRLF and escaped quotes", () => {
  assert.deepEqual(
    parseCSV('\uFEFFsku,name,category\r\nA,"A, \"\"premium\"\"\npart",kitchen'),
    [
      ["sku", "name", "category"],
      ["A", 'A, "premium"\npart', "kitchen"],
    ],
  );
});
test("detects duplicates within a file and against existing SKUs ignoring case", () => {
  const rows = validateImport(
    "sku,name,category\nA,First,kitchen\na,Second,kitchen\nB,Third,kitchen",
    ["b"],
  );
  assert.equal(rows[0].errors.length, 0);
  assert.ok(rows[1].errors.includes("Duplicate SKU"));
  assert.ok(rows[2].errors.includes("Duplicate SKU"));
});
test("retains valid rows and reports invalid fields and column counts", () => {
  const rows = validateImport(
    "sku,name,category,featured\nA,Good,kitchen,true\nB,,other,yes\nC,Extra,kitchen,false,extra",
  );
  assert.equal(rows[0].errors.length, 0);
  assert.equal(rows[1].errors.length, 3);
  assert.ok(rows[2].errors.some((e) => e.includes("Column count")));
});
test("fails malformed CSV rather than truncating input", () => {
  assert.throws(() => parseCSV('sku,name\nA,"broken'), /quote/);
  assert.throws(() => validateImport("sku,name\nA,Name"), /category/);
  assert.throws(
    () => validateImport("sku,sku,name,category\nA,A,Name,kitchen"),
    /Duplicate column/,
  );
});
test("matches longest SKU and explicit image variant suffix", () => {
  assert.equal(matchImage("WM-40__02.jpg", ["WM", "WM-40"]), "WM-40");
  assert.equal(matchImage("wm-40.webp", ["WM-40"]), "WM-40");
  assert.equal(matchImage("WM-400.jpg", ["WM-40"]), null);
});
test("neutralizes spreadsheet formula injection in error exports", () => {
  assert.equal(csvCell("=SUM(1)"), '"\'=SUM(1)"');
  assert.equal(csvCell("normal"), '"normal"');
});
