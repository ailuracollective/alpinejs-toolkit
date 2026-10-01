import { defineConfig } from "vite-plus";

// Library packaging via `vp pack` (tsdown): ESM-first, types, and size
// reporting. `alpinejs` stays external — it is a peer, never bundled.
// Toolkit workspace deps stay external too — they are peers, never bundled
// (consistent with old `@ailura/alpinejs-theme` pattern: peers fuera).
export default defineConfig({
  test: {
    environment: "happy-dom",
  },
  pack: {
    entry: ["src/index.ts"],
    format: ["esm"],
    minify: true,
    dts: true,
    deps: {
      neverBundle: [
        "alpinejs",
        "@ailura/alpinejs-core",
        "@ailura/alpinejs-state-machine",
        "@ailura/alpinejs-ui",
      ],
    },
    report: { gzip: true, brotli: true },
    devtools: true,
    publint: true,
    // ESM-only package by design (browser Alpine.js plugins): skip the
    // CJS-resolution checks, keep the ESM/node16 type-resolution checks.
    attw: { profile: "esm-only" },
  },
});
