---
title: Carousel
---

@ailura/alpinejs-carousel

A carousel on top of Embla: drag, autoplay, loop, and the ARIA wiring for a slide
region. The plugin owns the index and the engine; you write the viewport, the slides,
and the controls.

## Install

```sh
pnpm add alpinejs @ailura/alpinejs-carousel embla-carousel
```

Autoplay is a separate package that the plugin imports on demand, and it is not a
declared peer: install it yourself if you pass `autoplay: true`.

```sh
pnpm add embla-carousel-autoplay
```

The import is wrapped in a bare `catch {}`, so a missing package fails silently — the
carousel still works, it just never advances on its own.

## Register the plugin

Do this once, before `Alpine.start()`.

```ts
import Alpine from "alpinejs";
import carouselPlugin from "@ailura/alpinejs-carousel";

Alpine.plugin(carouselPlugin());

Alpine.start();
```

That registers a `carousel` store, so everything below is reachable at `$store.carousel`.

## Minimal example

Three slides, next and previous, with the region and slide roles bound.

```html
<div
  x-data="{ id: 'gallery' }"
  x-init="$store.carousel.create(id, { loop: false, autoplay: false })"
  @keydown="$store.carousel.handleKeydown(id, $event)"
>
  <section x-bind="$store.carousel.carouselProps(id, { label: 'Gallery' })">
    <div x-bind="$store.carousel.viewportProps(id)" x-carousel="id">
      <template x-for="(slide, index) in ['One', 'Two', 'Three']" :key="slide">
        <div x-bind="$store.carousel.slideProps(id, index)">
          <span x-text="slide"></span>
        </div>
      </template>
    </div>
  </section>

  <button @click="$store.carousel.previous(id)" :disabled="!$store.carousel.canPrevious(id)">
    Previous
  </button>
  <button @click="$store.carousel.next(id)" :disabled="!$store.carousel.canNext(id)">Next</button>
</div>
```

Embla has to know the viewport element before it can measure anything, so the store
needs a reference to the DOM. `x-carousel` is what hands it over: its expression is the
instance id, and it releases the binding when Alpine removes that element. The
hand-written `$store.carousel.bindViewport(id, el)` still works and is what you reach
for when the element is not a plain template node.

## Variants

**Loop forever.** With `loop: false` the controls disable at the ends, which is the
honest default for a finite gallery.

```js
$store.carousel.create(id, { loop: true });
```

**Autoplay, and tune it.** `autoplay` is a boolean switch; the delay and Embla's
stop-on-interaction behavior live in `autoplayOptions`.

```js
$store.carousel.create(id, {
  autoplay: true,
  autoplayOptions: { delay: 4000, stopOnInteraction: true },
});
```

Only two `autoplayOptions` reach Embla today: `delay` (default `4000`) and
`stopOnInteraction` (default `true`). `stopOnMouseEnter`, `stopOnFocusIn` and
`stopWhenHidden` are declared on the type and accepted by the compiler, but the plugin
does not forward them — setting them changes nothing at runtime.

**Drive it from code.** `play()` and `goTo()` are there when the trigger is something
other than a button on the slide. `play()` calls Embla's autoplay plugin for real;
`pause()` only flips the `isPlaying` flag and never reaches the engine, so the carousel
keeps advancing on its own after you press it.

```js
$store.carousel.play(id);
$store.carousel.goTo(id, 2);
```

**React to slide changes.** `onChange` receives the new index.

```js
$store.carousel.create(id, { onChange: (index) => track("slide", index) });
```

## API reference

| Name                                                       | Type     | Purpose                                                                                                                                               |
| ---------------------------------------------------------- | -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| `$store.carousel.create(id, options?)`                     | `method` | Create an instance. Options: `loop`, `autoplay`, `autoplayOptions`, `axis`, `align`, `containScroll`, `dragFree`, `duration`, `ariaLive`, `onChange`. |
| `$store.carousel.destroy(id)`                              | `method` | Tear one instance down.                                                                                                                               |
| `$store.carousel.destroyAll()`                             | `method` | Tear every instance down.                                                                                                                             |
| `$store.carousel.next(id)` / `previous(id)`                | `method` | Move one slide.                                                                                                                                       |
| `$store.carousel.goTo(id, index)`                          | `method` | Jump to a slide by index.                                                                                                                             |
| `$store.carousel.current(id)`                              | `method` | The current index.                                                                                                                                    |
| `$store.carousel.count(id)`                                | `method` | How many slides.                                                                                                                                      |
| `$store.carousel.canNext(id)` / `canPrevious(id)`          | `method` | Whether moving is possible; drives the disabled state.                                                                                                |
| `$store.carousel.play(id)` / `pause(id)` / `isPlaying(id)` | `method` | Autoplay control. `play()` drives Embla's plugin; `pause()` only flips the reported `isPlaying` flag.                                                 |
| `$store.carousel.bindViewport(id, el)`                     | `method` | Hand Embla the viewport element. Required before measuring.                                                                                           |
| `$store.carousel.handleKeydown(id, event)`                 | `method` | Arrow keys. Required for keyboard support.                                                                                                            |
| `$store.carousel.viewportProps(id, options?)`              | `method` | The scrollable viewport: `tabindex` and the `--slide-size` custom property. Pass `{ slideSize: false }` to skip it.                                   |
| `$store.carousel.slideProps(id, index)`                    | `method` | `role="group"`, `aria-roledescription`, `aria-label`, `aria-hidden` for one slide.                                                                    |
| `$store.carousel.indicatorProps(id, index)`                | `method` | `type`, `aria-label`, `aria-current` for a dot indicator.                                                                                             |
| `$store.carousel.carouselProps(id, options?)`              | `method` | `role="region"`, `aria-roledescription`, `aria-live`, and the `aria-label` from `{ label }`. Bind on the outer wrapper.                               |
| `$store.carousel.instances`                                | `store`  | Reactive registry of every instance.                                                                                                                  |

## Directives

| Name              | Type        | Purpose                                                                                                                           |
| ----------------- | ----------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `x-carousel="id"` | `directive` | Binds the element to the instance whose id the expression evaluates to, and releases the binding when Alpine removes the element. |

The release is element-scoped: the Embla engine bound to that viewport is destroyed and
the element reference is dropped, while the instance itself stays in
`$store.carousel.instances` for its controls to keep driving it. An expression that is
not a string binds nothing. The directive name is configurable with
`directiveKey`.

:::caution[Hand-written `bindViewport` still fails quietly]
With `x-carousel` on the element there is nothing to forget. If you bind by hand
instead, nothing throws when the viewport is never bound: the slides render, the
buttons change the index, and nothing moves — which looks like a CSS problem and sends
people debugging the wrong file. A hand-written binding is also never released; only
`destroy(id)` or the directive's own cleanup takes it away.
:::

## Plugin options

```ts
carouselPlugin({ id: "app-carousel", storeKey: "gallery", directiveKey: "carousel" });
```
