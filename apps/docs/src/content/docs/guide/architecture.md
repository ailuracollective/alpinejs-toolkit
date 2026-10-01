---
title: Architecture
---

The toolkit is a monorepo of 40 `@ailura/alpinejs-*` packages sharing a single controller
canon and Alpine bridge. This page is the reference for that canon: the principles
behind it, the layer rules, the controller lifecycle, the plugin factory shape, and how
a new package gets scaffolded and validated.

## The five core ideas

1. **Controllers own state; Alpine owns reactivity.** A framework-agnostic
   `BaseController` emits typed `change` events; a thin `plugin.ts` shadows them into an
   Alpine store or magic.
2. **One canon per package.** Every package ships `package.json`, `vite.config.ts`,
   `tsconfig.json`, `.size-limit.json`, and `src/{index,types,controller,plugin}.ts`.
3. **Guards prevent silent collisions.** `guardStore` / `guardMagic` / `guardDirective`
   throw a `RegistrationError` when two packages claim the same name.
4. **SSR-safe by default.** No package reads `window`/`document` at import time — only
   `safeWindow()` / `safeDocument()` / `safeMatchMedia()`.
5. **Build and size are enforced.** `vp pack` → one ESM bundle + types, with
   `publint`/`attw` and per-package size budgets.

## Layers

Layers flow downward — a layer only imports from layers below it. `core` has zero
toolkit peers, which is what makes it safe to depend on from anywhere.

```
Foundation  core · ui · state-machine · testing · plugin-template
Primitives  env · media · notify · selection · collection · child · scroll · calendar
            form · gesture · keyboard · history · timer · toast · transfer · permissions · geo · lang
Features    accordion · tabs · dialog · menu · tooltip · overlay · attention
            theme · sidebar · carousel · command · virtual
Data        query · query-adapter-alpine · query-adapter-zustand · query-adapter-nanostores · json-api
```

The home page has the same map as browsable cards, one per layer.

### The Data layer has an adapter family, not a single adapter

`@ailura/alpinejs-query` owns the `QueryStateAdapter` contract — `{ create(initial) → { get,
set, destroy } }` — and the controller publishes a fresh devtools snapshot into the handle
on every change. Three packages implement that contract, and all three register the key
`"query"`, so you can swap one for the other and rename nothing:

- `query-adapter-alpine` keeps the snapshot in an `Alpine.reactive` box.
- `query-adapter-zustand` keeps it in one `zustand/vanilla` store per handle, and an
  injected store creator makes that store reachable for subscription from outside Alpine.
- `query-adapter-nanostores` keeps it in one `nanostores` `atom` per handle, and an
  injected store creator makes that atom reachable the same way.

All three are **sinks, not sources**: none reads a cache entry back out, and none changes
the registered `$store.query`. What separates them is the store, and therefore what a host
can observe. Alpine's box is the only one a template can bind to, because `Alpine.reactive`
is Alpine's own graph. Between the other two, zustand's `subscribe` hands you the whole
`{ value }` slot to unwrap, while nanostores' `atom` holds the snapshot itself — no
wrapper, a `subscribe` that also fires once on attach, and the smallest peer dependency of
the three.

:::note[40 folders, 37 demo pages]
The repo has 40 package folders and the demo catalog has 37 entries. Those are two different
numbers and neither is a rounding of the other. The gap is exactly `ui` (framework-agnostic
helpers), `testing` (test harness) and `plugin-template` (scaffold) — all three ship no
browser plugin by design. Every other package, `query-adapter-nanostores` included, has a
catalog entry and a demo page.
:::

## Migration facts

Two things about the old `@ailuracode` packages are worth stating plainly, because the prose
that used to describe them is no longer true:

- **`@ailuracode/alpine-query-kit` is retired and is not being re-created.** It was described
  as the single remaining `QueryStateAdapter` implementation; that sentence is false, and the
  retirement is finished rather than pending — **both** surfaces the old package owned now
  have a home here, and neither came back as the old package:

  | Old `alpine-query-kit` surface                   | New home                                                                        | State                                          |
  | ------------------------------------------------ | ------------------------------------------------------------------------------- | ---------------------------------------------- |
  | The devtools panel                               | `@ailura/alpinejs-query/devtools` — `queryDevtoolsPlugin`, `mountQueryDevtools` | **Shipped** as a real subpath export           |
  | The snapshot contract the panel read             | `QueryDevtoolsApi` at `$store.query.devtools`                                   | **Shipped** — `getSnapshot()`, `subscribe(cb)` |
  | The nanostores state backend                     | `@ailura/alpinejs-query-adapter-nanostores`                                     | **Shipped** as a peer package, not a re-export |
  | The `NanoStores` / `$nano` / `x-nano` re-exports | Nothing — `@nanostores/alpine` owns those names                                 | **Not carried over**, deliberately             |

  The panel is a port, not a copy: it is rewritten to be SSR-safe through `safeDocument()` /
  `safeWindow()` / `isBrowser()` from `@ailura/alpinejs-core/env` instead of the old raw DOM
  access, `queryDevtoolsPlugin` defers to `alpine:initialized` with a listener it can remove
  again, it reads the cache only through `QueryDevtoolsApi`, and its **Edit** tab turns on
  only when the source it is mounted with exposes `setData` — `QueryDevtoolsApi` itself is
  read-only, so a bare `{ devtools }` source gets a disabled tab with the reason printed
  instead of a button that does nothing. It ships from its own subpath, so a production
  bundle that never imports it carries none of it.

  What was **not** carried over is the dependency shape, and that is the point. This repo has
  **zero runtime `dependencies`** in all 40 packages — every third-party runtime is a
  `peerDependency` plus a devDependency, a `neverBundle` entry, and a `.size-limit.json`
  `ignore`, exactly as `carousel` does with `embla-carousel`, and as the two other query
  adapters do with `zustand` and `nanostores`. So `nanostores` was not pulled into `query`:
  it became a separate package in the same adapter family, and every named Alpine surface
  the old package used to register is now either owned by `query` or deliberately left to
  your app.

- **`state-machine` is the successor of the old `alpine-toggle`, and `alpine-toggle` is not
  being re-created.** That is a migration fact, not a feature claim: `state-machine` is an
  N-state `MachineController` in the tree, and the tree supports no mapping from an
  `alpine-toggle` source to it beyond the migration itself. Anything the old package did
  that `MachineController` does not, is not ported.

## Controller lifecycle

```
[*] --> idle : new Controller()
idle --> mounted : mount() — runs setup()
mounted --> destroyed : destroy() — drains cleanups LIFO
destroyed --> [*] : frozen — all mutations are silent no-ops
```

`mount()` is idempotent and only runs once from `idle`. `destroy()` is idempotent and
final.

## The plugin factory

Every feature package exports a factory that returns an `Alpine.plugin` callback:

```ts
const packageName = "@ailura/alpinejs-my"; // required: guard ownership

export function myPlugin(options: CreateMyOptions = {}) {
  const storeKey = options.storeKey ?? DEFAULT_MY_STORE_KEY;
  const magicKey = options.magicKey ?? options.storeKey ?? DEFAULT_MY_MAGIC_KEY;

  return function registerMy(alpine: Alpine) {
    const controller = new MyController(options.id);
    const store = createMyStore(controller);

    const sync = () => {
      /* shadow controller state into alpine.store(storeKey) */
    };
    const unsubscribe = controller.on("change", sync);

    guardStore(alpine, storeKey, store, packageName);
    if (magicKey) guardMagic(alpine, magicKey, () => alpine.store(storeKey), packageName);
  };
}
```

**Magic follows store** — renaming `storeKey` renames both.

## Key surfaces by kind

| Kind      | Example                               | Notes                                        |
| --------- | ------------------------------------- | -------------------------------------------- |
| Store     | `$store.accordion`, `$store.theme`    | Reactive snapshot synced from the controller |
| Magic     | `$timer.create(...)`, `$machine(...)` | Built per evaluation, isolated instances     |
| Directive | `x-child`, `x-gesture`                | Registered via `guardDirective`, kebab-cased |

## Adding a package

```sh
pnpm run new:plugin -- my-plugin
```

This scaffolds from `plugin-template`, renames the tokens, and adds the tsconfig
reference. The [plugin-template](/plugins/foundation/plugin-template) page has the full
canon checklist to land a package.

## Validation

```sh
pnpm typecheck   # tsc + vp run --recursive typecheck
pnpm build       # vp run --recursive build (vp pack per package)
pnpm test        # vitest + happy-dom
pnpm check       # lint + typecheck + tests
pnpm size        # size-limit per package
```

## Next

- [Core](/plugins/foundation/core/) — the code all of this grows out of.
- [Accordion](/plugins/features/accordion/) — one complete package to read the pattern end to end.
