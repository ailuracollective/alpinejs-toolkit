import { defineConfig } from "vite-plus";

// Library packaging via `vp pack` (tsdown): ESM-first, types, and size
// reporting. `alpinejs` stays external — it is a peer, never bundled.
// `@ailura/alpinejs-core` stays external too — it is a runtime
// dependency, never bundled.
export default defineConfig({
  pack: {
    // Barrel plus one entry per layer: consumers importing a single layer
    // (e.g. `@ailura/alpinejs-ui/storage`) load only that layer's output
    // instead of the full barrel. The barrel stays the compat entry.
    entry: ["src/index.ts", "src/storage.ts", "src/portal.ts", "src/media.ts", "src/types.ts"],
    format: ["esm"],
    minify: true,
    dts: true,
    deps: { neverBundle: ["alpinejs", "@ailura/alpinejs-core"] },
    report: { gzip: true, brotli: true },
    devtools: true,
    publint: true,
    // ESM-only package by design (browser Alpine.js plugins): skip the
    // CJS-resolution checks, keep the ESM/node16 type-resolution checks.
    attw: { profile: "esm-only" },
  },
});
