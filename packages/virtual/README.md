# @ailura/alpinejs-virtual

<p align="center">

[![bundlephobia minzip](https://badgen.net/bundlephobia/minzip/@ailura/alpinejs-virtual)](https://bundlephobia.com/package/@ailura/alpinejs-virtual)

</p>

> Alpine.js headless virtual list — fixed and variable row sizes, overscan, element or window scroll, and list/listitem ARIA on @ailura/alpinejs-core. One `x-virtual-scroll` attribute per scroll container.

## Installation

```sh
pnpm add @ailura/alpinejs-virtual alpinejs
# or
npm install @ailura/alpinejs-virtual alpinejs
```

Requires `alpinejs@^3.0.0` as peer. `@ailura/alpinejs-core` is a **peer
dependency**, not a dependency: no package in this toolkit has a
`dependencies` block, so the host installs it too.

## Usage

### 1. Standalone (framework-agnostic)

```ts
import { createVirtualController } from "@ailura/alpinejs-virtual";

const ctrl = createVirtualController(); // already mounted
ctrl.create("rows", { count: 10000, estimateSize: 36, overscan: 6 });

const viewport = document.querySelector<HTMLElement>("#viewport")!;
ctrl.bindScrollElement("rows", viewport);

ctrl.on("rangeChange", (detail) => {
  console.log(detail.startIndex, detail.endIndex, detail.virtualItems.length);
});
ctrl.on("scroll", (detail) => {
  console.log(detail.scrollOffset, detail.scrollDirection, detail.isScrolling);
});

ctrl.getVirtualItems("rows"); // the window — 8 rows computed without a viewport
ctrl.getTotalSize("rows"); // 360000 — count × estimateSize, padding and gap included
ctrl.measureItem("rows", 42, 64); // a row taller than the estimate
ctrl.scrollToIndex("rows", 4999, { align: "end" });

ctrl.destroy("rows"); // drop one instance and its scroll listener
// ctrl.destroy() when done — every mutating method after destroy is a silent no-op
```

The controller computes offsets, ranges and total size; you own the DOM. It
touches the DOM only inside `bindScrollElement()`, which is also the only place
it reads a layout measurement.

### 2. Alpine

```ts
import Alpine from "alpinejs";
import virtualPlugin from "@ailura/alpinejs-virtual";

Alpine.plugin(virtualPlugin());
Alpine.start();
```

```html
<div x-data="{ rows: Array.from({ length: 10000 }, (_, i) => ({ id: i, label: `Row ${i + 1}` })) }">
  <!--
    .create hace las dos cosas: crea la instancia desde las opciones del
    atributo y enlaza ESTE elemento como su contenedor de scroll. Sin el
    modificador sólo enlaza, y la instancia la crea otro `create()`.
  -->
  <div x-virtual-scroll.create="{ id: 'rows', count: 10000, estimateSize: 36 }">
    <!-- El spacer: altura sintetizada = la suma de todas las filas -->
    <div
      :style="`height: ${$store.virtual.instances.rows?.totalSize ?? 0}px; position: relative`"
      x-bind="$store.virtual.contentProps('rows')"
    >
      <template x-for="item in $store.virtual.instances.rows?.virtualItems ?? []" :key="item.key">
        <!-- translateY(item.start) es lo que pone la fila en su sitio -->
        <div
          x-bind="$store.virtual.itemProps('rows', item.index)"
          :style="`position: absolute; top: 0; transform: translateY(${item.start}px); height: ${item.size}px`"
          x-text="rows[item.index].label"
        ></div>
      </template>
    </div>
  </div>
</div>
```

The plugin registers `$store.virtual`, the magic `$virtual` (the same object),
and the `x-virtual-scroll` directive.

**Three attributes and a spacer are the whole contract.** The package computes
_which_ rows to render and _where_; it never touches a row element, because a
virtualizer that positions rows itself is not headless.

## API

### Exports

| Export                        | Description                                                                                                                                            | Type       |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------- |
| `VirtualController`           | Framework-agnostic controller class — owns instances, emits `change`, `rangeChange`, `scroll`, `toStore()`                                             | `class`    |
| `createVirtualController`     | Factory — `createVirtualController(options?) => VirtualController`; constructs **and mounts** it                                                       | `function` |
| `virtualPlugin`               | Alpine plugin factory — `virtualPlugin(options?) => AlpineCallback`; also the `default` export                                                         | `function` |
| `DEFAULT_VIRTUAL_STORE_KEY`   | Default `$store` and `$magic` key — `"virtual"`                                                                                                        | `string`   |
| `DEFAULT_VIRTUAL_MAGIC_KEY`   | Same string, named separately; the magic follows `storeKey` unless `magicKey` says otherwise                                                           | `string`   |
| `CreateVirtualOptions`        | Plugin options — `{ id, storeKey, magicKey, directiveKey }`                                                                                            | `type`     |
| `VirtualControllerOptions`    | Controller factory options — `{ id }`                                                                                                                  | `type`     |
| `VirtualOptions`              | Instance options — `count`, `horizontal`, `estimateSize`, `overscan`, `paddingStart`, `paddingEnd`, `gap`, `scrollMode`, `getItemKey`                  | `type`     |
| `VirtualInstance`             | Snapshot — `count`, `scrollOffset`, `scrollDirection`, `isScrolling`, `totalSize`, `viewportSize`, `startIndex`, `endIndex`, `virtualItems`, `options` | `type`     |
| `VirtualItem`                 | One computed row — `key`, `index`, `start`, `end`, `size`                                                                                              | `type`     |
| `VirtualKey`                  | `string \| number` — what `getItemKey` returns and what keys `setKeys` takes                                                                           | `type`     |
| `VirtualScrollAlign`          | `"start" \| "center" \| "end" \| "auto"`                                                                                                               | `type`     |
| `VirtualScrollBehavior`       | `"auto" \| "smooth"`                                                                                                                                   | `type`     |
| `VirtualScrollMode`           | `"element"` (the bound element scrolls) or `"window"` (the document does)                                                                              | `type`     |
| `VirtualScrollDirection`      | `"forward" \| "backward" \| "none"` — derived from the previous offset, not from the wheel                                                             | `type`     |
| `VirtualScrollToIndexOptions` | `{ align?, behavior? }`                                                                                                                                | `type`     |
| `VirtualStore`                | Alpine-facing store surface, including `instances`                                                                                                     | `type`     |
| `VirtualEvents`               | Event map for `controller.on(…)`                                                                                                                       | `type`     |
| `VirtualChangeDetail`         | `change` payload — `{ id }`                                                                                                                            | `type`     |
| `VirtualRangeChangeDetail`    | `rangeChange` payload — `{ id, startIndex, endIndex, virtualItems }`                                                                                   | `type`     |
| `VirtualScrollDetail`         | `scroll` payload — `{ id, scrollOffset, scrollDirection, isScrolling }`                                                                                | `type`     |
| `VirtualAlpine`               | Typed view of `Alpine` used by the plugin                                                                                                              | `type`     |
| `VirtualPluginCallback`       | `(alpine: Alpine) => void`                                                                                                                             | `type`     |

### Controller API

| Method                | Description                                                                                                   |
| --------------------- | ------------------------------------------------------------------------------------------------------------- |
| `hasInstance(id)`     | Whether an instance is registered                                                                             |
| `snapshotInstances()` | A fresh `Record<string, VirtualInstance>` of plain copies — never the private registry                        |
| `toStore()`           | The `VirtualStore` facade the plugin registers                                                                |
| `destroy(id?)`        | With an id: unbind and drop that instance. **Without** an id: drop every instance _and_ freeze the controller |

### Store API

```ts
// Lifecycle — `x-virtual-scroll.create` does the first two for you
$store.virtual.create("rows", { count: 10000, estimateSize: 36, overscan: 6 });
$store.virtual.bindScrollElement("rows", document.querySelector("#viewport"));
$store.virtual.destroy("rows");
$store.virtual.destroyAll();

// Data
$store.virtual.setCount("rows", 20000); // rebuilds the key array
$store.virtual.setKeys("rows", keys); // throws unless keys.length === count
$store.virtual.measureItem("rows", 42, 64); // throws RangeError on size <= 0

// Navigation
$store.virtual.scrollToIndex("rows", 4999, { align: "end" });
$store.virtual.scrollToOffset("rows", 12000, { behavior: "smooth" });

// Reads
$store.virtual.getVirtualItems("rows"); // readonly VirtualItem[]
$store.virtual.getTotalSize("rows"); // number
$store.virtual.instances.rows; // reactive VirtualInstance snapshot

// ARIA + data attributes
$store.virtual.listProps("rows", { label: "Rows" });
$store.virtual.itemProps("rows", 42);
$store.virtual.contentProps("rows");
```

| Method                              | Description                                                                                                                                                                                       |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `create(id, options?)`              | Registers `id` with normalised options, builds the key array from `count`/`getItemKey`, computes the range, emits `change` + `rangeChange`                                                        |
| `bindScrollElement(id, el)`         | Attaches the scroll listener, reads the viewport size and recomputes. `el = null` removes the listener and keeps the instance. **A missing id is a silent no-op**                                 |
| `setCount(id, count)`               | Rebuilds keys and invalidates the offset cache. No-op on an unknown id                                                                                                                            |
| `setKeys(id, keys)`                 | Replaces the keys. **Throws** `setKeys length (n) must match count (m)` on a mismatch                                                                                                             |
| `measureItem(id, index, size)`      | Records one row's real size and rebuilds offsets. **Throws** `index n out of range` and `RangeError` on `size <= 0`. A repeated measurement of the same size returns without emitting             |
| `scrollToIndex(id, index, opts?)`   | Scrolls so `index` lands per `align`, clamped to `[0, count - 1]` and then to the scrollable range                                                                                                |
| `scrollToOffset(id, offset, opts?)` | Scrolls to a raw offset, clamped to `[0, max(0, totalSize - viewportSize)]`. Emits a `scroll` with `scrollDirection: "none"` and `isScrolling: false` — it is a synthesized event, not a real one |
| `getVirtualItems(id)`               | The current computed window                                                                                                                                                                       |
| `getTotalSize(id)`                  | `paddingStart + Σ(size + gap) - gap + paddingEnd`, floored at 0                                                                                                                                   |
| `listProps(id, opts?)`              | `role="list"`, `aria-orientation` from `horizontal`, and `opts.label` as `aria-label`                                                                                                             |
| `itemProps(id, index)`              | `role="listitem"`, `aria-setsize` = `count`, `aria-posinset` = `index + 1`, plus `data-virtual-index`, `data-virtual-start`, `data-virtual-size` when the row is in the window                    |
| `contentProps(id)`                  | `data-virtual-total-size`                                                                                                                                                                         |
| `instances`                         | `Record<string, VirtualInstance>` of snapshots, written by the plugin on every event                                                                                                              |

### Options

Plugin:

```ts
type CreateVirtualOptions = {
  id?: string; // controller id — defaults to generateId("virtual")
  storeKey?: string; // $store key — default "virtual"
  magicKey?: string; // $magic key — default magicKey ?? storeKey ?? "virtual"
  directiveKey?: string; // directive name without `x-` — default "virtual-scroll"
};
```

Instance (`VirtualOptions`), normalised by `create()`:

| Option         | Default     | Description                                                                  |
| -------------- | ----------- | ---------------------------------------------------------------------------- |
| `count`        | `0`         | How many rows. `0` renders nothing and still reports a total size            |
| `horizontal`   | `false`     | Measures `clientWidth` instead of `clientHeight` and sets `aria-orientation` |
| `estimateSize` | `50`        | Assumed row size in px until `measureItem` corrects it                       |
| `overscan`     | `1`         | Extra rows rendered before and after the visible range                       |
| `paddingStart` | `0`         | Space before the first row                                                   |
| `paddingEnd`   | `0`         | Space after the last row                                                     |
| `gap`          | `0`         | Added between rows, and subtracted once from the total                       |
| `scrollMode`   | `"element"` | `"window"` listens on `document` and reads `window.scrollY` instead          |
| `getItemKey`   | `(i) => i`  | Row identity. Set it whenever rows can be reordered or removed               |

## The `x-virtual-scroll` directive

```html
<!-- a bare identifier IS the id — do not quote it -->
<div x-virtual-scroll="rows">…</div>

<!-- .create also builds the instance from these options -->
<div x-virtual-scroll.create="{ id: 'rows', count: 10000, estimateSize: 36 }">…</div>

<!-- no id anywhere: one is generated and written to data-virtual-id -->
<div x-virtual-scroll.create="{ count: 1000 }">…</div>
```

The bare-identifier form is not a typo. The expression is evaluated, and
`x-virtual-scroll="rows"` as an expression asks Alpine for a _variable_ named
`rows` — which throws "rows is not defined" before the directive can do
anything, and the list simply stays dead. So a bare identifier is taken
literally; a quoted string or an object bag is evaluated as before.

**Binding and creating are separate on purpose.** Without `.create` the
directive only binds, which is what you want when the host owns the instance's
options. `bindScrollElement()` returns silently on an unknown id, so the
directive also retries — on the next microtask and on every `change` the
controller emits — until the instance appears. That is what makes a list whose
`count` arrives from a fetch work without any extra wiring.

**The release is the directive's own `cleanup()`.** Alpine 3.17 gives a plugin
no teardown — `plugin()` discards the callback's return value — so
`cleanupElement` draining `el._x_cleanups` is the only mechanism the runtime
really invokes. When the container leaves the tree, `data-virtual-id` is removed
and `bindScrollElement(id, null)` runs the instance's `scrollCleanup`. The
instance itself survives.

## SSR

> Import-safe. Nothing reads `window`, `document` or `matchMedia` at module
> scope, and `bindScrollElement()` re-checks `typeof window` before attaching a
> listener. `create()` on the server still computes a full range against an
> assumed 300 px viewport, so the list server-renders as a window of rows
> wrapped in a correctly-sized spacer — which is exactly what you want for a
> virtual list, since the scroll height is already correct without JavaScript.

## Accessibility

- Roles/attributes managed: `listProps()` gives the container `role="list"`,
  `aria-orientation="vertical"` (or `"horizontal"`) and your `aria-label`;
  `itemProps()` gives each row `role="listitem"` plus `aria-setsize` = the full
  `count` and `aria-posinset` = its real 1-based position — so a screen reader
  announces "3 of 10000" even though only a window of rows exists in the DOM.
  `contentProps()` puts `data-virtual-total-size` on the spacer
- Keyboard: none of its own. A virtual list is an ordinary scroll container, so
  the browser's own scrolling, `Home`/`End`, `PageUp`/`PageDown` and focus
  scrolling work — but **only when the container is focusable**
  (`tabindex="0"`), which the package does not add for you
- Focus: no focus management. Removing a focused row from the DOM on scroll
  drops focus to `<body>`; there is no `aria-activedescendant` pattern here to
  paper over it
- Reference: [WAI-ARIA Authoring Practices — List pattern](https://www.w3.org/WAI/ARIA/apg/patterns/list/)
- `itemProps()` still returns `aria-setsize`/`aria-posinset` for a row outside
  the current window, so you can call it on a row you are about to render and
  get the right numbers

## Integration

- **@ailura/alpinejs-query** — the natural source for `count`: `setCount()` on
  every cache update is all a virtualized table needs
- **@ailura/alpinejs-overlay** — a virtual list inside a modal needs the modal
  to own the scroll container, and `scrollMode: "window"` is _not_ the answer
- **@ailura/alpinejs-collection** — its filtering/sorting can drive
  `setKeys()` when the order is yours rather than the index's

## Limitations

- **Nothing measures your rows.** There is no `ResizeObserver`. A row whose
  real height differs from `estimateSize` keeps the wrong offset, the wrong
  spacer and the wrong scrollbar until you call `measureItem()` for it. For a
  fixed-height list that is the whole cost model; for a variable one, the
  measuring loop is yours to write.
- **`viewportSize` is read once.** `bindScrollElement()` takes
  `clientHeight` at bind time and nothing ever re-reads it — there is no resize
  observer and no resize listener. Resize the container and the computed range,
  `align: "center"` and the scroll clamp all keep using the old height until
  you re-bind with `bindScrollElement(id, el)`.
- **A zero-height container assumes 300 px.** `element.clientHeight || 300` is
  the fallback, so a list inside a collapsed panel — a closed `<details>`, a
  hidden tab — silently computes against a viewport that does not exist. It
  does not self-correct when the panel opens.
- **`align: "auto"` is not implemented.** The controller branches on
  `"center"` and `"end"` only, so `"auto"` and `"start"` and an omitted value
  all do the same thing: align the row's top edge. `VirtualScrollAlign` offers
  four values and two of them are aliases.
- **`behavior: "smooth"` only works in `scrollMode: "window"`.** For an element
  container `scrollToOffset()` assigns `scrollTop`, which cannot be animated;
  the option is accepted and dropped. Use CSS `scroll-behavior` on the
  container instead.
- **`scrollDirection` is inferred, not measured.** It is
  `offset > last ? "forward" : offset < last ? "backward" : "none"`, so a
  programmatic scroll reports `"none"` and a scrollbar drag that moves the
  offset the wrong way reports the opposite of what the user did.
- **`isScrolling` is a 150 ms timer.** It is set `true` on the scroll event and
  cleared by a `setTimeout` that nothing cancels, so a destroy mid-scroll still
  fires the callback.
- **`count: 0` still reports a total size** — `paddingStart - gap + paddingEnd`,
  floored at 0 — which is a negative-looking number the caller has to know about.
- **`destroy()` with no id freezes the controller**, after which every `create`,
  `bindScrollElement`, `measureItem` and `scrollToIndex` returns silently.
  `destroyAll()` is the instance-scoped version.
- **`DEFAULT_VIRTUAL_DIRECTIVE_KEY` is not exported** from the entrypoint, so
  `directiveKey`'s default is not discoverable from TypeScript.

## Size

`8.71 kB raw / 3.19 kB gzip` · budget `6 kB` · externalized peers: `alpinejs`,
`@ailura/alpinejs-core` · `size-limit` + `publint` + `attw` verified.

**The build exceeds its own budget**: 8.71 kB raw against a 6 kB limit in
`.size-limit.json`, so `pnpm size` fails for this package today. Both numbers
are printed here rather than the flattering one.

## Architecture

[Features layer](../../ARCHITECTURE.md) — controllers own state, Alpine owns reactivity. See canon, guards, and SSR rules in [ARCHITECTURE.md](../../ARCHITECTURE.md).

## Testing

```sh
pnpm test              # vp test (happy-dom)
pnpm run typecheck     # tsc --noEmit
```

## License

MIT
