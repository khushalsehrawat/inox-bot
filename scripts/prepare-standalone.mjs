import { access, cp, readdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const output = join(root, '.next');
const standalone = join(output, 'standalone');

// Fail during the build, with a specific error, rather than platform detection.
await access(join(standalone, 'server.js'));
await access(join(output, 'static'));
// Next.js traces the server but does not copy these assets automatically.
await cp(join(root, 'public'), join(standalone, 'public'), { recursive: true });
await cp(join(output, 'static'), join(standalone, '.next', 'static'), { recursive: true });
console.log('Standalone ready: .next/standalone/server.js (public and static assets included).');

// Replace only this generated deployment directory so stale runtime files cannot survive.
const bundle = resolve(root, 'hostinger-build');
if (dirname(bundle) !== resolve(root)) throw new Error('Invalid deployment bundle path.');
await rm(bundle, { recursive: true, force: true });
await cp(standalone, bundle, { recursive: true, verbatimSymlinks: true });

// Keep Next's PORT handling and generated server intact; override inherited hostnames.
const entry = join(bundle, 'server.js');
const server = await readFile(entry, 'utf8');
await writeFile(entry, "process.env.HOSTNAME = '0.0.0.0';\n" + server);
for (const file of ['server.js', 'package.json', '.next/BUILD_ID', 'node_modules/next/package.json']) {
  if (!(await stat(join(bundle, file))).isFile()) throw new Error(`Missing bundle file: ${file}`);
}
for (const directory of ['public', '.next/static']) {
  if (!(await readdir(join(bundle, directory))).length) throw new Error(`Empty bundle assets: ${directory}`);
}
console.log('Hostinger bundle ready: hostinger-build/server.js (complete standalone runtime and assets).');
