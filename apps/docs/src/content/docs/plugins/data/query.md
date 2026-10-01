---
title: Query
---

@ailura/alpinejs-query

A query cache in the shape of TanStack Query: fetch, observe, invalidate, and mutate,
with `staleTime`, retries, and a state object per key. The plugin owns the
cache; you call it from a component.

## Install

```sh
pnpm add alpinejs @ailura/alpinejs-core @ailura/alpinejs-query
```

## Register the plugin

Do this once, before `Alpine.start()`.

```ts
import Alpine from "alpinejs";
import queryPlugin from "@ailura/alpinejs-query";

Alpine.plugin(queryPlugin());

Alpine.start();
```

That registers a `query` store and a `query` magic, so everything below is reachable at
`$store.query` or `$query`.

## Minimal example

Load a list once and render its state.

```html
<div
  x-data="{
    users: null,
    error: null,
    async load() {
      const key = ['users'];
      await $store.query.prefetch(key, () => fetch('/api/users').then((r) => r.json()));
      const state = $store.query.get(key);
      this.users = state?.data ?? null;
      this.error = state?.error?.message ?? null;
    },
  }"
  x-init="load()"
>
  <p x-show="!users && !error">Loading…</p>
  <p x-show="error" x-text="error" role="alert"></p>

  <ul>
    <template x-for="user in users ?? []" :key="user.id">
      <li x-text="user.name"></li>
    </template>
  </ul>

  <button @click="load()">Load</button>
</div>
```

A key is an array, and it is compared by value: `['users']` and `['users']` are the
same cache entry, however the array is built. The method that reads state back is
`get()`, not `getQueryData()`. It returns the state object, or `undefined` for a key that
has never been requested.

**The flags live on that state object, not on the store.** The store has no
`isPending(key)` method; the equivalent is `get(key)?.isPending`. The state carries
`data`, `error`, `status`, `fetchStatus`, `dataUpdatedAt`, `errorUpdatedAt`,
`isPending`, `isLoading`, `isFetching`, `isError`, `isSuccess`, `isStale`, and
`refetch()`.

`get()` returning `undefined` is load-bearing: a template that reads `get(key).data`
throws on the first render, before any request has been made.

:::caution[Entries are plain objects, not reactive proxies]
The store is a command surface: it holds no data, only methods, and the observable
per-query state (`status`, `data`, `isPending`, …) lives on the entry `get()` and
`observe()` return. That entry is a plain object of getters, not a reactive proxy, so a
template reading `$store.query.get(['users'])?.status` registers no reactive dependency
and will not re-render on its own when the entry changes. If the view has to update,
keep what you render in component state — copy the fields you need from the entry, as
the example above does — and read from there. The plugin does not wrap entries in
`alpine.reactive`, and nothing here changes that.
:::

## Invalidate versus refetch

Three calls look like "reload", and none of them behave the same.

`refetch()` on a state object always runs the fetcher again, even when the entry is
still fresh:

```js
$store.query.get(["users"])?.refetch();
```

`invalidate(key?)` re-runs the fetcher in the background for one key, a list of keys,
or — with no argument — every entry. It returns nothing and is not awaitable, so a
component that renders from its own state has to do its read-back afterwards, the way
the example above does.

`fetch(key, fn, options?)` is the one that only kicks off a request when the entry has
no data yet: call it again on an entry that already succeeded and you get the state
back without a second request. Use it for the first load; use `refetch()` or
`invalidate()` for a manual refresh.

## Mutations

`mutate()` takes a single options object and returns a handle, not a promise, so the
state is readable while the mutation runs.

```js
const mutation = $store.query.mutate({
  mutationFn: (variables) =>
    fetch("/api/users", {
      method: "POST",
      body: JSON.stringify(variables),
    }).then((r) => r.json()),
  onError: (error) => console.error(error),
});

try {
  await mutation.mutate({ name: "Ada" });
  $store.query.invalidate(["users"]);
} finally {
  mutation.reset();
}
```

The options are `mutationFn` (required, `(variables) => Promise<data>`), plus the
optional `onMutate(variables)`, `onSuccess(data, variables, context)`,
`onError(error, variables, context)` and
`onSettled(data, error, variables, context)`. The handle carries `data`, `error`,
`status` (`idle` / `pending` / `error` / `success`), the flags `isIdle`, `isPending`,
`isError` and `isSuccess`, and two methods: `mutate(variables)` and `reset()`. There is
no mutation key — one `mutate()` call is one mutation.

Invalidating after the write is what keeps the list honest. Without it the mutation
succeeds and the list still shows the old data.

## Tuning the cache

`defaultOptions` applies to every query, which is where `staleTime` and `retry` belong
once you know your data's shape.

```ts
queryPlugin({
  defaultOptions: {
    queries: { staleTime: 30_000, retry: 3 },
  },
});
```

## API reference

| Name                                       | Type   | Purpose                                                                          |
| ------------------------------------------ | ------ | -------------------------------------------------------------------------------- |
| `$store.query.fetch(key, fn, options?)`    | method | Start the request if the entry has no data yet; return the state.                |
| `$store.query.observe(key, fn, options?)`  | method | Same, plus a live view carrying the state.                                       |
| `$store.query.prefetch(key, fn, options?)` | method | Always run the fetcher and await it.                                             |
| `$store.query.get(key)`                    | method | Read the state object: `data`, `status`, `error`, and the flags, or `undefined`. |
| `$store.query.setData(key, data)`          | method | Write into the cache by hand; `data` may be a function of the current value.     |
| `$store.query.invalidate(key?)`            | method | Refetch one key, a list of keys, or everything. Not awaitable.                   |
| `$store.query.remove(key?)`                | method | Drop one entry, a list of entries, or all of them.                               |
| `$store.query.reset()`                     | method | Clear the whole cache. Takes no argument.                                        |
| `$store.query.resetQueries(key?)`          | method | Drop one entry, a list of entries, or all of them.                               |
| `$store.query.mutate(options)`             | method | Run a mutation; returns a state handle.                                          |
| `$store.query.cancel(key)`                 | method | Abort the in-flight request for one key.                                         |
| `$store.query.clearMutations()`            | method | Present for parity; there is nothing to clear.                                   |
| `$store.query.devtools`                    | store  | `getSnapshot()` and `subscribe(cb)`; see [Devtools API](#devtools-api).          |
| `$store.query.destroy()`                   | method | Abort everything in flight and tear the cache down.                              |

`observe()`, `fetch()` and `prefetch()` also take a single definition object —
`{ queryKey, queryFn, ...options }` — instead of the positional form.

:::caution[Keys are compared by JSON value, not by reference]
Every key is stringified with `JSON.stringify`, so a fresh `['users', { page: 1 }]` with
the same content is the same cache entry — build it inline if you like. What does _not_
survive the round trip is anything `JSON.stringify` cannot represent stably: a `Date`, a
`Map`, a function or a cyclic object produce a different string on every call, so each
one is a distinct entry and the request never stops. Keep keys to plain JSON values.
:::

## Events

The controller emits `change(key)`, `success(key, data)` and `error(key, error)`. They
are controller events, not DOM events: nothing is dispatched on `window`, so subscribe
through a controller you built yourself.

## Plugin options

```ts
queryPlugin({ storeKey: "cache", magicKey: "cacheQuery" });
```

| Option     | Type     | Default | Purpose                                                           |
| ---------- | -------- | ------- | ----------------------------------------------------------------- |
| `storeKey` | `string` | `query` | Name of the store registration, reachable at `$store.<storeKey>`. |
| `magicKey` | `string` | `query` | Name of the magic registration, reachable as `$<magicKey>`.       |

`magicKey` wins over `storeKey`. If you pass only `storeKey`, the magic follows it, so
one option moves the whole plugin out of a collided name:

```ts
queryPlugin({ storeKey: "cache" }); // $store.cache and $cache
```

Both names go through the registration guards, so a name another package already owns
throws instead of being silently overwritten.

## Devtools API

`$store.query.devtools` is a real contract, and it is the half of the devtools story that
ships in the main entry point:

```ts
const snapshot = $store.query.devtools.getSnapshot();
// { phase, entries, mutations } — plain values, not getters

const stop = $store.query.devtools.subscribe((next) => {
  console.log(next.entries.length, "entries");
});

stop();
```

`getSnapshot()` is a plain read; `subscribe(cb)` calls back on every meaningful change — an
entry entering or leaving the cache, a fetch settling, a `setData()`, a mutation settling —
and `stop()` is idempotent. It is read-only: it is a window onto the cache, not a handle on
it.

### The panel

`@ailura/alpinejs-query/devtools` is the styled inspector for that contract, and it **ships**
from its own subpath — a production bundle that never imports it carries none of it.

```js
import { queryDevtoolsPlugin } from "@ailura/alpinejs-query/devtools";

Alpine.plugin(queryPlugin());
Alpine.plugin(queryDevtoolsPlugin({ position: "bottom", theme: "system" }));
```

`queryDevtoolsPlugin` defers to `alpine:initialized`, because `$store.query` does not exist
until Alpine boots, and it returns a cleanup that removes that listener again. Or mount it
directly against a controller, with no Alpine involved at all:

```js
import { mountQueryDevtools } from "@ailura/alpinejs-query/devtools";

const panel = mountQueryDevtools({ store: controller.toStore(), initialOpen: true });
// panel.open() / close() / toggle() / setToggleCorner() / getToggleCorner() / destroy()
```

What you get: a corner toggle and a `bottom` or `right` panel; a Queries and a Mutations list
with search, sort and a per-source scope filter; a detail pane with a Tree / JSON / Edit value
viewer; light and dark themes that follow the host `data-theme`, `.dark` or the OS colour
scheme; and preferences persisted in `localStorage`.

**The panel is a reader.** It renders `phase`, `entries` and `mutations` exactly as the
contract defines them, and every mutating affordance it offers — Refetch, Invalidate, Reset,
Remove, Reset cache, Clear mutations, Edit-and-apply — is probed on the source you mount it
with. A source that exposes only `devtools` gets no action buttons and a disabled **Edit**
tab with the reason printed underneath it. A full `QueryStore` exposes `setData()`, and that
is what turns the editor on: `QueryDevtoolsApi` itself is read-only and is never widened to
carry it.

The subpath is DOM-only by design and is guarded the toolkit way, so the whole panel is inert
under SSR rather than throwing: it reaches the DOM through `safeDocument()` / `safeWindow()` /
`isBrowser()` from `@ailura/alpinejs-core/env`, and `mountQueryDevtools()` in a Node process
returns an inert controller instead of throwing.
