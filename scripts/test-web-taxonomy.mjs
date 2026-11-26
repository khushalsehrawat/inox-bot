import http from "node:http";
import net from "node:net";
import { spawn, spawnSync } from "node:child_process";
import { mkdtemp, cp, symlink } from "node:fs/promises";
import { join } from "node:path";
const root = process.cwd();
const dir = await mkdtemp(join(root, ".test-web-taxonomy-"));
for (const name of [
  "src",
  "public",
  "next.config.ts",
  "tsconfig.json",
  "package.json",
  "postcss.config.mjs",
  "next-env.d.ts",
  "AGENTS.md",
])
  await cp(join(root, name), join(dir, name), { recursive: true });
await symlink(
  join(root, "node_modules"),
  join(dir, "node_modules"),
  process.platform === "win32" ? "junction" : "dir",
);
const mock = http.createServer(async (req, res) => {
  res.setHeader("Content-Type", "application/json");
  if (req.url === "/api/v1/admin/login" && req.method === "POST") {
    let text = "";
    for await (const chunk of req) text += chunk;
    const body = JSON.parse(text);
    if (body.email === "admin@example.test" && body.password === "test-only") {
      res.end(
        JSON.stringify({
          success: true,
          data: {
            accessToken: "isolated-test-admin",
            expiresIn: 900,
            user: { role: "admin" },
          },
        }),
      );
      return;
    }
  }
  if (
    req.url === "/api/v1/admin/me" &&
    req.headers.authorization === "Bearer isolated-test-admin"
  ) {
    res.end(
      JSON.stringify({
        success: true,
        data: { id: "test-admin", role: "admin" },
      }),
    );
    return;
  }
  res.statusCode = 401;
  res.end(JSON.stringify({ success: false }));
});
await new Promise((resolve) => mock.listen(0, "127.0.0.1", resolve));
const port = await new Promise((resolve) => {
  const socket = net.createServer();
  socket.listen(0, "127.0.0.1", () => {
    const port = socket.address().port;
    socket.close(() => resolve(port));
  });
});
const base = `http://127.0.0.1:${port}`;
const env = {
  ...process.env,
  INOX_API_ORIGIN: `http://127.0.0.1:${mock.address().port}`,
  WEB_CATALOGUE_DATA_DIR: join(dir, "data"),
  WEB_TAXONOMY_TEST_URL: base,
};
let logs = "";
const server = spawn(
  process.execPath,
  [
    join(root, "node_modules/next/dist/bin/next"),
    "dev",
    "--hostname",
    "127.0.0.1",
    "--port",
    String(port),
    "--webpack",
  ],
  { cwd: dir, env, windowsHide: true, stdio: ["ignore", "pipe", "pipe"] },
);
server.stdout.on("data", (chunk) => {
  logs += chunk;
});
server.stderr.on("data", (chunk) => {
  logs += chunk;
});
try {
  let ready = false;
  for (let i = 0; i < 120; i++) {
    if (server.exitCode !== null)
      throw new Error("Isolated Next.js server exited.");
    if (logs.includes("Module not found"))
      throw new Error("Isolated server module resolution failed.");
    try {
      const response = await fetch(`${base}/api/web/categories`, {
        signal: AbortSignal.timeout(20000),
      });
      if (response.ok) {
        ready = true;
        break;
      }
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  if (!ready) throw new Error("Isolated test server did not start.");
  console.log(
    `Testing web categories with isolated service and database. Test server PID ${server.pid}. No production writes.`,
  );
  const test = spawn(
    process.execPath,
    [
      join(root, "node_modules/@playwright/test/cli.js"),
      "test",
      "--config",
      "playwright-taxonomy.config.ts",
    ],
    { cwd: root, env, windowsHide: true, stdio: "inherit" },
  );
  process.exitCode = await new Promise((resolve) =>
    test.on("exit", (code) => resolve(code ?? 1)),
  );
  if (process.exitCode) console.error(logs.slice(-9000));
} catch (error) {
  console.error(error.message);
  console.error(logs.slice(-9000));
  process.exitCode = 1;
} finally {
  if (process.platform === "win32")
    spawnSync("taskkill", ["/PID", String(server.pid), "/T", "/F"], {
      windowsHide: true,
      stdio: "ignore",
    });
  else server.kill("SIGTERM");
  mock.closeAllConnections();
  mock.close();
  server.stdout.destroy();
  server.stderr.destroy();
  server.unref();
  setTimeout(() => process.exit(process.exitCode || 0), 300);
}
