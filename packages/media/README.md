# @ailura/alpinejs-media

<p align="center">

[![bundlephobia minzip](https://badgen.net/bundlephobia/minzip/@ailura/alpinejs-media)](https://bundlephobia.com/package/@ailura/alpinejs-media)

</p>

> One reactive `$store.media` — viewport size, named breakpoint, `prefers-reduced-motion` and `prefers-color-scheme` — from a debounced `matchMedia` controller on `@ailura/alpinejs-core`.

## Installation

```sh
pnpm add @ailura/alpinejs-media alpinejs
# or
npm install @ailura/alpinejs-media alpinejs
```

Requires `alpinejs@^3.0.0` as peer. `@ailura/alpinejs-core` is a **peer
dependency**, not a dependency: no package in this toolkit has a
`dependencies` block, so the host installs it too.

## Usage

This package is **store-only**: it registers `$store.media` and nothing else.
There is no magic and no directives.

### 1. Alpine

```ts
import Alpine from "alpinejs";
import mediaPlugin from "@ailura/alpinejs-media";

Alpine.plugin(mediaPlugin());
Alpine.start();
```

```html
<div x-data>
  <p x-text="`${$store.media.width} × ${$store.media.height}`"></p>
  <p x-text="`breakpoint: ${$store.media.breakpoint}`"></p>

  <!-- render one of two layouts -->
  <div x-show="$store.media.breakpoint !== 'md'">Sidebar layout</div>
  <div x-show="$store.media.breakpoint === 'md'">Stacked layout</div>

  <!-- honour the OS motion preference; Alpine's x-collapse and the playground's
       global `prefers-reduced-motion` block do not read this -->
  <div x-show="!$store.media.prefersReducedMotion">Animated</div>
  <div x-show="$store.media.prefersReducedMotion">Still</div>
</div>
```

With custom breakpoint names:

```ts
Alpine.plugin(
  mediaPlugin({
    intervals: { mobile: 0, tablet: 768, desktop: 1024 },
    debounceMs: 120,
  })
);
// → $store.media.breakpoint is "mobile" | "tablet" | "desktop"
```

### 2. Standalone (framework-agnostic)

```ts
import { createMediaController } from "@ailura/alpinejs-media";

// Document-scoped singleton: the second call returns the same controller.
const ctrl = createMediaController({ debounceMs: 200 });
ctrl.breakpoint; // "md"
ctrl.isDark; // false

const off = ctrl.on("change", (detail) => {
  // detail is the full new snapshot plus `previous` and `source`
  if (detail.source === "resize") console.log(detail.previous?.width, "→", detail.width);
});
off();
ctrl.destroy(); // detaches the resize + matchMedia listeners and releases the singleton
```

## API

| Export                    | Description                                                                                                   | Type             |
| ------------------------- | ------------------------------------------------------------------------------------------------------------- | ---------------- |
| `MediaController`         | Controller class — owns one `MediaSnapshot`, emits `change`                                                   | `class`          |
| `createMediaController`   | **Singleton** factory — `(options?) => MediaController`, mounted before return. Same document ⇒ same instance | `function`       |
| `mediaPlugin`             | `Alpine.plugin()` factory — `(options?) => (alpine) => void`; also the package's `default` export             | `function`       |
| `DEFAULT_MEDIA_STORE_KEY` | Default `$store` key — `"media"`                                                                              | `string`         |
| `DEFAULT_MEDIA_INTERVALS` | The default breakpoint table — `{ sm: 640, md: 768, lg: 1024, xl: 1280, "2xl": 1536 }`                        | `MediaIntervals` |
| `CreateMediaOptions`      | Plugin and factory options — `{ id, intervals, debounceMs, scope, storeKey }`                                 | `type`           |
| `MediaSnapshot`           | The tracked values — `{ width, height, breakpoint, prefersReducedMotion, prefersColorScheme, isDark }`        | `type`           |
| `MediaStore`              | `$store.media` — `MediaSnapshot` plus `refresh()` and `destroy()`                                             | `type`           |
| `MediaChangeDetail`       | `change` payload — the new `MediaSnapshot` plus `{ previous, source }`                                        | `type`           |
| `MediaChangeSource`       | `'initialization' \| 'resize' \| 'system' \| 'refresh'`                                                       | `type`           |
| `MediaIntervals`          | Breakpoint name → **min-width** in px. Names are yours; only the numbers matter                               | `type`           |
| `MediaBreakpoint`         | `string` — the name of the largest interval the viewport has reached, or `"base"` below the smallest          | `type`           |
| `MediaEvents`             | Event map — `change: [MediaChangeDetail]`                                                                     | `type`           |
| `MediaPluginCallback`     | `(alpine: Alpine) => void` — the `Alpine.plugin()` callback signature                                         | `type`           |
| `MediaAlpine`             | Alias for the `Alpine` type the plugin callback receives                                                      | `type`           |

`MediaController` exposes `width`, `height`, `breakpoint`, `prefersReducedMotion`
and `isDark` getters plus `snapshot()`, `refresh()` and `destroy()`.

### Store API — `$store.media`

| Member                 | Type                                   | Description                                                        |
| ---------------------- | -------------------------------------- | ------------------------------------------------------------------ |
| `width`                | `number`                               | `window.innerWidth`, or `1024` without a window                    |
| `height`               | `number`                               | `window.innerHeight`, or `768` without a window                    |
| `breakpoint`           | `string`                               | Largest interval name whose min-width the viewport has reached     |
| `prefersReducedMotion` | `boolean`                              | `(prefers-reduced-motion: reduce)`                                 |
| `prefersColorScheme`   | `'light' \| 'dark' \| 'no-preference'` | Derived from `isDark` — see Limitations                            |
| `isDark`               | `boolean`                              | `(prefers-color-scheme: dark)`                                     |
| `refresh()`            | `void`                                 | Re-read every field now and emit `change` with `source: 'refresh'` |
| `destroy()`            | `void`                                 | Detach the listeners **and release the shared singleton**          |

Each of the six data fields is rewritten in place on the reactive store; only
those six re-render a template. They are declared `readonly` on `MediaStore` —
the store is a read surface to your templates, and `refresh()` is the only
supported way to force a re-read.

### Options

```ts
interface CreateMediaOptions {
  id?: string; // controller id — defaults to generateId("media")
  intervals?: MediaIntervals; // default DEFAULT_MEDIA_INTERVALS
  debounceMs?: number; // default 50 — resize coalescing window, in ms
  scope?: object; // singleton cache scope — defaults to `document`
  storeKey?: string; // $store key — default DEFAULT_MEDIA_STORE_KEY
}
```

| Option       | Default                   | Effect                                                                                       |
| ------------ | ------------------------- | -------------------------------------------------------------------------------------------- |
| `intervals`  | `DEFAULT_MEDIA_INTERVALS` | Values are **min-widths in px** and are sorted before matching, so key order does not matter |
| `debounceMs` | `50`                      | `resize` events coalesce for this long; system-preference changes are **not** debounced      |
| `scope`      | `document`                | `createSingleton` cache key. Pass an object to get an isolated instance in tests             |
| `storeKey`   | `"media"`                 | `$store` key, resolved with `resolveStoreKey` (only `undefined`/`null` fall back)            |

There is no `magicKey` and no `DEFAULT_MEDIA_MAGIC_KEY`: the package registers a
store and one name to rename.

### Avoiding name collisions

```ts
Alpine.plugin(mediaPlugin({ storeKey: "viewport" })); // → $store.viewport
```

The claim goes through `guardStore`, so a second plugin taking `"media"` throws
a `RegistrationError` instead of overwriting the first. `DEFAULT_MEDIA_STORE_KEY`
keeps the rename discoverable from TypeScript.

### Events

```ts
import type { MediaChangeDetail } from "@ailura/alpinejs-media";

const off = ctrl.on("change", (detail: MediaChangeDetail) => {
  detail.width; // the new value
  detail.previous; // MediaSnapshot | null — null only on `initialization`
  detail.source; // 'initialization' | 'resize' | 'system' | 'refresh'
});
```

`source` tells you what to trust:

| Source           | Emitted when                                                | Debounced |
| ---------------- | ----------------------------------------------------------- | --------- |
| `initialization` | Once, on a microtask after `mount()`                        | —         |
| `resize`         | `window` fired `resize` and the width/height actually moved | Yes       |
| `system`         | `prefers-reduced-motion` or `prefers-color-scheme` changed  | No        |
| `refresh`        | `refresh()` was called and something moved                  | —         |

An event only fires when at least one field actually changed, so a resize that
does not cross a threshold is silent. That silence is also why `previous` is not
always the value you last saw in a handler — it is the previous _emitted_
snapshot.

## SSR

> SSR-safe — no `window`/`document` at import time. Every DOM access goes through
> `safeWindow()`/`safeMatchMedia()` from `@ailura/alpinejs-core/env`.

Without a window `mount()` attaches no `resize` or `matchMedia` listener, but it
still queues one `change` with `source: 'initialization'` and `previous: null` on
a microtask — so a server subscriber is not left waiting for an event that will
never come. The server snapshot is fixed at:

```ts
{ width: 1024, height: 768, breakpoint: "lg", prefersReducedMotion: false, prefersColorScheme: "no-preference", isDark: false }
```

`breakpoint` is resolved from `width: 1024` against your intervals, so with
custom intervals the name follows the numbers, not a hard-coded default. This is
a placeholder viewport, not a guess: there is no server-side viewport to read. On
the client the store is filled from the real measurement before
`Alpine.start()` returns, so the placeholder only ever reaches a **server-rendered
HTML string** — gate markup on something client-only if the difference matters.

The singleton is also SSR-safe: `createSingleton` falls back to a fresh scope
object per call when there is no `document`, so instances never leak across
requests.

## Accessibility

> This is a `Primitives` package and ships **no ARIA and no key bindings.** It
> is a value store; wiring `aria-hidden`, focus or key handling is the host's.

`prefersReducedMotion` is the one field with an accessibility use, and the only
thing the package does is report the media query — it never animates anything.
Note that `x-transition` and `x-collapse` set `transition` inline, so a
`motion-reduce:` utility on the element loses to it; gate on the store instead:

```html
<div x-show="$store.media.prefersReducedMotion ? false : open">…</div>
```

## Integration

- **@ailura/alpinejs-sidebar** — the responsive-overlay pattern is
  `sidebar({ breakpoint: { query, onMismatch } })`, which takes its own
  `matchMedia` query. `$store.media.breakpoint` is the JS-side value for
  everything else.
- **@ailura/alpinejs-theme** — owns the resolved light/dark decision and its
  persistence. `$store.media.isDark` is the un-owned raw query, useful for
  diagnostics; do not branch product behaviour on it when `theme` is installed.

## Limitations

- **`prefersColorScheme` never reports `"no-preference"` in a browser.** It is
  derived as `isDark ? 'dark' : 'light'`, so a user with no preference is
  reported as `light`. The three-value union in `MediaSnapshot` is what the
  _server_ default uses. Branch on `isDark` if you need the binary truth.
- **`MediaController` has no `prefersColorScheme` getter.** It is only reachable
  through `snapshot()` — the store projects it, the controller does not.
- **`createMediaController()` is a singleton per scope.** Two calls in one
  document return the _same_ instance, so the second `on('change')` sees every
  event and the second `mount()` never runs. Use `new MediaController(options)`
  when you deliberately want a second one.
- **`destroy()` on the store takes the shared controller with it.** Because the
  controller is a singleton, one caller destroying it leaves every other
  `$store.media` reading frozen values — the listeners are gone and nothing
  re-registers them. `destroy()` is a test-teardown and page-teardown handle,
  not a per-component one.
- **Two `mediaPlugin()` registrations share one controller** but get two stores,
  each its own reactive object, both fed by the same subscription. Harmless, but
  `$store.media` on the second key is a projection, not a second measurement.
- **`readMediaSnapshotBase()` in `src/internal/media-query.ts` is dead.** It
  duplicates the first half of `MediaController.#readSnapshot()` and nothing
  calls it; the controller's private reader is the live one.
- **`intervals` with a zero minimum never yields `"base"`.** A width below the
  smallest interval reports `"base"`; a table starting at `0` (as the playground
  does with `mobile: 0`) has no such band, so `"base"` is unreachable.
- **`debounceMs` applies to `resize` only.** A `prefers-color-scheme` flip
  reaches the store immediately even with a large debounce window.

## Size

`3.75 kB raw / 1.39 kB gzip` · budget `5 kB` · externalized peers: `alpinejs`, `@ailura/alpinejs-core` · `size-limit` + `publint` + `attw` verified.

## Architecture

[Primitives layer](../../ARCHITECTURE.md) — controllers own state, Alpine owns reactivity. See canon, guards, and SSR rules in [ARCHITECTURE.md](../../ARCHITECTURE.md).

## Testing

```sh
pnpm test              # vp test (happy-dom)
pnpm run typecheck     # tsc --noEmit
```

`createSingleton` caches per document, so a test that mounts the controller and
a later test that calls `createMediaController()` again get the same instance
unless you pass an explicit `scope` or call `clearAllSingletons()`.

## License

MIT
