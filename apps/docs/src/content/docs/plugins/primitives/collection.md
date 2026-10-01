---
title: Collection
---

@ailura/alpinejs-collection

A collection store: items plus filtering, sorting, grouping, and pagination, with the
result computed for you. The plugin owns the query; you render the list.

## Install

```sh
pnpm add alpinejs @ailura/alpinejs-collection
```

## Register the plugin

Do this once, before `Alpine.start()`.

```ts
import Alpine from "alpinejs";
import collectionPlugin from "@ailura/alpinejs-collection";

Alpine.plugin(collectionPlugin());

Alpine.start();
```

That registers a `collection` store, so everything below is reachable at `$store.collection`.

## Minimal example

A tracked list, read back from the registry.

```html
<div x-data="{ cid: 'products' }" x-init="$store.collection.create(cid, { items: products })">
  <p>
    Tracked: <span x-text="Object.keys($store.collection.instances).join(', ') || 'none'"></span>
  </p>

  <button @click="$store.collection.create('orders', { items: orders })">Track orders</button>
  <button @click="$store.collection.destroy(cid)">Stop tracking products</button>
</div>
```

There are exactly two methods: `create()` and `destroy()`. The filtering, sorting and
pagination live on the snapshot, not on the store, so the store stays small enough to
reason about.

## One store, many collections

`instances` is keyed by the id you passed to `create()`. That is the whole reason the
id exists: it lets a single registered store carry the product list and the order list
at the same time, each independent.

```js
$store.collection.create("products", {
  items: products,
  filter: { match: (item, query) => byCategory(item, query) },
  sort: { compare: (a, b) => a.name.localeCompare(b.name), direction: "desc" },
});
```

Destroying is symmetric with creating, and is what you do when a view unmounts so the
instance does not outlive the component that made it.

```js
$store.collection.destroy("orders");
```

## Configuring the query

`create()` takes the same options you would pass to a data layer: the items, and
optionally a `filter`, a `sort`, a `group`, and a `paginate`. `filter` and `sort` are
objects, not bare functions: `filter.match` is the matcher and `sort.compare` is the
comparator, and `sort` does nothing at all without a `compare`.

```js
$store.collection.create("products", {
  items,
  filter: { match: (item, query) => item.name.includes(query) },
  sort: { compare: (a, b) => a.name.localeCompare(b.name), direction: "asc" },
  paginate: { pageSize: 20 },
});
```

The snapshot in `instances` carries the filtered, sorted, grouped, and paginated
result. Bind to that rather than recomputing it in the template, or a long list is
recomputed on every render.

## API reference

| Name                                     | Type   | Purpose                                                                                                                                      |
| ---------------------------------------- | ------ | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `$store.collection.create(id, options?)` | method | Create an instance. Options: `items`, `getKey`, `initialKey`, `isDisabled`, `isHidden`, `filter`, `sort`, `group`, `paginate`, `wrap`, `id`. |
| `$store.collection.destroy(id)`          | method | Remove an instance.                                                                                                                          |
| `$store.collection.instances`            | store  | Reactive registry, keyed by id, holding each snapshot.                                                                                       |

:::caution[An instance you create and never destroy keeps filtering its items]
`instances` is reactive and long-lived, so a collection created for a route that is no
longer mounted keeps its snapshot alive. Create on mount and destroy on teardown, or
the memory grows one collection per navigation.
:::

## Plugin options

```ts
collectionPlugin({ storeKey: "lists" });
```
