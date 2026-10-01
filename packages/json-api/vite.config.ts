import { defineConfig } from "vite-plus";
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
