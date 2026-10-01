# @ailura/alpinejs-query-adapter-nanostores

<p align="center">

[![bundlephobia minzip](https://badgen.net/bundlephobia/minzip/@ailura/alpinejs-query-adapter-nanostores)](https://bundlephobia.com/package/@ailura/alpinejs-query-adapter-nanostores)

</p>

> A `nanostores`-backed `QueryStateAdapter` for `@ailura/alpinejs-query`, plus
> an Alpine plugin that registers the query store and forwards the adapter to
> the controller. `nanostores` is a peer: the package ships the glue and zero
> bytes of nanostores, and one `atom` per handle is the whole implementation.
> Pass your own store creator and the atom is yours, so every published snapshot
> can be subscribed to from outside Alpine.
>
> This package does **not** provide `$nano` or `x-nano`, and does not depend on
> `@nanostores/alpine`. See
> [No `$nano`, no `x-nano`](#no-nano-no-x-nano) for why.

## Installation

```sh
pnpm add @ailura/alpinejs-query-adapter-nanostores @ailura/alpinejs-query nanostores alpinejs
# or
npm install @ailura/alpinejs-query-adapter-nanostores @ailura/alpinejs-query nanostores alpinejs
```

Four peers, all required, none bundled:

- `alpinejs@^3.0.0` — only for the plugin half. The adapter half never touches it.
- `@ailura/alpinejs-core` — only for `guardStore`/`resolveStoreKey`, the two
  registration primitives the plugin half is built on.
- `@ailura/alpinejs-query` — this package constructs its `QueryController` and
  imports `QueryStateAdapter` from it. It is not re-exported here.
- `nanostores@^1.0.0` — **not optional.** The adapter imports `atom` at module
  scope. Skip it and the very first import of this package fails to resolve, at
  build time or at runtime, with nothing to do with Alpine.

## Usage

### 1. Alpine

```ts
import Alpine from "alpinejs";
import {
  createQueryPlugin,
  nanostoresStoreAdapter,
} from "@ailura/alpinejs-query-adapter-nanostores";

Alpine.plugin(createQueryPlugin({ adapter: nanostoresStoreAdapter }));
Alpine.start();
```

```html
<div x-data>
  <button @click="$store.query.invalidate(['articles'])">Reload</button>
  <span x-text="$store.query.get(['articles'])?.data?.length ?? 0"></span>
</div>
```

That registers `$store.query` and no magic — there is no `$query`; the magic
belongs to `queryPlugin()` from `@ailura/alpinejs-query`, and there is no
`$nano` either; see [No `$nano`, no `x-nano`](#no-nano-no-x-nano). Read
[Store API](#store-api) for the surface and [Limitations](#limitations) for what
the `adapter` option does and does not change. `nanostoresStoreAdapter` is the
ready-made singleton, which is fine for the store surface and cannot be
subscribed to; build the adapter with `createNanostoresStoreAdapter({ create })`
when you want to watch the snapshots — see
[Observing snapshots](#3-observing-snapshots-from-outside-alpine).

The default export is the same plugin under the package's own name:

```ts
import Alpine from "alpinejs";
import queryAdapterNanostores from "@ailura/alpinejs-query-adapter-nanostores";
import { nanostoresStoreAdapter } from "@ailura/alpinejs-query-adapter-nanostores";

Alpine.plugin(queryAdapterNanostores({ storeKey: "cache", adapter: nanostoresStoreAdapter }));
// → $store.cache
```

### 2. Headless — no Alpine, no DOM

`createNanostoresStoreAdapter()` is a pure factory. It reads no globals at import
time, and `nanostores` is framework-free and DOM-free, so the adapter half of
this package runs in a plain Node process.

The host that owns the adapter also owns its handles:

```ts
import { nanostoresStoreAdapter } from "@ailura/alpinejs-query-adapter-nanostores";

const handle = nanostoresStoreAdapter.create({ phase: "idle", entries: [], mutations: [] });
handle.get(); // the initial value it was created with
handle.set({ phase: "mounted", entries: [{ key: ["todos"] }], mutations: [] });
console.log(handle.get().entries.length); // 1
handle.destroy();
handle.get(); // undefined — and destroy() again is a no-op, not a throw
```

Handles are independent and the shared adapter holds no state: `create()`
allocates a fresh atom per handle, so two handles created from
`nanostoresStoreAdapter` cannot see each other.

### 3. Observing snapshots from outside Alpine

That example only reaches the handle's own `get()`. To be _watched_, a snapshot
has to travel through a store you hold, and by default the store is private to
the handle — see [Limitations](#limitations). Pass your own `create` and it is
yours:

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

// The controller created its handle while the plugin ran, so `atoms[0]` is the
// atom every published snapshot is written into.
const unsubscribe = atoms[0].subscribe((snapshot) => {
  const entries = (snapshot as { entries: unknown[] } | undefined)?.entries ?? [];
  console.log(entries.length, "entries in the cache");
});

// later, when the panel is torn down
unsubscribe();
atoms[0].get(); // the latest snapshot, without Alpine
```

## What the sink is for

`@ailura/alpinejs-query` keeps every cache entry inside its own
`QueryController`. On each meaningful change it builds a
`QueryDevtoolsSnapshot` — `{ phase, entries, mutations }`, values rather than
getters — and hands that to the adapter's handle with `set()`. This package's
adapter is the backend that holds it, one `nanostores` `atom` per handle, in a
single slot: the value itself. No `{ value }` wrapper, no `map` store: one
published snapshot, one atom holding it.

That is worth having when something outside Alpine needs to see the cache over
time: a devtools panel, a Node-side test that asserts what the cache looked like
after a fetch, a persistence layer that writes entries to disk. A nanostores
atom is a tiny observable box with no framework attached, so a subscriber
attached to it sees every publish from code that has no Alpine instance at all
— the example in
[Observing snapshots](#3-observing-snapshots-from-outside-alpine) is the whole
mechanism: hand the adapter a `create` that keeps the atom, then `subscribe` to
it.

It is equally worth being blunt about what it is not. The handle is a **sink,
never a source**: nothing here reads a cache entry back out, and the registered
`$store.query` is byte-for-byte identical with or without the adapter. Passing
one does not make the cache reactive, does not add a store member, and does not
change events or per-query state. What changes is where the snapshots are
written — and who is able to read them.

## No `$nano`, no `x-nano`

This package claims exactly one registered name: the `$store` key from
`guardStore`. It registers no magic and no directive, so `$nano` and `x-nano`
are not defined by it.

That is a deliberate departure from the package it replaces. The old
`@ailuracode/alpine-query-kit` re-exported `NanoStores`, `$nano` and `x-nano`
from its own barrel and called `@nanostores/alpine`'s plugin from inside its own
registration callback. That collides with this repo's ownership model, where
`guardStore`/`guardMagic` claim names as `kind:name` and a second claim throws a
`RegistrationError`: two packages registering `$nano`, or one package registering
a name another one already owns, is a collision by construction. Worse, a
consumer importing the barrel would get a name they never asked for, registered
by a package whose job is a query cache.

If you want `$nano` in your app, register it yourself — one line, and you own it:

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

Both registrations then live in your app, under names your app chose, and the
query adapter package keeps out of a battle it should not be in.

## API

| Export                          | Description                                                                                                                                                                                                                                                      | Type                                        |
| ------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------- |
| `createNanostoresStoreAdapter`  | `createNanostoresStoreAdapter(options?) => QueryStateAdapter` — pure factory, no side effect at import time. `options.create` is the store creator each handle is built from, so a caller can keep the atom. This is what `createQueryPlugin({ adapter })` takes | `function`                                  |
| `NanostoresStoreAdapterOptions` | `{ create? }` — the argument above. `create` defaults to nanostores' own `atom`                                                                                                                                                                                  | `type`                                      |
| `NanostoresStoreCreator`        | `<Value>(initial: Value) => WritableAtom<Value>` — nanostores' `atom` satisfies it as-is, and an injected creator returns a real `WritableAtom` with `subscribe` on it                                                                                           | `type`                                      |
| `nanostoresStoreAdapter`        | A ready-made `createNanostoresStoreAdapter()` result, ready to pass as `adapter`. No configuration, and no injected creator — so its atoms are unreachable. Sharing it shares no mutable state                                                                   | `const` (value of type `QueryStateAdapter`) |
| `createQueryPlugin`             | `createQueryPlugin(options?) => (alpine) => void` — builds a `QueryController` with `defaultOptions` and `adapter`, registers `toStore()` via `guardStore`                                                                                                       | `function`                                  |
| `nanostoresQueryPlugin`         | Second name for `createQueryPlugin`, with a narrower options type: neither `adapter` nor `defaultOptions` is in it, so passing either is a type error. Nothing in the playground catalog refers to this name                                                     | `function`                                  |
| `default`                       | `queryAdapterNanostores(options?)` — alias of `createQueryPlugin`, with the full `QueryRegisterOptions` parameter type                                                                                                                                           | `function`                                  |
| `DEFAULT_QUERY_STORE_KEY`       | `"query"` — the default `$store` key. The same string as `@ailura/alpinejs-query`'s own constant                                                                                                                                                                 | `const` (string literal)                    |
| `QueryRegisterOptions`          | `{ storeKey?, adapter?, defaultOptions? }`                                                                                                                                                                                                                       | `type`                                      |

`QueryStateAdapter` and `QueryStateHandle` are **imported** from
`@ailura/alpinejs-query` here, not re-exported: the contract has one owner, and
a host that needs the type imports it from there. `WritableAtom` and `atom` are
likewise imported from `nanostores`, never re-exported — the barrel is this
package's own surface only.

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

- **There is no `$query` magic and no `$nano` magic.** A template that reaches
  for `$query` on a page booted with this plugin gets `undefined`; so does one
  that reaches for `$nano`.
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
| `adapter`        | —         | Handed to `new QueryController(undefined, defaultOptions, adapter)` as its third argument. A sink; omitting it changes nothing about the registered store, and there is no implicit default adapter                                       |
| `defaultOptions` | —         | Handed to `new QueryController(undefined, defaultOptions, adapter)` as its second argument, unchanged, so `{ staleTime: 30_000 }` works. Typed `unknown`, so nothing checks it and this package re-exports none of `query`'s option types |

`defaultOptions` is the one option with no default and no validation: pass a
`QueryOptions` bag or pass nonsense, and the cache will merge it or ignore it
without complaint. It is also per-entry: the cache merges it into each entry
once, when that entry is created.

There is deliberately no `registerNanoStores` option, and no fallback adapter:
omit `adapter` and the controller keeps every byte of state inside itself, which
is the same behaviour as registering `queryPlugin()` from
`@ailura/alpinejs-query`.

### `createNanostoresStoreAdapter`

```ts
type NanostoresStoreAdapterOptions = {
  create?: NanostoresStoreCreator; // default: nanostores' atom
};
```

| Option   | Default            | Effect                                                                                                                                                                                                                                                     |
| -------- | ------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `create` | nanostores' `atom` | The function each handle's store is allocated from. Supply your own to keep the atom, and the `subscribe` on it. Supplying one changes only the allocation — `get`, `set` and `destroy` are identical either way, and every handle still gets its own atom |

The factory takes no other argument and reads nothing at import time, so
`createNanostoresStoreAdapter()` with no argument is the unchanged default path:
it allocates its own atoms and they stay private to their handle.

## Avoiding name collisions

The toolkit rule is that a second package claiming a registered name throws a
`RegistrationError`. This package does not take the exception its siblings take:
it registers without `override`, so two of them on one page is a throw, not a
silent replacement.

```ts
Alpine.plugin(queryAdapterNanostores({ storeKey: "cache" }));
// → $store.cache
```

That is what lets this package and `queryPlugin()` from `@ailura/alpinejs-query`
coexist in one app under different names. Under the same name they do not
coexist: the second registration throws, and the first controller keeps running.

## SSR

> SSR-safe — no `window`/`document` at import time, and the registration needs
> neither. `nanostores` is framework-free and DOM-free, so the adapter half
> imports and runs unchanged on the server. The `QueryController` is constructed
> when the plugin callback runs, which is when the host calls it.

## Integration

- **`@ailura/alpinejs-query`** — required. This package imports
  `QueryController` and `QueryStateAdapter` from it, registers its store and
  does not bundle it. `queryPlugin()` from that package takes the same
  `adapter` option, so registering that plugin and passing this adapter
  achieves the same wiring without a second store.
- **`@ailura/alpinejs-query-adapter-zustand`** — the sibling adapter. Both
  implement the same contract, so a host can swap one for the other and rename
  nothing: both register the same key, `"query"`. Choose by the store you want
  to hold. `zustand/vanilla` gives you a `StoreApi` whose `subscribe` receives
  the whole `{ value }` slot; a nanostores `atom` gives you the published
  snapshot itself, with `subscribe` that also fires once on attach, plus
  `init` (the value the store was created with) and a one-function
  `listen`. This package is the smaller dependency of the two, and its `atom` is
  the only store either of them hands out that a UI library can bind to
  directly.
- **`@ailura/alpinejs-query-adapter-alpine`** — the other sibling, and the one
  closest in size. Same contract, same key; its store is Alpine's own reactive
  object, so it needs Alpine in the loop where this one does not.
- **`@nanostores/alpine`** — **not** a dependency, by choice. It is the package
  that owns `$nano` and `x-nano`, and this package registers neither; see
  [No `$nano`, no `x-nano`](#no-nano-no-x-nano). Install and register it
  yourself if your app wants those names.

## Limitations

- **The default singleton's atom is unreachable; an injected one is not.**
  `create()` returns `{ get, set, destroy }` and nothing else, so there is no
  `subscribe` on the handle. `nanostoresStoreAdapter` was built with no `create`
  option, so the atoms it allocates belong to their handles alone, and
  `QueryController` keeps the handle in a private field with no accessor — a host
  that registers the singleton gets snapshots it cannot read. Build the adapter
  with `createNanostoresStoreAdapter({ create })` and the atom is yours from the
  first publish; that is the whole difference between a sink you can observe and
  one you cannot. Until you inject one, the reachable way to observe a snapshot
  is `store.devtools.subscribe()`, which exists on the registered store with or
  without an adapter.
- **`destroy()` is final and idempotent.** After it runs, `get()` reports
  `undefined` and `set()` is dropped — including a late publish from a
  controller being torn down — so a released handle can never be resurrected.
  Calling it twice is a no-op, not a throw. `QueryController.destroy()` calls
  the handle's `destroy()` and drops the handle, so a destroyed controller's
  adapter is spent.
- **nanostores has no `destroy()`, so the teardown is a listener binding, not a
  store call.** The handle holds exactly one `listen` of its own — which also
  keeps the store mounted, since a nanostores store with no listeners is allowed
  to read back `undefined` — and drops it on release. What a caller attached with
  `store.subscribe` stays the caller's to unbind, because nanostores exposes no
  per-store listener registry to clear. Nothing of this package's survives a
  released handle; your own subscription is yours.
- **A `subscribe` on the atom fires once on attach** with the value the handle
  was created with. That is nanostores' documented `subscribe` behaviour, not
  an extra publish, and it is why a subscriber sees the initial snapshot as its
  first call.
- **The snapshot is held by reference, not deep-copied.** `set()` stores
  exactly what the controller published, and `get()` returns that same object.
  A snapshot is rebuilt from scratch on every change, so a holder never sees it
  mutate underneath — but the entry `key` arrays and `data` values inside it are
  the caller's own objects, and a caller that mutates them mutates the snapshot.
- **The atom is written one value at a time.** Re-publishing the _same_ snapshot
  object is a no-op for subscribers, because nanostores compares with
  `Object.is` before notifying. The controller builds a fresh snapshot on every
  change, so this never hides a real transition.
- **The plugin's own adapter path is not the differentiator.** The registered
  `$store.query` is identical with and without `adapter` — it is a command
  surface over the controller either way.
- **Three names, one function.** `createQueryPlugin`, the default export
  (`queryAdapterNanostores`) and `nanostoresQueryPlugin` are the same code, and
  they do not even have the same parameter type: `nanostoresQueryPlugin` omits
  `adapter` and `defaultOptions` from its options type, so passing either is a
  compile error while passing it to either of the other two is not.
- **`DEFAULT_QUERY_STORE_KEY` collides by name with `query`'s own constant.**
  Both are `"query"`, both are exported, and importing both into one module
  needs an alias. They are not the same binding, so nothing keeps them in step.
- **`src/types.ts` is not on the barrel.** `AdapterOptions` and
  `DEFAULT_ADAPTER_NANOSTORES_STORE_KEY` are unreachable from the package entry
  point and nothing in `src/` imports that file. The value is the same as
  `DEFAULT_QUERY_STORE_KEY`.
- **No test covers the plugin.** `test/adapter.test.ts` exercises the adapter
  only; `createQueryPlugin` and its two aliases are untested.
- **The budget is met with room to spare** — `439 B` gzip against a `500 B`
  entry — so the size gate is not a constraint on this package.

## Size

`0.84 kB raw / 439 B gzip / 0.39 kB brotli` · budget `500 B` (gzip, from `.size-limit.json`) · externalized peers: `alpinejs`, `@ailura/alpinejs-core`, `@ailura/alpinejs-query`, `nanostores`.

## Architecture

[Data layer](../../ARCHITECTURE.md) — an adapter package, not a feature. It has
no controller of its own and no state of its own: `adapter.ts` implements
`query`'s `QueryStateAdapter` contract against a nanostores `atom`, and
`plugin.ts` constructs `query`'s `QueryController` and registers its store. See
canon, guards and SSR rules in [ARCHITECTURE.md](../../ARCHITECTURE.md).

## Testing

```sh
pnpm exec vp test packages/query-adapter-nanostores
pnpm exec tsc --noEmit -p packages/query-adapter-nanostores/tsconfig.json
```

`test/adapter.test.ts` observes the adapter from the outside only — what `get()`
returns, what `set()` changes, what `destroy()` releases, that one adapter
serves many independent handles, and that it works with no Alpine instance
present. It also covers the injected path: a caller's creator, the atom it
keeps, and `store.subscribe` seeing every published snapshot, with the release
guarantees, the listener detach and handle independence holding there too. The
plugin has no tests; see [Limitations](#limitations). See
[ARCHITECTURE.md §8](../../ARCHITECTURE.md).

## License

MIT
