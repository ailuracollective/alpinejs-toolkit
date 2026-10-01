# @ailura/alpinejs-scroll

<p align="center">

[![bundlephobia minzip](https://badgen.net/bundlephobia/minzip/@ailura/alpinejs-scroll)](https://bundlephobia.com/package/@ailura/alpinejs-scroll)

</p>

> Alpine.js scroll controller — position tracking, refcounted body lock, section observer and programmatic navigation on `@ailura/alpinejs-core`.

## Installation

```sh
pnpm add @ailura/alpinejs-scroll alpinejs
# or
npm install @ailura/alpinejs-scroll alpinejs
```

Requires `alpinejs@^3.0.0` as peer. `@ailura/alpinejs-core` is a **peer
dependency**, not a dependency: no package in this toolkit has a
`dependencies` block, so the host installs it too.

## Usage

### 1. Standalone (framework-agnostic)

```ts
import { createScrollController } from "@ailura/alpinejs-scroll";

const scroll = createScrollController({ respectReducedMotion: true });

scroll.on("change", (detail) => {
  console.log(detail.source, detail.state.y, detail.state.progress);
});

const handle = scroll.lock("checkout-modal");
scroll.unlock(handle);

// ctrl.destroy() when done — after destroy every mutation is a silent no-op
```

`createScrollController` **mounts the controller for you**. Calling `mount()`
again is a no-op, so the standalone path is one call, not two. The controller
reads the window on every `scroll` event and writes to `document.body` when
locked, so it is browser-only — safe to construct on the server, inert there.

### 2. Alpine

```ts
import Alpine from "alpinejs";
import scrollPlugin from "@ailura/alpinejs-scroll";

Alpine.plugin(scrollPlugin());
Alpine.start();
```

The plugin registers `$store.scroll` and the `$scroll` magic (the same object
under both names), and mounts the controller immediately — it tracks the window
from the moment the plugin is registered, not from the first `x-data`.

```html
<div x-data>
  <!-- A header progress bar; the route layout already renders one -->
  <div class="h-1 bg-slate-200">
    <div class="h-full bg-blue-500" :style="`width: ${$store.scroll.progress * 100}%`"></div>
  </div>

  <!-- Hide a header once the reader is past the fold -->
  <header :class="$store.scroll.atTop ? 'py-6' : 'py-2 shadow-sm'">Site</header>

  <!-- Sticky nav, driven by the section observer -->
  <nav>
    <a
      href="#pricing"
      :class="$store.scroll.activeSection === 'pricing' ? 'font-bold' : 'text-slate-500'"
      >Pricing</a
    >
  </nav>

  <button type="button" @click="$store.scroll.toBottom()">Back to top… no, to bottom</button>
  <button type="button" @click="$store.scroll.unlockAll()">Release all locks</button>
</div>
```

There are **no scroll directives**. Everything is a store read or a store
method, because the state is a single window-level object rather than a
per-element binding.

## API

### Exports

| Export                          | Description                                                                                                                                                                                                                                                                      | Type       |
| ------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| `ScrollController`              | The controller class. `state`, `isLocked`, `lockHandles`, `activeSection`, `visibleSections` are getters; mutators are `lock`/`lockWithHandle`, `unlock`, `unlockAll`, `registerSection`, `unregisterSection`, `scrollIntoView`, `by`, `toTop`, `toBottom`, `toElement`, `reset` | `class`    |
| `createScrollController`        | `createScrollController(options?) => ScrollController` — **calls `mount()` before returning**, so the returned controller is already listening                                                                                                                                   | `function` |
| `scrollPlugin`                  | `Alpine.plugin()` factory — `scrollPlugin(options?) => (alpine) => void`. Registers `$store.scroll` + `$scroll` and mounts a controller of its own                                                                                                                               | `function` |
| `DEFAULT_SCROLL_STORE_KEY`      | Default store key, `"scroll"`                                                                                                                                                                                                                                                    | `const`    |
| `DEFAULT_SCROLL_MAGIC_KEY`      | Default magic key, `"scroll"`                                                                                                                                                                                                                                                    | `const`    |
| `ScrollEvents`                  | Event map — `change`, `lock`, `section`, `scroll`, `reach`, `navigation`                                                                                                                                                                                                         | `type`     |
| `ScrollState`                   | The tracked position: `{ x, y, direction, atTop, atBottom, progress, locked, lockCount, activeSection, visibleSections }`                                                                                                                                                        | `type`     |
| `ScrollStore`                   | What `$store.scroll` exposes — the `ScrollState` fields plus the navigation and lock methods                                                                                                                                                                                     | `type`     |
| `ScrollOptions`                 | Controller and plugin options — see [Options](#options)                                                                                                                                                                                                                          | `type`     |
| `ScrollChangeDetail`            | `change` payload — `{ state, previous, source, reason? }`                                                                                                                                                                                                                        | `type`     |
| `ScrollChangeSource`            | Which mutation produced a `change` — `"user" \| "navigation" \| "lock" \| "section" \| "reset" \| "initialization"`                                                                                                                                                              | `type`     |
| `ScrollDirection`               | `"up" \| "down" \| "none"`                                                                                                                                                                                                                                                       | `type`     |
| `ScrollBehavior`                | `"auto" \| "instant" \| "smooth"` — what the DOM accepts for `behavior`                                                                                                                                                                                                          | `type`     |
| `ScrollLockAxis`                | `"y" \| "both"`. **Declared but never read** — the lock always sets `overflow: hidden` on `<body>`                                                                                                                                                                               | `type`     |
| `ScrollLockChangeDetail`        | `lock` payload — `{ locked, count, reason, handle }`                                                                                                                                                                                                                             | `type`     |
| `ScrollLockDetail`              | Alias of `ScrollLockChangeDetail`                                                                                                                                                                                                                                                | `type`     |
| `ScrollLockReason`              | Alias of `string`                                                                                                                                                                                                                                                                | `type`     |
| `ScrollSectionChangeDetail`     | `section` payload — `{ active, previous, visible }`                                                                                                                                                                                                                              | `type`     |
| `ScrollSectionOptions`          | `{ mode?, rootMargin? }` — accepted by `registerSection` and **not consulted**; see [Limitations](#limitations)                                                                                                                                                                  | `type`     |
| `ScrollSectionMode`             | `"first-visible" \| "nearest"` — same caveat                                                                                                                                                                                                                                     | `type`     |
| `ScrollPositionDetail`          | `scroll` payload — `{ x, y, direction, progress }`                                                                                                                                                                                                                               | `type`     |
| `ScrollReachDetail`             | `reach` payload — `{ edge: "top" \| "bottom", y }`, fired on the transition into an edge                                                                                                                                                                                         | `type`     |
| `ScrollNavigationDetail`        | `navigation` payload — `{ from, to, behavior, reason? }`                                                                                                                                                                                                                         | `type`     |
| `ScrollIntoViewOptions`         | `{ behavior?, focus? }`                                                                                                                                                                                                                                                          | `type`     |
| `ScrollIntoViewAbsoluteOptions` | `ScrollIntoViewOptions` plus required `x`/`y`                                                                                                                                                                                                                                    | `type`     |
| `ScrollNavigationOptions`       | `{ behavior? }` — the subset `by`/`toTop`/`toBottom` accept                                                                                                                                                                                                                      | `type`     |
| `ScrollManager`                 | `{ readonly state: ScrollState }` — a minimal structural contract `ScrollController` satisfies; nothing in the package implements it separately                                                                                                                                  | `type`     |
| `ScrollAlpine`                  | Alias of Alpine's own `Alpine` type                                                                                                                                                                                                                                              | `type`     |
| `ScrollPluginCallback`          | `(alpine: Alpine) => void`                                                                                                                                                                                                                                                       | `type`     |
| `Unsubscribe`                   | `() => void`                                                                                                                                                                                                                                                                     | `type`     |

`scrollPlugin` is also the package's `default` export.

### Store API

```ts
// Reactive state — read these in templates
$store.scroll.x;
$store.scroll.y;
$store.scroll.direction; // 'up' | 'down' | 'none'
$store.scroll.atTop;
$store.scroll.atBottom;
$store.scroll.progress; // 0–1
$store.scroll.locked;
$store.scroll.lockCount;
$store.scroll.activeSection; // string | null
$store.scroll.visibleSections; // readonly string[]

// Navigation
$store.scroll.scrollIntoView($refs.target, { behavior: "smooth", focus: true });
$store.scroll.scrollIntoView({ x: 0, y: 800 });
$store.scroll.by({ y: 400 });
$store.scroll.toTop();
$store.scroll.toBottom();

// Locking
const handle = $store.scroll.lock("checkout-modal");
$store.scroll.unlock(handle);
$store.scroll.unlockAll();

$store.scroll.destroy();
```

| Method                             | Description                                                                                                                                                                                                                                      |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `scrollIntoView(target, options?)` | `target` is an `Element` or `{ x, y }`. With an `Element`, calls its `scrollIntoView` and — when `options.focus` is true — calls `.focus()` afterwards. With coordinates, scrolls the window absolutely. Emits `change` with source `navigation` |
| `by(delta, options?)`              | Relative window scroll. `delta.x`/`delta.y` are optional and default to `0`. Uses `window.scrollBy` with the given or default behavior                                                                                                           |
| `toTop(options?)`                  | Absolute scroll to `0, 0`                                                                                                                                                                                                                        |
| `toBottom(options?)`               | Absolute scroll to the current `documentElement.scrollHeight - innerHeight`. A no-op without a window                                                                                                                                            |
| `lock(reason?)`                    | Adds a lock and returns its handle. `reason` defaults to `"store"` from the store and `"lock"` from the controller. Every lock sets `body { overflow: hidden }`                                                                                  |
| `unlock(handle)`                   | Releases one lock. An unknown handle is a no-op — no throw, no warning                                                                                                                                                                           |
| `unlockAll()`                      | Releases every lock at once                                                                                                                                                                                                                      |
| `destroy()`                        | **Host-owned.** Disconnects the section observer, releases all locks and clears the registered sections. Nothing calls it automatically; the host that registered the plugin does                                                                |

`reset()`, `toElement(id)` and `registerSection`/`unregisterSection` are on
the **controller only** — the store does not forward them.

### Body lock is refcounted

`lock()` returns a handle and the lock is held until _that_ handle is released,
so two owners can overlap without one of them freeing the other's lock:

```ts
const modal = $store.scroll.lock("modal");
const menu = $store.scroll.lock("menu");

$store.scroll.locked; // true
$store.scroll.lockCount; // 2

$store.scroll.unlock(modal);
$store.scroll.locked; // true — the menu still holds it
$store.scroll.unlock(menu);
$store.scroll.locked; // false — overflow is restored
```

Locking also writes the scrollbar width to `--ailura-scrollbar-gap` on
`<html>`, and, when `target` is set, adds `padding-right` to that element so a
fixed header does not shift as the scrollbar disappears. `unlockAll()` is the
safe teardown for a route change.

### Section observer

Sections are registered by id against the controller, looked up in the document
as `[data-scroll-section="<id>"]` first and then by element id:

```ts
import { createScrollController } from "@ailura/alpinejs-scroll";

const scroll = createScrollController();

scroll.registerSection("pricing");
scroll.registerSection("faq", { mode: "nearest" });

scroll.on("section", ({ active, previous, visible }) => {
  console.log(`${previous} → ${active}`, visible);
});
```

The observer uses a fixed `rootMargin` of `0px 0px -50% 0px`, so a section is
considered active while it occupies the top half of the viewport. When more
than one is visible, the **first registered** one wins.

> The section observer is on the controller, not the store — `$store.scroll`
> forwards navigation and locking but not `registerSection`. To use it from
> Alpine, build a controller yourself and read `$store.scroll.activeSection` is
> not wired to it; drive the section state from your own controller instance.

### Options

```ts
type ScrollOptions = {
  id?: string; // controller id — default: generateId('scroll')
  defaultBehavior?: ScrollBehavior; // default: 'smooth'
  respectReducedMotion?: boolean; // default: true
  reserveScrollbarGap?: boolean; // default: true
  target?: Element | string | null; // default: null
  storeKey?: string; // default: 'scroll'
  magicKey?: string; // default: magicKey ?? storeKey
};
```

| Option                 | Default                | Description                                                                                                                                                                                                                                               |
| ---------------------- | ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `id`                   | `generateId("scroll")` | Controller identifier, readable as `controller.id`                                                                                                                                                                                                        |
| `defaultBehavior`      | `"smooth"`             | `behavior` used by `scrollIntoView`, `by`, `toTop` and `toBottom` when the call does not pass one                                                                                                                                                         |
| `respectReducedMotion` | `true`                 | Checked as `!== false`, so omitting it and passing `true` behave identically. When the user prefers reduced motion, `"smooth"` is downgraded to `"instant"`. Set to `false` to opt out                                                                    |
| `reserveScrollbarGap`  | `true`                 | Also checked as `!== false`. When true _and_ `target` is set, the lock adds `padding-right` to that element equal to the scrollbar width                                                                                                                  |
| `target`               | `null`                 | The element that absorbs the scrollbar gap. An `Element` is used directly; a string is passed to `document.querySelector` each time the lock state changes; `null` disables the padding but the `--ailura-scrollbar-gap` custom property is still written |
| `storeKey`             | `"scroll"`             | `$store` key. Plugin-only — the standalone controller ignores it                                                                                                                                                                                          |
| `magicKey`             | `magicKey ?? storeKey` | `$magic` key. Plugin-only. Renaming `storeKey` without `magicKey` renames both                                                                                                                                                                            |

`id`, `storeKey` and `magicKey` are the standard canon trio. The plugin passes
its whole `options` object to the controller, so the behavioural options set at
registration time apply to the controller it owns.

### Avoiding name collisions

If your application already owns `$store.scroll`, or another toolkit plugin
registers on that name, rename the integration surface without touching the
controller:

```ts
Alpine.plugin(scrollPlugin({ storeKey: "pageScroll" })); // → $store.pageScroll, $pageScroll
```

Renaming `storeKey` renames the magic too, because `magicKey` defaults to it.
Pass `magicKey` explicitly to keep `$store.scroll` under one name and the magic
under another. The exported constants `DEFAULT_SCROLL_STORE_KEY` and
`DEFAULT_SCROLL_MAGIC_KEY` keep the defaults discoverable from TypeScript.

## Events

```ts
import type { ScrollChangeDetail } from "@ailura/alpinejs-scroll";

scroll.on("change", (detail: ScrollChangeDetail) => {
  detail.state; // the full ScrollState after the mutation
  detail.previous; // the state before it, or null on the first emit
  detail.source; // 'user' | 'navigation' | 'lock' | 'section' | 'reset' | 'initialization'
  detail.reason; // present for 'lock' ('unlockAll' or a handle) and for reset/navigation
});
```

| Event        | Payload                     | Fires when                                                                                                |
| ------------ | --------------------------- | --------------------------------------------------------------------------------------------------------- |
| `change`     | `ScrollChangeDetail`        | Any state mutation, with `source` naming which                                                            |
| `lock`       | `ScrollLockChangeDetail`    | A lock is taken, released, or all are released                                                            |
| `section`    | `ScrollSectionChangeDetail` | The active section changes, or the active one is unregistered                                             |
| `scroll`     | `ScrollPositionDetail`      | On every `scroll` event, independently of `change`                                                        |
| `reach`      | `ScrollReachDetail`         | On the _transition into_ an edge — `{ edge: 'top' \| 'bottom', y }`. Not re-fired while parked at an edge |
| `navigation` | `ScrollNavigationDetail`    | A programmatic scroll was requested                                                                       |

`change` is what the plugin's store sync listens to, so it is the event to use
for anything reactive. `scroll` is a higher-frequency signal for work that does
not need the full state.

## SSR

> SSR-safe — no `window`/`document` at import time. All DOM access is deferred
> to `mount()` and guarded, through `safeWindow()`, `safeDocument()` and
> `safeMatchMedia()` from `@ailura/alpinejs-core/env`.

Concretely: `createScrollController()` and `scrollPlugin()` can both be called
during SSR and will do nothing observable. There is no window, so no listener is
attached; the initial metrics read returns zeros, and `mount()` queues a
`change` with source `initialization` on the next microtask. Lock calls still
return a handle and still count — the count is state, not DOM — but no
`overflow` is written. On the client, run the plugin registration where
`Alpine.start()` runs, not during module evaluation.

## Accessibility

Not applicable — this is a Primitives-layer package and it produces no roles,
ARIA attributes or key bindings. It reports position and manages
`overflow: hidden`; the scrollbar-gap compensation exists so hiding the
scrollbar does not reflow the page under a keyboard user's focus, but the
package sets no ARIA and traps no focus.

`scrollIntoView(el, { focus: true })` calls `.focus()` on the target, which
moves keyboard focus without scrolling it into view itself — the scroll is the
browser's `scrollIntoView`. If you use it, make sure the target is focusable.

## Integration

- **@ailura/alpinejs-dialog** — a modal needs the body locked for as long as it
  is open. `lock()`'s refcount is what makes that safe when a dialog opens a
  nested dialog: each takes its own handle.
- **@ailura/alpinejs-sidebar** — a sticky or overlay sidebar on a small screen
  holds a lock for the same reason.
- **@ailura/alpinejs-virtual** — a virtualised list owns its own scroll offset
  and should not also be driven by this controller's window tracking.

## Limitations

- **`ScrollSectionOptions.mode` and `rootMargin` are accepted and ignored.**
  `registerSection(id, { mode: "nearest", rootMargin: "…" })` records them, but
  the observer hardcodes `rootMargin: "0px 0px -50% 0px"` and always resolves
  ties to the first registered section. Both types are exported and the option
  is on the public signature; neither has an effect today.
- **`ScrollLockAxis` is exported and unused.** Nothing reads it; the lock always
  applies `overflow: hidden` to `<body>`.
- **The section observer is not reachable from the store.**
  `registerSection`/`unregisterSection`/`reset`/`toElement` exist only on
  `ScrollController` — `ScrollStore` does not forward them. In an Alpine app
  driven by the plugin, `$store.scroll.activeSection` and `visibleSections`
  therefore stay `null`/`[]` forever, because nothing ever registers a section.
  A consumer that needs the section observer has to construct its own
  controller and read _that_ one, not the plugin's.
- **`$store.scroll.destroy()` is host-owned and never called for you.** The
  controller outlives the store registration; if you re-register the plugin
  without destroying the old controller, the old scroll listener stays attached
  and you leak a listener per registration.
- **Locks are not persisted across a route change.** `unlockAll()` has to be
  called explicitly, or the next page inherits a locked body.
- **Position updates are not rAF-batched.** Every `scroll` event reads layout
  and emits `change` synchronously, so a consumer doing expensive work per event
  will feel it on a fast scroll. Throttle at the call site.
- **`by()` optimistically sets `x`/`y` to the requested target** and then also
  assigns the freshly read metrics over it, so the final values come from the
  read, not from the arithmetic. Sub-pixel and browser-clamped scrolls (a rubber
  band at the end of the page) land where the browser put them.
- **`toBottom()` measures on the document element only.** A page whose height
  comes from an inner scroll container reports the wrong target.
- **`unlock()` with an unknown handle is silently ignored** — no throw, no
  return value. A double-unlock cannot be detected.
- **`ScrollManager` is a structural type nothing implements.** `ScrollController`
  satisfies it by shape; there is no separate manager instance.
- **No test directory exists** for this package outside `change-detail.test.ts`;
  `pnpm test` runs that one file.

## Size

`7.59 kB raw / 2.70 kB gzip` · budget `4.5 kB` · externalized peers: `alpinejs`,
`@ailura/alpinejs-core` · `size-limit` + `publint` + `attw` verified.

The gzip figure exceeds nothing here, but note the raw size is the second
largest in the Primitives layer for a package with no directives — most of it
is the six-event detail types and the section observer.

## Architecture

[Primitives layer](../../ARCHITECTURE.md) — controllers own state, Alpine owns
reactivity. See canon, guards, and SSR rules in
[ARCHITECTURE.md](../../ARCHITECTURE.md).

## Testing

```sh
pnpm test              # vp test (happy-dom)
pnpm run typecheck     # tsc --noEmit
```

## License

MIT
