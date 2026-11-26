import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { cpSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve, sep } from "node:path";
import net from "node:net";
import { randomUUID } from "node:crypto";
import sharp from "sharp";
import { hashWebsiteAdminPassword, createWebsiteAdminSession } from "../src/lib/website-admin-auth.mjs";

// Run after npm run build. Only isolated credentials/storage are used.
const root = process.cwd();
const dir = mkdtempSync(join(root, ".test-web-taxonomy-admin-"));
const password = "Isolated-test-admin9!";
const config = { email: "website-admin@example.test", passwordHash: await hashWebsiteAdminPassword(password), secret: "isolated-admin-session-secret-".repeat(3) };
const socket = net.createServer();
await new Promise(resolve => socket.listen(0, "127.0.0.1", resolve));
const port = socket.address().port;
await new Promise(resolve => socket.close(resolve));
const base = `http://127.0.0.1:${port}`;
const server = spawn(process.execPath, [join(root, "node_modules/next/dist/bin/next"), "start", "--hostname", "127.0.0.1", "--port", String(port)], {
  cwd: root,
  env: { ...process.env, NODE_ENV: "production", INOX_API_ORIGIN: "https://website-admin-test.invalid", WEB_ADMIN_EMAIL: config.email, WEB_ADMIN_PASSWORD_HASH: config.passwordHash, WEB_ADMIN_SESSION_SECRET: config.secret, WEB_CATALOGUE_DATA_DIR: join(dir, "data") },
  windowsHide: true, stdio: ["ignore", "pipe", "pipe"],
});
let logs = "";
server.stdout.on("data", value => { logs += value; });
server.stderr.on("data", value => { logs += value; });
const call = (path, options = {}) => fetch(base + path, { ...options, signal: AbortSignal.timeout(15000), headers: { Origin: base, "Content-Type": "application/json", ...options.headers } });
try {
  for (let i = 0; i < 100 && !logs.includes("Ready"); i++) {
    if (server.exitCode !== null) throw new Error("Isolated test server exited. Run npm run build first.");
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  assert.ok(logs.includes("Ready"));
  assert.equal((await call("/api/admin/web-categories")).status, 401);
  assert.equal((await call("/api/admin/session", { method: "POST", headers: { Origin: "https://other.invalid" }, body: JSON.stringify({ email: config.email, password }) })).status, 403);
  assert.equal((await call("/api/admin/session", { method: "POST", body: JSON.stringify({ email: config.email, password: "wrong" }) })).status, 401);
  const login = await call("/api/admin/session", { method: "POST", body: JSON.stringify({ email: config.email, password }) });
  assert.equal(login.status, 200);
  assert.equal((await login.json()).scope, "website");
  const setCookie = login.headers.getSetCookie().find(value => value.startsWith("inox_website_admin="));
  assert.match(setCookie, /HttpOnly/i);
  assert.match(setCookie, /Secure/i);
  assert.match(setCookie, /SameSite=strict/i);
  const cookie = setCookie.split(";")[0], options = { headers: { Cookie: cookie } };
  assert.equal((await call("/api/admin/session", options)).status, 200);
  assert.equal((await call("/api/admin/web-categories", options)).status, 200);
  assert.equal((await call("/api/admin/products")).status, 401);
  assert.equal((await call("/api/admin/product-media", { method: "POST", body: "no-image", headers: { "Content-Type": "image/png" } })).status, 401);
  assert.equal((await call("/api/admin/product-media", { method: "POST", body: "no-image", headers: { "Content-Type": "image/png", Cookie: cookie } })).status, 422);
  const png = await sharp({ create: { width: 12, height: 12, channels: 3, background: "#cc2222" } }).png().toBuffer();
  const upload = await call("/api/admin/product-media", { method: "POST", headers: { Cookie: cookie, "Content-Type": "image/png" }, body: png });
  assert.equal(upload.status, 201);
  const image = (await upload.json()).url;
  assert.equal((await call(image)).status, 404);
  const draft = { id: randomUUID(), sku: "UPLOAD-TEST-1", name: "Actual uploaded product", category: "kitchen", description: "Uploaded material description", specifications: "Material: Stainless steel", finish: "Chrome", images: [image], webVisible: true, pdf: "" };
  const publish = product => call("/api/admin/products", { method: "POST", headers: { Cookie: cookie }, body: JSON.stringify({ operation: "save", product }) });
  const published = await publish(draft);
  assert.equal(published.status, 200);
  const saved = (await published.json()).product;
  assert.equal(saved.version, 1);
  const detail = await call(`/products/${draft.id}`);
  assert.equal(detail.status, 200);
  assert.match(await detail.text(), /Actual uploaded product/);
  assert.match(await (await call("/products")).text(), /Actual uploaded product/);
  assert.match(await (await call("/sitemap.xml")).text(), new RegExp(draft.id));
  assert.equal((await call(image)).status, 200);
  assert.equal((await publish({ ...draft, id: randomUUID() })).status, 409);
  assert.equal((await publish({ ...draft, name: "Stale change" })).status, 409);
  const hidden = await publish({ ...saved, webVisible: false });
  assert.equal(hidden.status, 200);
  assert.equal((await call(`/products/${draft.id}`)).status, 404);
  assert.equal((await call(image)).status, 404);
  assert.doesNotMatch(await (await call("/products")).text(), /Actual uploaded product/);
  assert.equal((await call("/api/admin/product-prices", { method: "PUT", headers: { Cookie: cookie }, body: JSON.stringify({ productId: "pull-out-waste-bin-40-litre", amount: 123450 }) })).status, 200);
  const prices = await call("/api/admin/product-prices", options);
  assert.equal(prices.status, 200);
  assert.equal((await prices.json()).prices[0].amount, 123450);
  assert.equal((await call("/api/admin/website-customers", options)).status, 403);
  assert.equal((await call("/api/admin/session", { headers: { Cookie: "inox_admin_access=pretend-shared-admin" } })).status, 401);
  const expired = createWebsiteAdminSession(config, Date.now() - 1000000);
  assert.equal((await call("/api/admin/web-categories", { headers: { Cookie: `inox_website_admin=${expired}` } })).status, 401);
  const logout = await call("/api/admin/session", { method: "DELETE", headers: { Cookie: cookie } });
  assert.equal(logout.status, 200);
  assert.match(logout.headers.getSetCookie().find(value => value.startsWith("inox_website_admin=")), /Max-Age=0/);
  assert.equal((await call("/api/admin/session")).status, 401);
  const allBrowser = process.argv.includes("--all-browser");
  if (allBrowser) {
    cpSync(join(root, "tests/browser"), join(dir, "tests/browser"), { recursive: true });
    mkdirSync(join(dir, "docs"));
    writeFileSync(join(dir, "playwright.config.ts"), readFileSync(join(root, "playwright.config.ts"), "utf8").replaceAll("http://127.0.0.1:3000", base));
    for (const filename of readdirSync(join(dir, "tests/browser"))) {
      const path = join(dir, "tests/browser", filename);
      writeFileSync(path, readFileSync(path, "utf8").replaceAll("http://127.0.0.1:3000", base));
    }
  }
  const browserArgs = allBrowser ? ["test", "--config", join(dir, "playwright.config.ts")] : ["test", "tests/browser/product-publishing.spec.ts"];
  const browserTest = spawn(process.execPath, [join(root, "node_modules/@playwright/test/cli.js"), ...browserArgs], { cwd: allBrowser ? dir : root, env: { ...process.env, WEB_PRODUCT_TEST_URL: base }, windowsHide: true, stdio: "inherit" });
  const result = await new Promise(resolve => browserTest.once("exit", resolve));
  assert.equal(result, 0, "Admin editor publishing browser test must pass");
  for (let i = 0; i < 10; i++) assert.equal((await call("/api/admin/session", { method: "POST", body: JSON.stringify({ email: config.email, password: "wrong" }) })).status, 401);
  assert.equal((await call("/api/admin/session", { method: "POST", body: JSON.stringify({ email: config.email, password: "wrong" }) })).status, 429);
  console.log("PASS: website login, publication and media upload, product listing/detail/sitemap, safe unpublishing, version/SKU conflicts, price writes, cookie security, CSRF, expiry, isolation, logout and rate limiting. No real backend/database used.");
} finally {
  if (server.exitCode === null) {
    const exited = new Promise(resolve => server.once("exit", resolve));
    server.kill();
    await exited;
  }
  server.stdout.destroy();
  server.stderr.destroy();
  const checked = resolve(dir);
  assert.ok(checked.startsWith(root + sep));
  rmSync(checked, { recursive: true, force: true });
}
