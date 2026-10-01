# @ailura/alpinejs-overlay

<p align="center">

[![bundlephobia minzip](https://badgen.net/bundlephobia/minzip/@ailura/alpinejs-overlay)](https://bundlephobia.com/package/@ailura/alpinejs-overlay)

</p>

> Headless overlay manager for Alpine.js — one portal root for the whole page, a
> dense z-index ladder allocated per open overlay, and a stack that re-numbers
> itself as things close. It hands out numbers and keeps one node; it renders
> nothing, traps no focus and sets no ARIA.

## Installation

```sh
pnpm add @ailura/alpinejs-overlay alpinejs
# or
npm install @ailura/alpinejs-overlay alpinejs
```

Requires `alpinejs@^3.0.0` as peer, plus `@ailura/alpinejs-ui` for the portal
helper and `@ailura/alpinejs-core` for the controller base. All three are
**peer dependencies** — no package in this toolkit has a `dependencies` block,
so the host installs them too.

## Usage

### 1. Standalone (framework-agnostic)

```ts
import { createOverlayController } from "@ailura/alpinejs-overlay";

const ctrl = createOverlayController({ baseZIndex: 1000, step: 10 });

ctrl.on("change", (detail) => {
  detail.action; // 'claim' | 'unregister' | 'destroy'
  detail.stack; // the entries after the change
  detail.added; // set on 'claim'
  detail.removed; // set on 'unregister'
});

const z = ctrl.claim("quick-panel", "panel-1"); // 1000
ctrl.claim("menu", "menu-1"); // 1010
ctrl.zIndexOf("quick-panel", "panel-1"); // 1000

ctrl.unregister("quick-panel", "panel-1");
ctrl.zIndexOf("menu", "menu-1"); // 1000 — the ladder closed the gap

ctrl.isOpen("menu", "menu-1"); // true
ctrl.state.root; // the portal element, or null before the first claim
ctrl.destroy();
```

The ladder is **positional, not incremental**: an entry's z-index is
`baseZIndex + position × step`, recomputed on every release. A long session
therefore reuses layers instead of climbing toward the browser's maximum, and an
overlay that read its z-index before a lower entry closed has to read it again.

`createOverlayController()` calls `mount()` for you; the plugin constructs the
controller directly instead. It makes no observable difference — this controller
wires nothing in `setup()`.

### 2. Alpine

```ts
import Alpine from "alpinejs";
import overlayPlugin from "@ailura/alpinejs-overlay";

Alpine.plugin(overlayPlugin());
Alpine.start();
```

The plugin registers `$store.overlay` and the `$overlay` magic — the same object
under two names, so a template can read `$overlay.count` and a script can call
`$store.overlay.claim()` on the same state.

```html
<template x-teleport="#overlay-root">
  <div x-show="bannerOpen" x-cloak :style="{ zIndex: $store.overlay.zIndexOf('demo', 'banner') }">
    Banner
  </div>
</template>
```

```js
Alpine.data("banner", () => ({
  bannerOpen: false,

  init() {
    // Claim on open, release on close — a claimed slot is a place on the ladder,
    // and an unclaimed pair makes zIndexOf() report the base instead.
    this.$watch("bannerOpen", (open) => {
      if (open) $store.overlay.claim("demo", "banner");
      else $store.overlay.unregister("demo", "banner");
    });
  },
}));
```

`x-teleport="#overlay-root"` targets the element this package resolves. Pass
`{ root: "#my-portal" }` to name your own, and the package will adopt it if it
already exists rather than creating a second one.

## API

| Export                      | Description                                                                                                                                                                   | Type       |
| --------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| `OverlayController`         | The manager. `new OverlayController(options?)` — owns the stack, the slot map and the root                                                                                    | `class`    |
| `createOverlayController`   | `createOverlayController(options?) => OverlayController` — constructs **and mounts**                                                                                          | `function` |
| `overlayPlugin`             | `Alpine.plugin()` factory — registers `$store.overlay` and `$overlay`, with a `change` sync                                                                                   | `function` |
| `default`                   | Alias of `overlayPlugin`                                                                                                                                                      | `function` |
| `DEFAULT_OVERLAY_STORE_KEY` | `"overlay"` — the default `$store` key                                                                                                                                        | `string`   |
| `DEFAULT_OVERLAY_MAGIC_KEY` | `"overlay"` — the default `$overlay` key; follows `storeKey` unless set explicitly                                                                                            | `string`   |
| `OverlayStore`              | The `$store.overlay` surface: five data fields and seven methods                                                                                                              | `type`     |
| `OverlayMagicFacade`        | The same surface with the data fields `readonly` — what the `$overlay` magic evaluates to                                                                                     | `type`     |
| `OverlayOptions`            | `{ root?, baseZIndex?, step?, scope?, storeKey?, magicKey? }` — the factory and `configure()` bag                                                                             | `type`     |
| `NormalizedOverlayOptions`  | `{ root, baseZIndex, step }`. Declared for the resolved shape; the controller uses an inline type and never returns one                                                       | `type`     |
| `OverlayState`              | What `controller.state` returns: `{ root, stack, count, baseZIndex, step }`                                                                                                   | `type`     |
| `OverlayStackEntry`         | One open overlay: `{ plugin, id, zIndex, openedAt }`                                                                                                                          | `type`     |
| `OverlayChangeDetail`       | The `change` payload: `{ action, stack, added?, removed? }`                                                                                                                   | `type`     |
| `OverlayChangeListener`     | `(detail: OverlayChangeDetail) => void`                                                                                                                                       | `type`     |
| `OverlayEvents`             | `{ change: [OverlayChangeDetail] }` — the controller's event map                                                                                                              | `type`     |
| `OverlayEventMap`           | The same map under a second name. A re-export alias, not a different type                                                                                                     | `type`     |
| `OverlayPluginCallback`     | `(alpine: Alpine) => void` — the `Alpine.plugin()` callback                                                                                                                   | `type`     |
| `AlpineOverlayAlpine`       | A typed view of `Alpine` limited to `store("overlay")` / `magic("overlay")`. The plugin types its parameter as the real `Alpine` instead, so nothing in the workspace uses it | `type`     |

### Controller API

| Member                   | Returns        | What it does                                                                                                                                                               |
| ------------------------ | -------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `state`                  | `OverlayState` | A fresh snapshot object on every read — the stack is copied, so it is not a live handle                                                                                    |
| `configure(options)`     | `void`         | Re-bases the ladder. **Throws** if the stack is non-empty and `baseZIndex` or `step` would change. See below                                                               |
| `claim(plugin, id)`      | `number`       | Takes a slot and returns its z-index. Idempotent: a second claim for the same pair returns the same number. **Throws** on an empty `plugin` or `id`, and after `destroy()` |
| `unregister(plugin, id)` | `void`         | Releases the slot and re-numbers everything above it. Silent no-op for a pair that holds no slot                                                                           |
| `zIndexOf(plugin, id)`   | `number`       | Pure read. The entry's z-index, or `baseZIndex` when it holds none. Allocates nothing. `0` after `destroy()`                                                               |
| `isOpen(plugin, id)`     | `boolean`      | Whether the pair holds a slot. `false` after `destroy()`                                                                                                                   |
| `on('change', listener)` | unsubscribe    | Inherited from `BaseController`; the unsubscribe also runs on `destroy()`                                                                                                  |
| `toStore()`              | `OverlayStore` | The store projection. A detached `stack` array the plugin fills in place on every `change`                                                                                 |
| `id`                     | `string`       | `generateId("overlay")`                                                                                                                                                    |
| `destroy()`              | `void`         | Empties the stack, detaches the root **only if this controller created it**, emits a final `change`, then freezes. Idempotent                                              |

### Store API

`$store.overlay` — and `$overlay` is the same object:

```js
// Data
$store.overlay.stack; // OverlayStackEntry[] — the projection, refilled in place
$store.overlay.count; // stack.length, always
$store.overlay.root; // the portal element, or null
$store.overlay.baseZIndex; // 1000 by default
$store.overlay.step; // 10 by default

// Methods
$store.overlay.claim("menu", "menu-1"); // → its z-index
$store.overlay.unregister("menu", "menu-1");
$store.overlay.zIndexOf("menu", "menu-1");
$store.overlay.isOpen("menu", "menu-1");
$store.overlay.configure({ baseZIndex: 5000, step: 50 });
$store.overlay.on("change", (detail) => console.log(detail.action, detail.stack));
$store.overlay.destroy();
```

Read the stack in a template and every entry is live — the plugin refills the
same array on each `change`, so `x-for="entry in $store.overlay.stack"`
re-renders without a `$watch`:

```html
<template x-for="entry in $store.overlay.stack" :key="entry.plugin + ':' + entry.id">
  <li>
    <code x-text="entry.plugin + ':' + entry.id"></code>
    — z-index <span x-text="entry.zIndex"></span>
  </li>
</template>
```

**`destroy()` is host-owned.** Nothing in the toolkit calls it for you: not the
plugin, not `x-data`'s `destroy()`. A page that tears down its overlay layer has
to call it, and only the host that registered the plugin knows when that is.

### Options

```ts
type OverlayOptions = {
  root?: HTMLElement | string | null; // default: null → "#overlay-root", created on the first claim
  baseZIndex?: number; //               default: 1000
  step?: number; //                     default: 10
  scope?: SingletonScope; //            accepted and ignored
  storeKey?: string; //                 default: "overlay"
  magicKey?: string; //                 default: "overlay", or storeKey when only that is given
};
```

| Option       | Default     | Effect                                                                                                                                                                                                                                           |
| ------------ | ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `root`       | `null`      | An `HTMLElement` is **adopted** (never removed by `destroy()`); a selector that matches is adopted; a selector starting with `#` that matches nothing gets a portal created for it; `null` means `#overlay-root`, created on the first `claim()` |
| `baseZIndex` | `1000`      | The z-index of the bottom of the ladder. `zIndexOf()` reports it for an unclaimed pair                                                                                                                                                           |
| `step`       | `10`        | The gap between consecutive entries. `step: 0` puts every overlay on one layer, in insertion order                                                                                                                                               |
| `scope`      | —           | Accepted and ignored — see [Limitations](#limitations)                                                                                                                                                                                           |
| `storeKey`   | `"overlay"` | The `$store` key                                                                                                                                                                                                                                 |
| `magicKey`   | `"overlay"` | The `$overlay` key. Follows `storeKey` when only that is given, and wins over it when both are                                                                                                                                                   |

## The one invariant that throws

`configure()` re-bases the ladder, which would renumber layers out from under
overlays that already hold them. It refuses:

```js
$store.overlay.claim("menu", "menu-1");
$store.overlay.configure({ baseZIndex: 5000 });
// Error: Cannot re-configure overlay baseZIndex (1000 -> 5000) or step (10 -> 10)
//        while the stack is non-empty.
```

The guard is a comparison, not a flag: passing the **same** `baseZIndex` and
`step` back while the stack is busy is allowed, because nothing moves. The trap
is that "the same" is compared against the _resolved_ values, and an omitted
field resolves to the default — so after a reconfigure to `baseZIndex: 5000`, a
call to `configure({})` or `configure({ root: "#x" })` resolves to `1000`, sees a
difference, and throws. Release the stack first, or pass the current numbers
back:

```js
for (const entry of [...$store.overlay.stack]) {
  $store.overlay.unregister(entry.plugin, entry.id);
}
$store.overlay.configure({ baseZIndex: 5000, step: 50 });
const z = $store.overlay.claim("menu", "menu-1"); // → 5000
```

Unregistering is not enough on its own: whatever the released entry was still
rendering has to be closed too, or it stays on screen while `zIndexOf()` reports
the base for it.

## Portal root ownership

The root is resolved once and then **owned or adopted**, and only an owned root is
detached by `destroy()`:

| How the root was resolved                       | `destroy()` removes it     |
| ----------------------------------------------- | -------------------------- |
| `createPortalRoot` created it                   | yes                        |
| A caller passed an `HTMLElement`                | no — the caller owns it    |
| `querySelector` found a node for the selector   | no — it was already there  |
| `createPortalRoot` found the id already present | no — somebody else made it |

That last row is the subtle one: `createPortalRoot` is idempotent, so two
controllers asking for `#overlay-root` get the same element and only the first
one to create it may remove it. `store.root` tells you which node you have, not
whose it is.

## Events

```ts
import type { OverlayChangeDetail } from "@ailura/alpinejs-overlay";

ctrl.on("change", (detail: OverlayChangeDetail) => {
  detail.action; // 'claim' | 'unregister' | 'destroy'
  detail.stack; // the entries AFTER the change
  detail.added; // the new entry, on 'claim'
  detail.removed; // the released entry, on 'unregister'
});
```

`on()` returns the unsubscribe function. `destroy()` emits a final `change` with
`action: 'destroy'` and an empty stack, so a listener still sees the store go
empty — and it is emitted before the base teardown so the plugin's projection is
refilled rather than left stale. A `change` listener is not a good place to
`claim()` from: the emit is synchronous and mid-emit changes are snapshotted, so
a claim made there lands after the snapshot the other listeners are iterating.

## SSR

> SSR-safe — no `window`/`document` at import time, and the DOM is only touched
> when it exists. Constructing a controller on the server leaves `state.root` as
> `null`; `createPortalRoot` returns `null` without a document rather than
> throwing, and `#resolveRoot` guards on `typeof document` before it asks. The
> first `claim()` on the client is what materialises the node, so a server-rendered
> page can reserve a slot and hydrate into it.

## Accessibility

This package produces **no ARIA and no keyboard handling**, and that is the right
scope for it: it allocates numbers and owns one node. What a reader of this
package needs to know is where the rest lives.

- Nothing here sets `role`, `aria-*` or `tabindex`, and nothing moves focus.
- Nothing here traps or restores focus, locks scroll, or dismisses on `Escape`.
- The `#overlay-root` node it creates is a bare `<div>` with no attributes —
  `createPortalRoot` accepts a `className` and a tag, but this package passes
  only an id.

Those are the feature packages' jobs, and the toolkit ships them:
`@ailura/alpinejs-dialog` and `@ailura/alpinejs-menu` for the dialog and menu
patterns, `@ailura/alpinejs-tooltip` for hover/focus tooltips,
`@ailura/alpinejs-command` for the palette. None of them depends on this package;
see [Integration](#integration).

The accessibility cost of a shared portal is worth stating plainly: a teleported
node leaves the accessibility tree position of its DOM parent, so an overlay
inherits the tree position of `#overlay-root` (a direct child of `<body>`) rather
than of the element that opened it. That is why the dialog and menu packages own
their focus management instead of delegating it here.

## Integration

**No package in the toolkit depends on this one.** `@ailura/alpinejs-overlay`
declares peers on `core` and `ui` and nothing depends back on it, so there is no
wiring order to get right and no feature package to register it for. What the
other packages share with it is a **convention, not an API**: the portal id.

- **`#overlay-root`** — the id this package resolves by default, and the one
  `DialogDemo`, `MenuDemo`, `TooltipDemo` and `CommandDemo` name in
  `x-teleport="#overlay-root"`. Those demos do not call `$store.overlay` and
  their packages do not import it; they teleport into a node by id, and this
  package is what guarantees an empty document has one. If your layout already
  renders `<div id="overlay-root">` — the playground's does, with
  `transition:persist` so a view transition does not drop it — the controller
  **adopts** it and `destroy()` will leave it in place.
- **A custom portal** — pass `{ root: "#my-portal" }` and the same convention
  applies under your own id. Every consumer teleports to the same string you
  name; nothing reads the option back out of the store.
- **`@ailura/alpinejs-dialog`, `@ailura/alpinejs-menu`, `@ailura/alpinejs-tooltip`,
  `@ailura/alpinejs-command`** — they own the ARIA, the focus trap and the
  keyboard handling for their patterns, and they take their z-index from their own
  `ui` portal work rather than from this stack. Reach for this package when you are
  writing an overlay of your own and want it ordered against the others.

## Limitations

- **`scope` is accepted and ignored.** `OverlayOptions.scope` is typed
  `SingletonScope` and no code in the package reads it — the controller holds one
  root and no shared state, so there is nothing for a scope to key on. It is
  there because the type doubles as the plugin factory's options.
- **Nothing in the toolkit depends on this package.** `@ailura/alpinejs-overlay`
  is a leaf: no other `@ailura/alpinejs-*` package declares it as a peer or
  imports from it, and the playground registers it beside the others rather than
  for them. The shared `#overlay-root` is a string convention, so a feature
  package can teleport into a node this one created without either package
  knowing the other exists — and a rename of the default id would break every one
  of them silently.
- **`configure()` compares against resolved defaults, so a partial call throws.**
  After a reconfigure to `baseZIndex: 5000`, `configure({ root: "#x" })` resolves
  to `1000` and refuses, even though only the root was being changed. Pass the
  current `baseZIndex` and `step` back, or empty the stack first.
- **`destroy()` is silent but `claim()` throws.** After `destroy()`, `claim()`
  raises `Cannot claim a slot on destroyed overlay controller`, while
  `unregister()`, `configure()` and `destroy()` itself are silent no-ops, and
  `zIndexOf()` reports `0`. A template that claims from a click handler after
  teardown gets an uncaught error rather than a no-op.
- **`NormalizedOverlayOptions` and `AlpineOverlayAlpine` are declared and unused.**
  The controller normalises options into an inline type and the plugin types its
  parameter as the real `Alpine` from the `alpinejs` package, so neither export
  is produced or consumed by anything in the workspace.
- **`OverlayEvents` and `OverlayEventMap` are the same interface** under two
  names; the barrel exports both.
- **Slot keys are stringified.** The slot map is keyed by `` `${plugin}::${id}` ``,
  so a `plugin` or `id` containing `::` collides with another pair. Nothing
  validates it beyond non-empty.
- **`zIndexOf()` for an unclaimed pair reports the base, not nothing.** That is
  deliberate (a pure read that allocates nothing) but it means a `:style` binding
  on a pair you never claimed renders a real-looking number for a layer that does
  not exist. Claim on open.
- **Releasing an entry renumbers everything above it.** Any z-index read before
  the release is stale. Bind `:style` to `zIndexOf()` and let it re-evaluate;
  do not cache the number in state.
- **`step: 0` collapses the ladder**, putting every overlay on `baseZIndex` and
  leaving paint order to insertion order. Nothing rejects it.
- **The store's `stack` is a projection, not the controller's array.** The plugin
  refills it in place on `change`; nothing pushes to it. A hand-rolled consumer
  of `controller.toStore()` with no `change` listener attached sees a permanently
  empty stack.
- **The declared budget is met** — `1.64 kB gzip` against a `3 kB` entry.

## Size

`4.09 kB raw / 1.64 kB gzip` · budget `3 kB` · externalized peers: `alpinejs`, `@ailura/alpinejs-core`, `@ailura/alpinejs-ui` · `size-limit` + `publint` + `attw` verified.

The number is larger than a headless feature package's because the portal
ownership rules — adopt versus own, and the idempotence of `createPortalRoot` —
are most of the code.

## Architecture

[Features layer](../../ARCHITECTURE.md) — controllers own state, Alpine owns
reactivity. `OverlayController extends BaseController`, so it inherits the
`idle → mounted → destroyed` lifecycle; the plugin is a thin projection: it
registers the store and a `change` listener that refills it. Portal creation goes
through `createPortalRoot` / `removePortalRoot` in `@ailura/alpinejs-ui`, which
return `null` without a document and are the reason the SSR path needs no guard
of its own. See canon, guards, and SSR rules in
[ARCHITECTURE.md](../../ARCHITECTURE.md).

## Testing

```sh
pnpm exec vp test packages/overlay
pnpm exec tsc --noEmit -p packages/overlay/tsconfig.json
```

`test/stack-projection.test.ts` runs against a `happy-dom` document and pins the
projection behaviour this package's correctness rests on: `count` always equals
`stack.length`, the `stack` array keeps its identity across changes, the store
array is not the controller's private one, `destroy()` empties the projection and
emits a `destroy` change, `zIndexOf()` allocates nothing, and an adopted root
survives `destroy()` while an owned one does not. See
[ARCHITECTURE.md §8](../../ARCHITECTURE.md).

## License

MIT
