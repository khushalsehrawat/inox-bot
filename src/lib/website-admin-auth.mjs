import { createHash, createHmac, randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const derive = promisify(scrypt);
export const websiteAdminCookie = "inox_website_admin";
export const websiteAdminLifetime = 28800; // 8 hours

export function websiteAdminConfig(env = process.env) {
  const email = env.WEB_ADMIN_EMAIL?.trim().toLowerCase();
  const passwordHash = env.WEB_ADMIN_PASSWORD_HASH;
  const secret = env.WEB_ADMIN_SESSION_SECRET;
  if (!email && !passwordHash && !secret) return null;
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !/^scrypt:[a-f0-9]{32}:[a-f0-9]{128}$/.test(passwordHash || "") || !secret || secret.length < 32) {
    throw new Error("Configure all three website administrator environment variables.");
  }
  return { email, passwordHash, secret };
}
export async function hashWebsiteAdminPassword(password) {
  if (typeof password !== "string" || password.length < 8 || password.length > 256) throw new Error("Use a password of 8–256 characters.");
  const salt = randomBytes(16).toString("hex");
  const key = await derive(password, salt, 64);
  return `scrypt:${salt}:${key.toString("hex")}`;
}
export async function verifyWebsiteAdminPassword(config, email, password) {
  const [, salt, hash] = config.passwordHash.split(":");
  const key = await derive(password, salt, 64);
  return timingSafeEqual(key, Buffer.from(hash, "hex")) && email.trim().toLowerCase() === config.email;
}
function identity(config) {
  return createHash("sha256").update(`${config.email}\n${config.passwordHash}`).digest("hex");
}
function signature(payload, config) {
  return createHmac("sha256", config.secret).update(`website-admin:${payload}`).digest();
}
export function createWebsiteAdminSession(config, now = Date.now()) {
  const issued = Math.floor(now / 1000);
  const payload = Buffer.from(JSON.stringify({ sub: "website-admin", identity: identity(config), issued, expires: issued + websiteAdminLifetime, nonce: randomBytes(16).toString("hex") })).toString("base64url");
  return `${payload}.${signature(payload, config).toString("base64url")}`;
}
export function verifyWebsiteAdminSession(token, config, now = Date.now()) {
  if (typeof token !== "string" || token.length > 2048) return false;
  try {
    const parts = token.split(".");
    if (parts.length !== 2) return false;
    const [payload, mac] = parts;
    const expected = signature(payload, config), actual = Buffer.from(mac, "base64url");
    if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return false;
    const data = JSON.parse(Buffer.from(payload, "base64url").toString());
    const seconds = Math.floor(now / 1000);
    return data.sub === "website-admin" && data.identity === identity(config) && Number.isInteger(data.issued) && Number.isInteger(data.expires) && data.issued <= seconds && data.expires === data.issued + websiteAdminLifetime && data.expires > seconds;
  } catch { return false; }
}
