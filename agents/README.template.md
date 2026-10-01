# @ailura/alpinejs-{{kebab}}

<p align="center">

[![bundlephobia minzip](https://badgen.net/bundlephobia/minzip/@ailura/alpinejs-{{kebab}})](https://bundlephobia.com/package/@ailura/alpinejs-{{kebab}})

</p>

> One-line description — what it does + key capabilities + built on `@ailura/alpinejs-core`. The controller is framework-agnostic; the plugin exposes it as `$store.{{camel}}`.

<!--
  TEMPLATE for all @ailura/alpinejs-* packages.
  Placeholders: {{kebab}} = my-package, {{Pascal}} = MyPackage, {{camel}} = myPackage,
                {{SCREAMING}} = MY_PACKAGE
  Layer: choose one — Foundation | Primitives | Features | Data | Template
  Delete this comment block before publishing.
  See ARCHITECTURE.md §2/§11 for layer assignment and §3 for canon.

  WHO FILLS THE PLACEHOLDERS: you do, by hand. `scripts/new-plugin.mjs`
  substitutes only `plugin-template` and `pluginTemplate`, and only in files it
  copies out of `packages/plugin-template/` — which is not this file. Nothing in
  the repo expands `{{…}}`.

  THE FILE MUST BE `packages/<name>/README.md`. `apps/demo/test/catalog.test.ts`
  asserts `readmePath === packages/${folder}/README.md` for all 37 catalog
  entries, and `apps/demo/src/plugin-nav.ts` links the README from every demo
  page — so the name and location are load-bearing, not conventional.
-->

## Installation

```sh
pnpm add @ailura/alpinejs-{{kebab}} alpinejs
# or
npm install @ailura/alpinejs-{{kebab}} alpinejs
```

Requires `alpinejs@^3.0.0` as peer. `@ailura/alpinejs-core` is a **peer
dependency**, not a dependency: no `packages/*/package.json` has a
`dependencies` block at all, so the host installs it too. Add it to your install
line when the package declares it.

<!-- VARIANT — Foundation (core/ui/state-machine): replace the line above with:
     Zero toolkit peers — foundation for all other packages. — for core
     Depends only on `@ailura/alpinejs-core`. — for ui / state-machine
     VARIANT — Third-party peer (carousel/calendar/adapters): the install line and the
     sentence both change. List every peer the package declares, not just the toolkit's.
       ```sh
       pnpm add @ailura/alpinejs-{{kebab}} alpinejs embla-carousel
       ```
       Requires `alpinejs@^3.0.0` and `embla-carousel@^8.0.0` as peers. `@ailura/alpinejs-core`
       is a peer dependency, not a dependency — the host installs it too.
     The three query adapters also peer on `@ailura/alpinejs-query`, and
     `query-adapter-nanostores` / `query-adapter-zustand` peer on `nanostores` / `zustand`.
     VARIANT — Dev-only (testing): replace whole block with:
     ```sh
     pnpm add -D @ailura/alpinejs-{{kebab}} alpinejs
     ```
     Dev-only, `private: true`, never published. Never import from plugin runtime or bundle
     into `dist`. Requires `alpinejs@^3.0.0` as peer. Also drop the bundlephobia badge above —
     an unpublished package has no bundlephobia page.
     VARIANT — Scaffold (plugin-template): replace with generator instructions (not published).
-->

## Usage

### 1. Standalone (framework-agnostic)

```ts
import { create{{Pascal}}Controller } from "@ailura/alpinejs-{{kebab}}";

// The factory mounts the controller for you — there is no second mount() call.
const ctrl = create{{Pascal}}Controller({ id: "main" });

ctrl.on("change", (detail) => {
  // Read the real fields of this package's {{Pascal}}ChangeDetail. `current`
  // exists only on state-machine and theme; most packages carry ids and a
  // `source` discriminator instead.
  console.log(detail.source, detail);
});

// ctrl.destroy() when done — every mutator after it is a silent no-op
```

### 2. Alpine

```ts
import Alpine from "alpinejs";
import {{camel}}Plugin from "@ailura/alpinejs-{{kebab}}";

Alpine.plugin({{camel}}Plugin()); // options — document the real ones
Alpine.start();
```

```html
<!-- Replace with REAL markup for this package: the store, the magic or the
     directive it actually registers. Copy a working block from this package's
     own demo page (apps/demo/src/components/demos/{{Pascal}}Demo.astro). -->
<div x-data>
  <!-- $store.{{camel}}.* — the store methods, with their real arity -->
  <!-- ${{camel}} — only if this package registers a magic -->
  <!-- x-{{camel}} — only if this package registers a directive (see the
       note below: the real ones are flat, never x-{{kebab}}:verb) -->
</div>
```

**There is no `x-{{kebab}}:trigger` and no `x-{{kebab}}:panel`.** No package in
this toolkit registers a namespaced directive. All nine that register one use a
flat name registered through `guardDirective`, and every one of the nine is a
flat, single-segment string:

| Package     | Directive          | Constant                          |
| ----------- | ------------------ | --------------------------------- |
| `child`     | `x-child`          | `DEFAULT_CHILD_DIRECTIVE_KEY`     |
| `carousel`  | `x-carousel`       | `DEFAULT_CAROUSEL_DIRECTIVE_KEY`  |
| `dialog`    | `x-dialog`         | `DEFAULT_DIALOG_DIRECTIVE_KEY`    |
| `gesture`   | `x-gesture`        | `DEFAULT_GESTURE_DIRECTIVE_KEY`   |
| `keyboard`  | `x-keyboard`       | `DEFAULT_KEYBOARD_DIRECTIVE_KEY`  |
| `menu`      | `x-menu`           | `DEFAULT_MENU_DIRECTIVE_KEY`      |
| `selection` | `x-selection`      | `DEFAULT_SELECTION_DIRECTIVE_KEY` |
| `tooltip`   | `x-tooltip`        | `DEFAULT_TOOLTIP_DIRECTIVE_KEY`   |
| `virtual`   | `x-virtual-scroll` | `DEFAULT_VIRTUAL_DIRECTIVE_KEY`   |

So a Features README that has no directive says so in the negative rather than
inventing one — `accordion/README.md` and `tabs/README.md` both carry an
explicit "there is no `x-accordion:trigger`" line, and that is the pattern.

<!--
  USAGE — CHOOSE THE PATTERN THAT MATCHES YOUR PACKAGE:

  A) Store + controller (accordion, tabs, dialog, menu, tooltip, carousel, calendar, etc.):
     Keep both subsections as above. `storeKey` renames the `$store` key;
     `magicKey` is only an option if the package registers a magic — 16 of 40 do.
     Do not document an option the package does not declare.

  B) Directive (child, carousel, dialog, gesture, keyboard, menu, selection, tooltip, virtual):
     A directive package is still a **plugin factory**, not a bare directive
     callback — it takes options and calls `guardDirective` itself. `child` is the
     smallest real example:
     ```ts
     import Alpine from "alpinejs";
     import childPlugin from "@ailura/alpinejs-child";

     Alpine.plugin(childPlugin());
     Alpine.start();
     ```
     ```html
     <div x-child class="my-wrapper-classes">
       <button>inherits the wrapper's classes, attributes and handlers</button>
     </div>
     ```
     Note the shape: `x-child` on a wrapper, and the element that inherits is
     the single child inside it. Use the class names this package documents,
     not demo-app Tailwind.

  C) Magic (env, notify, transfer, attention, timer, permissions, query, and the
     others that export a `*Magic`): `geo` is a **store**, not a magic, so it
     does not belong in this list. Replace subsection 2 with real calls:
     ```html
     <div x-data>
       <span x-text="$env.network.online ? "online" : "offline""></span>
       <button @click="$notify.send("Saved")">Notify</button>
     </div>
     ```
     There is no `$env.isOnline` and no `$notify.show` — the real members are on
     the `*Magic` interface, so read `packages/{{kebab}}/src/types.ts` and
     document what is actually there. List every magic the package registers.

  D) Data / adapter (query, query-adapter-*, json-api):
     Replace the standalone example with the real adapter setup. The adapter
     factories take their host as an argument, and the name is
     `create<Framework>StoreAdapter`, not `create<Framework>Adapter`:
     ```ts
     import Alpine from "alpinejs";
     import { createQueryController } from "@ailura/alpinejs-query";
     import { createAlpineStoreAdapter } from "@ailura/alpinejs-query-adapter-alpine";

     const ctrl = createQueryController({ adapter: createAlpineStoreAdapter(Alpine) });
     ```
     Siblings: `createZustandStoreAdapter(store)`, `createNanostoresStoreAdapter(atom)`.

  E) Foundation / infra (core, ui, state-machine, testing):
     Replace both subsections with subpath imports. `core` ships twelve modules
     and a barrel; see core/ui/testing READMEs as the reference.

  RULE: Every code block must be copy-paste runnable. No `{ ... }` and no
  `/* options */` in a published README — those read as documentation of an API
  that does not exist. Quote style is double quotes throughout: `vite.config.ts`
  sets `fmt.singleQuote: false`, and all 40 READMEs are written that way.
-->

## API

### Exports

| Export                            | Description                                                             | Type       |
| --------------------------------- | ----------------------------------------------------------------------- | ---------- |
| `{{Pascal}}Controller`            | Framework-agnostic controller — owns state, emits `change`              | `class`    |
| `create{{Pascal}}Controller`      | Factory — mounts and returns a controller                               | `function` |
| `{{camel}}Plugin`                 | Alpine plugin factory — also the `default` export                       | `function` |
| `DEFAULT_{{SCREAMING}}_STORE_KEY` | Default `Alpine.store()` key (e.g. `"{{kebab}}"`)                       | `string`   |
| `{{Pascal}}Options`               | Per-instance options — the shape the instance methods take              | `type`     |
| `{{Pascal}}ChangeSource`          | Discriminator — `'user' \| 'initialization'`                            | `type`     |
| `{{Pascal}}ChangeDetail`          | `change` payload — a flat interface, e.g. `{ instanceId, ids, source }` | `type`     |
| `{{Pascal}}Store`                 | The Alpine-facing surface, i.e. everything on `$store.{{camel}}.*`      | `type`     |
| `{{Pascal}}Events`                | Event map for `controller.on('change', …)` — one key, one payload       | `type`     |

<!--
  API — RULES:
  - One row per actual export from src/index.ts. No invented rows. Run
    `grep -E '^export' packages/{{kebab}}/src/index.ts` — every export appears here.
  - There is NO `{{camel}}Options` identity helper. It used to be exported by
    every package, had zero call sites, and was removed as dead code
    (ARCHITECTURE.md §5). Do not add the row.
  - There is NO `{{camel}}` shorthand alias for `{{camel}}Plugin`. No package
    exports one: the barrel is `export { xPlugin, xPlugin as default }`.
  - `DEFAULT_{{SCREAMING}}_MAGIC_KEY` only if the package registers a magic
    (16 of 40 do). `DEFAULT_{{SCREAMING}}_DIRECTIVE_KEY` only if it registers a
    directive (9 of 40). `create{{Pascal}}StoreFromController` only if it exists
    (accordion and tabs only).
  - A `*ChangeDetail` is a flat `interface` with a `source` field, NOT a
    discriminated union. The union of `'user' | 'initialization'` is the
    separate `*ChangeSource` type, and it gets its own row.
  - Descriptions must be specific: what it does, key params, what it returns/throws.
  - BAD: "Public type / interface" / "Utility export" / "Factory for framework-agnostic controller"
  - GOOD: "Resolves retry delay — `(attempt: number) => number`, default exponential backoff"
  - If package exposes subpaths (core/ui), add a separate "Subpaths" subsection.
  - If package has no Alpine plugin (adapters), omit plugin rows and document the adapter contract.
  - ESCAPE A `|` INSIDE A TABLE CELL as `\|`, or the row splits into two.
-->

### Store API

```ts
// Real store calls, with the real arity. There is no universal `register()`:
// the method that creates an instance is package-specific (`create()` in
// accordion and tabs). Read the `{{Pascal}}Store` interface and use its names.
$store.{{camel}}.create("{{kebab}}-1");
$store.{{camel}}.toggle("{{kebab}}-1", "item-1");
```

| Method           | Description                                                                            |
| ---------------- | -------------------------------------------------------------------------------------- |
| `method(arg, …)` | What it does, and what it does on an unknown id — a no-op, a throw, or a silent no-op. |

### Options

```ts
interface Create{{Pascal}}Options {
  id?: string; // controller id — defaults to generateId("{{kebab}}")
  storeKey?: string; // $store key — default DEFAULT_{{SCREAMING}}_STORE_KEY
  // magicKey?: string;  — only if the package registers a magic
}
```

Document each option in a table with its **type, default and effect**, and say
what ignores it: `storeKey` is a plugin option and the standalone
`create{{Pascal}}Controller()` ignores it.

### Avoiding name collisions

If your application already owns a `$store.{{camel}}` or another toolkit plugin registers on that name, rename the integration surface without touching the controller:

```ts
Alpine.plugin({{camel}}Plugin({ storeKey: "my{{Pascal}}" })); // → $store.my{{Pascal}}
```

The exposed constant `DEFAULT_{{SCREAMING}}_STORE_KEY` keeps the rename discoverable from TypeScript.

### Events

```ts
// Emitted via controller.on("change", (detail) => …)
interface {{Pascal}}ChangeDetail {
  readonly instanceId: string;
  readonly source: {{Pascal}}ChangeSource; // 'user' | 'initialization'
}
```

Document every field, and note which operations do **not** emit — a no-op
`toggle()` usually emits nothing, and a reader who assumes otherwise will build
a bug on top of it.

## {Feature-specific section}

<!--
  30 of 40 packages have one or two of these, and they are the part a reader
  actually uses the README for: the behaviour that is not obvious from the API
  table. A title is a claim ("Roving tabindex: bind `tabindex` on its own",
  "Retry, staleTime and what \"fetch\" means"), not a label.
-->

{Description of a key feature or use case}

```html
<!-- Example usage -->
```

## {Another feature section}

{Description of another feature}

```ts
// Code example
```

## SSR

> SSR-safe — no `window`/`document` at import time. Uses `safeWindow`/`safeDocument` from `@ailura/alpinejs-core/env`.

<!--
  37 of 40 packages have this section. `ui`, `toast` and `plugin-template` do not —
  for those, either document the equivalent in Integration or drop it.

  VARIANT — if package touches matchMedia/storage/portal:
  > SSR-safe — no `window`/`document` at import time. Storage adapters noop on server; `createMediaQueryListener` guards `matchMedia`.
  VARIANT — core (by design):
  > SSR-safe by design — no `window`/`document` at import time. All env access via `safeWindow`/`safeDocument`/`safeMatchMedia`.
  VARIANT — testing (dev-only):
  > Test helpers run in `happy-dom`/`jsdom`. Not SSR-relevant.
-->

## Accessibility

<!-- Include when the package manages ARIA or keyboard interaction — that is 19 of
     40 today, and it is NOT the same set as the Features layer: `child`,
     `collection`, `history`, `media`, `scroll` and `selection` are Primitives
     and all ship this section. Omit it for Data and for packages with no ARIA
     surface at all. -->

- Roles/attributes managed: `aria-expanded`, `aria-controls`, etc. (list real ones)
- Keyboard: `ArrowDown`/`ArrowUp`/`Home`/`End`/`Escape` — describe actual bindings
- Focus: roving tabindex / focus trap / restore — describe actual behavior
- Reference: [WAI-ARIA Authoring Practices](https://www.w3.org/WAI/ARIA/apg/) pattern used

## Browser support

<!-- Include only when the package is gated on a browser API. `transfer` (Web
     Share / Clipboard) and `attention` (Wake Lock / Idle Detection) both do.
     Say which API, which browsers lack it, and what the magic reports when
     unsupported — a silent no-op is the failure worth documenting. -->

- {API required} — {support, and the fallback}

## Integration

<!-- Omit entirely when there is nothing to integrate with. 31 of 40 have it;
     `calendar`, `theme`, `attention`, `transfer`, `lang`, `toast`, `form` and
     `geo` do not. -->

- **@ailura/alpinejs-{other}** — {Description of integration}

## Limitations

<!-- 39 of 40 have this. It is the section a reader trusts most, so it must be
     real: the known-broken path, the browser gate, the thing that silently
     no-ops. Every one of these has been a genuine package defect at least once
     (accordion's `tabindex` under object-form `x-bind`, carousel's `pause()`,
     dialog's absent focus management, overlay's `configure()` invariant), and
     documenting them is better than fixing them silently. -->

- {Limitation 1}
- {Limitation 2}

## Size

`X.X kB raw / X.X kB gzip` · budget `X.X kB` · externalized peers: `alpinejs`, `@ailura/alpinejs-core` · `size-limit` + `publint` + `attw` verified.

<!--
  Fill from actual build: run `pnpm run build && pnpm run size` in the package
  directory. Both scripts exist in 38 of 40 packages.
  Format: `raw / gzip` from `size-limit` output. Budget from `.size-limit.json`.
  List the REAL externalized peers — a package with a third-party peer
  (carousel → embla-carousel, calendar → date-fns, the adapters → zustand /
  nanostores) must not claim only the toolkit's.

  Example canon package (accordion):
    `6.11 kB raw / 2.02 kB gzip` · budget `2.3 kB` · externalized peers:
    `alpinejs`, `@ailura/alpinejs-core` · `size-limit` + `publint` + `attw` verified.
  Example multi-entry foundation (core): the barrel plus TWELVE subpaths, so
    give the barrel line and point at `.size-limit.json` for the subpath budgets:
    `1.81 kB raw / 0.70 kB gzip` (barrel `dist/index.mjs`, minified, gzip 9) ·
    declared budget `1.95 kB` · externalized peers: `alpinejs`
  Example dev-only (testing): `Dev-only — no dist budget. Not published.`
  Example scaffold (plugin-template): `0.35 kB raw / 0.26 kB gzip` · budget
    `260 B` · externalized peers: `alpinejs` — plugin-template takes no core peer.
  Example where size-limit does not finish (core): say so and cross-link
    Limitations rather than writing "verified" — a false verification claim is
    worse than an admitted gap.
-->

## Architecture

[Features layer](../../ARCHITECTURE.md) — controllers own state, Alpine owns reactivity. See canon, guards, and SSR rules in [ARCHITECTURE.md](../../ARCHITECTURE.md).

<!--
  Choose the layer label from ARCHITECTURE.md §11 — that table is authoritative
  and `apps/demo/test/catalog.test.ts` asserts against it (including
  `toast` → primitives, which is counter-intuitive and has been got wrong here
  before). Layers, in §11 order:

  - Foundation — core, ui, state-machine, testing
  - Primitives — env, media, notify, selection, collection, child, scroll,
    calendar, form, gesture, keyboard, history, timer, TOAST, transfer,
    permissions, geo, lang
  - Features — accordion, tabs, dialog, menu, tooltip, overlay, attention,
    theme, sidebar, CAROUSEL, command, virtual
  - Data — query, query-adapter-alpine, query-adapter-zustand,
    query-adapter-nanostores, json-api
  - Template — plugin-template (a real fifth layer, scaffold only)

  Note `toast` is a Primitives and `carousel` is a Features. Both were wrong in
  a previous version of this comment.

  - For ui: `[Foundation layer] — infra for Features (overlay, toast, sidebar, theme).`
  - For core: `[Foundation layer] — core has zero toolkit peers. All other packages depend on core.`
  - For testing: `[Foundation layer] — shared test infra.`
  - For plugin-template: `[Template layer] — copy-paste canon. See scripts/new-plugin.mjs.`
-->

## Testing

```sh
pnpm exec vp test packages/{{kebab}}
pnpm exec tsc --noEmit -p packages/{{kebab}}/tsconfig.json
```

Uses `@ailura/alpinejs-testing` — `html`/`mount`/`settled`/`start`/`resume`/`reset`
plus `onReset`, which every `test/setup.ts` wires to
`resetRegistrationTracking`. See [ARCHITECTURE.md §8](../../ARCHITECTURE.md).

<!--
  These scoped commands are run from the REPO ROOT and are what core, ui,
  state-machine, overlay, json-api, query, the three adapters and
  plugin-template already print. 29 other READMEs still use the shorter
  `pnpm test` / `pnpm run typecheck`, which run the whole workspace — prefer the
  scoped form, and if you use the short form say which directory to run it from.

  VARIANT — testing (dev-only, no `test` script and no `dist`):
  ```sh
  pnpm exec tsc --noEmit -p packages/{{kebab}}/tsconfig.json
  ```
-->

## License

MIT
