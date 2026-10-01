---
title: Media
---

@ailura/alpinejs-media

A `media` store for viewport size, the current breakpoint, dark scheme, and reduced
motion. It listens to the browser's own media queries, so nothing is polled.

## Install

```sh
pnpm add alpinejs @ailura/alpinejs-media
```

## Register the plugin

Do this once, before `Alpine.start()`.

```ts
import Alpine from "alpinejs";
import mediaPlugin from "@ailura/alpinejs-media";

Alpine.plugin(mediaPlugin());

Alpine.start();
```

That registers a `media` store, so everything below is reachable at `$store.media`.

## Minimal example

Read size and the dark preference straight in markup.

```html
<div x-data>
  <p>
    Viewport: <span x-text="$store.media.width"></span> ×
    <span x-text="$store.media.height"></span>
  </p>
  <p>Breakpoint: <span x-text="$store.media.breakpoint"></span></p>
  <p>Dark: <span x-text="$store.media.isDark"></span></p>
  <p>Reduced motion: <span x-text="$store.media.prefersReducedMotion"></span></p>
</div>
```

The values are reactive. `width`, `height` and `breakpoint` come from a debounced
`resize` listener (`debounceMs`, 50 by default); `prefersReducedMotion` and `isDark` come
from the browser's own `matchMedia` queries.

## Respecting reduced motion

This is the one to actually use. Gate anything that animates, and be explicit about
the fallback, because the value is `true` for users who asked for less movement and
nothing else.

```html
<div
  x-data="{ open: false }"
  x-effect="$watch('$store.media.prefersReducedMotion', (reduce) => { if (reduce) open = true; })"
>
  <div x-show="open" x-transition.opacity.duration.200ms>
    <span x-show="!$store.media.prefersReducedMotion" x-transition.opacity.duration.200ms>
      A panel that slides in.
    </span>
    <span x-show="$store.media.prefersReducedMotion">A panel that does not.</span>
  </div>
</div>
```

## Reading the raw preference

`prefersColorScheme` is what the user asked for; `isDark` is the resolved boolean. In
the browser the controller only ever reports `light` or `dark` — `no-preference` is the
value it reports when there is no window to ask, so it shows up in server-rendered markup
before hydration.

```html
<p>Asked for: <span x-text="$store.media.prefersColorScheme"></span></p>
<p>Resolved: <span x-text="$store.media.isDark"></span></p>
```

## API reference

| Name                                | Type   | Purpose                                    |
| ----------------------------------- | ------ | ------------------------------------------ |
| `$store.media.width`                | store  | Viewport width, in pixels.                 |
| `$store.media.height`               | store  | Viewport height, in pixels.                |
| `$store.media.breakpoint`           | store  | The name of the current breakpoint.        |
| `$store.media.prefersReducedMotion` | store  | Whether the user asked for reduced motion. |
| `$store.media.prefersColorScheme`   | store  | `light`, `dark`, or `no-preference`.       |
| `$store.media.isDark`               | store  | The resolved dark boolean.                 |
| `$store.media.refresh()`            | method | Re-read every query. Rarely needed.        |
| `$store.media.destroy()`            | method | Detach the listeners.                      |

:::note[`prefersColorScheme` and `isDark` answer different questions]
Bind to `isDark` to decide what to render, and read `prefersColorScheme` when you want to
label the preference itself. The one case where they diverge is the server-rendered
`no-preference`, which resolves to `isDark: false` until the browser reports a scheme.
:::

## Plugin options

```ts
mediaPlugin({ id: "app-media", storeKey: "viewport" });
```
