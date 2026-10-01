# @ailura/alpinejs-query-adapter-alpine

<p align="center">

[![bundlephobia minzip](https://badgen.net/bundlephobia/minzip/@ailura/alpinejs-query-adapter-alpine)](https://bundlephobia.com/package/@ailura/alpinejs-query-adapter-alpine)

</p>

> Registers the `@ailura/alpinejs-query` cache as an Alpine store, taking the
> name from whoever already holds it, and ships the `Alpine.reactive` value box
> that `query`'s `adapter` option consumes. It is 0.68 kB: a
> `QueryController`, a `guardStore` call with `override: true`, and a
> four-method factory.

## Installation

```sh
pnpm add @ailura/alpinejs-query-adapter-alpine @ailura/alpinejs-query alpinejs
# or
npm install @ailura/alpinejs-query-adapter-alpine @ailura/alpinejs-query alpinejs
```

Three peers, all required, none bundled:

- `alpinejs@^3.0.0` — only for the plugin half. The adapter half never touches it.
- `@ailura/alpinejs-core` — for `guardStore` and `resolveStoreKey`, the two
  registration primitives the plugin half is built on.
- `@ailura/alpinejs-query` — this package constructs its `QueryController` and
  imports `QueryStateAdapter` from it. It is not re-exported here, and that is
  also the shortest honest description of what this package does.

No package in this toolkit has a `dependencies` block, so the host installs all
three.

This is one of the seven packages exempt from the strict canon
([ARCHITECTURE.md §9](../../ARCHITECTURE.md)): it has no controller of its own,
no `types.ts` on the barrel, and it is not a store _or_ a magic — it is a second
way to register the query store.

## Usage

### 1. Alpine

```ts
import Alpine from "alpinejs";
import queryAdapterAlpine from "@ailura/alpinejs-query-adapter-alpine";

Alpine.plugin(queryAdapterAlpine());
Alpine.start();
```

That registers `$store.query`, the same command surface
`queryPlugin()` from `@ailura/alpinejs-query` registers, and registers **no**
magic: there is no `$query`. Read [Store API](#store-api) for what the store
carries and [Limitations](#limitations) for what "the same" does and does not
mean.

The three exported factories are the same function. Pick the one whose name says
what you mean:

```ts
import {
  alpineStoreQueryPlugin, // the name the playground catalog advertises
  createQueryPlugin, //      the implementation
  queryAdapterAlpine, //      the default export
} from "@ailura/alpinejs-query-adapter-alpine";

Alpine.plugin(alpineStoreQueryPlugin());
```

### 2. The value-box factory

`createAlpineStoreAdapter()` is the reactive half of this package, and it is what
`@ailura/alpinejs-query`'s `adapter` option wants: the controller publishes a
`QueryDevtoolsSnapshot` on every change, and an `Alpine.reactive` box is what
makes a template reading that object update.

```ts
import Alpine from "alpinejs";
import { createAlpineStoreAdapter } from "@ailura/alpinejs-query-adapter-alpine";
import queryPlugin from "@ailura/alpinejs-query";

Alpine.plugin(queryPlugin({ adapter: createAlpineStoreAdapter(Alpine) }));
// $store.query.devtools.getSnapshot() is now held in a reactive box
```

Used on its own, it is a general one-value reactive box:

```ts
const adapter = createAlpineStoreAdapter(Alpine);

const box = adapter.create({ count: 0 });
box.get(); // { count: 0 }
box.set({ count: 1 }); // a template bound to the box re-renders
box.destroy(); // get() → undefined, and set() is inert from here on
```

Handles are independent: destroying one leaves every other box readable. `Alpine`
is a parameter rather than an import, so this is a pure factory with no side
effect at import time, and it works with any host that exposes `reactive()`.

## API

| Export                     | Description                                                                                                                                          | Type       |
| -------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| `createAlpineStoreAdapter` | `createAlpineStoreAdapter(alpine) => QueryStateAdapter` — pure factory, no side effect at import time. This is what `queryPlugin({ adapter })` takes | `function` |
| `createQueryPlugin`        | `createQueryPlugin(options?) => (alpine) => void` — builds a `QueryController` and registers `toStore()` with `override: true`                       | `function` |
| `alpineStoreQueryPlugin`   | Alias of `createQueryPlugin` under the name the catalog advertises. Its parameter type is narrower: no `defaultOptions`                              | `function` |
| `default`                  | `queryAdapterAlpine` — alias of `createQueryPlugin`, with the full `QueryRegisterOptions` parameter type                                             | `function` |
| `DEFAULT_QUERY_STORE_KEY`  | `"query"` — the default `$store` key. **The same name and value as `query`'s own constant**                                                          | `string`   |
| `QueryStateAdapter`        | `{ create(initial) => { get, set, destroy } }` — the value-box contract                                                                              | `type`     |
| `QueryRegisterOptions`     | `{ storeKey?, defaultOptions? }`                                                                                                                     | `type`     |

There is no `magicKey`: the package registers a store and nothing else, so
`storeKey` is the one name to move.

## Store API

Whatever `QueryController.toStore()` returns, registered by this package instead
of by `query`'s own plugin:

```js
$store.query.observe(["articles"], fetcher, { staleTime: 30_000 });
$store.query.get(["articles"]);
$store.query.invalidate(["articles"]);
$store.query.setData(["articles"], (list) => [...(list ?? []), created]);
$store.query.mutate({ mutationFn: (variables) => api.create(variables) });
$store.query.remove();
$store.query.destroy();
$store.query.devtools.getSnapshot(); // { phase, entries, mutations }
$store.query.devtools.subscribe((s) => console.log(s.entries.length));
```

The full surface, its options, its per-query state and its devtools contract are
documented in [`@ailura/alpinejs-query`](../query/README.md) — this package does
not extend, wrap or alter it. The two things to know before choosing it:

- **There is no `$query` magic.** The magic belongs to `queryPlugin()`, and this
  package never registers one. A template that reaches for `$query` on a page
  booted with this plugin gets `undefined`.
- **The store does not react to the cache.** That is unchanged from `query` — see
  its [Store API](../query/README.md#store-api) — and it is also true of the
  value box: `createAlpineStoreAdapter()` holds a snapshot, and this plugin does
  not pass one. The reason the playground's query demo copies what it renders
  into component state.

## Options

```ts
type QueryRegisterOptions = {
  storeKey?: string; //    default: DEFAULT_QUERY_STORE_KEY ("query")
  defaultOptions?: unknown; // forwarded verbatim as the controller's QueryOptions
};
```

| Option           | Default   | Effect                                                                                                                                                                                                   |
| ---------------- | --------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `storeKey`       | `"query"` | The `$store` key. Renaming it is the only collision-avoidance this package offers                                                                                                                        |
| `defaultOptions` | —         | Handed to `new QueryController(undefined, defaultOptions)` unchanged, so `{ staleTime: 30_000 }` works. Typed `unknown`, so nothing checks it and this package re-exports none of `query`'s option types |

`defaultOptions` is the one option with no default and no validation: pass a
`QueryOptions` bag or pass nonsense, and the cache will merge it or ignore it
without complaint.

## Avoiding name collisions

The usual toolkit rule is that a second package claiming a registered name
throws a `RegistrationError`. This package is the exception: it registers with
`{ override: true }`, so it takes `"query"` from whoever holds it.

```ts
Alpine.plugin(queryAdapterAlpine({ storeKey: "cache" }));
// → $store.cache
```

Renaming `storeKey` is therefore not needed to avoid a collision — it is needed
to avoid _replacing_ someone else's store without noticing. The playground does
exactly that: it registers this plugin and never registers `queryPlugin()`.

## SSR

> SSR-safe — no `window`/`document` at import time, and the registration does
> not need either. The controller is constructed when the plugin callback runs,
> which is when the host calls it; nothing here reads the DOM. `Alpine.reactive`
> is only reached inside `createAlpineStoreAdapter(alpine).create(…)`, and Alpine
> is passed in by the caller.

## Integration

- **`@ailura/alpinejs-query-adapter-zustand`** and
  **`@ailura/alpinejs-query-adapter-nanostores`** — the two sibling adapters. All
  three implement the same `QueryStateAdapter` contract and all three register the
  key `"query"`, so you can swap one for the other and rename nothing. This one is
  the only adapter a template can bind to, because its `Alpine.reactive` box is
  Alpine's own graph; that is also its limit, since nothing outside Alpine can
  subscribe to a reactive box. Use the zustand or nanostores adapter when a
  devtools panel, a persistence layer or a test has to observe the published
  snapshots.
- **`@ailura/alpinejs-query`** — required. This package imports
  `QueryController` from it and registers its store; it does not bundle it and
  does not add behaviour to it. Register one plugin or the other, not both. The
  one thing worth taking from _that_ package instead is
  `queryPlugin({ adapter: createAlpineStoreAdapter(Alpine) })`, which registers
  the same store **and** the reactive box — this plugin cannot, because it never
  receives the Alpine instance at factory time.
- **`@ailura/alpinejs-json-api`** — a typed `queryFn` for the cache this package
  registers, in the shape
  `$store.query.observe(["articles"], () => api.findAll("articles").then((d) => d.data))`.

## Limitations

- **The plugin still does not use the adapter.** `createAlpineStoreAdapter()` is
  implemented here and wired up on the _other_ plugin: `createQueryPlugin()`
  constructs `new QueryController(undefined, defaultOptions)` with no third
  argument, so a store registered by this package gets no value box and nothing
  in the cache becomes reactive. To get the box, register `queryPlugin()` from
  `@ailura/alpinejs-query` with `{ adapter: createAlpineStoreAdapter(Alpine) }` —
  and then you do not need this plugin at all.
- **The two `QueryStateAdapter` types are structurally identical but separately
  declared** — one here, one in `@ailura/alpinejs-query`. The contract is
  satisfied by construction and checked by neither compiler, because neither
  package imports the other's type. A change to one is invisible to the other.
- **The box holds a snapshot, not an entry.** What the adapter receives is a
  `QueryDevtoolsSnapshot` of the whole cache. It does not make
  `store.get(key)` reactive, and it is not a store — a template that wants the
  latest snapshot has to hold the box itself.
- **`override: true` bypasses the registration guards on purpose.** Registering
  this plugin after `queryPlugin()` replaces `$store.query` silently, and the
  first controller is left running with its in-flight requests and no way to reach
  it. Nothing warns.
- **Three names, one function.** `createQueryPlugin`, the default export
  (`queryAdapterAlpine`) and `alpineStoreQueryPlugin` are the same code. They do
  not even have the same parameter type: `alpineStoreQueryPlugin` omits
  `defaultOptions` from its options type, so passing one to that alias is a
  compile error while passing it to either of the other two is not.
- **`DEFAULT_QUERY_STORE_KEY` collides by name with `query`'s own constant.**
  Both are `"query"`, both are exported, and importing both into one module needs
  an alias. They are not the same binding, so nothing keeps them in step.
- **`src/types.ts` is not on the barrel.** `AdapterOptions` and
  `DEFAULT_ADAPTER_ALPINE_STORE_KEY` are unreachable from the package entry point
  and nothing in `src/` imports that file. The value is the same as
  `DEFAULT_QUERY_STORE_KEY`; the type is a subset of `QueryRegisterOptions`.
- **`defaultOptions` is untyped and unvalidated** — see [Options](#options).
- **No test covers the plugin.** `test/adapter.test.ts` exercises
  `createAlpineStoreAdapter` only; `createQueryPlugin` and its two aliases are
  untested, which is the other reason the `override: true` behaviour above has
  gone unnoticed.
- **The budget is met with room to spare** — `0.40 kB gzip` against a `3 kB`
  entry — so the size gate is not a constraint on this package.

## Size

`0.68 kB raw / 0.40 kB gzip` · budget `3 kB` · externalized peers: `alpinejs`, `@ailura/alpinejs-core`, `@ailura/alpinejs-query` · `size-limit` + `publint` + `attw` verified.

## Architecture

[Data layer](../../ARCHITECTURE.md) — a canon exception by design, listed in
[ARCHITECTURE.md §9](../../ARCHITECTURE.md): the sole `QueryStateAdapter`
implementation, counted once among the seven WARN rows. It has no controller of
its own and no state of its own — it constructs another package's controller and
registers it, which is why it bundles 0.68 kB and why `plugin.ts` here has no
`change` listener to wire.

## Testing

```sh
pnpm exec vp test packages/query-adapter-alpine
pnpm exec tsc --noEmit -p packages/query-adapter-alpine/tsconfig.json
```

`test/adapter.test.ts` observes the adapter from the outside only — what `get()`
returns, what `set()` changes, what `destroy()` releases — through a mock Alpine
that keeps the boxes it handed out. The plugin has no tests; see
[Limitations](#limitations). See
[ARCHITECTURE.md §8](../../ARCHITECTURE.md).

## License

MIT
