import { defineConfig } from "@playwright/test";
import { existsSync, readdirSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
const cache = join(homedir(), "AppData", "Local", "ms-playwright");
const installed =
  process.platform === "win32" && existsSync(cache)
    ? readdirSync(cache)
        .filter((s) => /^chromium-\d+$/.test(s))
        .sort()
        .reverse()
        .map((s) => join(cache, s, "chrome-win64", "chrome.exe"))
        .find(existsSync)
    : undefined;
export default defineConfig({
  testDir: "./tests/browser",
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL || "http://127.0.0.1:3000",
    browserName: "chromium",
    launchOptions: {
      executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || installed,
    },
  },
  workers: 1,
  reporter: "list",
});
