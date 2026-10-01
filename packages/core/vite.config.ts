import { defineConfig } from "vite-plus";

// Library packaging via `vp pack` (tsdown): ESM-first, types, and size
// reporting. `alpinejs` stays external — it is a peer, never bundled.
export default defineConfig({
  test: {
    setupFiles: ["./test/setup.ts"],
  },
  pack: {
    // Barrel plus one entry per layer: consumers importing a single layer
    // (e.g. `@ailura/alpinejs-core/env`) load only that layer's output
    // instead of the full barrel. The barrel stays the compat entry.
    entry: [
      "src/index.ts",
      "src/bridge.ts",
      "src/constants.ts",
      "src/controller.ts",
      "src/directives.ts",
      "src/env.ts",
      "src/errors.ts",
      "src/guards.ts",
      "src/ids.ts",
      "src/invariant.ts",
      "src/registration.ts",
      "src/singletons.ts",
      "src/sync.ts",
    ],
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
