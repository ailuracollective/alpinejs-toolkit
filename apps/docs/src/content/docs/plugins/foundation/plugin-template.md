---
title: Plugin Template
---

@ailura/alpinejs-plugin-template

Copy-paste scaffold for new toolkit packages. It is a demo package — never published —
and it ships a single-file example (`src/index.ts` plus the `alpine.d.ts` store
augmentation). Every real package then grows out of it into this canon:

```plaintext
src/
  index.ts       # barrel only — re-exports, no logic
  types.ts       # public contracts + DEFAULT_*_KEY constants
  controller.ts  # extends BaseController, owns state, emits 'change'
  plugin.ts      # factory xxxPlugin(options) => (alpine) => void + guards
  events.ts      # typed Events map + ChangeDetail
  store.ts       # store creation + reactive sync (packages that ship a store)
```

## Scaffold a plugin

```sh
pnpm run new:plugin -- my-plugin
# creates packages/my-plugin from packages/plugin-template,
# renames plugin-template → my-plugin and pluginTemplate → myPlugin,
# and prints the tsconfig reference you still have to add by hand.
```

## The canon

1. **`index.ts` is a pure barrel.** It re-exports; it defines nothing. Logic here means
   something is leaking to the public surface.
2. **`types.ts` is the boundary.** Everything a consumer can touch, plus the
   `DEFAULT_*_KEY` constants.
3. **`controller.ts` owns the state.** It does not import Alpine and it does not touch
   the DOM. The framework only gets connected in `plugin.ts`.
4. **`plugin.ts` does three things, in order.** Claim the name with the guard, sync the
   state, return the callback. Nothing else.
5. **`events.ts` is the event map.** Every event with its typed payload, in one file.
6. **`store.ts` owns the store projection.** A package that registers a store creates it
   there; `plugin.ts` only registers the result and wires the sync.

## Pre-merge checklist

- [ ] `package.json`: `type:module`, `sideEffects:false`, `exports` with `types` + `import`, a single entry, `files:["dist"]`, and the `build` / `test` / `typecheck` / `size` scripts.
- [ ] `vite.config.ts`: `deps.neverBundle` for `alpinejs` and the core peer, so they stay out of the bundle.
- [ ] `controller.ts`: no `alpinejs` imports, no `window` / `document` access.
- [ ] `plugin.ts`: `guardStore` / `guardMagic` with a literal `packageName`.
- [ ] `index.ts`: a pure barrel.
- [ ] Tests: the `@ailura/alpinejs-testing` pattern, with `start` once per file and `resume` in each `beforeEach`.
- [ ] Size within the `.size-limit.json` budget.
- [ ] README and `ARCHITECTURE.md` updated.

## Reference canon

The accordion package is the reference feature implementation:

```plaintext
packages/accordion/src/
  controller.ts   # accessible AccordionController
  plugin.ts       # factory + guards + reactive sync
  types.ts        # options + DEFAULT keys
  store.ts        # store creation + registry sync
  events.ts       # typed events
```

## Next

- [Core](/plugins/foundation/core/) — the code this scaffold grows out of.
- [Testing](/plugins/foundation/testing/) — the harness you validate the package with.
