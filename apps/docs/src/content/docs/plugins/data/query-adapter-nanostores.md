---
title: Query Adapter (Nanostores)
---

@ailura/alpinejs-query-adapter-nanostores

A `QueryStateAdapter` for the [Query](/plugins/data/query/) cache that keeps every published
snapshot in a `nanostores` `atom`. `nanostores` is a peer, so the package ships the glue and
zero bytes of nanostores, and one atom per handle is the whole implementation.

It is the third member of the adapter family: same contract as
[Query Adapter (Alpine)](/plugins/data/query-adapter-alpine/) and
[Query Adapter (Zustand)](/plugins/data/query-adapter-zustand/), different backing store. Pick
it when something outside Alpine has to see the cache over time — a devtools panel, a
Node-side test, a persistence layer — and you want the smallest dependency of the three to
reach for.

## Install

```sh
pnpm add alpinejs @ailura/alpinejs-core @ailura/alpinejs-query @ailura/alpinejs-query-adapter-nanostores nanostores
```

Four peers are required. `nanostores` in particular is not optional: the adapter imports
`atom` at module scope, so without it the first import of this package fails to resolve —
at build time or at runtime, with nothing to do with Alpine.

## Register the plugin

```ts
import Alpine from "alpinejs";
import {
  createQueryPlugin,
  nanostoresStoreAdapter,
} from "@ailura/alpinejs-query-adapter-nanostores";

Alpine.plugin(createQueryPlugin({ adapter: nanostoresStoreAdapter }));

Alpine.start();
```

That registers `$store.query` and **no magic** — there is no `$query` here, and no `$nano`
either. The magic belongs to `queryPlugin()` from `@ailura/alpinejs-query`.

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

This package's adapter is the backend that holds it, in a single slot: the value itself. An
`atom`, not a `map` and not a `{ value }` wrapper — the handle publishes one value, and a
plain atom is already a live observable box.

The handle is a **sink, never a source**. Nothing here reads a cache entry back out, and
the registered `$store.query` is identical with or without the adapter. Passing one does not
make the cache reactive, does not add a store member, and does not change events or
per-query state.

Read the snapshot without Alpine, from the handle itself:

```ts
import { nanostoresStoreAdapter } from "@ailura/alpinejs-query-adapter-nanostores";

const handle = nanostoresStoreAdapter.create({ phase: "idle", entries: [], mutations: [] });
handle.get(); // the initial value it was created with
handle.set({ phase: "mounted", entries: [{ key: ["todos"] }], mutations: [] });
handle.get().entries.length; // 1
handle.destroy();
handle.get(); // undefined — and destroy() again is a no-op, not a throw
```

Handles are independent: `create()` allocates a fresh atom per handle, so two handles
created from the same adapter cannot see each other.

## Observing snapshots from outside Alpine

That example only reaches the handle's own `get()`. To be _watched_, a snapshot has to
travel through a store you hold — and by default the store is private to the handle.
`QueryStateHandle` is `{ get, set, destroy }` and cannot grow a `subscribe` member, and the
controller keeps the handle in a private field with no accessor. So the store itself is
made reachable: pass your own creator to the adapter factory and the atom is yours.

```ts
import Alpine from "alpinejs";
import { atom } from "nanostores";
import type { WritableAtom } from "nanostores";
import {
  createNanostoresStoreAdapter,
  createQueryPlugin,
} from "@ailura/alpinejs-query-adapter-nanostores";

const atoms: WritableAtom<unknown>[] = [];

const adapter = createNanostoresStoreAdapter({
  create: (initial) => {
    const store = atom(initial);
    atoms.push(store);
    return store;
  },
});

Alpine.plugin(createQueryPlugin({ adapter }));
Alpine.start();

// The controller created its handle while the plugin ran, so atoms[0] is the
// atom every published snapshot is written into.
const unsubscribe = atoms[0].subscribe((snapshot) => {
  const entries = (snapshot as { entries: unknown[] } | undefined)?.entries ?? [];
  console.log(entries.length, "entries in the cache");
});

// later
atoms[0].get(); // the latest snapshot, without Alpine

// and when the panel is torn down
unsubscribe();
```

`create` is resolved once per adapter, not per handle, so an injected creator cannot be
swapped underneath a handle it already built. Supplying one changes only the allocation —
`get`, `set` and `destroy` are identical either way.

:::caution[The ready-made singleton's atom is unreachable]
`nanostoresStoreAdapter` is `createNanostoresStoreAdapter()` with no options, so it has no
injected creator: the atoms it allocates belong to their handles alone, and the controller
exposes no accessor for the handle. Registering the singleton gives you snapshots you cannot
subscribe to. Build the adapter with `createNanostoresStoreAdapter({ create })` when
observation is the point. Until you inject one, the reachable way to observe a snapshot is
`store.devtools.subscribe()`, which exists on the registered store with or without an
adapter.
:::

## No `$nano`, no `x-nano`

This package registers exactly one name: the `$store` key from `guardStore`. No magic, no
directive. `$nano` and `x-nano` belong to `@nanostores/alpine`, which this package
deliberately does not depend on — this repo claims every registered name as
`kind:name`, so a package that re-exported another package's Alpine plugin, or registered it
from inside its own callback, would take a name this repo does not own.

If you want `$nano` in your app, register it yourself:

```ts
import Alpine from "alpinejs";
import { NanoStores } from "@nanostores/alpine";
import {
  createQueryPlugin,
  nanostoresStoreAdapter,
} from "@ailura/alpinejs-query-adapter-nanostores";

const nanostores = new NanoStores();
Alpine.plugin((Alpine) => Alpine.magic("nano", nanostores));
Alpine.plugin(createQueryPlugin({ adapter: nanostoresStoreAdapter }));

Alpine.start();
```

## API reference

| Export                          | Description                                                                                                                                                                  | Type                                        |
| ------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------- |
| `createNanostoresStoreAdapter`  | `createNanostoresStoreAdapter(options?) => QueryStateAdapter` — pure factory, no side effect at import time. `options.create` is the store creator each handle is built from | `function`                                  |
| `NanostoresStoreAdapterOptions` | `{ create? }` — the argument above. `create` defaults to nanostores' own `atom`                                                                                              | `type`                                      |
| `NanostoresStoreCreator`        | `<Value>(initial: Value) => WritableAtom<Value>` — nanostores' `atom` satisfies it as-is, and an injected creator returns a real `WritableAtom` with `subscribe`             | `type`                                      |
| `nanostoresStoreAdapter`        | A ready-made `createNanostoresStoreAdapter()` result, ready to pass as `adapter`. No configuration, and no injected creator                                                  | `const` (value of type `QueryStateAdapter`) |
| `createQueryPlugin`             | `createQueryPlugin(options?) => (alpine) => void` — builds a `QueryController` with `defaultOptions` and `adapter`, registers `toStore()` via `guardStore`                   | `function`                                  |
| `nanostoresQueryPlugin`         | Second name for `createQueryPlugin`, with a narrower options type: neither `adapter` nor `defaultOptions` is in it, so passing either is a type error                        | `function`                                  |
| `default`                       | `queryAdapterNanostores(options?)` — alias of `createQueryPlugin`                                                                                                            | `function`                                  |
| `DEFAULT_QUERY_STORE_KEY`       | `"query"` — the default `$store` key. The same string as `@ailura/alpinejs-query`'s own constant                                                                             | `const` (string literal)                    |
| `QueryRegisterOptions`          | `{ storeKey?, adapter?, defaultOptions? }`                                                                                                                                   | `type`                                      |

`QueryStateAdapter` and `QueryStateHandle` are **imported** from `@ailura/alpinejs-query`
here, not re-exported: the contract has one owner, and a host that needs the type imports it
from there. `atom` and `WritableAtom` are likewise imported from `nanostores` and never
re-exported — the barrel is this package's own surface only.

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

There is no `registerNanoStores` option and no implicit default adapter: omit `adapter` and
the controller keeps every byte of state inside itself, exactly as when you register
`queryPlugin()` from `@ailura/alpinejs-query`.

### `createNanostoresStoreAdapter`

| Option   | Default            | Effect                                                                                                                                                 |
| -------- | ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `create` | nanostores' `atom` | The function each handle's store is allocated from. Supply your own to keep the atom — and the `subscribe` on it. Every handle still gets its own atom |

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

The full surface, its options and its devtools contract — including the shipped
`@ailura/alpinejs-query/devtools` panel — are documented on the
[Query page](/plugins/data/query/). This package does not extend, wrap or alter any of it.

## Avoiding name collisions

This package does **not** take the exception its Alpine sibling takes. It registers without
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
`nanostores` is framework-free and DOM-free, so the adapter half of this package imports
and runs unchanged in a Node process. The `QueryController` is constructed when the plugin
callback runs, which is when the host calls it.

## Which adapter

All three adapters implement the same `QueryStateAdapter` contract and all three register the
key `"query"`, so you can swap one for the other and rename nothing. They differ in exactly
one thing: what a host can do with the store the snapshot lands in.

| Package                    | Store behind a handle       | Value held          | Subscribe from outside Alpine        |
| -------------------------- | --------------------------- | ------------------- | ------------------------------------ |
| `query-adapter-alpine`     | One `Alpine.reactive` box   | `{ value }`         | No — read the box through the handle |
| `query-adapter-zustand`    | One `zustand/vanilla` store | `{ value }`         | Yes — with an injected `create`      |
| `query-adapter-nanostores` | One `nanostores` `atom`     | The snapshot itself | Yes — with an injected `create`      |

That difference is worth spelling out, because it is the only one there is:

- **Alpine** is the only one whose store a template can bind to. `Alpine.reactive` is
  Alpine's own graph, so a component reading the box re-renders when the snapshot changes —
  and it needs Alpine in the loop to do it.
- **zustand** hands out a `StoreApi` whose `subscribe` receives the whole `{ value }` slot.
  You unwrap one level to reach the snapshot.
- **nanostores** hands out a `WritableAtom` that holds the snapshot directly, so there is no
  wrapper to unwrap. Its `subscribe` also fires once on attach, with the value the store was
  created with, plus `init` for that same value and a one-function `listen`. It is the
  smallest of the three peer dependencies, and its `atom` is the only one of the three a UI
  library can bind to directly.

All three are sinks, not sources: none of them makes the cache reactive, and all three leave
`$store.query` unchanged.

## Limitations

- **The default singleton's atom is unreachable; an injected one is not.** See the caution
  above.
- **`destroy()` is final and idempotent.** After it runs, `get()` reports `undefined` and
  `set()` is dropped — including a late publish from a controller being torn down — so a
  released handle can never be resurrected. Calling it twice is a no-op, not a throw.
- **The teardown is a listener binding, not a store call.** nanostores has no `destroy()`, so
  the handle holds exactly one `listen` of its own — which also keeps the store mounted,
  since a nanostores store with no listeners is allowed to read back `undefined` — and drops
  it on release. What you attached with `store.subscribe` stays yours to unbind.
- **A `subscribe` on the atom fires once on attach** with the value the handle was created
  with. That is nanostores' documented behaviour, not an extra publish, and it is why a
  subscriber sees the initial snapshot as its first call.
- **The snapshot is held by reference, not deep-copied.** `set()` stores exactly what the
  controller published and `get()` returns that same object. A snapshot is rebuilt from
  scratch on every change, so a holder never sees it mutate underneath — but the entry `key`
  arrays and `data` values inside it are the caller's own objects.
- **The atom is written one value at a time.** Re-publishing the _same_ snapshot object is a
  no-op for subscribers, because nanostores compares with `Object.is` before notifying. The
  controller builds a fresh snapshot on every change, so this never hides a real transition.
- **`subscribe()` is the consumer's responsibility.** The plugin registers no `change`
  listener and wires nothing to the adapter: the snapshot path is the controller's, and the
  subscription path is the host's.
- **Three names, one function.** `createQueryPlugin`, the default export
  (`queryAdapterNanostores`) and `nanostoresQueryPlugin` are the same code, and they do not
  have the same parameter type: `nanostoresQueryPlugin` omits `adapter` and
  `defaultOptions`, so passing either is a compile error.
- **`DEFAULT_QUERY_STORE_KEY` collides by name with `query`'s own constant.** Both are
  `"query"`, both are exported, and importing both into one module needs an alias.
- **The demo page is adapter-shaped, not atom-shaped.** The playground has no real nanostores
  atom to hand the adapter, so `apps/demo` constructs one in `src/demo/query-nanostores-demo.ts`
  to make the snapshot path observable. Read the demo for the wiring, not for a nanostores
  idiom.
- **No test covers the plugin.** The package's tests exercise the adapter only.
