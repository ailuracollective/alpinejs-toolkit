import { defineConfig } from "vite-plus";

// Library packaging via `vp pack` (tsdown): ESM-first, types, and size
// reporting. `alpinejs` and `@ailura/alpinejs-core` stay external — they are
// peers, never bundled (peers fuera).
export default defineConfig({
  pack: {
    entry: ["src/index.ts"],
    format: ["esm"],
    minify: true,
    dts: true,
    deps: { neverBundle: ["alpinejs", "@ailura/alpinejs-core"] },
    report: { gzip: true, brotli: true },
    devtools: true,
    publint: true,
    attw: { profile: "esm-only" },
  },
});
