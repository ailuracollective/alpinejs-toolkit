# @ailura/alpinejs-plugin-template

> **This is not a package you install.** It is the scaffold
> `scripts/new-plugin.mjs` copies when you run `pnpm run new:plugin`, and it is
> the one entry in the workspace that is never published. The copy it produces
> is yours to rewrite; this README is rewritten along with it, because
> `new-plugin.mjs` substitutes the same two tokens here as everywhere else.

## Usage

### Generate a package

```sh
pnpm run new:plugin -- my-plugin
# or
node scripts/new-plugin.mjs my-plugin
```

The name must match `/^[a-z0-9][a-z0-9-]*$/`, and `packages/my-plugin` must not
already exist. The script copies this directory, then rewrites two tokens across
every `.json`, `.ts`, `.md`, `.html` and `.mjs` file it copied (skipping
`node_modules` and `dist`):

| Token             | Becomes     |
| ----------------- | ----------- |
| `plugin-template` | `my-plugin` |
| `pluginTemplate`  | `myPlugin`  |

It prints what to do next; it does not do it for you:

```
Created packages/my-plugin. Add { "path": "./packages/my-plugin" } to tsconfig.json references.
```

`pnpm-workspace.yaml` already globs `packages/*`, so there is nothing to add
there.

### What you get

```
packages/my-plugin/
├── package.json          # ESM, sideEffects:false, exports, peer: alpinejs
├── vite.config.ts        # vp pack — one ESM entry, dts, publint, attw
├── tsconfig.json         # extends ../../tsconfig.base.json, noEmit
├── .size-limit.json      # one entry on dist/index.mjs, peers ignored
├── src/
│   ├── index.ts          # the only source file — directive + magic + store
│   └── alpine.d.ts       # types the plugin's store for $store.<key>
└── test/
    ├── index.test.ts     # the pure helper
    └── dom.test.ts       # the three Alpine surfaces, in happy-dom
```

Three registrations, and nothing else:

| Surface        | Markup                                          |
| -------------- | ----------------------------------------------- |
| `x-upper`      | `<span x-upper="'hello'">` → `HELLO`            |
| `$greet` magic | `<span x-text="$greet('Ada')">` → `Hello, Ada!` |
| `$store.<key>` | `{ ready: true }`                               |

With no expression at all, `x-upper` uppercases the element's existing
`textContent` instead of evaluating one.

| Export                | Description                                                                                                               |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `default`             | `pluginTemplate(Alpine)` — the `Alpine.plugin()` entry point                                                              |
| `pluginName`          | `"plugin-template"`, rewritten to `"my-plugin"`                                                                           |
| `toUpper(value)`      | Pure, DOM-free, unit-testable                                                                                             |
| `PluginTemplateStore` | The example store's type, rewritten to `MyPluginStore` and registered on Alpine's `Stores` interface by `src/alpine.d.ts` |

### After generating: what to replace

This scaffold is deliberately the **shortest** possible plugin, not the canon.
It takes no `@ailura/alpinejs-core` peer, so it registers straight on `Alpine`
with no collision guard, and it has no controller, no events and no reactive
sync. Before you publish anything, walk the checklist in
[ARCHITECTURE.md §10.2](../../ARCHITECTURE.md):

- [ ] **`package.json`** — add `"@ailura/alpinejs-core": "workspace:*"` to
      `peerDependencies`; give it a real `description`; set
      `toolkit.bundleBudget.category` if the default `limit` does not fit
- [ ] **`src/controller.ts`** — `extends BaseController<Events>`, `generateId`,
      `emit('change', detail)`, a `frozen` guard so a destroyed controller's
      mutations are silent no-ops
- [ ] **`src/plugin.ts`** — `const packageName = "@ailura/alpinejs-my-plugin"`,
      the factory `myPluginPlugin(options) => (alpine) => void`,
      `resolveStoreKey` / `resolvePluginKeys`, and every registration through
      `guardStore` / `guardMagic` / `guardDirective` instead of `Alpine.*`
- [ ] **Reactivity** — `x-upper` renders **once**, at directive init. Wrap
      `evaluate(expression)` in `utilities.effect()` and use
      `createValueReader` from `@ailura/alpinejs-core/directives` if the
      expression has to track later changes
- [ ] **Teardown** — register a teardown with the `cleanup()` utility the
      directive callback receives. `Alpine.plugin()` discards its return value,
      so nothing else in the runtime will call your teardown
- [ ] **`src/types.ts`** — the public types plus `DEFAULT_MY_PLUGIN_STORE_KEY`
      and `DEFAULT_MY_PLUGIN_MAGIC_KEY` as exported constants, so the store key
      is declared rather than a literal inside `plugin.ts`
- [ ] **`src/index.ts`** — becomes a barrel: re-exports only, no logic
- [ ] **`test/setup.ts`** — wire `onReset(resetRegistrationTracking)` so guard
      tracking does not leak between tests
- [ ] **`tsconfig.json`** — add the project reference

## Testing

```sh
pnpm exec vp test packages/plugin-template
pnpm exec tsc --noEmit -p packages/plugin-template/tsconfig.json
```

The two shipped tests are the shape to copy: `index.test.ts` covers the pure
helper in node, `dom.test.ts` covers the three Alpine surfaces in `happy-dom`
with `start` / `resume` / `reset` from `@ailura/alpinejs-testing`.

## Size

`0.35 kB raw / 0.26 kB gzip` (minified, gzip 9) · declared budget `260 B` ·
externalized peers: `alpinejs` · the template is exempt from publish checks
(`publint` / `attw` run but its result is not gated), and the generated copy
inherits the same `260 B` entry — raise it to whatever the real package needs,
because the scaffold's number says nothing about a controller, a store and a
guard.

## Architecture

[Template layer](../../ARCHITECTURE.md) — the copy-paste canon, and the one
`FAIL (exempt)` row in [ARCHITECTURE.md §9](../../ARCHITECTURE.md): it is a
scaffold, not a library, so the canon validator's store/plugin/controller rules
do not apply to it. The real canon is
[ARCHITECTURE.md §10](../../ARCHITECTURE.md) and the reference implementation is
[`packages/accordion`](../../packages/accordion).

## License

MIT
