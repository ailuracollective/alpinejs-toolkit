# @ailura/alpinejs-query-adapter-zustand

<p align="center">

[![bundlephobia minzip](https://badgen.net/bundlephobia/minzip/@ailura/alpinejs-query-adapter-zustand)](https://bundlephobia.com/package/@ailura/alpinejs-query-adapter-zustand)

</p>

> A `zustand`-backed `QueryStateAdapter` for `@ailura/alpinejs-query`, plus an
> Alpine plugin that registers the query store and forwards the adapter to the
> controller. `zustand` is a peer: the package ships the glue and zero bytes of
> zustand, and one `zustand/vanilla` store per handle is the whole
> implementation. Pass your own store creator and the store is yours, so every
> published snapshot can be subscribed to from outside Alpine.

## Installation

```sh
pnpm add @ailura/alpinejs-query-adapter-zustand @ailura/alpinejs-query zustand alpinejs
# or
npm install @ailura/alpinejs-query-adapter-zustand @ailura/alpinejs-query zustand alpinejs
```

Three peers, all required, none bundled:

- `alpinejs@^3.0.0` — only for the plugin half. The adapter half never touches it.
- `@ailura/alpinejs-query` — this package constructs its `QueryController` and
  imports `QueryStateAdapter` from it. It is not re-exported here.
- `zustand@^5.0.0` — **not optional.** The adapter imports
  `zustand/vanilla` at module scope. Skip it and the very first import of this
  package fails to resolve, at build time or at runtime, with nothing to do
  with Alpine.

## Usage

### 1. Alpine

```ts
import Alpine from "alpinejs";
import { createQueryPlugin, zustandStoreAdapter } from "@ailura/alpinejs-query-adapter-zustand";

Alpine.plugin(createQueryPlugin({ adapter: zustandStoreAdapter }));
Alpine.start();
```

```html
<div x-data>
  <button @click="$store.query.invalidate(['articles'])">Reload</button>
  <span x-text="$store.query.get(['articles'])?.data?.length ?? 0"></span>
</div>
```

That registers `$store.query` and no magic — there is no `$query`; the magic
belongs to `queryPlugin()` from `@ailura/alpinejs-query`. Read
[Store API](#store-api) for the surface and [Limitations](#limitations) for what
the `adapter` option does and does not change. `zustandStoreAdapter` is the
ready-made singleton, which is fine for the store surface and cannot be
subscribed to; build the adapter with `createZustandStoreAdapter({ create })`
when you want to watch the snapshots — see
[Observing snapshots](#3-observing-snapshots-from-outside-alpine).

The default export is the same plugin under the package's own name:

```ts
import Alpine from "alpinejs";
import queryAdapterZustand from "@ailura/alpinejs-query-adapter-zustand";

Alpine.plugin(queryAdapterZustand({ storeKey: "cache", adapter: zustandStoreAdapter }));
// → $store.cache
```

### 2. Headless — no Alpine, no DOM

`createZustandStoreAdapter()` is a pure factory. It reads no globals at import
time, and `zustand/vanilla` carries neither React nor the DOM, so the adapter
half of this package runs in a plain Node process.

The host that owns the adapter also owns its handles:

```ts
import { zustandStoreAdapter } from "@ailura/alpinejs-query-adapter-zustand";

const handle = zustandStoreAdapter.create({ phase: "idle", entries: [], mutations: [] });
handle.get(); // the initial value it was created with
handle.set({ phase: "mounted", entries: [{ key: ["todos"] }], mutations: [] });
handle.get().entries.length; // 1
handle.destroy();
handle.get(); // undefined — and destroy() again is a no-op, not a throw
```

Handles are independent and the shared adapter holds no state: `create()`
allocates a fresh store per handle, so two handles created from
`zustandStoreAdapter` cannot see each other.

### 3. Observing snapshots from outside Alpine

That example only reaches the handle's own `get()`. To be _watched_, a snapshot
has to travel through a store you hold, and by default the store is private to
the handle — see [Limitations](#limitations). Pass your own `create` and it is
yours:

```ts
import Alpine from "alpinejs";
import { createStore } from "zustand/vanilla";
import type { StoreApi } from "zustand/vanilla";
import {
  createQueryPlugin,
  createZustandStoreAdapter,
} from "@ailura/alpinejs-query-adapter-zustand";

const stores: StoreApi<{ value: unknown }>[] = [];

const adapter = createZustandStoreAdapter({
  create: (initializer) => {
    const store = createStore(initializer);
    stores.push(store);
    return store;
  },
});

Alpine.plugin(createQueryPlugin({ adapter }));
Alpine.start();

// The controller created its handle while the plugin ran, so `stores[0]` is
// the store every published snapshot is written into.
stores[0].subscribe((state) => {
  const snapshot = state.value as { entries: unknown[] } | undefined;
  console.log(snapshot?.entries.length ?? 0, "entries in the cache");
});

// later
stores[0].getState().value; // the latest snapshot, without Alpine
```

## What the sink is for

`@ailura/alpinejs-query` keeps every cache entry inside its own
`QueryController`. On each meaningful change it builds a
`QueryDevtoolsSnapshot` — `{ phase, entries, mutations }`, values rather than
getters — and hands that to the adapter's handle with `set()`. This package's
adapter is the backend that holds it, one `zustand/vanilla` store per handle,
in a single key: `{ value }`.

That is worth having when something outside Alpine needs to see the cache over
time: a devtools panel, a Node-side test that asserts what the cache looked like
after a fetch, a persistence layer that writes entries to disk. A zustand store
is a plain observable box with no framework attached, so a subscriber attached
to it sees every publish from code that has no Alpine instance at all — the
example in [Observing snapshots](#3-observing-snapshots-from-outside-alpine) is
the whole mechanism: hand the adapter a `create` that keeps the store, then
`subscribe` to it.

It is equally worth being blunt about what it is not. The handle is a **sink,
never a source**: nothing here reads a cache entry back out, and the registered
`$store.query` is byte-for-byte identical with or without the adapter. Passing
one does not make the cache reactive, does not add a store member, and does not
change events or per-query state. What changes is where the snapshots are
written — and who is able to read them.

## API

| Export                       | Description                                                                                                                                                                                                                                                    | Type                                        |
| ---------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------- |
| `createZustandStoreAdapter`  | `createZustandStoreAdapter(options?) => QueryStateAdapter` — pure factory, no side effect at import time. `options.create` is the store creator each handle is built from, so a caller can keep the store. This is what `createQueryPlugin({ adapter })` takes | `function`                                  |
| `ZustandStoreAdapterOptions` | `{ create? }` — the argument above. `create` defaults to zustand's own `createStore`                                                                                                                                                                           | `type`                                      |
| `ZustandStoreCreator`        | `(initializer: () => { value: unknown }) => StoreApi<{ value: unknown }>` — zustand's `createStore` satisfies it as-is, and an injected creator returns a real zustand `StoreApi` with `subscribe` on it                                                       | `type`                                      |
| `zustandStoreAdapter`        | A ready-made `createZustandStoreAdapter()` result, ready to pass as `adapter`. No configuration, and no injected creator — so its stores are unreachable. Sharing it shares no mutable state                                                                   | `const` (value of type `QueryStateAdapter`) |
| `createQueryPlugin`          | `createQueryPlugin(options?) => (alpine) => void` — builds a `QueryController` with `defaultOptions` and `adapter`, registers `toStore()` via `guardStore`                                                                                                     | `function`                                  |
| `zustandStoreQueryPlugin`    | Second name for `createQueryPlugin`, with a narrower options type: neither `adapter` nor `defaultOptions` is in it, so passing either is a type error. Nothing in the playground catalog refers to this name                                                   | `function`                                  |
| `default`                    | `queryAdapterZustand(options?)` — alias of `createQueryPlugin`, with the full `QueryRegisterOptions` parameter type                                                                                                                                            | `function`                                  |
| `DEFAULT_QUERY_STORE_KEY`    | `"query"` — the default `$store` key. The same string as `@ailura/alpinejs-query`'s own constant                                                                                                                                                               | `const` (string literal)                    |
| `QueryRegisterOptions`       | `{ storeKey?, adapter?, defaultOptions? }`                                                                                                                                                                                                                     | `type`                                      |

`QueryStateAdapter` and `QueryStateHandle` are **imported** from
`@ailura/alpinejs-query` here, not re-exported: the contract has one owner, and
a host that needs the type imports it from there.

There is no `magicKey`: the package registers a store and nothing else, so
`storeKey` is the one name to move.

## Store API

Whatever `QueryController.toStore()` returns, registered by this package:

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

The full surface, its options and its devtools contract are documented in
[`@ailura/alpinejs-query`](../query/README.md) — this package does not extend,
wrap or alter it. The two things to know before choosing it:

- **There is no `$query` magic.** A template that reaches for `$query` on a page
  booted with this plugin gets `undefined`.
- **The store does not react to the cache.** A snapshot published into the
  adapter is not a value any template reads, and `devtools.getSnapshot()` is a
  plain read, not a reactive accessor.

## Options

### `createQueryPlugin`

```ts
type QueryRegisterOptions = {
  storeKey?: string; //    default: DEFAULT_QUERY_STORE_KEY ("query")
  adapter?: QueryStateAdapter; // state backend the controller publishes into
  defaultOptions?: unknown; // forwarded verbatim as the controller's QueryOptions
};
```

| Option           | Default   | Effect                                                                                                                                                                                                                                    |
| ---------------- | --------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `storeKey`       | `"query"` | The `$store` key. Renaming it is the only collision-avoidance this package offers                                                                                                                                                         |
| `adapter`        | —         | Handed to `new QueryController(undefined, defaultOptions, adapter)` as its third argument. A sink; omitting it changes nothing about the registered store                                                                                 |
| `defaultOptions` | —         | Handed to `new QueryController(undefined, defaultOptions, adapter)` as its second argument, unchanged, so `{ staleTime: 30_000 }` works. Typed `unknown`, so nothing checks it and this package re-exports none of `query`'s option types |

`defaultOptions` is the one option with no default and no validation: pass a
`QueryOptions` bag or pass nonsense, and the cache will merge it or ignore it
without complaint. It is also per-entry: the cache merges it into each entry
once, when that entry is created.

### `createZustandStoreAdapter`

```ts
type ZustandStoreAdapterOptions = {
  create?: ZustandStoreCreator; // default: zustand's createStore
};
```

| Option   | Default                 | Effect                                                                                                                                                                                                                                                       |
| -------- | ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `create` | zustand's `createStore` | The function each handle's store is allocated from. Supply your own to keep the store, and the `subscribe` on it. Supplying one changes only the allocation — `get`, `set` and `destroy` are identical either way, and every handle still gets its own store |

The factory takes no other argument and reads nothing at import time, so
`createZustandStoreAdapter()` with no argument is the unchanged default path: it
allocates its own stores and they stay private to their handle.

## Avoiding name collisions

The toolkit rule is that a second package claiming a registered name throws a
`RegistrationError`. This package does not take the exception its sibling takes:
it registers without `override`, so two of them on one page is a throw, not a
silent replacement.

```ts
Alpine.plugin(queryAdapterZustand({ storeKey: "cache" }));
// → $store.cache
```

That is what lets this package and `queryPlugin()` from `@ailura/alpinejs-query`
coexist in one app under different names. Under the same name they do not
coexist: the second registration throws, and the first controller keeps running.

## SSR

> SSR-safe — no `window`/`document` at import time, and the registration needs
> neither. `zustand/vanilla` carries no React and no DOM, so the adapter half
> imports and runs unchanged on the server. The `QueryController` is
> constructed when the plugin callback runs, which is when the host calls it.

## Integration

- **`@ailura/alpinejs-query`** — required. This package imports
  `QueryController` and `QueryStateAdapter` from it, registers its store and
  does not bundle it. `queryPlugin()` from that package takes the same
  `adapter` option, so registering that plugin and passing this adapter
  achieves the same wiring without a second store.
- **`@ailura/alpinejs-query-adapter-alpine`** — the sibling adapter. Both
  implement the same contract, so a host can swap one for the other and rename
  nothing: both register the same key, `"query"`. Choose by where the snapshot
  entries: same, but a vanilla zustand store you can `subscribe` to from code
  with no Alpine instance — see [Observing
  snapshots](#3-observing-snapshots-from-outside-alpine).

## Limitations

- **The default singleton's store is unreachable; an injected one is not.**
  `create()` returns `{ get, set, destroy }` and nothing else, so there is no
  `subscribe` on the handle. `zustandStoreAdapter` was built with no `create`
  option, so the stores it allocates belong to their handles alone, and
  `QueryController` keeps the handle in a private field with no accessor — a
  host that registers the singleton gets snapshots it cannot read. Build the
  adapter with `createZustandStoreAdapter({ create })` and the store is yours
  from the first publish; that is the whole difference between a sink you can
  observe and one you cannot. Until you inject one, the reachable way to
  observe a snapshot is `store.devtools.subscribe()`, which exists on the
  registered store with or without an adapter.
- **`destroy()` is final and idempotent.** After it runs, `get()` reports
  `undefined` and `set()` is dropped — including a late publish from a
  controller being torn down — so a released handle can never be resurrected.
  Calling it twice is a no-op, not a throw. `QueryController.destroy()` calls
  the handle's `destroy()` and drops the handle, so a destroyed controller's
  adapter is spent.
- **The snapshot is held by reference, not deep-copied.** `set()` stores
  exactly what the controller published, and `get()` returns that same object.
  A snapshot is rebuilt from scratch on every change, so a holder never sees it
  mutate underneath — but the entry `key` arrays and `data` values inside it are
  the caller's own objects, and a caller that mutates them mutates the
  snapshot.
- **`subscribe()` is the consumer's responsibility.** The plugin registers no
  `change` listener and wires nothing to the adapter: the snapshot path is the
  controller's `publish()`, and the subscription path is the host's. An injected
  store does not subscribe to anything either — it is only where the values land,
  and attaching the listener is still the host's one line.
- **The plugin's own adapter path is not the differentiator.** The registered
  `$store.query` is identical with and without `adapter` — it is a command
  surface over the controller either way.
- **Three names, one function.** `createQueryPlugin`, the default export
  (`queryAdapterZustand`) and `zustandStoreQueryPlugin` are the same code, and
  they do not even have the same parameter type: `zustandStoreQueryPlugin` omits
  `adapter` and `defaultOptions` from its options type, so passing either is a
  compile error while passing it to either of the other two is not.
- **`DEFAULT_QUERY_STORE_KEY` collides by name with `query`'s own constant.**
  Both are `"query"`, both are exported, and importing both into one module
  needs an alias. They are not the same binding, so nothing keeps them in step.
- **`src/types.ts` is not on the barrel.** `AdapterOptions` and
  `DEFAULT_ADAPTER_ZUSTAND_STORE_KEY` are unreachable from the package entry
  point and nothing in `src/` imports that file. The value is the same as
  `DEFAULT_QUERY_STORE_KEY`.
- **No test covers the plugin.** `test/adapter.test.ts` exercises the adapter
  only; `createQueryPlugin` and its two aliases are untested.
- **The budget is met with room to spare** — `444 B` gzip against a `600 B`
  entry — so the size gate is not a constraint on this package.

## Size

`0.86 kB raw / 444 B gzip / 0.40 kB brotli` · budget `600 B` (gzip, from `.size-limit.json`) · externalized peers: `alpinejs`, `@ailura/alpinejs-core`, `@ailura/alpinejs-query`, `zustand`.

## Architecture

[Data layer](../../ARCHITECTURE.md) — an adapter package, not a feature. It has
no controller of its own and no state of its own: `adapter.ts` implements
`query`'s `QueryStateAdapter` contract against `zustand/vanilla`, and
`plugin.ts` constructs `query`'s `QueryController` and registers its store. See
canon, guards and SSR rules in [ARCHITECTURE.md](../../ARCHITECTURE.md).

## Testing

```sh
pnpm exec vp test packages/query-adapter-zustand
pnpm exec tsc --noEmit -p packages/query-adapter-zustand/tsconfig.json
```

`test/adapter.test.ts` observes the adapter from the outside only — what `get()`
returns, what `set()` changes, what `destroy()` releases, that one adapter
serves many independent handles, and that it works with no Alpine instance
present. It also covers the injected path: a caller's creator, the store it
keeps, and `store.subscribe` seeing every published snapshot, with the release
guarantees and handle independence holding there too. The plugin has no tests;
see [Limitations](#limitations). See [ARCHITECTURE.md §8](../../ARCHITECTURE.md).

## License

MIT
