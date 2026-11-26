import type { NextConfig } from "next";
const config: NextConfig = {
  // Isolated dev tests may use another directory; deployment always emits .next.
  distDir: process.env.NODE_ENV === "development"
    ? process.env.WEB_TEST_DIST_DIR || ".next"
    : ".next",
  async rewrites() {
    return [{ source: "/honeycomb", destination: "/honeycomb/index.html" }];
  },
  poweredByHeader: false,
  allowedDevOrigins: ["127.0.0.1"],
  output: "standalone",

};
export default config;
