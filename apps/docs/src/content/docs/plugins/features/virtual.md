---
title: Virtual
---

@ailura/alpinejs-virtual

A virtualized list: it keeps only the rows in view in the DOM, whatever the total
count. The plugin owns the window math; you write the scroll container and the rows.

Reach for it when a list is long enough that rendering every row is the bottleneck.

## Install

```sh
pnpm add alpinejs @ailura/alpinejs-virtual
```

## Register the plugin

Do this once, before `Alpine.start()`.

```ts
import Alpine from "alpinejs";
import virtualPlugin from "@ailura/alpinejs-virtual";

Alpine.plugin(virtualPlugin());

Alpine.start();
```

That registers a `virtual` store, so everything below is reachable at `$store.virtual`.

## Minimal example

Ten thousand rows, rendered by the slice the store hands you.

```html
<div x-data="{ id: 'rows' }" x-init="$store.virtual.create(id, { count: 10000, estimateSize: 32 })">
  <div
    x-bind="$store.virtual.listProps(id)"
    x-virtual-scroll="id"
    style="height: 400px; overflow-y: auto"
  >
    <div
      x-bind="$store.virtual.contentProps(id)"
      :style="`position: relative; height: $store.virtual.instances[id].totalSize + 'px'`"
    >
      <template x-for="row in $store.virtual.instances[id].virtualItems" :key="row.key">
        <div
          x-bind="$store.virtual.itemProps(id, row.index)"
          :style="`position: absolute; top: 0; left: 0; transform: translateY(${row.start}px); height: ${row.size}px`"
          x-text="row.index"
        ></div>
      </template>
    </div>
  </div>
</div>
```

Two things make this work and both are easy to miss:

- `x-virtual-scroll` is what tells the store which element scrolls. Without it the
  window never updates and the list renders as a single static row.
- `contentProps()` only publishes `data-virtual-total-size`. The scroll height is yours:
  bind the inner spacer's `height` to `instances[id].totalSize` and position the rows
  with their `start`. Without that the scrollbar never grows and the user cannot scroll.

Loop over `instances[id].virtualItems`, not over the full count. That record is the
reactive projection: the store rewrites it on every scroll, so the template re-renders.
`getVirtualItems(id)` returns the same slice but reads the controller directly, so it is
an imperative read — fine in a click handler, inert in a template.

## Variants

**Keep a few extra rows rendered around the viewport.** Overscan trades a little DOM
for scroll smoothness.

```js
$store.virtual.create(id, { count: 10000, estimateSize: 32, overscan: 8 });
```

**Scroll to a row.** `scrollToIndex` positions the container; it does not change
selection.

```js
$store.virtual.scrollToIndex(id, 4500);
```

**Change the data without recreating the instance.** When your list arrives from a
fetch, update the count or the keys rather than calling `create` again.

```js
$store.virtual.setCount(id, rows.length);
$store.virtual.setKeys(
  id,
  rows.map((r) => r.id)
);
```

**Measure rows that are not a fixed height.** `measureItem` takes the real size once
the row is on screen.

```js
$store.virtual.measureItem(id, index, element.offsetHeight);
```

## API reference

| Name                                          | Type     | Purpose                                                                                                              |
| --------------------------------------------- | -------- | -------------------------------------------------------------------------------------------------------------------- |
| `$store.virtual.create(id, options?)`         | `method` | Create an instance. Options: `count`, `horizontal`, `estimateSize`, `overscan`, `gap`, `paddingStart`, `paddingEnd`. |
| `$store.virtual.destroy(id)` / `destroyAll()` | `method` | Tear instances down.                                                                                                 |
| `$store.virtual.bindScrollElement(id, el)`    | `method` | The scrolling element. Required.                                                                                     |
| `$store.virtual.getVirtualItems(id)`          | `method` | The visible slice, each with an `index`. Imperative, not reactive: loop over `instances[id].virtualItems` in markup. |
| `$store.virtual.getTotalSize(id)`             | `method` | Total scrollable size. Imperative, not reactive: `instances[id].totalSize` is the one a template can bind.           |
| `$store.virtual.scrollToIndex(id, index)`     | `method` | Scroll the container to a row.                                                                                       |
| `$store.virtual.scrollToOffset(id, px)`       | `method` | Scroll the container to an absolute offset.                                                                          |
| `$store.virtual.setCount(id, count)`          | `method` | Change the total row count.                                                                                          |
| `$store.virtual.setKeys(id, keys)`            | `method` | Change the row keys, for `:key` stability.                                                                           |
| `$store.virtual.measureItem(id, index, size)` | `method` | Record a real measured height.                                                                                       |
| `$store.virtual.listProps(id)`                | `method` | `role="list"` and the attributes for the scroll container.                                                           |
| `$store.virtual.contentProps(id)`             | `method` | `data-virtual-total-size` for the inner spacer. The height itself is your binding.                                   |
| `$store.virtual.itemProps(id, index)`         | `method` | `role="listitem"`, `aria-setsize`/`aria-posinset` and `data-virtual-*` offsets for one row.                          |
| `$store.virtual.instances`                    | `store`  | Reactive registry of every instance. The only surface a template can bind to.                                        |

## Directives

| Name                    | Type        | Purpose                                                                                                                           |
| ----------------------- | ----------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `x-virtual-scroll="id"` | `directive` | Binds the scroll container to the instance whose id the expression evaluates to, and unbinds it when Alpine removes that element. |

The release is element-scoped: the scroll listener is removed and the element reference
is dropped, while the instance itself stays in `$store.virtual.instances` and keeps
serving `getVirtualItems()`. An expression that is not a string binds nothing. The
directive name is configurable with `directiveKey`.

:::caution[Two halves, and one of them is yours]
`contentProps()` does not set a height — it publishes `data-virtual-total-size`, and
you bind the spacer's height from `getTotalSize(id)`. Drop that binding and the
container scrolls a handful of pixels; keep the height but drop `x-virtual-scroll` and
the scrollbar is full size while nothing moves.
:::

## Plugin options

```ts
virtualPlugin({ id: "app-virtual", storeKey: "lists", directiveKey: "virtual-scroll" });
```
