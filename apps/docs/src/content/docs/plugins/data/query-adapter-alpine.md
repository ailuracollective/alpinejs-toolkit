---
title: Query Adapter (Alpine)
---

@ailura/alpinejs-query-adapter-alpine

The alternative registration for the [Query](/plugins/data/query/) store: it registers
the same `query` store, from a fresh controller, under the same name.

It is a thin bridge, not a plugin of its own: the store surface it hands Alpine is
built by `QueryController.toStore()`, exactly the one the Query package builds.

## Install

```sh
pnpm add alpinejs @ailura/alpinejs-core @ailura/alpinejs-query @ailura/alpinejs-query-adapter-alpine
```

## Register the plugin

This replaces `queryPlugin`. Do not install both.

```ts
import Alpine from "alpinejs";
import { alpineStoreQueryPlugin } from "@ailura/alpinejs-query-adapter-alpine";

Alpine.plugin(alpineStoreQueryPlugin());

Alpine.start();
```

Everything from the Query page then works unchanged, because the store surface is the
same one. Two differences worth knowing: this registration replaces whatever is under the
`query` name instead of throwing on a collision, and it registers no magic, so there is
no `$query` — only `$store.query`.

## What the adapter is for

The query cache is storage-agnostic: it fetches, deduplicates, and tracks staleness, and
somewhere has to keep the result. Entries it hands back are plain objects of getters,
not reactive proxies, so a template that binds a query result registers no dependency
and will not re-render on its own — the same caveat the Query page spells out.

That is what `createAlpineStoreAdapter` is for: it hands you an `Alpine.reactive` box
for a value, with `get()`, `set(value)` and a final `destroy()`, so you can place a
result inside Alpine's reactive graph yourself.

```js
import { createAlpineStoreAdapter } from "@ailura/alpinejs-query-adapter-alpine";

const box = createAlpineStoreAdapter(Alpine).create(null);
box.set({ ok: true }); // a template bound to this value re-renders
box.destroy(); // final: get() reports undefined from here on
```

The plugin above does not use it — register the plugin, or compose the adapter yourself,
not both.

## Other pieces it exports

Alongside the plugin, the package exports the plugin factory under its other names and
the adapter itself.

| Export                     | Type     | Purpose                                       |
| -------------------------- | -------- | --------------------------------------------- |
| `alpineStoreQueryPlugin`   | function | The plugin to install.                        |
| `createQueryPlugin`        | function | Same factory, under its build-time name.      |
| `createAlpineStoreAdapter` | function | Build the adapter.                            |
| `default`                  | function | `alpineStoreQueryPlugin`, under another name. |

`createAlpineStoreAdapter(Alpine)` returns an adapter with one method, `create(initial)`,
which returns the `{ get, set, destroy }` box.

## Which adapter

This is one of three adapters. All three implement the same `QueryStateAdapter` contract
and all three register the key `"query"`, so you can swap one for the other and rename
nothing. They differ in one thing only: what the store the snapshot lands in can do.

| Package                    | Backing store               | Value held          | Subscribe from outside Alpine        |
| -------------------------- | --------------------------- | ------------------- | ------------------------------------ |
| `query-adapter-alpine`     | One `Alpine.reactive` box   | `{ value }`         | No — read the box through the handle |
| `query-adapter-zustand`    | One `zustand/vanilla` store | `{ value }`         | Yes — with an injected `create`      |
| `query-adapter-nanostores` | One `nanostores` `atom`     | The snapshot itself | Yes — with an injected `create`      |

This one is the only adapter a template can bind to, because `Alpine.reactive` is Alpine's
own graph — `$store.query` is the box itself. That is also its limit: nothing outside
Alpine can subscribe to a reactive box, so a devtools panel, a persistence layer or a test
cannot observe the snapshots this adapter receives. If you need that, use the
[zustand](/plugins/data/query-adapter-zustand/) or
[nanostores](/plugins/data/query-adapter-nanostores/) adapter, where you inject your own
store creator and keep the store.

## API reference

The store is the Query store, documented on the
[Query page](/plugins/data/query/). This package adds no methods of its own.
