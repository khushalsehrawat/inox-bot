import { defineConfig } from "@playwright/test";
import base from "./playwright.config";
export default defineConfig({
  ...base,
  testDir: "./tests/taxonomy-browser",
  use: { ...base.use, baseURL: process.env.WEB_TAXONOMY_TEST_URL },
  workers: 1,
  timeout: 60_000,
});
