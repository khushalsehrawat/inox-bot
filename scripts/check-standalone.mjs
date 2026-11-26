// Read-only HTTP checks. No login, admin requests, migrations or database writes.
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { setTimeout } from 'node:timers/promises';
import nextEnv from '@next/env';

nextEnv.loadEnvConfig(process.cwd(), false);
const socket = createServer();
await new Promise(resolve => socket.listen(0, '127.0.0.1', resolve));
const port = socket.address().port;
await new Promise(resolve => socket.close(resolve));
const server = spawn(process.execPath, ['hostinger-build/server.js'], {
  env: { ...process.env, NODE_ENV: 'production', HOSTNAME: 'invalid-inherited-hostname', PORT: String(port) },
  windowsHide: true,
  stdio: 'ignore',
});
let exited = false;
server.on('exit', () => { exited = true; });
try {
  const base = `http://127.0.0.1:${port}`;
  let ready = false;
  for (let attempt = 0; attempt < 60; attempt++) {
    if (exited) throw new Error('Standalone process exited before readiness.');
    try { await fetch(`${base}/fonts/manrope-OFL.txt`); ready = true; break; }
    catch { await setTimeout(500); }
  }
  if (!ready) throw new Error('Standalone readiness timeout.');
  const failures = [];
  for (const path of ['/', '/products', '/api/web/categories', '/fonts/manrope-variable.ttf']) {
    const response = await fetch(`${base}${path}`);
    console.log(`${path}: HTTP ${response.status}`);
    if (!response.ok) { failures.push(path); continue; }
    if (path === '/') {
      const html = await response.text();
      const asset = html.match(/(?:src|href)="([^" ]*\/_next\/static\/[^" ]+)"/);
      if (!asset) throw new Error('No static asset found in home page.');
      const staticResponse = await fetch(new URL(asset[1].replaceAll('&amp;', '&'), base));
      console.log(`Next static asset: HTTP ${staticResponse.status}`);
      if (!staticResponse.ok) throw new Error('Standalone static asset failed.');
    }
    if (path === '/api/web/categories') {
      const body = await response.json();
      if (!Array.isArray(body.categories)) throw new Error('Invalid category API response.');
      console.log(`Published categories: ${body.categories.length}`);
    }
  }
  if (failures.length) throw new Error(`Read-only checks failed: ${failures.join(', ')}`);
} finally {
  server.kill();
}
