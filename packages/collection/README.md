# @ailura/alpinejs-collection

<p align="center">

[![bundlephobia minzip](https://badgen.net/bundlephobia/minzip/@ailura/alpinejs-collection)](https://bundlephobia.com/package/@ailura/alpinejs-collection)

</p>

> A keyed collection controller — filter, sort, group, paginate and walk the active item — projected into `$store.collection.instances`, on @ailura/alpinejs-core.

## Installation

```sh
pnpm add @ailura/alpinejs-collection alpinejs
# or
npm install @ailura/alpinejs-collection alpinejs
```

Requires `alpinejs@^3.0.0` as peer. `@ailura/alpinejs-core` is a **peer
dependency**, not a dependency: no package in this toolkit has a
`dependencies` block, so the host installs it too.

## Usage

This package registers a store and **no magic and no directives**, despite
`DEFAULT_COLLECTION_MAGIC_KEY` existing — the plugin reads only `storeKey`.
See [Limitations](#limitations).

### 1. Alpine

```ts
import Alpine from "alpinejs";
import collectionPlugin from "@ailura/alpinejs-collection";

Alpine.plugin(collectionPlugin());
Alpine.start();
```

```ts
type Fruit = { name: string; family: string; stock: number };

Alpine.data("picker", () => ({
  fruits: [] as Fruit[],
  query: "",
  direction: "asc" as "asc" | "desc",

  init() {
    // Created once. Every interaction below mutates this live instance rather
    // than rebuilding it — `create()` was not always the only mutator.
    this.$store.collection.create<Fruit>("fruits", {
      items: this.fruits,
      getKey: (item) => item.name,
      filter: { match: (item, q) => item.name.toLowerCase().includes(q.toLowerCase()) },
      sort: { compare: (a, b) => a.name.localeCompare(b.name), direction: "asc" },
      group: { by: (item) => item.family },
      paginate: { pageSize: 20 },
      wrap: true,
    });
  },

  search() {
    this.$store.collection.setQuery("fruits", this.query);
  },

  toggleSort() {
    this.direction = this.direction === "asc" ? "desc" : "asc";
    this.$store.collection.setSort(
      "fruits",
      (a, b) => a.name.localeCompare(b.name),
      this.direction
    );
  },
}));
```

```html
<div x-data="picker">
  <input type="search" x-model="query" @input.debounce.200ms="search()" />

  <ul>
    <template x-for="row in $store.collection.instances.fruits?.view ?? []" :key="row.key">
      <li :class="row.key === $store.collection.instances.fruits?.activeKey ? 'bg-blue-100' : ''">
        <span x-text="row.item.name"></span>
        <small x-text="row.disabled ? 'unavailable' : `${row.item.stock} in stock`"></small>
      </li>
    </template>
  </ul>

  <!-- `groups` buckets the whole filtered list, not the current page -->
  <template
    x-for="group in $store.collection.instances.fruits?.groups ?? []"
    :key="String(group.key)"
  >
    <section>
      <h3 x-text="`${group.label} · ${group.count}`"></h3>
    </section>
  </template>

  <footer>
    <span
      x-text="`page ${$store.collection.instances.fruits?.page} of ${$store.collection.instances.fruits?.pageCount}`"
    ></span>
    <button @click="$store.collection.prevPage('fruits')">Previous</button>
    <button @click="$store.collection.nextPage('fruits')">Next</button>
  </footer>
</div>
```

### 2. Standalone (framework-agnostic)

```ts
import { createCollectionController } from "@ailura/alpinejs-collection";

const ctrl = createCollectionController<Fruit, string>({
  items: fruits,
  getKey: (item) => item.name,
  filter: { match: (item, q) => item.name.includes(q) },
  sort: { compare: (a, b) => a.stock - b.stock, direction: "desc" },
  paginate: { pageSize: 3, initialPage: 1 },
  wrap: true,
}); // already mounted

ctrl.pageCount; // Math.ceil(filtered.length / pageSize), minimum 1
ctrl.view.length; // the current page only
ctrl.groups.length; // 0 — no `group.by` was given

ctrl.on("change", (detail) => {
  detail.reason; // 'items' | 'filter' | 'sort' | 'group' | 'paginate' | 'active' | 'reset'
  detail.keys; // keys of the whole source, not the view
  detail.viewCount; // rows on the current page
});

ctrl.setQuery("ap"); // resets to page 1
ctrl.nextActive(); // walks the unpaginated list
ctrl.insert({ name: "Ugli", family: "citrus", stock: 4 });
ctrl.remove("Ugli");
ctrl.destroy();
```

`createCollectionController()` is generic in both the item type and the key type,
so `getKey` and every command are typed against your data. The factory mounts
before returning, so there is no `mount()` call.

## API

| Export                         | Description                                                                                                | Type       |
| ------------------------------ | ---------------------------------------------------------------------------------------------------------- | ---------- |
| `CollectionController`         | Controller class, generic in `<T, K>` — owns one collection, emits `change`                                | `class`    |
| `createCollectionController`   | Factory — `(options?) => CollectionController<T, K>`; **mounts before returning**                          | `function` |
| `collectionPlugin`             | `Alpine.plugin()` factory — `(options?) => (alpine) => void`; also the package's `default` export          | `function` |
| `DEFAULT_COLLECTION_STORE_KEY` | Default `$store` key — `"collection"`                                                                      | `string`   |
| `DEFAULT_COLLECTION_MAGIC_KEY` | Same constant as the store key — **not registered by the plugin**, see Limitations                         | `string`   |
| `CollectionStore`              | The `$store.collection` surface — `instances` plus 10 commands                                             | `type`     |
| `CollectionInstance`           | The snapshot in `instances[id]`                                                                            | `type`     |
| `CollectionOptions`            | Create and plugin options — see below                                                                      | `type`     |
| `CollectionViewItem`           | One row — `{ item, key, index, disabled, hidden }`                                                         | `type`     |
| `CollectionGroup`              | One bucket — `{ key, label, items, count }`                                                                | `type`     |
| `CollectionGroupKey`           | `string \| number \| null` — the value `group.by` returns                                                  | `type`     |
| `CollectionGroupKeyFn`         | `(item: T) => CollectionGroupKey`                                                                          | `type`     |
| `CollectionGroupOptions`       | `{ by, initialKey?, enabled? }` — see Limitations for what is and is not read                              | `type`     |
| `CollectionFilterOptions`      | `{ match, initial?, enabled? }`                                                                            | `type`     |
| `CollectionMatchFn`            | `(item: T, query: string) => boolean`                                                                      | `type`     |
| `CollectionSortOptions`        | `{ compare, direction? }`                                                                                  | `type`     |
| `CollectionCompareFn`          | `(a: T, b: T) => number`                                                                                   | `type`     |
| `CollectionSortDirection`      | `'asc' \| 'desc'`                                                                                          | `type`     |
| `CollectionPaginateOptions`    | `{ pageSize, initialPage? }`                                                                               | `type`     |
| `CollectionKey`                | `string \| number`                                                                                         | `type`     |
| `CollectionKeyFn`              | `(item: T) => K`                                                                                           | `type`     |
| `CollectionPredicate`          | `(item: T) => boolean`                                                                                     | `type`     |
| `CollectionChangeDetail`       | `change` payload — `{ id, reason, keys, viewCount }`                                                       | `type`     |
| `CollectionChangeReason`       | `'items' \| 'filter' \| 'sort' \| 'group' \| 'paginate' \| 'active' \| 'reset'`                            | `type`     |
| `CollectionEvents`             | Event map — `change: [CollectionChangeDetail]`                                                             | `type`     |
| `CollectionItem`               | `{ key, value, disabled?, hidden? }` — the `CollectionManager` item shape                                  | `type`     |
| `CollectionManager`            | `{ items, register, unregister, filter, sort, paginate }` — **an unimplemented contract**, see Limitations | `type`     |
| `CollectionSelectionLike`      | `{ selectedKeys: ReadonlyArray<K> }` — what `controller.isSelected()` accepts                              | `type`     |
| `CollectionPluginCallback`     | `(alpine: Alpine) => void` — the `Alpine.plugin()` callback signature                                      | `type`     |
| `CollectionAlpine`             | Alias for the `Alpine` type the plugin callback receives                                                   | `type`     |

`CollectionViewDetail` is declared in `src/events.ts` but **not exported from the
barrel** — see Limitations.

### The pipeline

Every derived value comes from one pipeline, in this order:

```
source items
  → filtered by filter.match(item, query)      (skipped when query is "")
  → sorted by sort.compare                      (skipped when no comparator)
  → flat view: { item, key, index, disabled, hidden }
      ├→ view   : the current page slice        (paginate.pageSize, default: no slice)
      ├→ groups : bucketed by group.by, unpaginated, [] when no group.by
      └→ nextActive / prevActive walk the flat view, ignoring the page slice
```

| `CollectionInstance` field | What it holds                                                                          |
| -------------------------- | -------------------------------------------------------------------------------------- |
| `source`                   | The items as given, unfiltered                                                         |
| `keys`                     | `getKey()` over the **whole source**, not the view — identity, not position            |
| `view`                     | `CollectionViewItem[]` — the current page                                              |
| `count`                    | `view.length`                                                                          |
| `groups`                   | `CollectionGroup[]` — the whole filtered list bucketed, unpaginated                    |
| `page` / `pageCount`       | 1-based; `pageCount` is `Math.ceil(filtered.length / pageSize)`, min 1                 |
| `activeKey`                | `initialKey`, or whatever `setActiveKey()` last set — never filtered out automatically |
| `query`                    | The text query, as set                                                                 |

### Store API — `$store.collection`

`instances` is a reactive registry, one `CollectionInstance` per id, replaced
wholesale from the controller on every `change`.

| Command                            | Behaviour                                                                                                                                                                                                                                                                         |
| ---------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `create(id, options?)`             | Creates **and mounts** a controller for `id`. Re-creating an id destroys the previous one first. `options` is a full `CollectionOptions`, so a rebuild with new items is one call — but it is the _only_ way to change `getKey`, `group.by` or `paginate.pageSize` after the fact |
| `destroy(id)`                      | Destroys that one collection and drops it from `instances`                                                                                                                                                                                                                        |
| `destroy()`                        | **Every** collection. Both arities share one key so `destroy(id)` can never be mistaken for `destroy()`                                                                                                                                                                           |
| `destroyAll()`                     | The same as `destroy()`                                                                                                                                                                                                                                                           |
| `setQuery(id, query)`              | Sets the text, keeps the filter function, resets to page 1                                                                                                                                                                                                                        |
| `setSort(id, compare, direction?)` | Sets the comparator (`null` clears it) and direction, keeps filter and paging. `direction` defaults to `'asc'`                                                                                                                                                                    |
| `setPage(id, page)`                | Clamped to `[1, pageCount]`                                                                                                                                                                                                                                                       |
| `nextPage(id)` / `prevPage(id)`    | `setPage` by one, clamped — so `nextPage()` on the last page is a no-op that still emits                                                                                                                                                                                          |
| `setActiveKey(id, key \| null)`    | Sets the highlighted key. Nothing filters or reconciles it — see Limitations                                                                                                                                                                                                      |
| `setItems(id, items)`              | Replaces the source, keeping filter, sort, group and paging                                                                                                                                                                                                                       |

Every command is `controllers[id]?.…`, so a call against an unknown id is a
silent no-op rather than a throw. That is the same rule the controller applies
after `destroy()`: every mutator checks `lifecycle === "destroyed"` and returns,
which is why a store command that races a `destroy(id)` fails quietly.

Beyond the store, `CollectionController` exposes `source`, `keys`, `query`,
`page`, `pageCount`, `activeKey`, `view`, `groups` and `snapshot()`, plus
`insert(item)`, `remove(key)`, `nextActive()`, `prevActive()` and
`isSelected(selection)` — the last four of which are **not on the store**.

### Options

```ts
interface CollectionOptions<T, K extends CollectionKey = string> {
  items?: readonly T[];
  getKey?: (item: T) => K;
  initialKey?: K | null;
  isDisabled?: (item: T) => boolean;
  isHidden?: (item: T) => boolean;
  filter?: { match: (item: T, query: string) => boolean; initial?: string; enabled?: boolean };
  sort?: { compare: (a: T, b: T) => number; direction?: "asc" | "desc" };
  group?: {
    by: (item: T) => CollectionGroupKey;
    initialKey?: CollectionGroupKey;
    enabled?: boolean;
  };
  paginate?: { pageSize: number; initialPage?: number };
  wrap?: boolean;
  id?: string;
  storeKey?: string;
  magicKey?: string;
}
```

| Option                 | Default                       | Effect                                                                                         |
| ---------------------- | ----------------------------- | ---------------------------------------------------------------------------------------------- |
| `items`                | `[]`                          | Copied into a new array; the array you pass is never held                                      |
| `getKey`               | `id` → `key` → `String(item)` | Keys must be unique and stable; they are the identity everything else speaks in                |
| `initialKey`           | `null`                        | Seeds `activeKey`. Not validated against `items` or `keys`                                     |
| `isDisabled`           | `() => false`                 | Tags `view[].disabled`. Nothing filters on it — see Limitations                                |
| `isHidden`             | `() => false`                 | Tags `view[].hidden`. Also does nothing else                                                   |
| `filter.match`         | —                             | Omit and the filter stage is skipped entirely. With a `match` and an empty query, also skipped |
| `filter.initial`       | `""`                          | The starting `query`                                                                           |
| `filter.enabled`       | —                             | **Never read.** Presence of `filter.match` is the switch                                       |
| `sort.compare`         | —                             | Omit and no sorting happens                                                                    |
| `sort.direction`       | `'asc'`                       | `'desc'` negates the comparator's result                                                       |
| `group.by`             | —                             | Omit and `groups` is `[]`                                                                      |
| `group.initialKey`     | —                             | **Never read**                                                                                 |
| `group.enabled`        | —                             | **Never read**                                                                                 |
| `paginate.pageSize`    | —                             | Omit or leave falsy and there is no pagination: `pageCount` is 1 and `view` is the whole list  |
| `paginate.initialPage` | `1`, clamped                  | Clamped against `pageCount` in the constructor, so a stale page cannot survive a rebuild       |
| `wrap`                 | `true`                        | Whether `nextActive()` past the last row returns to the first                                  |
| `id`                   | `generateId("collection")`    | The controller id; also the `id` in every `change` detail                                      |
| `storeKey`             | `"collection"`                | `$store` key — read by the **plugin factory only**                                             |
| `magicKey`             | —                             | **Never read.** See Limitations                                                                |

`storeKey` is `CollectionOptions` rather than a separate plugin-options type
because the plugin factory is typed with `CollectionOptions<T, K>` and reads
`_options.storeKey` through a cast. Everything else in that object is passed to
the controllers a host creates later, not to the plugin.

### Avoiding name collisions

```ts
Alpine.plugin(collectionPlugin({ storeKey: "products" })); // → $store.products
```

`storeKey` is resolved with `resolveStoreKey`, so only `undefined` or `null` falls
back to `DEFAULT_COLLECTION_STORE_KEY`. The claim goes through `guardStore`, so
a second plugin taking `"collection"` throws a `RegistrationError`.
`DEFAULT_COLLECTION_STORE_KEY` keeps the rename discoverable from TypeScript.

### Events

```ts
import type { CollectionChangeDetail } from "@ailura/alpinejs-collection";

ctrl.on("change", (detail: CollectionChangeDetail) => {
  detail.id; // the controller id
  detail.reason; // what moved
  detail.keys; // keys of the whole source
  detail.viewCount; // rows on the current page
});
```

`reason` is the one worth switching on — it tells a subscriber whether to
re-render a list (`'items'`, `'filter'`, `'sort'`, `'paginate'`) or just move a
highlight (`'active'`):

| `reason`     | Emitted by                                             |
| ------------ | ------------------------------------------------------ |
| `'items'`    | `setItems`, `insert`, `remove`                         |
| `'filter'`   | `setQuery`, `setFilter`                                |
| `'sort'`     | `setSort`                                              |
| `'group'`    | **Nothing in this package emits it** — see Limitations |
| `'paginate'` | `setPage` (and so `nextPage`/`prevPage`)               |
| `'active'`   | `setActiveKey`, `nextActive`, `prevActive`             |
| `'reset'`    | **Nothing emits it** — reserved                        |

Every mutator emits exactly one `change`, **even when nothing changed** — there
is no diffing. `nextPage()` on the last page emits `reason: 'paginate'` with an
unchanged snapshot, and `setSort()` with the comparator already installed emits
`'sort'` too. Subscribe on `reason`, not on object identity.

## SSR

> SSR-safe — no `window`/`document` at import time. This package never reads the
> DOM at all; every value is derived from the items you pass in.

State is in-memory, so a server render produces a real collection but a throwaway
one: `$store.collection.instances` is `{}` until `create()` runs, and the
`create()` that ran on the server is not the one the client has. Populate the
items during SSR if you want the server HTML to contain rows, and re-create the
instance on the client — or accept that the server string is empty and let the
list fill in on hydration. There is no hydration story here: nothing is
serialised, and nothing needs to be.

The controller is also the one in this group with no `matchMedia` or DOM guard at
all, because it has nothing to guard. `getKey`, the filter, the sort and the
group function are all pure functions of your data.

## Accessibility

> This is a `Primitives` package and ships **no ARIA and no key bindings.** It is
> a data pipeline; wiring roles, `aria-selected` and arrow-key handling is the
> host's.

Two fields exist for an accessibility host and neither acts on it:
`view[].disabled` tells you a row is disabled so you can render it as such, and
motion handling is not this package's business. The active-item navigation
(`nextActive`/`prevActive`) is what a roving-tabindex or `aria-activedescendant`
implementation would drive:

```html
<div role="listbox" :aria-activedescendant="`row-${$store.collection.instances.picker?.activeKey}`">
  <template x-for="row in $store.collection.instances.picker?.view ?? []" :key="row.key">
    <div
      :id="`row-${row.key}`"
      role="option"
      :aria-selected="row.key === $store.collection.instances.picker?.activeKey"
    >
      …
    </div>
  </template>
</div>
```

Bind it through `@keydown` on your own element — nothing in this package listens
for a key. `nextActive`/`prevActive` are on the controller, not on the store, so a
store-only host drives the highlight with `setActiveKey(id, key)` from its own
key handler.

## Integration

- **@ailura/alpinejs-selection** — `CollectionController.isSelected(selection)`
  takes anything with `selectedKeys`, which a `SelectionInstance` structurally
  satisfies. That is the intended pairing: the collection owns what is _visible_,
  the selection owns what is _chosen_, and the two are separate stores.
- **@ailura/alpinejs-virtual** — `keys` covers the whole source while `view` is
  one page, so a virtualised list can page `view` and still resolve identity
  against every item.
- **@ailura/alpinejs-command** — a command palette's ranked list is a filter over
  a collection; both are a `match(item, query)` plus an order.

## Limitations

- **The plugin registers no magic.** `DEFAULT_COLLECTION_MAGIC_KEY` is exported
  and `CollectionOptions.magicKey` is a declared field, but `collectionPlugin()`
  reads only `storeKey` and calls only `guardStore`. `magicKey: 'x'` in plugin
  options is silently ignored — there is no `$collection` to read, contrary to
  the demo catalog's own surface string.
- **`CollectionManager` and `CollectionItem` are unimplemented contracts.**
  `CollectionManager` declares `register`, `unregister`, `filter`, `sort` and
  `paginate` over `CollectionItem[]`, and nothing in the package implements it —
  not the controller, not the store. It is exported, so it is part of the public
  surface, and it is a type with no behaviour behind it.
- **`group.initialKey` and `group.enabled` are never read**, and neither is
  `filter.enabled`. Presence of `filter.match` and `group.by` is the only switch
  those stages have. The `group` reason in `CollectionChangeReason` is likewise
  never emitted, because grouping is computed on read rather than stored.
- **`isDisabled` and `isHidden` are tags, not behaviour.** They set
  `view[].disabled` and `view[].hidden` and nothing filters on either: a disabled
  row is still in `view`, still in `groups`, still reachable by `nextActive()`,
  and still selectable by a host that does not check. Filter it yourself.
- **`setActiveKey()` accepts any key.** It is not checked against `keys`, against
  the filtered view, or against the current page — so an active key can point at a
  row that is filtered out or on another page, and no row highlights. Only
  `setItems()` reconciles it, and only when the key _disappears entirely_.
- **`insert()` and `remove()` are not on the store.** They exist on the
  controller, but `$store.collection` only reaches the controllers through
  `setItems()` — which replaces the whole array. A host that owns the controller
  directly gets the incremental pair; a host using the store rebuilds.
- **`destroy()` with no argument destroys everything.** It is one function
  declared with two overloads, `destroy(id: string)` and `destroy()`; the no-arg
  form iterates every controller, and `destroyAll()` calls it. `destroy(id)` is
  the one that destroys one.
- **`source` is the live internal array.** `get source()` returns `this.#source`,
  the actual array, not a copy — so a consumer can mutate the controller's state
  without an event firing. `snapshot().source` has the same problem; it is the
  same reference.
- **`CollectionViewDetail` is not exported from the barrel.** It is declared in
  `src/events.ts` and used nowhere, so `{ items, keys }` — a payload no event
  carries — is unreachable from the package's public API.
- **`keys` is derived from the source, never from the view.** `detail.keys` in a
  `change` payload is every item's key, so it does not shrink when a filter
  narrows the list. Read `viewCount`, or `view.length`, for "how many are showing".
- **`view` is the paginated slice and `groups` is not.** Pagination and grouping
  are independent, so `groups` can list rows that are not on the current page.
  That is usually what you want (a grouped sidebar of counts), but it is not
  obvious from the two field names.
- **No event is suppressed for a no-op.** `nextPage()` on the last page,
  `setSort()` with the comparator already installed, and `setPage()` with the page
  already current all emit `change` anyway. There is no equality check.

## Size

`4.50 kB raw / 1.74 kB gzip` · budget `5 kB` · externalized peers: `alpinejs`, `@ailura/alpinejs-core` · `size-limit` + `publint` + `attw` verified.

## Architecture

[Primitives layer](../../ARCHITECTURE.md) — controllers own state, Alpine owns reactivity. See canon, guards, and SSR rules in [ARCHITECTURE.md](../../ARCHITECTURE.md).

## Testing

```sh
pnpm test              # vp test (happy-dom)
pnpm run typecheck     # tsc --noEmit
```

## License

MIT
