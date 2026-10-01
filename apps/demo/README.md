# @ailura/demo — playground

Interactive playground for the `@ailura/alpinejs-*` packages. Every plugin gets a
live page: no docs, no prose — the demos are the documentation.

```sh
pnpm --filter @ailura/demo dev     # http://localhost:4321
pnpm --filter @ailura/demo build   # static output in dist/
pnpm --filter @ailura/demo check   # astro check + tsc
pnpm --filter @ailura/demo test    # the demo suite
```

## How it works

- **Astro 7 + Tailwind 4.** The app is static; the only client bundle is
  `src/alpine-boot.ts`, which registers the 36 toolkit plugins plus 4
  `@alpinejs/*` companions on one Alpine instance.
- **Packages resolve to source.** `astro.config.ts` and `tsconfig.json` alias
  `@ailura/alpinejs-<name>` to `packages/<name>/src/index.ts`, so the playground
  always runs the working tree instead of a stale `dist/`.
- **`src/catalog`** is the single source of truth for navigation: the package
  list, the layer it belongs to (Foundation / Primitives / Features / Data), the
  families that group related packages, and the package each demo page renders.
- **`src/demo/*.ts`** holds the Alpine data components the demos need (calendar
  grid, collection, query, JSON:API, toast renderer, permission adapters).
- **`src/components/demos/*.astro`** is one demo per package, mapped to the
  catalog id in `src/demo/playground-demos.ts`.

The design tokens (an iOS/Cupertino palette with light and dark modes) live in
`src/styles/global.css`; `src/styles/sonner.css` styles the toast renderer.

## Writing a demo page

A demo page is a fragment, not a page: one `DemoSection` sourced from the
catalog, containing examples that call the real package. It does not lay out,
take props, print the package name, or reimplement what it demonstrates.

The full contract is [`agents/DEMO.template.md`](../../agents/DEMO.template.md).

```astro
---
import { getPluginNavItem } from "../../plugin-nav";
import DemoButton from "../astro/DemoButton.astro";
import DemoSection from "../DemoSection.astro";

const plugin = getPluginNavItem("<catalog-id>")!;
---

<DemoSection id={plugin.id} title={plugin.title} api={plugin.api} description={plugin.description}>
	<DemoButton @click="$store.<name>.<method>()"><method>()</DemoButton>
</DemoSection>
```

The rules are enforced by `test/demo-page-contract.test.ts`, which reads each
page's text and checks it against the packages' own declarations — the
`*Store`/`*Magic` types and the `DEFAULT_*_KEY` constants, read with the
TypeScript compiler. Nothing in the test is a hand-written list of member names,
so it cannot go stale.

```sh
pnpm exec vp test apps/demo/test/demo-page-contract.test.ts
```

Every failure carries a code (`genuine/declared-member`, `structure/no-props`,
…) and a one-line reason. Fix the page, not the rule.

## Testing

Vitest, in three tiers, because Vitest cannot transform `.astro` — no demo page
is ever executed by this app's own tests.

| Tier        | What it does                                                   | Files                                                   |
| ----------- | -------------------------------------------------------------- | ------------------------------------------------------- |
| Data        | Imports the catalog and navigation and checks their invariants | `catalog`, `playground-navigation`, `playground-demos`  |
| Source text | Parses `.astro` files as text and checks their wiring          | `template-scopes`, `demo-page-contract`, `history-demo` |
| Real Alpine | Mounts real Alpine against hand-written markup                 | `permissions-links`, `timer-demo`, `sonner-stack`       |
| Environment | Checks the app's own wiring — icons resolve, modules resolve   | `playground-icons`, `module-resolution`                 |

The third tier is the weakest link and worth knowing about: it exercises the
package, not the page, because it cannot mount the page. What protects the pages
themselves is the second tier, and `test/helpers/package-surface.ts` — the one
place that decides what "a member of this package" means.

Two of those tests read another package's source rather than importing it,
because importing does not work: `@lucide/astro` re-exports `Icon.astro` and
`@ailura/alpinejs-core` is an `.astro`-free TS package that `tsc` can only
resolve through its built output unless `tsconfig.json` declares it.
`module-resolution.test.ts` is what keeps that honest — it compares
`tsconfig.json`'s `paths` against the alias map the bundler derives, in both
directions, so the two cannot quietly disagree about whether a specifier points
at `src/` or a stale `dist/`.
