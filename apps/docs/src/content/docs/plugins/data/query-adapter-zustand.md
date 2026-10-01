---
title: Query Adapter (Zustand)
---

@ailura/alpinejs-query-adapter-zustand

A `QueryStateAdapter` for the [Query](/plugins/data/query/) cache that keeps every
published snapshot in a `zustand/vanilla` store. `zustand` is a peer, so the package ships
the glue and zero bytes of zustand, and one store per handle is the whole implementation.

It is one of three members of the adapter family: same contract as
[Query Adapter (Alpine)](/plugins/data/query-adapter-alpine/) and
[Query Adapter (Nanostores)](/plugins/data/query-adapter-nanostores/), different backing store.
Pick it when something outside Alpine has to see the cache over time — a devtools panel, a
Node-side test, a persistence layer.

## Install

```sh
pnpm add alpinejs @ailura/alpinejs-core @ailura/alpinejs-query @ailura/alpinejs-query-adapter-zustand zustand
```

All four peers are required. `zustand` in particular is not optional: the adapter imports
`zustand/vanilla` at module scope, so without it the first import of this package fails to
resolve.

## Register the plugin

```ts
import Alpine from "alpinejs";
import { createQueryPlugin, zustandStoreAdapter } from "@ailura/alpinejs-query-adapter-zustand";

Alpine.plugin(createQueryPlugin({ adapter: zustandStoreAdapter }));

Alpine.start();
```

That registers `$store.query` and **no magic** — there is no `$query` here. The magic
belongs to `queryPlugin()` from `@ailura/alpinejs-query`.

## Minimal example

```html
<div x-data>
  <button @click="$store.query.invalidate(['articles'])">Reload</button>
  <span x-text="$store.query.get(['articles'])?.data?.length ?? 0"></span>
</div>
```

The store surface is the Query store, documented on the
[Query page](/plugins/data/query/), and it is byte-for-byte the same one `queryPlugin()`
registers. Passing `adapter` changes where snapshots are written, not what the store can
do.

## What the sink is for

`@ailura/alpinejs-query` keeps every cache entry inside its own `QueryController`. On each
meaningful change the controller builds a **devtools snapshot** — `{ phase, entries, mutations }`,
values rather than getters — and hands it to the adapter's handle with `set()`.

This package's adapter is the backend that holds it, in a single key: `{ value }`.

The handle is a **sink, never a source**. Nothing here reads a cache entry back out, and
the registered `$store.query` is identical with or without the adapter. Passing one does not
make the cache reactive, does not add a store member, and does not change events or
per-query state.

Read the snapshot without Alpine, from the handle itself:

```ts
import { zustandStoreAdapter } from "@ailura/alpinejs-query-adapter-zustand";

const handle = zustandStoreAdapter.create({ phase: "idle", entries: [], mutations: [] });
handle.get(); // the initial value it was created with
handle.set({ phase: "mounted", entries: [{ key: ["todos"] }], mutations: [] });
handle.get().entries.length; // 1
handle.destroy();
handle.get(); // undefined — and destroy() again is a no-op, not a throw
```

Handles are independent: `create()` allocates a fresh store per handle, so two handles
created from the same adapter cannot see each other.

## Observing snapshots from outside Alpine

That example only reaches the handle's own `get()`. To be _watched_, a snapshot has to
travel through a store you hold — and by default the store is private to the handle.
`QueryStateHandle` is `{ get, set, destroy }` and cannot grow a `subscribe` member, and the
controller keeps the handle in a private field with no accessor. So the store itself is
made reachable: pass your own creator to the adapter factory and the store is yours.

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

// The controller created its handle while the plugin ran, so stores[0] is the
// store every published snapshot is written into.
stores[0].subscribe((state) => {
  const snapshot = state.value as { entries: unknown[] } | undefined;
  console.log(snapshot?.entries.length ?? 0, "entries in the cache");
});

// later
stores[0].getState().value; // the latest snapshot, without Alpine
```

`create` is resolved once per adapter, not per handle, so an injected creator cannot be
swapped underneath a handle it already built. Supplying one changes only the allocation —
`get`, `set` and `destroy` are identical either way.

:::caution[The ready-made singleton's store is unreachable]
`zustandStoreAdapter` is `createZustandStoreAdapter()` with no options, so it has no injected
creator: the stores it allocates belong to their handles alone, and the controller exposes no
accessor for the handle. Registering the singleton gives you snapshots you cannot subscribe
to. Build the adapter with `createZustandStoreAdapter({ create })` when observation is the
point. Until you inject one, the reachable way to observe a snapshot is
`store.devtools.subscribe()`, which exists on the registered store with or without an adapter.
:::

## API reference

| Export                       | Description                                                                                                                                                               | Type                                        |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------- |
| `createZustandStoreAdapter`  | `createZustandStoreAdapter(options?) => QueryStateAdapter` — pure factory, no side effect at import time. `options.create` is the store creator each handle is built from | `function`                                  |
| `ZustandStoreAdapterOptions` | `{ create? }` — the argument above. `create` defaults to zustand's own `createStore`                                                                                      | `type`                                      |
| `ZustandStoreCreator`        | `(initializer: () => { value: unknown }) => StoreApi<{ value: unknown }>` — zustand's `createStore` satisfies it as-is                                                    | `type`                                      |
| `zustandStoreAdapter`        | A ready-made `createZustandStoreAdapter()` result, ready to pass as `adapter`. No configuration, and no injected creator                                                  | `const` (value of type `QueryStateAdapter`) |
| `createQueryPlugin`          | `createQueryPlugin(options?) => (alpine) => void` — builds a `QueryController` with `defaultOptions` and `adapter`, registers `toStore()` via `guardStore`                | `function`                                  |
| `zustandStoreQueryPlugin`    | Second name for `createQueryPlugin`, with a narrower options type: neither `adapter` nor `defaultOptions` is in it, so passing either is a type error                     | `function`                                  |
| `default`                    | `queryAdapterZustand(options?)` — alias of `createQueryPlugin`                                                                                                            | `function`                                  |
| `DEFAULT_QUERY_STORE_KEY`    | `"query"` — the default `$store` key. The same string as `@ailura/alpinejs-query`'s own constant                                                                          | `const` (string literal)                    |
| `QueryRegisterOptions`       | `{ storeKey?, adapter?, defaultOptions? }`                                                                                                                                | `type`                                      |

`QueryStateAdapter` and `QueryStateHandle` are **imported** from `@ailura/alpinejs-query`
here, not re-exported: the contract has one owner, and a host that needs the type imports it
from there.

## Plugin options

```ts
type QueryRegisterOptions = {
  storeKey?: string; //        default: DEFAULT_QUERY_STORE_KEY ("query")
  adapter?: QueryStateAdapter; // state backend the controller publishes into
  defaultOptions?: unknown; //   forwarded verbatim as the controller's QueryOptions
};
```

| Option           | Default   | Effect                                                                                                                                                                       |
| ---------------- | --------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `storeKey`       | `"query"` | The `$store` key. Renaming it is the only collision-avoidance this package offers                                                                                            |
| `adapter`        | —         | Handed to `new QueryController(undefined, defaultOptions, adapter)`. A sink; omitting it changes nothing about the registered store                                          |
| `defaultOptions` | —         | Handed to the same constructor unchanged, so `{ staleTime: 30_000 }` works. Typed `unknown`, so nothing checks it and this package re-exports none of `query`'s option types |

### `createZustandStoreAdapter`

| Option   | Default                 | Effect                                                                                                                                                   |
| -------- | ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `create` | zustand's `createStore` | The function each handle's store is allocated from. Supply your own to keep the store — and the `subscribe` on it. Every handle still gets its own store |

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

The full surface, its options and its devtools contract are documented on the
[Query page](/plugins/data/query/). This package does not extend, wrap or alter it.

## Avoiding name collisions

This package does **not** take the exception its sibling takes. It registers without
`override`, so a second registration of `"query"` throws a `RegistrationError` rather than
silently replacing the first — the first controller keeps running.

```ts
Alpine.plugin(createQueryPlugin({ storeKey: "cache" }));
// → $store.cache
```

That is what lets this package and `queryPlugin()` from `@ailura/alpinejs-query` coexist in
one app under different names. Under the same name they do not.

## SSR

SSR-safe: no `window`/`document` at import time, and the registration needs neither.
`zustand/vanilla` carries no React and no DOM, so the adapter half of this package imports
and runs unchanged in a Node process. The `QueryController` is constructed when the plugin
callback runs, which is when the host calls it.

## Which adapter

All three adapters implement the same `QueryStateAdapter` contract and all three register the
key `"query"`, so you can swap one for the other and rename nothing. They differ in one thing
only: what the store the snapshot lands in can do.

| Package                    | Backing store               | Value held          | Subscribe from outside Alpine        |
| -------------------------- | --------------------------- | ------------------- | ------------------------------------ |
| `query-adapter-alpine`     | One `Alpine.reactive` box   | `{ value }`         | No — read the box through the handle |
| `query-adapter-zustand`    | One `zustand/vanilla` store | `{ value }`         | Yes — with an injected `create`      |
| `query-adapter-nanostores` | One `nanostores` `atom`     | The snapshot itself | Yes — with an injected `create`      |

Alpine is the only one a template can bind to, because `Alpine.reactive` is Alpine's own
graph. Between the two observable ones, zustand hands you a `StoreApi` whose `subscribe`
receives the whole `{ value }` slot, while nanostores hands you a `WritableAtom` holding the
snapshot itself — no wrapper to unwrap, a `subscribe` that also fires once on attach, and
the smallest peer dependency of the three.

All three are sinks, not sources: none of them makes the cache reactive, and all three leave
`$store.query` unchanged.

## Limitations

- **The default singleton's store is unreachable; an injected one is not.** See the caution
  above.
- **`destroy()` is final and idempotent.** After it runs, `get()` reports `undefined` and
  `set()` is dropped — including a late publish from a controller being torn down — so a
  released handle can never be resurrected. Calling it twice is a no-op, not a throw.
- **The snapshot is held by reference, not deep-copied.** `set()` stores exactly what the
  controller published and `get()` returns that same object. A snapshot is rebuilt from
  scratch on every change, so a holder never sees it mutate underneath — but the entry
  `key` arrays and `data` values inside it are the caller's own objects.
- **`subscribe()` is the consumer's responsibility.** The plugin registers no `change`
  listener and wires nothing to the adapter: the snapshot path is the controller's, and the
  subscription path is the host's.
- **Three names, one function.** `createQueryPlugin`, the default export
  (`queryAdapterZustand`) and `zustandStoreQueryPlugin` are the same code, and they do not
  have the same parameter type: `zustandStoreQueryPlugin` omits `adapter` and
  `defaultOptions`, so passing either is a compile error.
- **`DEFAULT_QUERY_STORE_KEY` collides by name with `query`'s own constant.** Both are
  `"query"`, both are exported, and importing both into one module needs an alias.
- **No test covers the plugin.** The package's tests exercise the adapter only.
