import { test } from "node:test";
import assert from "node:assert/strict";
import { hashWebsiteAdminPassword, websiteAdminConfig, verifyWebsiteAdminPassword, createWebsiteAdminSession, verifyWebsiteAdminSession, websiteAdminLifetime } from "../src/lib/website-admin-auth.mjs";

const passwordHash = await hashWebsiteAdminPassword("Test-website-admin9!");
const config = websiteAdminConfig({ WEB_ADMIN_EMAIL: "admin@example.test", WEB_ADMIN_PASSWORD_HASH: passwordHash, WEB_ADMIN_SESSION_SECRET: "isolated-test-secret-".repeat(3) });

test("website admin verifies the configured hash and email independently", async () => {
  assert.equal(await verifyWebsiteAdminPassword(config, "ADMIN@example.test", "Test-website-admin9!"), true);
  assert.equal(await verifyWebsiteAdminPassword(config, "other@example.test", "Test-website-admin9!"), false);
  assert.equal(await verifyWebsiteAdminPassword(config, config.email, "wrong-password"), false);
  assert.notEqual(await hashWebsiteAdminPassword("Test-website-admin9!"), passwordHash);
});
test("website sessions reject tampering, expired tokens, and shared-backend bearer tokens", () => {
  const now = 1800000000000;
  const session = createWebsiteAdminSession(config, now);
  assert.equal(verifyWebsiteAdminSession(session, config, now), true);
  assert.equal(verifyWebsiteAdminSession(session, config, now + websiteAdminLifetime * 1000), false);
  assert.equal(verifyWebsiteAdminSession(session, config, now - 1000), false);
  assert.equal(verifyWebsiteAdminSession(session + "x", config, now), false);
  assert.equal(verifyWebsiteAdminSession("a.b.c", config, now), false);
  assert.equal(verifyWebsiteAdminSession(undefined, config, now), false);
  assert.equal(verifyWebsiteAdminSession(session, { ...config, secret: "a-different-long-session-secret-value" }, now), false);
  assert.equal(verifyWebsiteAdminSession(session, { ...config, email: "changed@example.test" }, now), false);
  assert.equal(verifyWebsiteAdminSession(session, { ...config, passwordHash: passwordHash.replace(/.$/, passwordHash.endsWith("0") ? "1" : "0") }, now), false);
});
test("incomplete website credentials fail closed instead of using shared admin authentication", () => {
  assert.equal(websiteAdminConfig({}), null);
  assert.throws(() => websiteAdminConfig({ WEB_ADMIN_EMAIL: config.email }));
  assert.throws(() => websiteAdminConfig({ WEB_ADMIN_EMAIL: config.email, WEB_ADMIN_PASSWORD_HASH: "plaintext-password", WEB_ADMIN_SESSION_SECRET: config.secret }));
  assert.throws(() => websiteAdminConfig({ WEB_ADMIN_EMAIL: config.email, WEB_ADMIN_PASSWORD_HASH: passwordHash, WEB_ADMIN_SESSION_SECRET: "short" }));
});
