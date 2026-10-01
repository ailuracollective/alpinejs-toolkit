import { fileURLToPath } from "node:url";

import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "astro/config";

import { buildSourceAliases } from "./src/lib/package-aliases.js";

const root = fileURLToPath(new URL(".", import.meta.url));

const packageAliases = buildSourceAliases(`${root}../../packages`, (message) =>
  process.stderr.write(`[demo] ${message}\n`)
);

// https://astro.build/config
export default defineConfig({
  trailingSlash: "always",
  vite: {
    plugins: [tailwindcss()],
    // `@ailura/alpinejs-carousel` lazy-imports Embla from inside the controller
    // (`await import("embla-carousel")`) so the ~30 kB never lands in the
    // initial bundle. A dynamic import, though, is a dependency Vite's optimizer
    // only discovers once that code path runs in the browser: it pre-bundles on
    // the fly, the in-flight request is invalidated, and the dev server answers
    // `504 (Outdated Optimize Dep)`.
    //
    // Naming them here moves the discovery to startup. Pre-bundling does not put
    // anything in the initial bundle — it only means the module is *ready* when
    // the dynamic import asks for it — so the lazy design is untouched.
    optimizeDeps: {
      include: ["embla-carousel", "embla-carousel-autoplay"],
    },
    resolve: {
      alias: {
        "@": `${root}src`,
        ...packageAliases,
      },
    },
  },
});
