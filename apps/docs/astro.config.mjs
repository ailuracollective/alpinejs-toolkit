import { readFileSync } from "node:fs";

import mdx from "@astrojs/mdx";
import starlight from "@astrojs/starlight";
import starlightThemeSix from "@six-tech/starlight-theme-six";
import { getFavIcons } from "@six-tech/starlight-theme-six/utils/favicons";
import { defineConfig } from "astro/config";

import { createUrls, parseEnv } from "./src/config/urls.ts";

const englishSidebar = [
  {
    label: "Overview",
    translations: { es: "Resumen" },
    items: [
      { label: "What is the toolkit", translations: { es: "Qué es el toolkit" }, link: "/" },
      {
        label: "Getting Started",
        translations: { es: "Primeros pasos" },
        link: "/guide/getting-started/",
      },
      { label: "Architecture", translations: { es: "Arquitectura" }, link: "/guide/architecture/" },
    ],
  },
  {
    label: "Foundation",
    translations: { es: "Fundamentos" },
    items: [
      {
        label: "Foundation overview",
        translations: { es: "Fundamentos — vista general" },
        link: "/plugins/foundation/",
      },
      { label: "Core", link: "/plugins/foundation/core/" },
      { label: "UI", link: "/plugins/foundation/ui/" },
      { label: "State Machine", link: "/plugins/foundation/state-machine/" },
      { label: "Testing", link: "/plugins/foundation/testing/" },
      { label: "Plugin Template", link: "/plugins/foundation/plugin-template/" },
    ],
  },
  {
    label: "Primitives",
    translations: { es: "Primitivos" },
    items: [
      {
        label: "Primitives overview",
        translations: { es: "Primitivos — vista general" },
        link: "/plugins/primitives/",
      },
      { label: "Env", link: "/plugins/primitives/env/" },
      { label: "Media", link: "/plugins/primitives/media/" },
      { label: "Notify", link: "/plugins/primitives/notify/" },
      { label: "Selection", link: "/plugins/primitives/selection/" },
      { label: "Collection", link: "/plugins/primitives/collection/" },
      { label: "Child", link: "/plugins/primitives/child/" },
      { label: "Scroll", link: "/plugins/primitives/scroll/" },
      { label: "Calendar", link: "/plugins/primitives/calendar/" },
      { label: "Form", link: "/plugins/primitives/form/" },
      { label: "Gesture", link: "/plugins/primitives/gesture/" },
      { label: "Keyboard", link: "/plugins/primitives/keyboard/" },
      { label: "History", link: "/plugins/primitives/history/" },
      { label: "Timer", link: "/plugins/primitives/timer/" },
      { label: "Toast", link: "/plugins/primitives/toast/" },
      { label: "Transfer", link: "/plugins/primitives/transfer/" },
      { label: "Permissions", link: "/plugins/primitives/permissions/" },
      { label: "Geo", link: "/plugins/primitives/geo/" },
      { label: "Lang", link: "/plugins/primitives/lang/" },
    ],
  },
  {
    label: "Features",
    translations: { es: "Características" },
    items: [
      {
        label: "Features overview",
        translations: { es: "Características — vista general" },
        link: "/plugins/features/",
      },
      { label: "Accordion", link: "/plugins/features/accordion/" },
      { label: "Tabs", link: "/plugins/features/tabs/" },
      { label: "Dialog", link: "/plugins/features/dialog/" },
      { label: "Menu", link: "/plugins/features/menu/" },
      { label: "Tooltip", link: "/plugins/features/tooltip/" },
      { label: "Overlay", link: "/plugins/features/overlay/" },
      { label: "Attention", link: "/plugins/features/attention/" },
      { label: "Theme", link: "/plugins/features/theme/" },
      { label: "Sidebar", link: "/plugins/features/sidebar/" },
      { label: "Carousel", link: "/plugins/features/carousel/" },
      { label: "Command", link: "/plugins/features/command/" },
      { label: "Virtual", link: "/plugins/features/virtual/" },
    ],
  },
  {
    label: "Data",
    translations: { es: "Datos" },
    items: [
      {
        label: "Data overview",
        translations: { es: "Datos — vista general" },
        link: "/plugins/data/",
      },
      { label: "Query", link: "/plugins/data/query/" },
      { label: "Query Adapter (Alpine)", link: "/plugins/data/query-adapter-alpine/" },
      { label: "Query Adapter (Zustand)", link: "/plugins/data/query-adapter-zustand/" },
      { label: "Query Adapter (Nanostores)", link: "/plugins/data/query-adapter-nanostores/" },
      { label: "JSON:API", link: "/plugins/data/json-api/" },
    ],
  },
];

// GitHub Pages project site — everything in `public/` is served under this prefix.
//
// `base` is deliberately left unset: setting it would make the dev server serve
// the whole site under `/alpinejs-toolkit/`, which is not a URL worth visiting.
// But `<head>` entries are emitted verbatim — Astro does not prefix them with
// `base` the way it does asset imports — so the links below must carry the
// prefix themselves, and those then 404 in dev, where `public/` is served from
// `/`. So the prefix is build-only: in dev every link stays root-relative.
//
// `astro dev` is the only subcommand that gets the unprefixed links, and a
// failed detection must never ship root-relative asset links to GitHub Pages,
// hence the positive test for dev rather than for build.
const basePath = "/";

/*
 * The cross-project URLs come from the environment, defaulting to the values
 * that used to be hardcoded so a clone with no `.env` still builds and its
 * canonical URLs still match what is already deployed. See
 * `src/config/urls.ts` and `.env.example`.
 *
 * `defineConfig` takes a function because the env has to be read here, at
 * config time, where `import.meta.env` does not exist: Astro only statically
 * replaces it inside source files, so `site:` and the Starlight options below
 * — which this file evaluates, not any component — cannot read it.
 *
 * `process.env` is spread last so a real deploy variable beats a checked-in
 * `.env`. `parseEnv` and `createUrls` are the same two functions
 * `src/config/urls.ts` calls at runtime, so the defaults and the trailing-slash
 * handling are written once and cannot drift between the config and the
 * components.
 */
let fromFile = {};
try {
  fromFile = parseEnv(readFileSync(new URL(".env", import.meta.url), "utf8"));
} catch {
  // Having no `.env` is the normal case, not an error: the defaults cover it.
}

const { repoUrl, docsUrl } = createUrls({ ...fromFile, ...process.env });

export default defineConfig({
  site: docsUrl,
  trailingSlash: "always",
  integrations: [
    starlight({
      // `root` is what tells Starlight the default language is served unprefixed.
      // Declaring `en` as a normal locale instead makes Starlight emit `/en/...`
      // links while the pages themselves stay at the root, and every one of them
      // 404s. See slugToLocale() in the Starlight source.
      locales: {
        root: { label: "English", lang: "en" },
        es: {
          label: "Español",
          lang: "es",
          description:
            "40 paquetes @ailura/alpinejs-*. Los controladores manejan el estado, Alpine maneja la reactividad.",
          editUrl: false,
        },
      },
      plugins: [
        starlightThemeSix({
          navLinks: [
            {
              label: "GitHub",
              link: repoUrl,
              attrs: { target: "_blank" },
            },
          ],
          // Neutral on purpose: the theme's `footerText` is a single global string with no
          // per-locale hook, and overriding PageFrame.astro to localize one line would
          // mean copying 207 lines of theme layout. The tagline already lives in
          // the hero and the meta description.
          footerText: "Alpine.js Toolkit — 40 packages",
        }),
      ],
      title: "Alpine.js Toolkit",
      description: "40 @ailura/alpinejs-* packages. Controllers own state; Alpine owns reactivity.",
      // Must be a relative path: Starlight turns these into real image imports
      // (`virtual:starlight/user-images`) so `SiteTitle` gets width/height.
      // Copies of the root `logo.svg` / `logo-dark.svg`; keep them in sync.
      logo: {
        light: "./src/assets/logo-dark.svg",
        dark: "./src/assets/logo.svg",
        alt: "Alpine.js Toolkit",
      },
      // Starlight emits its own `rel="shortcut icon"` from this option, and it
      // outranks the links below in the <head>, so it has to point at ours.
      // `base` is unset, so `fileWithBase` is a no-op: pass the full path.
      favicon: `${basePath}favicon.svg`,
      head: [
        ...getFavIcons({ basePath, themeColor: "#0f111d" }),
        // Dark-ink favicon for dark browser tabs (the default one is the light-ink mark).
        {
          tag: "link",
          attrs: {
            rel: "icon",
            type: "image/svg+xml",
            href: `${basePath}favicon-dark.svg`,
            media: "(prefers-color-scheme: dark)",
          },
        },
      ],
      social: [{ icon: "github", label: "GitHub", href: repoUrl }],
      // Routes view transitions through a Head override: enabled on doc pages
      // only, so the splash home page is always a real page load.
      components: {
        Head: "./src/components/starlight/Head.astro",
      },
      customCss: ["./src/styles/custom.css"],
      sidebar: englishSidebar,
    }),
    mdx(),
  ],
  // `lightningcss` (Astro's default CSS minifier) rejects a selector in the theme's
  // stylesheet, so hand minification to esbuild. Mirrors the reference project.
  vite: {
    build: {
      cssMinify: "esbuild",
    },
  },
});
