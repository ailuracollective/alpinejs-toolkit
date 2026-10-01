# @ailura/alpinejs-query

<p align="center">

[![bundlephobia minzip](https://badgen.net/bundlephobia/minzip/@ailura/alpinejs-query)](https://bundlephobia.com/package/@ailura/alpinejs-query)

</p>

> TanStack-Query-style cache for Alpine.js — key-addressed entries, `staleTime`,
> background retries, optimistic writes and mutations, on
> `@ailura/alpinejs-core`. Framework-agnostic `QueryController` plus a
> `$store.query` command surface, a real `devtools` snapshot API, and an optional
> state sink; the per-query state it hands back is a plain object of getters, so an application copies what it renders into its own
> reactive scope.

## Installation

```sh
pnpm add @ailura/alpinejs-query alpinejs
# or
npm install @ailura/alpinejs-query alpinejs
```

Requires `alpinejs@^3.0.0` as peer. `@ailura/alpinejs-core` is a **peer
dependency**, not a dependency: no package in this toolkit has a
`dependencies` block, so the host installs it too.

## Usage

### 1. Standalone (framework-agnostic)

```ts
import { createQueryController } from "@ailura/alpinejs-query";

type Article = { id: number; title: string };

const ctrl = createQueryController({ staleTime: 30_000 });

// `observe()` STARTS the request when the entry is pending or past staleTime,
// and hands back a live view over the cache entry. The key is the entry's
// address: build it fresh every time and keep it JSON-shaped.
const page = 1;
const articles = ctrl.observe(["articles", page], async ({ signal }) => {
  const res = await fetch(`/api/articles?page=${page}`, { signal });
  if (!res.ok) throw new Error(`articles failed: ${res.status}`);
  return (await res.json()) as Article[];
});

ctrl.on("change", (key) => console.log("cache moved:", key));
ctrl.on("success", (key, data) => console.log("resolved:", key, data));
ctrl.on("error", (key, error) => console.warn("failed:", key, error));

await articles.refetch(); // always re-runs the fetcher, fresh entry or not
articles.status; // 'pending' | 'error' | 'success'
articles.data; // Article[] | undefined
articles.isStale; // true once the entry is older than staleTime

ctrl.destroy(); // aborts in-flight requests; every later call is a silent no-op
```

The controller is safe to drive from any stack — Blade, Livewire, Astro, or plain
TypeScript. `mount()` is inherited from `BaseController` and is a no-op here:
this controller overrides no `setup()` and reads no lifecycle state except
`destroyed`, so creating it and using it are the same thing.

### 2. Alpine

```ts
import Alpine from "alpinejs";
import queryPlugin from "@ailura/alpinejs-query";

Alpine.plugin(
  queryPlugin({
    defaultOptions: { queries: { staleTime: 30_000 } },
  })
);

Alpine.data("articles", () => ({
  list: null,
  error: null,

  init() {
    void this.load();
  },

  async load() {
    this.error = null;
    // `observe()` starts the request when the entry is pending or stale. There is
    // no directive to register and no magic to reach for: `$store.query` is a set
    // of commands, and the state you render has to live somewhere you own.
    const observer = $store.query.observe(["articles"], ({ signal }) =>
      fetch("/api/articles", { signal }).then((res) => {
        if (!res.ok) throw new Error(`articles failed: ${res.status}`);
        return res.json();
      })
    );
    // The view is a plain object of getters, not a reactive proxy, so await the
    // request and copy the fields you render into the component.
    await observer.refetch();
    this.list = observer.data;
    this.error = observer.error?.message ?? null;
  },
}));

Alpine.start();
```

```html
<div x-data="articles">
  <p x-show="error" x-cloak x-text="error" role="alert"></p>

  <template x-for="article in list ?? []" :key="article.id">
    <p x-text="article.title"></p>
  </template>

  <button @click="load()">Reload</button>
</div>
```

`refetch()` is the line worth noticing: `load()` deliberately re-runs the
fetcher rather than calling `observe()` again, because `observe()` on a stale
entry refetches anyway and on a fresh one does not — a "Reload" button bound to
it would do nothing half the time.

The plugin registers `$store.query` and the `$query` magic. The magic is the same
store object under the `$` name, so `$query.get(["articles"])` and
`$store.query.get(["articles"])` are the same call — pick whichever reads better
where the code sits.

## API

| Export                     | Description                                                                                       | Type       |
| -------------------------- | ------------------------------------------------------------------------------------------------- | ---------- |
| `QueryController`          | The cache. `new QueryController(id?, defaultOptions?)` — owns the entries, emits `change`         | `class`    |
| `createQueryController`    | `createQueryController(options?) => QueryController`. Takes a `QueryOptions` bag plus an `id`     | `function` |
| `queryPlugin`              | `Alpine.plugin()` factory — registers `$store.query` and `$query` through the guards              | `function` |
| `default`                  | Alias of `queryPlugin`                                                                            | `function` |
| `DEFAULT_QUERY_STORE_KEY`  | `"query"` — the default `$store` key                                                              | `string`   |
| `DEFAULT_QUERY_MAGIC_KEY`  | `"query"` — the default `$` key; follows `storeKey` unless set explicitly                         | `string`   |
| `QueryKey`                 | `readonly unknown[]`, serialised with `JSON.stringify` to address an entry                        | `type`     |
| `QueryFunction<TData>`     | `(context: { signal: AbortSignal }) => Promise<TData>` — the fetcher, handed an abort signal      | `type`     |
| `QueryFunctionContext`     | `{ signal: AbortSignal }`                                                                         | `type`     |
| `QueryOptions`             | `{ enabled?, staleTime?, retry?, initialData? }`                                                  | `type`     |
| `QueryState<TData>`        | What `fetch()` / `get()` return: the six fields, six derived flags and `refetch()`                | `type`     |
| `QueryObserver<TData>`     | `QueryState` plus `state` — a self-reference, the shape `observe()` returns                       | `type`     |
| `QueryStatus`              | `'pending' \| 'error' \| 'success'`                                                               | `type`     |
| `FetchStatus`              | `'fetching' \| 'paused' \| 'idle'` — `'paused'` is declared but never assigned                    | `type`     |
| `MutationOptions`          | `{ mutationFn, onMutate?, onSuccess?, onError?, onSettled? }`                                     | `type`     |
| `MutationState`            | What `mutate()` returns: `data`, `error`, `status`, four flags, `mutate()`, `reset()`             | `type`     |
| `MutationStatus`           | `'idle' \| 'pending' \| 'error' \| 'success'`                                                     | `type`     |
| `QueryDefinition`          | `{ queryKey, queryFn } & QueryOptions` — the object form `observe`/`fetch`/`prefetch` also accept | `type`     |
| `InferQueryData<TQueryFn>` | `Awaited<ReturnType<TQueryFn>>`, widened to `unknown` when the fetcher returns `any`              | `type`     |
| `QueryData<T>`             | The same widening, applied to a bare `T` — the return type of `mutate()`                          | `type`     |
| `QueryPluginOptions`       | `{ defaultOptions?, storeKey?, magicKey? }`                                                       | `type`     |
| `QueryClientOptions`       | `QueryPluginOptions & { adapter?: QueryStateAdapter }`                                            | `type`     |
| `QueryControllerOptions`   | `QueryOptions & { id?, adapter? }` — the `createQueryController()` bag                            | `type`     |
| `QueryStore`               | The `$store.query` surface — every command plus a `devtools` getter                               | `type`     |
| `QueryEvents`              | `{ change: [key?], success: [key, data], error: [key, error] }`                                   | `type`     |
| `QueryStateAdapter`        | `{ create(initial) → { get, set, destroy } }` — the state backend `options.adapter` takes         | `type`     |
| `QueryStateHandle<TState>` | One slot from `create()`; `destroy` is final and idempotent                                       | `type`     |
| `QueryDevtoolsApi`         | `{ getSnapshot(), subscribe(cb) }` — what `store.devtools` exposes                                | `type`     |
| `QueryDevtoolsSnapshot`    | `{ phase, entries, mutations }` — a plain, serialisable read of the cache                         | `type`     |
| `QueryDevtoolsEntry`       | One cache entry in a snapshot: key, `keyHash`, status, data, error, timestamps, `staleTime`       | `type`     |
| `QueryDevtoolsMutation`    | One mutation in a snapshot: `id`, `status`, `data`, error                                         | `type`     |
| `QueryDevtoolsError`       | An `Error` flattened to `{ name, message }`                                                       | `type`     |

### Controller API

`QueryController` methods are also the store's methods, one for one — `toStore()`
is a thin command facade over the same instance.

| Method                             | Returns  | What it does                                                                                              |
| ---------------------------------- | -------- | --------------------------------------------------------------------------------------------------------- |
| `observe(key, queryFn, options?)`  | observer | Active read. Creates the entry, fetches when it is pending or stale, returns the live view                |
| `fetch(key, queryFn, options?)`    | state    | Same, but only fetches a **pending** entry — a stale-but-populated entry is returned as-is                |
| `get(key)`                         | state?   | Passive read. `undefined` for a key the cache has never seen; never starts a request                      |
| `prefetch(key, queryFn, options?)` | `void`   | Awaits a fetch and populates the cache. Ignores `staleTime` — it always runs                              |
| `invalidate(key?)`                 | `void`   | Background refetch, returns immediately. No argument refetches every cached entry                         |
| `remove(key?)`                     | `void`   | Drops entries. No argument empties the cache                                                              |
| `setData(key, data \| updater)`    | `void`   | Optimistic write. Marks the entry `success` and refreshes `dataUpdatedAt`. **No-op for an uncached key**  |
| `cancel(key)`                      | `void`   | Aborts the entry's in-flight request; the resolved value is discarded                                     |
| `reset()`                          | `void`   | Empties the cache. Identical to `remove()`                                                                |
| `resetQueries(key?)`               | `void`   | Alias of `remove()`, under the TanStack name                                                              |
| `clearMutations()`                 | `void`   | An empty method — the devtools mutation registry is never emptied by it. See [Limitations](#limitations)  |
| `mutate(options)`                  | mutation | Returns a fresh `MutationState`; nothing is written to the cache unless you call `setData()` yourself     |
| `snapshot()`                       | `Map`    | Copy of the entry table, keyed by serialised query key. Diagnostic only — the values are the live entries |
| `toStore()`                        | store    | A fresh `$store.query` facade over the same controller                                                    |
| `id`                               | `string` | `generateId("query")` when the id was not given                                                           |
| `destroy()`                        | `void`   | Aborts every in-flight request, empties the cache, freezes the instance. Idempotent                       |

### Store API

`$store.query` is a **command surface, not a data surface**. It holds no query
data of its own: it carries a `devtools` getter and the methods above. The
observable per-query state — `data`, `status`, `fetchStatus`, `dataUpdatedAt`,
`errorUpdatedAt`, `isPending`, `isLoading`, `isFetching`, `isError`, `isSuccess`,
`isStale` — lives on the entry returned by `observe()`, `fetch()` or `get()`.

```js
// Read
$store.query.get(["articles", 1])?.data;
$store.query.observe(["articles", 1], fetcher, { staleTime: 30_000 });

// Write and evict
$store.query.setData(["articles", 1], (current) => [...(current ?? []), created]);
$store.query.invalidate(["articles", 1]);
$store.query.cancel(["articles", 1]);
$store.query.remove(["articles", 1]);

// Mutations
const mutation = $store.query.mutate({
  mutationFn: (variables) => api.createArticle(variables), // variables: { title }
  onSuccess: (created) => $store.query.setData(["articles"], (list) => [...(list ?? []), created]),
});
await mutation.mutate({ title: "Added from a mutation" });
```

`observe`, `fetch` and `prefetch` also take a definition object, for when the
key and its fetcher travel together:

```js
$store.query.observe({ queryKey: ["articles", 1], queryFn: fetcher, staleTime: 30_000 });
```

`invalidate`, `remove` and `resetQueries` take one key or an array of keys —
`invalidate([["articles", 1], ["articles", 2]])` — and no argument at all means
every entry.

**The entry is not reactive.** It is a plain object of getters reading a
controller field, so a template that renders
`$store.query.get(["articles"])?.data` registers no dependency and will not
re-render when that entry changes. Keep what you render in your own state —
await the call and assign — exactly as the example in
[Usage](#2-alpine) does. Nothing in this package makes the entry reactive.

### Devtools API

`$store.query.devtools` is a real contract: it is how a panel, a time-travel
tool or a `console.log` loop reads the cache without reaching into the
controller.

```js
// A plain, serialisable read of the whole cache.
const snapshot = $store.query.devtools.getSnapshot();
// { phase: 'idle', entries: [ ... ], mutations: [ ... ] }

JSON.stringify(snapshot); // works — Errors are flattened, nothing is a class instance

// Be told about every meaningful change. The returned function unsubscribes.
const stop = $store.query.devtools.subscribe((next) => console.log(next.entries.length));
stop();
```

`getSnapshot()` builds a fresh value every call, so a snapshot you hold never
changes underneath you and one you poke at cannot reach the cache. Each entry
carries its `key`, its serialised `keyHash`, `status`, `fetchStatus`, `data`, a
flattened `error` (`{ name, message }` — `JSON.stringify(new Error())` is `{}`),
`dataUpdatedAt`, `errorUpdatedAt`, the effective `staleTime`, `isStale` recomputed
at snapshot time, and `enabled`.

`subscribe(callback)` fires on every meaningful change: a query starting or
settling, an entry entering or leaving the cache, `setData()`, a mutation
settling. Subscribers are independent, unsubscribing is idempotent, and after
`destroy()` no callback runs again — the controller drops the set rather than
leaving callbacks wired to a dead cache.

### Devtools panel

`@ailura/alpinejs-query/devtools` is a styled inspector panel for that contract.
It ships from its own subpath so a production bundle that never imports it
carries none of it.

```js
import { queryDevtoolsPlugin } from "@ailura/alpinejs-query/devtools";

Alpine.plugin(queryPlugin());
Alpine.plugin(queryDevtoolsPlugin({ position: "bottom", theme: "system" }));
```

Or mount it directly against a controller, with no Alpine involved:

```js
import { mountQueryDevtools } from "@ailura/alpinejs-query/devtools";

const panel = mountQueryDevtools({ store: controller.toStore(), initialOpen: true });
// panel.open() / close() / toggle() / setToggleCorner() / getToggleCorner() / destroy()
```

What it does: a corner toggle and a `bottom` or `right` panel; a Queries and a
Mutations list with search, four sort orders and a per-source scope filter; a
detail pane with a Tree / JSON / Edit value viewer; light and dark themes that
follow the host `data-theme`, `.dark` or the OS colour scheme; drag-to-resize
on small screens; a layout that collapses to a single pane on a narrow viewport;
and preferences persisted in `localStorage`.

**The panel is a reader.** It renders `phase`, `entries` and `mutations` exactly
as the contract defines them, and every mutating affordance it offers —
Refetch, Invalidate, Reset, Remove, Reset cache, Clear mutations, Edit-and-apply
— is probed on the source you mount it with. A source that exposes only
`devtools` gets no action buttons and a disabled **Edit** tab with the reason
printed underneath it, rather than buttons that quietly do nothing. A full
`QueryStore` exposes `setData()`, and that is what turns the editor on.

| Option                   | Default                                 | Description                                |
| ------------------------ | --------------------------------------- | ------------------------------------------ |
| `store` / `stores`       | —                                       | The source(s) to inspect. Required.        |
| `additionalStores`       | —                                       | Extra sources merged into the same list.   |
| `storeName`              | `"query"`                               | Label for the primary source.              |
| `position`               | `"bottom"`                              | Panel dock: `"bottom"` or `"right"`.       |
| `toggleCorner`           | `"bottom-right"`                        | Corner the toggle sits in.                 |
| `persistToggleCorner`    | `true`                                  | Persist the corner in `localStorage`.      |
| `toggleCornerStorageKey` | `"alpine-query-devtools:toggle-corner"` | Storage key for the corner.                |
| `persistPreferences`     | `true`                                  | Persist filters, sort, tab and open state. |
| `preferencesStorageKey`  | `"alpine-query-devtools:preferences"`   | Storage key for preferences.               |
| `followLatest`           | `false`                                 | Start following the newest entry.          |
| `rememberOpenState`      | `false`                                 | Restore open/closed after reload.          |
| `initialOpen`            | `false`                                 | Start open.                                |
| `filter`                 | `""`                                    | Initial search text.                       |
| `theme`                  | `"system"`                              | `"light"`, `"dark"` or `"system"`.         |
| `zIndex`                 | `60`                                    | Panel and toggle z-index.                  |

### State adapter

An optional backend can receive the published state:

```ts
import { createAlpineStoreAdapter } from "@ailura/alpinejs-query-adapter-alpine";

Alpine.plugin(queryPlugin({ adapter: createAlpineStoreAdapter(Alpine) }));
```

```ts
type QueryStateAdapter = {
  create: (initial: unknown) => {
    get: () => unknown;
    set: (value: unknown) => void;
    destroy: () => void;
  };
};
```

That is the shape `createAlpineStoreAdapter()` already implements, and the
`initial` it is given is the controller's first snapshot. The slot is a **sink,
not a source**: the controller keeps its entries and publishes a
`QueryDevtoolsSnapshot` into the slot on each change, so `get(key)` is identical
with or without an adapter, and a backend that is slow, dropped or already
released cannot change what a caller reads. Omitting `adapter` changes nothing.

`destroy()` is final and idempotent, like every other `destroy` in the toolkit:
the slot is released exactly once, and no publish path is left open to put
state back into it.

### Options

Per query, on `observe()` / `fetch()` / `prefetch()`:

```ts
type QueryOptions<TData = unknown> = {
  enabled?: boolean; //        default: undefined, which means enabled. Only `false` disables.
  staleTime?: number; //       default: 0 — any entry older than 0 ms is stale
  retry?: number | boolean; // default: undefined — no retry. `true` means 3 extra attempts.
  initialData?: TData; //      default: none — a fresh entry starts `pending` with no data
};
```

| Option        | Default     | Effect                                                                                                                                                                                                         |
| ------------- | ----------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `enabled`     | `undefined` | `false` makes every fetch path a no-op for that entry — `observe()`, `fetch()`, `prefetch()` and `invalidate()` all skip it. The entry still exists                                                            |
| `staleTime`   | `0`         | Milliseconds an entry stays fresh. `isStale` is `Date.now() - dataUpdatedAt > staleTime`. With the default, everything is stale as soon as a ms passes                                                         |
| `retry`       | `undefined` | Attempt budget after the first failure. A number is that many extra attempts; `true` is 3. Each retry waits a flat 1 s — there is no backoff                                                                   |
| `initialData` | —           | Seeds `data` and starts the entry `success` with `dataUpdatedAt = now`, so it reads as fresh. The fetcher still runs as soon as the seeded entry goes stale, which with the default `staleTime` is immediately |

Controller-wide, on `createQueryController()` or `queryPlugin()`:

```ts
type QueryControllerOptions = {
  id?: string; // default: generateId("query")
  enabled?: boolean;
  staleTime?: number;
  retry?: number | boolean;
  initialData?: unknown;
};

type QueryPluginOptions = {
  defaultOptions?: {
    queries?: Partial<QueryOptions>; // merged UNDER the per-call options
    mutations?: { retry?: number | boolean }; // accepted, never read
  };
  storeKey?: string; //  default: "query"
  magicKey?: string; //  default: "query", or storeKey when only that is given
};

type QueryClientOptions = QueryPluginOptions & {
  adapter?: QueryStateAdapter; // state backend, see "State adapter"
};
```

Per-call options win over `defaultOptions.queries`, and **both are read once**,
when the entry is created — see
[Limitations](#limitations).

### Avoiding name collisions

If your application, or another toolkit plugin, already owns `$store.query`,
rename the integration surface without touching the controller:

```ts
Alpine.plugin(queryPlugin({ storeKey: "cache", magicKey: "$cacheQuery" }));
// → $store.cache, $cacheQuery
```

```ts
import { DEFAULT_QUERY_STORE_KEY } from "@ailura/alpinejs-query"; // "query"
```

Passing only `storeKey` renames the magic too, because the magic falls back to
the store key. Both names go through the registration guards, so a name another
package already owns throws a `RegistrationError` instead of being silently
overwritten.

### Events

```ts
import type { QueryEvents } from "@ailura/alpinejs-query";

const off = ctrl.on("change", (key) => {});
ctrl.on("success", (key, data) => {});
ctrl.on("error", (key, error) => {});
```

| Event     | Payload                    | Emitted when                                                         |
| --------- | -------------------------- | -------------------------------------------------------------------- |
| `change`  | `key?: readonly unknown[]` | A fetch starts, and again when it settles. Also fires on `setData()` |
| `success` | `key`, `data`              | A fetch resolved. Not emitted when the request was aborted           |
| `error`   | `key`, `error`             | A fetch rejected. Not emitted when the request was aborted           |

`on()` returns the unsubscribe function. `remove()`, `reset()` and
`resetQueries()` emit nothing: a `change` listener is a "something is fetching or
just finished" signal, not a cache-inventory one.

## Retry, staleTime and what "fetch" means

Three commands overlap, and the difference is the whole ergonomics of the
package:

```ts
// Starts a request only if the entry is pending or stale. Calling it again on a
// fresh entry costs nothing; calling it on a stale one refetches — so a
// component that calls observe() in a render path re-requests a stale entry on
// every render.
const view = ctrl.observe(key, fetcher, { staleTime: 30_000 });

// Always re-runs the fetcher, whatever `staleTime` says. This is the button
// behind a "Refresh" affordance.
await view.refetch();

// Fetches in the background and returns at once. Use it when several components
// share a key and one of them should pay for the refresh.
ctrl.invalidate(key);
```

`invalidate()` never resolves the request, so a component that wants the new
data has to await something itself — `await view.refetch()`, or a poll on
`view.isPending` / `view.isFetching`.

Mutations are **not** wired to the cache. `mutate()` returns a fresh state
object and the cache is untouched, so writing the result back is the caller's
step — and rolling it back is `invalidate()`:

```ts
const mutation = ctrl.mutate<Article, { title: string }>({
  mutationFn: ({ title }) => api.createArticle({ title }),
  onSuccess: (created) => {
    ctrl.setData(["articles"], (list) => [...(list ?? []), created]);
  },
  onError: () => {
    ctrl.invalidate(["articles"]); // drop the optimistic row
  },
});

await mutation.mutate({ title: "Added from a mutation" });
```

`onMutate` is awaited before `mutationFn` runs and its return value is the
`context` the other three callbacks receive. A throw inside `onMutate` is
swallowed and the mutation runs anyway with `context === undefined`.

## SSR

> SSR-safe — no `window`/`document` at import time, and no call in this package
> touches either. The cache is in-memory and per-controller, so a request that
> fetches on the server shares nothing with the next one. Nothing here reads
> `safeWindow`/`safeDocument`: there is no DOM access to guard.

The `devtools` subpath is DOM-only by definition and is guarded the toolkit way:
every global it needs — `document`, `window`, `localStorage`,
`requestAnimationFrame`, `matchMedia`, `ResizeObserver`, `MutationObserver` —
is resolved through `@ailura/alpinejs-core/env`, and nothing is read at import
time. `mountQueryDevtools()` and `queryDevtoolsPlugin()` therefore return an
inert controller and a no-op cleanup on a server instead of throwing, and
`destroy()` is safe to call there.

## Integration

- **`@ailura/alpinejs-query-adapter-alpine`** — registers the same
  `$store.query` surface from a different plugin. Use one or the other, not both
  (see [Limitations](#limitations)).
- **`@ailura/alpinejs-json-api`** — a typed fetcher for a `queryFn`:
  `ctrl.observe(["articles"], () => jsonApi.findAll("articles").then((d) => d.data))`.
  The `AbortSignal` the fetcher receives is worth passing down if your transport
  can honour it.
- **Your own reactive layer** — the entry is a getter bag, so the integration
  with Alpine, Vue signals or a Svelte store is the same shape: read the fields
  you need after an `await`, write them into the state you render from.

## Limitations

- **Options are read once per entry.** `ensureEntry()` merges
  `defaultOptions.queries` and the per-call options when the entry is first
  created. A later `observe()` for the same key gets the existing entry, so its
  `staleTime`, `retry`, `enabled` and `initialData` are **silently dropped**. Call
  `remove(key)` to pick up new options.
- **Query keys are compared by `JSON.stringify`, and the serialisation is
  cached by array identity in a module-level `WeakMap` shared by every controller
  in the process.** Mutating a key array in place after its first use keeps
  resolving to the old entry, and a key containing a `Map`, a function or a cycle
  never matches an equivalent hand-written key. Build keys fresh, or as a `const`
  tuple, and keep them JSON-shaped.
- **`QueryState.data` is writable in the type but not in the cache.** The setter
  the object literal carries is a no-op; assigning to `entry.data` does nothing
  and reports nothing. `setData()` is the write path.
- **`clearMutations()` is an empty method** and `resetQueries()` is a literal
  alias of `remove()`. A mutation registry does exist — every `mutate()` call
  records one, and `getSnapshot()` surfaces it as `mutations[]` — but
  `clearMutations()` never touches it. The records are only released by
  `destroy()`, so a long-lived controller accumulates every mutation it has ever
  run, and each one is copied into every devtools snapshot.
- **`devtools` sees the cache, it does not own it.** `getSnapshot()` returns a
  plain, serialisable copy — no class instances, no functions, no DOM — so a
  panel can stringify, diff or ship it. It is a read, not a handle: there is no
  `setSnapshot()`, and `snapshot.entries[0].data` is still the caller's own
  value, by reference.
- **`subscribe()` fires on cache movement, not on store writes.** A query
  starting or settling, an entry entering or leaving the cache, `setData()` and a
  mutation settling each produce one notification. It says nothing about anything
  that did not move.
- **`options.adapter` is a sink, not a source.** The controller keeps every
  entry in itself and publishes a `QueryDevtoolsSnapshot` into the adapter's slot
  on each change; the cache never reads back from it. So a slow, broken or
  dropped backend cannot change what `get(key)` returns — but it also cannot
  make the per-query entry reactive. `defaultOptions.mutations` is still
  accepted and never read.
- **Retry is a flat 1 s, and `retry: n` is not "n attempts".** It is `n` extra
  attempts after the first failure — `retry: 2` issues three requests in total.
  There is no exponential backoff, no `retryDelay`, and no jitter, so every
  failing query in the app retries on the same 1 s grid.
- **Cancellation is per entry and partial.** `cancel(key)` aborts the current
  request; the entry keeps its previous `data` and its previous `status`, and the
  discarded result emits nothing. `destroy()` aborts everything.
- **No `focusManager`, no garbage collection, no `queryKey` hashing** — an entry
  lives until something removes it. There is no cache ceiling, so an app that
  keys by a route param it never repeats grows without bound.
- **`FetchStatus` declares `'paused'`, which nothing ever assigns.** Offline
  pausing, which is what that state is for, is not implemented.
- **The declared budget is met with room to spare** — `1.86 kB gzip` against a
  `10 kB` entry — so the size gate is not a constraint on this package.
- **The devtools panel cannot write, by contract.** `QueryDevtoolsApi` is
  `getSnapshot()` and `subscribe()`, and that is all. Its `Edit` mode is enabled
  only when the mounted source also exposes `setData()` (a full `QueryStore`
  does); a bare `{ devtools }` source gets a read-only viewer with the reason
  stated in the panel.
- **The panel cannot show what the snapshot does not carry.** No observer count,
  no invalidation flag, no fetch duration and no mutation variables or
  timestamps exist on `QueryDevtoolsEntry` / `QueryDevtoolsMutation`, so the
  panel does not display them. The live fetch timer is the panel's own
  observation — "fetching for as long as this panel has seen it fetching" — and
  mutations are ordered by their monotonic `id`, not by recency.
- **A mutation record is never cleared.** `clearMutations()` is still an empty
  method on the controller, so the panel's "Clear mutations" button calls it and
  the list does not change.

## Size

`6.68 kB raw / 2.29 kB gzip` · budget `10 kB` · externalized peers: `alpinejs`, `@ailura/alpinejs-core` · `size-limit` + `publint` + `attw` verified.

The `devtools` subpath is budgeted separately and is not small:
`47.98 kB raw / 12.81 kB gzip / 11.31 kB brotli` against a `14 kB` entry. It is
CSS-in-JS, so most of that is the stylesheet, and it is dev-only by design —
import it behind `import.meta.env.DEV` and production never sees it.

## Architecture

[Data layer](../../ARCHITECTURE.md) — controllers own state, Alpine owns
reactivity. `QueryController extends BaseController`, so it inherits the
`idle → mounted → destroyed` lifecycle and the LIFO teardown stack; after
`destroy()` every mutating method returns early instead of throwing. See canon,
guards, and SSR rules in [ARCHITECTURE.md](../../ARCHITECTURE.md).

This package is one of the seven canon exceptions: `$store.query` is a command
surface, so `plugin.ts` has no `change` listener to register — there is no state
on the store for one to project.

## Testing

```sh
pnpm exec vp test packages/query
pnpm exec tsc --noEmit -p packages/query/tsconfig.json
```

`test/plugin.test.ts` pins the two facts the plugin depends on: the store
carries no data members, and registration leaves no dead `change` subscription
behind. `test/devtools-panel.test.ts` mounts the panel in a DOM and checks the
lifecycle, the batching and the read-only contract; `test/devtools-ssr.test.ts`
runs in the node environment, where the panel must be inert;
`test/devtools-e2e.test.ts` drives a real controller, a real adapter and an
external consumer end to end. See [ARCHITECTURE.md §8](../../ARCHITECTURE.md).

## License

MIT
