// Live integration check. Uses random website-only fixtures and removes only those fixtures.
import assert from 'node:assert/strict';
import { randomUUID, createHash } from 'node:crypto';
import nextEnv from '@next/env';
import { websitePool } from '../src/lib/web-mysql.mjs';
import { mysqlStore } from '../src/lib/web-mysql-store.mjs';
import { websiteAdminConfig, createWebsiteAdminSession, websiteAdminCookie } from '../src/lib/website-admin-auth.mjs';
nextEnv.loadEnvConfig(process.cwd());
const base = process.env.WEB_TEST_BASE_URL || 'http://127.0.0.1:3000';
if (!['127.0.0.1', 'localhost'].includes(new URL(base).hostname)) throw Error('Run against a local test server only.');
const pool = websitePool();
const marker = randomUUID();
const emails = [`journey-a-${marker}@example.test`, `journey-b-${marker}@example.test`];
const password = `Journey9!${randomUUID()}`;
const digest = value => createHash('sha256').update(value).digest('hex');
const enquiryIds = [];
let browser;
async function request(path, { method = 'GET', body, cookie, origin = base } = {}) {
  const response = await fetch(`${base}${path}`, {
    method, headers: { ...(cookie ? { Cookie: cookie } : {}), ...(method !== 'GET' ? { Origin: origin, 'Content-Type': 'application/json' } : {}) },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    signal: AbortSignal.timeout(60000),
  });
  const data = await response.json();
  return { status: response.status, data, cookie: response.headers.get('set-cookie')?.split(';')[0], headers: response.headers };
}
try {
  assert.equal((await request('/api/customer/prices')).status, 401);
  assert.equal((await request('/api/customer/enquiries')).status, 401);
  assert.equal((await request('/api/admin/enquiries')).status, 401);
  assert.equal((await request('/api/admin/website-customers')).status, 401);
  const accounts = [];
  for (const [index, email] of emails.entries()) {
    const registration = await request('/api/customer/register', { method: 'POST', body: { firstName: `Journey ${index}`, email, mobile: '9876543210', countryCode: '+91', companyName: 'Automated website check', password, consentAccepted: true } });
    assert.equal(registration.status, 201, registration.data.message);
    if (index === 0) assert.equal((await request('/api/customer/login', { method: 'POST', body: { email, password: 'Incorrect9!' } })).status, 401);
    const login = await request('/api/customer/login', { method: 'POST', body: { email, password } });
    assert.equal(login.status, 200, login.data.message);
    assert.ok(login.cookie);
    accounts.push(login);
  }
  const [a, b] = accounts;
  const prices = await request('/api/customer/prices', { cookie: a.cookie });
  assert.equal(prices.status, 200);
  assert.ok(Array.isArray(prices.data.prices));
  assert.match(prices.headers.get('cache-control'), /no-store/);
  const store = mysqlStore();
  const visible = await store.list(true);
  const product = (await store.productDrafts()).find(p => p.webVisible && visible.some(c => c.id === (p.subcategory || p.category)) && p.variations?.some(v => v.active && v.available));
  assert.ok(product, 'A published product with an available variation is required for this check.');
  const variation = product.variations.find(v => v.active && v.available);
  const body = { name: 'Journey fixture', email: emails[0], phone: '+91 9876543210', company: 'Automated website check', city: 'Test city', type: 'Project enquiry', message: `Saved enquiry check ${marker}`, consent: 'on', items: [{ id: product.id, variationId: variation.id, quantity: 2 }], customerId: b.data.user.id };
  assert.equal((await request('/api/enquiries', { method: 'POST', cookie: a.cookie, body, origin: 'https://untrusted.example' })).status, 403);
  const saved = await request('/api/enquiries', { method: 'POST', cookie: a.cookie, body });
  assert.equal(saved.status, 201, saved.data.message); enquiryIds.push(saved.data.id);
  assert.equal(saved.data.savedToAccount, true);
  const guest = await request('/api/enquiries', { method: 'POST', body: { ...body, message: `Guest check ${marker}` } });
  assert.equal(guest.status, 201, guest.data.message); enquiryIds.push(guest.data.id);
  assert.equal(guest.data.savedToAccount, false);
  const history = await request('/api/customer/enquiries', { cookie: a.cookie });
  assert.equal(history.status, 200);
  assert.equal(history.data.enquiries.length, 1, 'Matching guest email must not claim an enquiry.');
  assert.equal(history.data.enquiries[0].customerId, a.data.user.id, 'Ignore customerId supplied by the browser.');
  assert.equal(history.data.enquiries[0].items[0].sku, variation.sku);
  assert.equal(history.data.enquiries[0].city, 'Test city');
  assert.equal((await request(`/api/customer/enquiries?customerId=${a.data.user.id}`, { cookie: b.cookie })).data.enquiries.length, 0);
  assert.equal((await request('/api/customer/enquiries?page=-1', { cookie: a.cookie })).status, 400);
  const config = websiteAdminConfig();
  assert.ok(config, 'Configure website administrator access for this check.');
  const adminCookie = `${websiteAdminCookie}=${createWebsiteAdminSession(config)}`;
  const directory = await request(`/api/admin/website-customers?customerId=${a.data.user.id}`, { cookie: adminCookie });
  assert.equal(directory.status, 200, directory.data.message);
  const customer = directory.data.customers.find(c => c.id === a.data.user.id);
  assert.equal(customer.login_count, 1); assert.equal(customer.enquiryCount, 1); assert.equal(customer.activeSessions, 1);
  for (const event of ['Registered', 'Signed in', 'Enquiry submitted']) assert.ok(directory.data.activity.some(a => a.event === event));
  assert.ok(!JSON.stringify(directory.data).includes('password_hash'));
  const adminEnquiries = await request('/api/admin/enquiries', { cookie: adminCookie });
  assert.equal(adminEnquiries.status, 200);
  assert.ok(adminEnquiries.data.enquiries.some(e => e.id === saved.data.id && e.accountEmail === emails[0]));
  assert.ok(adminEnquiries.data.enquiries.some(e => e.id === guest.data.id && e.customerId === null));
  assert.equal((await request('/api/admin/enquiries', { method: 'PATCH', cookie: a.cookie, body: { id: saved.data.id, status: 'Quoted' } })).status, 401);
  assert.equal((await request('/api/admin/enquiries', { method: 'PATCH', cookie: adminCookie, body: { id: saved.data.id, status: 'Quoted' }, origin: 'https://untrusted.example' })).status, 403);
  assert.equal((await request('/api/admin/enquiries', { method: 'PATCH', cookie: adminCookie, body: { id: saved.data.id, status: 'Unknown' } })).status, 422);
  assert.equal((await request('/api/admin/enquiries', { method: 'PATCH', cookie: adminCookie, body: { id: saved.data.id, status: 'Quoted' } })).status, 200);
  assert.equal((await request('/api/customer/enquiries', { cookie: a.cookie })).data.enquiries[0].status, 'Quoted');
  if (process.argv.includes('--browser')) {
    const { chromium } = await import('@playwright/test');
    const { existsSync, readdirSync } = await import('node:fs');
    const { join } = await import('node:path');
    const { homedir } = await import('node:os');
    const root = join(homedir(), 'AppData', 'Local', 'ms-playwright');
    const executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || (existsSync(root) ? readdirSync(root).filter(x => /^chromium-\d+$/.test(x)).reverse().map(x => join(root, x, 'chrome-win64', 'chrome.exe')).find(existsSync) : undefined);
    browser = await chromium.launch({ executablePath });
    const context = await browser.newContext({ reducedMotion: 'reduce' });
    const page = await context.newPage();
    await page.goto(`${base}/login?next=%2Faccount`, { waitUntil: 'domcontentloaded' });
    await page.getByLabel('Email address', { exact: true }).fill(emails[0]);
    await page.getByLabel('Password', { exact: true }).fill(password);
    await page.getByRole('button', { name: 'Sign in', exact: true }).click();
    await page.waitForURL(`${base}/account`);
    await page.goto(`${base}/products/${product.id}?variation=${variation.id}`, { waitUntil: 'domcontentloaded' });
    const price = page.locator('.detail-price-block .product-price');
    const expectedPrice = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(Number(variation.sellingPrice));
    await price.getByText(expectedPrice, { exact: true }).waitFor();
    await page.route('**/api/customer/prices', route => route.fulfill({ status: 503, json: { message: 'Temporary pricing outage' } }));
    await page.reload({ waitUntil: 'domcontentloaded' });
    await price.getByRole('button', { name: 'Try again' }).waitFor();
    assert.ok(!(await price.textContent()).includes('Price available on request'));
    await page.unroute('**/api/customer/prices');
    await price.getByRole('button', { name: 'Try again' }).click();
    await price.getByText(expectedPrice, { exact: true }).waitFor();
    let releasePrices;
    let intercepted;
    const started = new Promise(resolve => { intercepted = resolve; });
    const released = new Promise(resolve => { releasePrices = resolve; });
    await page.route('**/api/customer/prices', async route => { intercepted(); await released; await route.continue(); });
    await page.evaluate(() => window.dispatchEvent(new Event('focus')));
    await started;
    assert.ok((await price.textContent()).includes(expectedPrice), 'Background refresh must keep the previously loaded price visible.');
    releasePrices();
    await page.unrouteAll({ behavior: 'wait' });
    console.log('PASS: saved database price displayed; price API errors show retry; background refresh retains loaded prices.');
    for (const width of [1440, 768, 390]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(`${base}/account`, { waitUntil: 'domcontentloaded' });
      await page.getByRole('heading', { name: 'Saved enquiries.' }).waitFor();
      await page.getByText(body.message, { exact: true }).waitFor();
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `Account overflow at ${width}`);
      await page.screenshot({ path: `test-results/customer-account-${width}.png`, fullPage: true });
    }
    await page.goto(`${base}/enquiry`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(email => document.querySelector('input[name="email"]')?.value === email, emails[0]);
    await page.getByLabel('Your message', { exact: true }).fill(`Browser enquiry ${marker}`);
    await page.getByRole('checkbox').check();
    const submission = page.waitForResponse(r => r.url().endsWith('/api/enquiries') && r.request().method() === 'POST');
    await page.getByRole('button', { name: 'Send enquiry', exact: true }).click();
    const sent = await submission;
    assert.equal(sent.status(), 201);
    enquiryIds.push((await sent.json()).id);
    await page.getByRole('link', { name: 'View your saved enquiries' }).click();
    await page.getByText(`Browser enquiry ${marker}`, { exact: true }).waitFor();
    await context.addCookies([{ name: websiteAdminCookie, value: adminCookie.slice(websiteAdminCookie.length + 1), url: `${base}/api/admin` }]);
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto(`${base}/admin`, { waitUntil: 'domcontentloaded' });
    await page.getByRole('button', { name: 'Enquiries', exact: true }).click();
    await page.getByText(body.message, { exact: true }).waitFor();
    await page.getByRole('button', { name: 'Website Customers', exact: true }).click();
    await page.getByRole('searchbox').fill(emails[0]);
    await page.getByRole('button', { name: 'View activity', exact: true }).click();
    await page.getByRole('heading', { name: 'Recent account activity' }).waitFor();
    console.log('PASS: account UI at 1440/768/390px and live admin enquiry/customer screens.');
  }
  assert.equal((await request('/api/customer/logout', { method: 'POST', cookie: a.cookie, body: {} })).status, 200);
  assert.equal((await request('/api/customer/prices', { cookie: a.cookie })).status, 401);
  assert.equal((await request('/api/customer/enquiries', { cookie: a.cookie })).status, 401);
  const activity = await request(`/api/admin/website-customers?customerId=${a.data.user.id}`, { cookie: adminCookie });
  assert.ok(activity.data.activity.some(a => a.event === 'Signed out'));
  const again = await request('/api/customer/login', { method: 'POST', body: { email: emails[0], password } });
  assert.ok((await request('/api/customer/enquiries', { cookie: again.cookie })).data.enquiries.some(e => e.id === saved.data.id));
  console.log('PASS: signup/login, protected prices, durable enquiries, account isolation, guest isolation, admin visibility/statuses, CSRF checks, logout and history after re-login.');
} finally {
  if (browser) await browser.close();
  const [users] = await pool.execute('SELECT id FROM web_users WHERE email IN (?,?)', emails);
  // Ownership is restricted to the random fixture identities above.
  for (const user of users) {
    await pool.execute('DELETE FROM web_enquiries WHERE customer_id=?', [user.id]);
    await pool.execute('DELETE FROM web_customers WHERE id=?', [user.id]);
    await pool.execute('DELETE FROM web_users WHERE id=?', [user.id]);
  }
  for (const id of enquiryIds) await pool.execute('DELETE FROM web_enquiries WHERE id=?', [id]);
  for (const email of emails) await pool.execute('DELETE FROM web_auth_limits WHERE bucket IN (?,?)', [digest(`register:${email}`), digest(`login:${email}`)]);
  await pool.end();
}
