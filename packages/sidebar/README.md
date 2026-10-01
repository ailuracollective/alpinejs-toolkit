# @ailura/alpinejs-sidebar

<p align="center">

[![bundlephobia minzip](https://badgen.net/bundlephobia/minzip/@ailura/alpinejs-sidebar)](https://bundlephobia.com/package/@ailura/alpinejs-sidebar)

</p>

> Alpine.js sidebar store — visibility state, a breakpoint query that can hide the drawer, an Escape handler the plugin installs on `document` for you, and a reactive `$store.sidebar` / `$sidebar` on @ailura/alpinejs-core. The smallest package in the Features layer.

## Installation

```sh
pnpm add @ailura/alpinejs-sidebar alpinejs
# or
npm install @ailura/alpinejs-sidebar alpinejs
```

Requires `alpinejs@^3.0.0` as peer. `@ailura/alpinejs-core` is a **peer
dependency**, not a dependency: no package in this toolkit has a
`dependencies` block, so the host installs it too.

The package also declares `@ailura/alpinejs-ui` and `@ailura/alpinejs-media`
as peers and imports **neither** — see [Limitations](#limitations).

## Usage

### 1. Standalone (framework-agnostic)

```ts
import { createSidebarController } from "@ailura/alpinejs-sidebar";

const ctrl = createSidebarController({
  initial: true,
  closeOnEscape: true,
  breakpoint: { query: "(max-width: 1023px)", onMismatch: "hide" },
}); // already mounted

ctrl.on("change", (detail) => {
  detail.visible; // boolean
  detail.matchesBreakpoint; // boolean
  detail.source; // "user" | "breakpoint" | "escape" | "reset" | "initialization"
  detail.previous; // { visible, matchesBreakpoint } | null — null on the first event
});

ctrl.show();
ctrl.visible; // true
ctrl.isVisible; // true — the same boolean, twice
ctrl.hasOverlay; // true — visible && closeOnOverlayClick
ctrl.toggle();
ctrl.reset(); // back to `initial`
ctrl.destroy();
```

The controller owns all mutable state and is safe to drive from any stack —
Blade, Livewire, Astro, or plain TypeScript. On mount it installs one
`document` keydown listener (when `closeOnEscape`) and, if you gave it a
`breakpoint`, one `MediaQueryList` change listener; `destroy()` removes both.

### 2. Alpine

```ts
import Alpine from "alpinejs";
import sidebarPlugin from "@ailura/alpinejs-sidebar";

Alpine.plugin(
  sidebarPlugin({
    breakpoint: { query: "(max-width: 1023px)", onMismatch: "hide" },
  })
);
Alpine.start();
```

```html
<div x-data>
  <button @click="$sidebar.toggle()" :aria-expanded="$sidebar.visible">Menu</button>

  <!-- The overlay's presence is derived state, not a second boolean -->
  <div x-show="$sidebar.hasOverlay" x-cloak @click="$sidebar.hide()"></div>

  <aside x-show="$sidebar.isVisible" x-cloak>
    <!--
      No @keydown here. With closeOnEscape (the default) the plugin already
      listens on `document`, so Escape works from anywhere on the page.
    -->
    <nav>…</nav>
  </aside>
</div>
```

The plugin registers `$store.sidebar` and the `$sidebar` magic — the same
object under two names. There are no directives: the drawer, its transition
and its scroll lock are your markup's job.

**Do not assign `$store.sidebar.visible = true`.** On the Alpine store
`visible` is a mirrored field that `sync()` overwrites; only `show()`, `hide()`
and `toggle()` reach the controller. See Limitations.

## API

### Exports

| Export                      | Description                                                                                                 | Type       |
| --------------------------- | ----------------------------------------------------------------------------------------------------------- | ---------- |
| `SidebarController`         | Framework-agnostic controller class — owns visibility, the breakpoint listener and the Escape handler       | `class`    |
| `createSidebarController`   | Factory — `createSidebarController(options?) => SidebarController`; constructs **and mounts** it            | `function` |
| `sidebarPlugin`             | Alpine plugin factory — `sidebarPlugin(options?) => AlpineCallback`; also the `default` export              | `function` |
| `DEFAULT_SIDEBAR_STORE_KEY` | Default `$store` key — `"sidebar"`                                                                          | `string`   |
| `DEFAULT_SIDEBAR_MAGIC_KEY` | Default `$magic` key — `"sidebar"`                                                                          | `string`   |
| `CreateSidebarOptions`      | Options for both — see the table below                                                                      | `type`     |
| `SidebarBreakpointOption`   | `{ query: string; onMismatch: "hide" \| "keep" }` — `onMismatch` is required, not optional                  | `type`     |
| `SidebarOnMismatch`         | `"hide" \| "keep"`                                                                                          | `type`     |
| `SidebarChangeDetail`       | `change` payload — `{ visible, matchesBreakpoint, source, previous }`                                       | `type`     |
| `SidebarChangeSource`       | `"user" \| "breakpoint" \| "escape" \| "reset" \| "initialization"`                                         | `type`     |
| `SidebarStore`              | The state surface — `visible`, `matchesBreakpoint`, `isVisible`, `hasOverlay` plus the four actions         | `type`     |
| `SidebarAlpineStore`        | `SidebarStore` plus `destroy()` — what the plugin registers                                                 | `type`     |
| `SidebarManager`            | `SidebarStore` plus `id`, `on("change", …)` and `destroy()`. **Declared but never constructed by anything** | `type`     |
| `SidebarEvents`             | Event map for `controller.on(…)`                                                                            | `type`     |
| `SidebarAlpine`             | `Alpine` widened with `store(name): unknown`                                                                | `type`     |
| `SidebarPluginCallback`     | `(alpine: Alpine) => void`                                                                                  | `type`     |

### Controller API

| Member                  | Description                                                                                                       |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `visible` / `isVisible` | The same boolean, twice. `visible` is writable through `toStore()`'s setter, which routes to `show()`/`hide()`    |
| `hasOverlay`            | `visible && closeOnOverlayClick` — so setting `closeOnOverlayClick: false` turns the overlay flag off permanently |
| `matchesBreakpoint`     | The last value the `MediaQueryList` reported. **`false` forever if you never passed `breakpoint`**                |
| `show()` / `hide()`     | Each is a no-op when already in that state, so neither emits twice                                                |
| `toggle()`              | `show()` when hidden, `hide()` when visible                                                                       |
| `reset()`               | Back to `initial`. Does **not** re-evaluate the breakpoint                                                        |
| `handleKeydown(event)`  | Hides on `Escape` and calls `preventDefault()` — but only when `closeOnEscape` and the sidebar is visible         |
| `toStore()`             | The `SidebarStore` facade, with `visible` as a write-through accessor                                             |
| `destroy()`             | Removes both listeners and freezes the controller. Idempotent and final                                           |

### Store API

```ts
$store.sidebar.show();
$store.sidebar.hide();
$store.sidebar.toggle();
$store.sidebar.reset();

$store.sidebar.visible; // boolean — mirrored, NOT writable in a useful way
$store.sidebar.isVisible; // boolean
$store.sidebar.matchesBreakpoint; // boolean
$store.sidebar.hasOverlay; // boolean

// The plugin already listens on `document`; call this only if you turned
// closeOnEscape off and want to handle the key yourself.
$store.sidebar.handleKeydown($event);

$store.sidebar.destroy(); // host-owned teardown; nothing calls it for you
```

### Options

`CreateSidebarOptions` is the same bag for the controller and the plugin:

| Option                | Default                 | Description                                                                                     |
| --------------------- | ----------------------- | ----------------------------------------------------------------------------------------------- |
| `id`                  | `generateId("sidebar")` | Controller id. Diagnostic only                                                                  |
| `initial`             | `false`                 | Visibility before anything happens, and what `reset()` returns to                               |
| `closeOnEscape`       | `true`                  | Installs a `document` keydown listener on mount and makes `handleKeydown()` do anything         |
| `closeOnOverlayClick` | `true`                  | Only ever read through `hasOverlay`. Setting it `false` is the whole reason that flag exists    |
| `breakpoint`          | —                       | `{ query, onMismatch }`. Omit it and `matchesBreakpoint` stays `false` for the life of the page |
| `storeKey`            | `"sidebar"`             | `$store` key. Only `undefined`/`null` fall back to the default                                  |
| `magicKey`            | `"sidebar"`             | `$magic` key — `magicKey ?? storeKey ?? "sidebar"`, so renaming the store renames both          |

`breakpoint.onMismatch` is **required** inside the object, so there is no
default: pick `"hide"` to close the drawer when the query stops matching
(the mobile drawer), or `"keep"` to only track it.

### Avoiding name collisions

```ts
Alpine.plugin(sidebarPlugin({ storeKey: "drawer" })); // → $store.drawer and $drawer
```

`storeKey` moves both names, because the magic key follows it. A second claim
on either name throws `RegistrationError` with
`code: 'REGISTRATION_COLLISION'` rather than overwriting. The exported
`DEFAULT_SIDEBAR_STORE_KEY` / `DEFAULT_SIDEBAR_MAGIC_KEY` keep the defaults
discoverable from TypeScript.

### Events

```ts
import type { SidebarChangeDetail } from "@ailura/alpinejs-sidebar";

const off = ctrl.on("change", (detail: SidebarChangeDetail) => {
  detail.visible; // boolean
  detail.matchesBreakpoint; // boolean
  detail.source;
  //   "user"          — show() / hide() / toggle()
  //   "escape"        — the document keydown listener
  //   "breakpoint"    — the MediaQueryList change listener
  //   "reset"         — reset()
  //   "initialization"— queued as a microtask from mount(), previous: null
  detail.previous; // { visible, matchesBreakpoint } | null
});
```

There is exactly one event. `on` returns an unsubscribe function and is
auto-disposed by `destroy()`.

## The breakpoint

```ts
sidebarPlugin({
  breakpoint: {
    query: "(max-width: 1023px)",
    onMismatch: "hide", // or "keep"
  },
});
```

The query is read once on mount through `safeMatchMedia()` and tracked from
there. `"hide"` closes the drawer when the query stops matching, and only when
it was visible — opening it again while the query is false is allowed and will
not be re-closed until the query flips once more.

## SSR

> Import-safe. Nothing reads `window`, `document` or `matchMedia` at module
> scope. `setup()` runs from `mount()`, reads the query through
> `safeMatchMedia()` (which returns `undefined` on the server), and guards its
> `document` keydown listener with `typeof document !== "undefined"`. On the
> server the sidebar is simply `initial` — set that to `true` and the drawer
> server-renders open, then hydrates open.

## Accessibility

The honest version, because the surface here is small:

- **ARIA managed: none.** The package computes no attributes. `aria-expanded`
  on the trigger, `aria-controls` pointing at the drawer, `aria-modal` and the
  labelling of the nav are all yours — bind them against
  `$sidebar.visible`, which is exactly what the boolean is for
- Keyboard: `Escape` closes, via the `document` listener the plugin installs
  itself, so it works without any `@keydown` in your markup. It only fires
  while the sidebar is visible, and it is disabled entirely by
  `closeOnEscape: false`
- Focus: none. Nothing moves focus into the drawer on open, nothing restores it
  to the trigger on close, and there is no focus trap. A sidebar that overlays
  the page needs all three, and they are markup, not store
- Reference: [WAI-ARIA Authoring Practices — Dialog pattern](https://www.w3.org/WAI/ARIA/apg/patterns/dialog/)
  for the drawer-as-modal case, which this package does not implement for you

## Integration

- **@ailura/alpinejs-overlay** — the scroll lock and the stacking layer are the
  overlay's job; this package only tells you `hasOverlay`
- **@ailura/alpinejs-media** — it has a real breakpoint store
  (`$store.media.breakpoint`) that this package deliberately does not use; see
  Limitations
- **@ailura/alpinejs-theme** — nothing here is themed
- **@ailura/alpinejs-ui** — declared as a peer and never imported; see
  Limitations

## Limitations

- **Two dead peer dependencies.** `@ailura/alpinejs-ui` and
  `@ailura/alpinejs-media` are in `peerDependencies` and in
  `deps.neverBundle`, and **no file in `src/` imports either**. The breakpoint
  comes from `@ailura/alpinejs-core/env`'s `safeMatchMedia()`; the overlay flag
  is a boolean. Installing this package therefore drags in two unused
  workspace peers, and `package.json`'s own description credits them for
  behaviour they do not provide. Documented rather than changed — see the
  package's `package.json` if you want to prune them.
- **Writing `$store.sidebar.visible` does nothing useful.** The plugin's store
  is a plain object whose `visible` field `sync()` overwrites on every
  `change`; the write-through accessor only exists on the `toStore()` facade
  the standalone path gets. `$store.sidebar.visible = true` sets a field that
  nothing observes and the next event reverts. Use `show()` / `hide()` /
  `toggle()`.
- **`hasOverlay` is not a preference, it is a derived flag** — and turning off
  `closeOnOverlayClick` switches it off _entirely_, so a sidebar configured
  that way can never report that it needs an overlay, even when it is covering
  the page.
- **A breakpoint change reports a fabricated `previous`.** On the `"keep"`
  path the handler builds `previous` as
  `{ visible: this.#visible, matchesBreakpoint: !e.matches }` — the state
  _after_ the change, not the one before it. Only the `"hide"` path snapshots
  correctly. Do not diff `detail.previous` against `detail` to detect a
  transition.
- **`reset()` ignores the breakpoint.** It restores `initial` and nothing
  else; it does not re-read the media query, so resetting on a phone does not
  re-hide a drawer the query says should be hidden.
- **Without `breakpoint`, `matchesBreakpoint` is `false` forever.** There is no
  default query, so a store that exposes the field without configuring it reads
  as "small screen" nowhere and "large screen" nowhere.
- **`closeOnEscape` installs a document-wide listener.** With it on (the
  default) `Escape` is handled from anywhere on the page, and binding
  `@keydown` on the drawer as well is redundant — harmless, because
  `handleKeydown()` returns early once hidden, but it means you cannot scope
  Escape to the drawer without turning the option off.
- **`SidebarManager` is a declared type with no producer.** Nothing in the
  package constructs one, so `id` and the `on("change", …)` handle it adds are
  not reachable through the plugin or the factory.
- **No focus management, no scroll lock, no transition.** By design — but that
  means a sidebar-as-modal is three features short of accessible.
- **Raw `<button>` triggers are the host's markup**; this package has no
  `*Props()` binding to justify one.

## Size

`3.24 kB raw / 1.18 kB gzip` · budget `3.5 kB` · externalized peers:
`alpinejs`, `@ailura/alpinejs-core`, `@ailura/alpinejs-ui`,
`@ailura/alpinejs-media` · `size-limit` + `publint` + `attw` verified.

The `externalized peers` line is the `neverBundle` list verbatim, which is why
the two unused peers are on it: they are declared, just never imported.

## Architecture

[Features layer](../../ARCHITECTURE.md) — controllers own state, Alpine owns reactivity. See canon, guards, and SSR rules in [ARCHITECTURE.md](../../ARCHITECTURE.md).

## Testing

```sh
pnpm test              # vp test (happy-dom)
pnpm run typecheck     # tsc --noEmit
```

## License

MIT
