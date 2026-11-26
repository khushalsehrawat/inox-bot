import { createHash, randomBytes, randomUUID, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import type { RowDataPacket } from "mysql2/promise";
import { websitePool, mysqlTransaction } from "./web-mysql.mjs";

const derive = promisify(scrypt);
export const customerCookie = "inox_website_customer";
export const customerLifetime = 60 * 60 * 24 * 7;
export class AccountError extends Error {
  constructor(public status: number, message: string) { super(message); }
}
export const digest = (value: string) => createHash("sha256").update(value).digest("hex");
export function accountInput(raw: unknown, signup: boolean) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new AccountError(400, "Invalid request.");
  const body = raw as Record<string, unknown>;
  const field = (key: string, max: number, required = true) => {
    const value = body[key] === undefined && !required ? "" : body[key];
    if (typeof value !== "string" || value.length > max || (required && !value.trim())) throw new AccountError(422, `Please check ${key}.`);
    return value.trim();
  };
  const email = field("email", 254).toLowerCase();
  const password = body.password;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new AccountError(422, "Enter a valid email address.");
  if (typeof password !== "string" || !password.length || password.length > 128) throw new AccountError(422, "Enter a valid password.");
  const result = { email, password, firstName: "", lastName: "", companyName: "", mobile: "", countryCode: "" };
  if (!signup) return result;
  if (password.length < 8 || !/[A-Za-z]/.test(password) || !/[0-9]/.test(password) || !/[^A-Za-z0-9]/.test(password)) throw new AccountError(422, "Use at least 8 characters with letters, numbers and a symbol.");
  result.firstName = field("firstName", 100);
  result.lastName = field("lastName", 100, false);
  result.companyName = field("companyName", 200, false);
  result.mobile = field("mobile", 15);
  result.countryCode = field("countryCode", 5);
  if (!/^\d{7,15}$/.test(result.mobile) || !/^\+\d{1,4}$/.test(result.countryCode)) throw new AccountError(422, "Enter a valid phone number and country code.");
  if (body.consentAccepted !== true) throw new AccountError(422, "Please accept the account consent.");
  return result;
}
export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const hash = await derive(password, salt, 64) as Buffer;
  return `scrypt:${salt}:${hash.toString("hex")}`;
}
export async function checkPassword(password: string, stored: string) {
  if (!/^scrypt:[a-f0-9]{32}:[a-f0-9]{128}$/.test(stored)) return false;
  const [, salt, hash] = stored.split(":");
  return timingSafeEqual(await derive(password, salt, 64) as Buffer, Buffer.from(hash, "hex"));
}
export async function limitAccount(action: string, email: string) {
  // Database-backed account throttling works across server instances; no proxy IP trust required.
  const bucket = digest(`${action}:${email}`);
  await websitePool().execute("INSERT INTO web_auth_limits(bucket,attempts,expires_at) VALUES(?,1,DATE_ADD(UTC_TIMESTAMP(),INTERVAL 15 MINUTE)) ON DUPLICATE KEY UPDATE attempts=IF(expires_at<=UTC_TIMESTAMP(),1,attempts+1),expires_at=IF(expires_at<=UTC_TIMESTAMP(),DATE_ADD(UTC_TIMESTAMP(),INTERVAL 15 MINUTE),expires_at)", [bucket]);
  const [rows] = await websitePool().execute<RowDataPacket[]>("SELECT attempts FROM web_auth_limits WHERE bucket=?", [bucket]);
  if (rows[0].attempts > (action === "register" ? 5 : 10)) throw new AccountError(429, "Too many attempts. Try again in 15 minutes.");
}
export async function registerAccount(input: ReturnType<typeof accountInput>) {
  const hash = await hashPassword(input.password);
  try {
    const id = randomUUID();
    await mysqlTransaction(async db => {
      await db.execute("INSERT INTO web_users(id,email,first_name,last_name,country_code,mobile,company_name,password_hash,consent_accepted_at) VALUES(?,?,?,?,?,?,?,?,UTC_TIMESTAMP())", [id,input.email,input.firstName,input.lastName,input.countryCode,input.mobile,input.companyName,hash]);
      await db.execute("INSERT INTO web_customer_activity(id,customer_id,event,details) VALUES(?,?,'Registered',?)", [randomUUID(), id, JSON.stringify({})]);
    });
  } catch (error) {
    if ((error as {code?: string}).code === "ER_DUP_ENTRY") throw new AccountError(409, "A website account with this email already exists. Please sign in.");
    throw error;
  }
}
function publicUser(row: RowDataPacket) {
  return { id: String(row.id), email: String(row.email), profile: { firstName: String(row.first_name), lastName: String(row.last_name), countryCode: String(row.country_code), mobile: String(row.mobile), companyName: String(row.company_name) } };
}
export async function loginAccount(input: ReturnType<typeof accountInput>) {
  const [rows] = await websitePool().execute<RowDataPacket[]>("SELECT * FROM web_users WHERE email=?", [input.email]);
  const row = rows[0];
  const dummy = `scrypt:${"0".repeat(32)}:${"0".repeat(128)}`;
  const valid = await checkPassword(input.password, row?.password_hash || dummy);
  if (!row || !valid) throw new AccountError(401, "Email or password is incorrect.");
  const token = randomBytes(32).toString("base64url");
  const user = publicUser(row);
  await mysqlTransaction(async db => {
    await db.execute("DELETE FROM web_user_sessions WHERE user_id=? AND expires_at<=UTC_TIMESTAMP()", [user.id]);
    await db.execute("INSERT INTO web_user_sessions(token_hash,user_id,expires_at) VALUES(?,?,DATE_ADD(UTC_TIMESTAMP(),INTERVAL 7 DAY))", [digest(token),user.id]);
    await db.execute("INSERT INTO web_customers(id,email,profile) VALUES(?,?,?) ON DUPLICATE KEY UPDATE email=VALUES(email),profile=VALUES(profile),last_login=CURRENT_TIMESTAMP,login_count=login_count+1", [user.id,user.email,JSON.stringify(user.profile)]);
    await db.execute("INSERT INTO web_customer_activity(id,customer_id,event,details) VALUES(?,?,'Signed in',?)", [randomUUID(), user.id, JSON.stringify({})]);
  });
  return { token, user };
}
export async function sessionAccount(token?: string) {
  if (!token || !/^[A-Za-z0-9_-]{43}$/.test(token)) return null;
  const [rows] = await websitePool().execute<RowDataPacket[]>("SELECT u.id,u.email,u.first_name,u.last_name,u.country_code,u.mobile,u.company_name FROM web_user_sessions s JOIN web_users u ON u.id=s.user_id WHERE s.token_hash=? AND s.expires_at>UTC_TIMESTAMP()", [digest(token)]);
  return rows[0] ? publicUser(rows[0]) : null;
}
export async function logoutAccount(token?: string) {
  if (!token || !/^[A-Za-z0-9_-]{43}$/.test(token)) return;
  await mysqlTransaction(async db => {
    const [rows] = await db.execute<RowDataPacket[]>("SELECT user_id FROM web_user_sessions WHERE token_hash=? AND expires_at>UTC_TIMESTAMP() FOR UPDATE", [digest(token)]);
    await db.execute("DELETE FROM web_user_sessions WHERE token_hash=?", [digest(token)]);
    if (rows[0]) await db.execute("INSERT INTO web_customer_activity(id,customer_id,event,details) VALUES(?,?,'Signed out',?)", [randomUUID(), rows[0].user_id, JSON.stringify({})]);
  });
}
