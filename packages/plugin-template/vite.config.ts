import { defineConfig } from "vite-plus";

// Library packaging via `vp pack` (tsdown): ESM-first, types, and size
// reporting. `alpinejs` stays external — it is a peer, never bundled.
export default defineConfig({
  pack: {
    entry: ["src/index.ts"],
    format: ["esm"],
    minify: true,
    dts: true,
    deps: { neverBundle: ["alpinejs"] },
    report: { gzip: true, brotli: true },
    devtools: true,
    publint: true,
    // ESM-only package by design (browser Alpine.js plugins): skip the
    // CJS-resolution checks, keep the ESM/node16 type-resolution checks.
    attw: { profile: "esm-only" },
  },
});
