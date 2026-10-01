# @ailura/alpinejs-carousel

<p align="center">

[![bundlephobia minzip](https://badgen.net/bundlephobia/minzip/@ailura/alpinejs-carousel)](https://bundlephobia.com/package/@ailura/alpinejs-carousel)

</p>

> Alpine.js headless carousel store — Embla Carousel under the hood, one `x-carousel` attribute per viewport, autoplay, loop, multi-slide sizing and ARIA helpers on @ailura/alpinejs-core.

## Installation

```sh
pnpm add @ailura/alpinejs-carousel alpinejs
# or
npm install @ailura/alpinejs-carousel alpinejs
```

Requires `alpinejs@^3.0.0` and `embla-carousel@^8.0.0` as peers, plus
`@ailura/alpinejs-core` for the controller base — all **peer dependencies**,
since no package in this toolkit has a `dependencies` block. The Embla
engine is reached through a dynamic `import("embla-carousel")` inside
`bindViewport()`, so it never lands in the initial bundle.

If you pass `autoplay: true` you also need `embla-carousel-autoplay@^8.0.0`
installed — see [Limitations](#limitations).

## Usage

### 1. Standalone (framework-agnostic)

```ts
import { createCarouselController } from "@ailura/alpinejs-carousel";

const ctrl = createCarouselController(); // already mounted
ctrl.create("hero", { loop: true, align: "center" });
ctrl.bindViewport("hero", document.querySelector<HTMLElement>("#viewport"));

ctrl.on("slideChange", (detail) => {
  console.log(detail.carouselId, detail.index, detail.totalSlides);
});
ctrl.on("change", (detail) => console.log(detail.carouselId));

ctrl.next("hero");
ctrl.current("hero"); // number
ctrl.count("hero"); // number
ctrl.snapshotInstances().hero; // a plain CarouselInstance snapshot

ctrl.destroy("hero"); // drop one instance and its engine
// ctrl.destroy() when done — every mutating method after destroy is a silent no-op
```

The controller owns all mutable state and is safe to drive from any stack —
Blade, Livewire, Astro, or plain TypeScript. It reads the DOM only inside
`bindViewport()`, and only after you hand it an element.

### 2. Alpine

```ts
import Alpine from "alpinejs";
import carouselPlugin from "@ailura/alpinejs-carousel";

Alpine.plugin(carouselPlugin());
Alpine.start();
```

```html
<div x-data>
  <!-- x-carousel creates the instance AND binds this element as its viewport -->
  <div
    x-carousel="{ id: 'hero', loop: true }"
    x-bind="$store.carousel.viewportProps('hero')"
    @keydown="$store.carousel.handleKeydown('hero', $event)"
    class="overflow-hidden"
  >
    <div class="flex">
      <div x-bind="$store.carousel.slideProps('hero', 0)" style="flex: 0 0 100%">One</div>
      <div x-bind="$store.carousel.slideProps('hero', 1)" style="flex: 0 0 100%">Two</div>
      <div x-bind="$store.carousel.slideProps('hero', 2)" style="flex: 0 0 100%">Three</div>
    </div>
  </div>

  <button @click="$store.carousel.previous('hero')">Prev</button>
  <button @click="$store.carousel.next('hero')">Next</button>
</div>
```

The plugin registers `$store.carousel` and the `x-carousel` directive. There is
no magic.

## API

### Exports

| Export                       | Description                                                                                                                                                             | Type       |
| ---------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| `CarouselController`         | Framework-agnostic controller class — owns instances, emits `change` and `slideChange`, `toStore()`                                                                     | `class`    |
| `createCarouselController`   | Factory — `createCarouselController(options?) => CarouselController`; constructs **and mounts** the controller                                                          | `function` |
| `carouselPlugin`             | Alpine plugin factory — `carouselPlugin(options?) => AlpineCallback`; also the package `default` export                                                                 | `function` |
| `DEFAULT_CAROUSEL_STORE_KEY` | Default `$store` key — `"carousel"`                                                                                                                                     | `string`   |
| `CarouselControllerOptions`  | Controller factory options — `{ id }`                                                                                                                                   | `type`     |
| `CreateCarouselOptions`      | Plugin options — `{ id, storeKey, directiveKey }`                                                                                                                       | `type`     |
| `CarouselOptions`            | Engine options passed to Embla — `loop`, `autoplay`, `axis`, `align`, `containScroll`, `dragFree`, `duration`, `ariaLive`, `onChange`                                   | `type`     |
| `CarouselAutoplayOptions`    | Autoplay sub-options — see the table below; three of the five are never forwarded                                                                                       | `type`     |
| `CarouselAlign`              | `"start" \| "center" \| "end" \| (viewSize, snapSize, index) => number`                                                                                                 | `type`     |
| `CarouselContainScroll`      | `"trimSnaps" \| "keepSnaps" \| false`                                                                                                                                   | `type`     |
| `CarouselInstance`           | Snapshot of one carousel — `currentIndex`, `totalSlides`, `progress`, `isFirst`, `isLast`, `isPlaying`, `canNext`, `canPrevious`, `slidesInView`, `options`, `ariaLive` | `type`     |
| `CarouselStore`              | Alpine-facing store surface, including `instances`                                                                                                                      | `type`     |
| `CarouselEvents`             | Event map for `controller.on(…)`                                                                                                                                        | `type`     |
| `CarouselChangeDetail`       | `change` payload — `{ carouselId?: string }`. Optional in the type, though every emit the controller makes sets it                                                      | `type`     |
| `CarouselSlideChangeDetail`  | `slideChange` payload — `{ carouselId, index, totalSlides }`                                                                                                            | `type`     |
| `CarouselAlpine`             | Typed view of `Alpine` used by the plugin (an alias for Alpine's own)                                                                                                   | `type`     |
| `CarouselPluginCallback`     | `(alpine: Alpine) => void`                                                                                                                                              | `type`     |

### Controller API

`CarouselController` also carries the two adapter helpers the plugin uses, and
three public methods that are not on the store:

| Method                | Description                                                                                                                  |
| --------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `hasInstance(id)`     | Whether an instance is registered. `true` from the moment `create()` is called, before the Embla engine has resolved         |
| `snapshotInstances()` | A fresh `Record<string, CarouselInstance>` of plain copies — never the private registry                                      |
| `toStore()`           | The `CarouselStore` facade the plugin registers                                                                              |
| `destroy(id?)`        | With an id: destroy that engine and drop the instance. **Without** an id: destroy every instance _and_ freeze the controller |

`create()` is idempotent per id and merges: calling it twice with the same id
`Object.assign`s the new options over the existing ones.

### Store API

```ts
// Lifecycle — the directive does both of these for you
$store.carousel.create("hero", { loop: true });
$store.carousel.bindViewport("hero", document.querySelector("#viewport"));
$store.carousel.destroy("hero");
$store.carousel.destroyAll();

// Navigation
$store.carousel.next("hero");
$store.carousel.previous("hero");
$store.carousel.goTo("hero", 2);

// Reads
$store.carousel.current("hero"); // number
$store.carousel.count("hero"); // number
$store.carousel.canNext("hero"); // boolean
$store.carousel.canPrevious("hero"); // boolean
$store.carousel.instances.hero; // CarouselInstance snapshot (reactive)

// Autoplay
$store.carousel.play("hero");
$store.carousel.pause("hero"); // see Limitations — reports only, does not stop Embla
$store.carousel.isPlaying("hero");

// Keyboard
$store.carousel.handleKeydown("hero", $event);

// ARIA + layout helpers
$store.carousel.carouselProps("hero", { label: "Featured" });
// → { role, 'aria-roledescription', 'aria-live', 'aria-label' }
$store.carousel.viewportProps("hero"); // → { tabindex, style: '--slide-size: 100%' }
$store.carousel.viewportProps("cards", { slideSize: false }); // → { tabindex } only
$store.carousel.slideProps("hero", 0); // → { role, 'aria-roledescription', 'aria-label', 'aria-hidden' }
$store.carousel.indicatorProps("hero", 0); // → { type, 'aria-label', 'aria-current' }
```

| Method                            | Description                                                                                                                                         |
| --------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| `create(id, options?)`            | Registers `id`, or merges `options` into it. Emits `change` synchronously                                                                           |
| `bindViewport(id, el)`            | Points `el` at the instance and builds the engine asynchronously. `el = null` destroys the engine and keeps the instance                            |
| `destroy(id)`                     | Destroys the engine and removes the instance. A missing id is a no-op                                                                               |
| `destroyAll()`                    | Every instance, without freezing the controller                                                                                                     |
| `next(id)` / `previous(id)`       | One snap forward/back. Silent no-op until the engine has resolved                                                                                   |
| `goTo(id, index)`                 | `scrollTo(index)`. Clamping is Embla's, not the controller's                                                                                        |
| `current(id)`                     | Selected snap index, `0` for an id that does not exist                                                                                              |
| `count(id)`                       | Number of snaps, `0` until the engine resolves — **not** the number of slide elements                                                               |
| `canNext(id)` / `canPrevious(id)` | Embla's `canScrollNext` / `canScrollPrev`, so both are `true` when `loop: true`                                                                     |
| `play(id)`                        | Calls the Embla autoplay plugin's `play()`, then sets `isPlaying = true`                                                                            |
| `pause(id)`                       | Sets `isPlaying = false` and **nothing else** — see Limitations                                                                                     |
| `isPlaying(id)`                   | The reported flag, not a query against the engine                                                                                                   |
| `handleKeydown(id, e)`            | `ArrowLeft`/`ArrowUp` → previous, `ArrowRight`/`ArrowDown` → next, `Home` → 0, `End` → last. Each calls `preventDefault()`                          |
| `carouselProps(id, opts?)`        | `role="region"`, `aria-roledescription="carousel"`, the instance's `aria-live`, and `opts.label` as `aria-label`                                    |
| `viewportProps(id, opts?)`        | `tabindex="0"`, plus `style="--slide-size: <opts.slideSize ?? '100%'>"` unless `slideSize: false`. Ignores `id`                                     |
| `slideProps(id, index)`           | `role="group"`, `aria-roledescription="slide"`, `aria-label="<index+1> of <count>"`, and `aria-hidden` on every slide that is not the selected snap |
| `indicatorProps(id, index)`       | `type="button"`, `aria-label="Go to slide N"`, `aria-current="true"` on the selected one                                                            |
| `instances`                       | `Record<string, CarouselInstance>` of snapshots, written by the plugin on every `change`                                                            |

### Options

Plugin:

```ts
type CreateCarouselOptions = {
  id?: string; // controller id — defaults to generateId("carousel")
  storeKey?: string; // $store key — default DEFAULT_CAROUSEL_STORE_KEY ("carousel")
  directiveKey?: string; // directive name without `x-` — default "carousel"
};
```

| Option         | Default      | Description                                                                                                        |
| -------------- | ------------ | ------------------------------------------------------------------------------------------------------------------ |
| `id`           | generated    | `generateId("carousel")`. Only used for diagnostics — nothing reads it                                             |
| `storeKey`     | `"carousel"` | `$store` key the plugin registers under. Only `undefined` falls back to the default, so `storeKey: ""` is honoured |
| `directiveKey` | `"carousel"` | Renames the directive to e.g. `x-carousel-hero`. `guardDirective` still applies                                    |

Engine — `CarouselOptions`, read inside `bindViewport()` when Embla is built:

| Option                              | Default                       | Description                                                           |
| ----------------------------------- | ----------------------------- | --------------------------------------------------------------------- |
| `loop`                              | `false`                       | Wraps the container so the last slide leads into the first            |
| `autoplay`                          | `false`                       | Loads `embla-carousel-autoplay` and attaches it                       |
| `autoplayOptions.delay`             | `4000`                        | Milliseconds between advances                                         |
| `autoplayOptions.stopOnInteraction` | `true`                        | Any scroll/select stops the timer for good                            |
| `autoplayOptions.stopOnMouseEnter`  | declared, **never forwarded** | —                                                                     |
| `autoplayOptions.stopOnFocusIn`     | declared, **never forwarded** | —                                                                     |
| `autoplayOptions.stopWhenHidden`    | declared, **never forwarded** | —                                                                     |
| `axis`                              | `"x"`                         | `"x"` or `"y"`                                                        |
| `align`                             | `"start"`                     | Snap alignment, or a function `(viewSize, snapSize, index) => number` |
| `containScroll`                     | `"trimSnaps"`                 | `"trimSnaps" \| "keepSnaps" \| false`                                 |
| `dragFree`                          | `false`                       | Free scrolling instead of snapping to the nearest slide               |
| `duration`                          | `25`                          | Embla's scroll duration, in its own units                             |
| `ariaLive`                          | `"polite"`                    | Read back through `carouselProps(id)` and `instances[id].ariaLive`    |
| `onChange`                          | —                             | `(index) => void`, called on every selected-snap change               |

### Avoiding name collisions

If your application — or another toolkit plugin — already owns
`$store.sidebar`'s neighbour `$store.carousel`, or the `x-carousel`
attribute, move either name without touching the controller:

```ts
Alpine.plugin(carouselPlugin({ storeKey: "hero" })); // → $store.hero
Alpine.plugin(carouselPlugin({ directiveKey: "embla" })); // → x-embla
```

Both go through the same guards as every other toolkit registration, so a second
claim throws `RegistrationError` with
`code: 'REGISTRATION_COLLISION'` rather than silently overwriting. The exported
`DEFAULT_CAROUSEL_STORE_KEY` keeps the default name discoverable from
TypeScript. The directive's default is **not** exported — `DEFAULT_CAROUSEL_DIRECTIVE_KEY`
lives in `src/types.ts` but not in the barrel, so `directiveKey` has no
discoverable constant.

### Events

```ts
import type { CarouselChangeDetail, CarouselSlideChangeDetail } from "@ailura/alpinejs-carousel";

const off = ctrl.on("slideChange", (detail: CarouselSlideChangeDetail) => {
  detail.carouselId; // string
  detail.index; // number — the selected snap
  detail.totalSlides; // number — snap count, not slide-element count
});

ctrl.on("change", (detail: CarouselChangeDetail) => {
  detail.carouselId; // string | undefined
});
```

`change` is the coarse signal and fires on create, destroy, every scroll-driven
`sync()` and every `play()`/`pause()`. `slideChange` is the fine one, and only
fires when the selected snap actually changed. The plugin subscribes to both,
which is why `instances` stays fresh.

## The `x-carousel` directive

This is the part that replaces wiring by hand. `x-carousel` creates the
instance **and** binds the element it sits on as that instance's viewport, in
one attribute, with no `$nextTick` and no `querySelector`:

```html
<!-- a bare quoted string is the instance id -->
<div x-carousel="'hero'">…</div>

<!-- or an options bag; `id` belongs to the directive, not to CarouselOptions -->
<div x-carousel="{ id: 'hero', loop: true, axis: 'y' }">…</div>

<!-- no id at all: one is generated and written to data-carousel-id -->
<div x-carousel="{ loop: true }">…</div>
```

The expression is evaluated, so `x-carousel="id"` with an `id` in scope binds
that variable's value — it is not the literal string `"id"`.

**`.viewport` binds without creating.** Use it when the host created the
instance elsewhere and the attribute should only point at it:

```html
<div x-init="$store.carousel.create('hero', { loop: true })">
  <div x-carousel.viewport="'hero'">…</div>
</div>
```

**The release is the directive's own `cleanup()`.** Alpine 3.17 gives a plugin
no teardown — `plugin()` discards the callback's return value — so
`cleanupElement` draining `el._x_cleanups` is the only mechanism the runtime
really invokes. When the element leaves the tree, `data-carousel-id` is removed
and `bindViewport(id, null)` destroys the Embla engine. The **instance survives
it**, so controls outside the viewport keep working and a new viewport can be
bound to the same id later.

## Autoplay

```html
<div x-carousel="{ id: 'hero', autoplay: true, autoplayOptions: { delay: 2500 } }">…</div>
```

Only `delay` and `stopOnInteraction` reach the Embla autoplay plugin. The other
three fields on `CarouselAutoplayOptions` are read by no code path in this
package — hover, focus-in and tab-visibility therefore do **not** stop the
timer. `play()` reaches the engine; `pause()` does not.

## SSR

> Import-safe. Nothing reads `window`, `document` or `matchMedia` at module
> scope. `bindViewport()` re-checks `typeof window`/`typeof document` before
> touching the DOM and loads Embla through a dynamic `import()` inside the
> browser only, so the engine and its `ResizeObserver` never exist on the
> server. A carousel server-renders as plain markup — every slide visible — and
> becomes a carousel once Alpine boots.

## Accessibility

- Roles/attributes managed: `carouselProps()` gives the wrapper
  `role="region"` + `aria-roledescription="carousel"` + `aria-live` (from the
  instance's `ariaLive`, default `polite`) + your `aria-label`;
  `viewportProps()` makes the viewport focusable with `tabindex="0"`;
  `slideProps()` gives each slide `role="group"`,
  `aria-roledescription="slide"`, `aria-label="N of M"` and `aria-hidden`;
  `indicatorProps()` gives each dot `type="button"`,
  `aria-label="Go to slide N"` and `aria-current` on the selected one
- Keyboard: `handleKeydown()` on the viewport — `ArrowLeft`/`ArrowUp` previous,
  `ArrowRight`/`ArrowDown` next, `Home` first snap, `End` last snap. Each calls
  `preventDefault()`. Embla's own drag and wheel handling are untouched
- Focus: no trap and no focus management. The viewport is a single tab stop
  (that is what `tabindex="0"` is for); the dots are ordinary buttons after it
- Reference: [WAI-ARIA Authoring Practices — Carousel pattern](https://www.w3.org/WAI/ARIA/apg/patterns/carousel/)
- **Caveat:** `slideProps()` marks every slide that is not the _selected snap_
  `aria-hidden`, which is correct for a one-visible-slide carousel and wrong for
  a multi-visible one — with `viewportProps(id, { slideSize: '45%' })` the
  partially visible neighbour is hidden from assistive tech while still on
  screen. Drive `aria-hidden` yourself if you show several at once.

## Integration

- **@ailura/alpinejs-overlay** — the carousel's store holds no z-index; wrap it
  in an overlay or a `x-teleport="#overlay-root"` if it must sit above the page
- **@ailura/alpinejs-theme** — nothing here is themed; slides and dots are your
  markup's classes
- **@ailura/alpinejs-toast** — a natural target for a `CarouselOptions.onChange`
  callback that announces the new slide
- **embla-carousel** — the engine. Autoplay adds a second peer, see below

## Limitations

- **`pause()` does not pause.** It flips `isPlaying` to `false` and emits
  `change`; it never calls the Embla autoplay plugin's `pause()`, so the
  carousel keeps advancing while the store says it stopped. `isPlaying` is a
  reported flag, not a query against the engine. `play()` _does_ reach the
  engine, so the pair is asymmetric. Stopping autoplay is left to Embla's own
  `stopOnInteraction`.
- **Autoplay needs a peer this package does not declare.** `autoplay: true`
  loads `embla-carousel-autoplay` through a dynamic import inside a bare
  `try {} catch {}`. The package lists it in `devDependencies` and in
  `deps.neverBundle`, but **not** in `peerDependencies` — so on an app that
  installs only the declared peers the import fails, the catch swallows it, and
  the carousel simply never autoplays with no error anywhere. Install
  `embla-carousel-autoplay` yourself.
- **`stopOnMouseEnter`, `stopOnFocusIn` and `stopWhenHidden` are inert.** They
  are declared on `CarouselAutoplayOptions` and forwarded to nothing.
- **`count(id)` is a snap count, not a slide count.** It is `0` until the engine
  resolves, so `slideProps(id, i).aria-label` reads `"1 of 0"` for the first
  tick or two after mount.
- **Options changed after binding do not reach Embla.** `create()` on an
  existing id merges into the options record, but the engine was already built
  from the old ones. Re-bind with `bindViewport(id, null)` then
  `bindViewport(id, el)`.
- **`viewportProps()` ignores its `id`.** It is static apart from the options
  argument — the viewport's `tabindex` and `--slide-size` never depend on
  instance state.
- **`destroy()` with no id freezes the controller.** Every later `create()`,
  `bindViewport()` or `play()` returns silently. `destroyAll()` is the
  instance-scoped version.
- **`DEFAULT_CAROUSEL_DIRECTIVE_KEY` is not exported** from the package
  entrypoint, so `directiveKey`'s default is not discoverable from TypeScript.
- No focus trap, no scroll-snap polyfill, no touch gestures of its own — those
  are Embla's, reached because the engine is the one mounted.

## Size

`5.97 kB raw / 2.23 kB gzip` · budget `12 kB` · externalized peers:
`alpinejs`, `@ailura/alpinejs-core`, `embla-carousel`, `embla-carousel-autoplay`
· `size-limit` + `publint` + `attw` verified.

The budget is 12 kB — four times the package's own footprint — because Embla
itself is a peer: `dist/index.mjs` measures the Alpine surface alone, and the
`neverBundle` list keeps the ~30 kB engine out of it. The figure above is that
external surface, not the wheel.

## Architecture

[Features layer](../../ARCHITECTURE.md) — controllers own state, Alpine owns reactivity. See canon, guards, and SSR rules in [ARCHITECTURE.md](../../ARCHITECTURE.md).

## Testing

```sh
pnpm test              # vp test (happy-dom)
pnpm run typecheck     # tsc --noEmit
```

## License

MIT
