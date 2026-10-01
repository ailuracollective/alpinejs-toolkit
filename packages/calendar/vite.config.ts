import { defineConfig } from "vite-plus";

// Library packaging via `vp pack` (tsdown): ESM-first, types, and size
// reporting. `alpinejs`, `@ailura/alpinejs-core`, and `date-fns` stay
// external — they are peers, never bundled.
export default defineConfig({
  pack: {
    entry: ["src/index.ts"],
    format: ["esm"],
    minify: true,
    dts: true,
    deps: { neverBundle: ["alpinejs", "@ailura/alpinejs-core", "date-fns"] },
    report: { gzip: true, brotli: true },
    devtools: true,
    publint: true,
    attw: { profile: "esm-only" },
  },
});
