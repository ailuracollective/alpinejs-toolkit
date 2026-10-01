# @ailura/alpinejs-gesture

<p align="center">

[![bundlephobia minzip](https://badgen.net/bundlephobia/minzip/@ailura/alpinejs-gesture)](https://bundlephobia.com/package/@ailura/alpinejs-gesture)

</p>

> Alpine.js headless gesture recognition — tap, doubletap, longpress, swipe, pan and pinch from Pointer Events, on `@ailura/alpinejs-core`.

## Installation

```sh
pnpm add @ailura/alpinejs-gesture alpinejs
# or
npm install @ailura/alpinejs-gesture alpinejs
```

Requires `alpinejs@^3.0.0` as peer. `@ailura/alpinejs-core` is a **peer
dependency**, not a dependency: no package in this toolkit has a
`dependencies` block, so the host installs it too.

## Usage

### 1. Standalone (framework-agnostic)

```ts
import { createGestureController } from "@ailura/alpinejs-gesture";

const surface = document.querySelector("#cards")!;

const gestures = createGestureController({ element: surface });
gestures.mount();

gestures.on("swipe", (detail) => {
  console.log(detail.direction, detail.velocityX, detail.velocityY);
});

gestures.on("pan", (detail) => {
  if (detail.phase !== "end") card.style.transform = `translateX(${detail.distanceX}px)`;
});

gestures.on("longpress", ({ x, y }) => openContextMenu(x, y));

// gestures.destroy() when done — detaches the four listeners, clears the timer
```

`createGestureController(options?)` does **not** mount. Pass `element` in the
options and call `mount()`, or skip both and call `attach(el)` later — the
controller follows exactly one element at a time, so `attach()` detaches from
the previous one.

### 2. Alpine

```ts
import Alpine from "alpinejs";
import gesturePlugin from "@ailura/alpinejs-gesture";

Alpine.plugin(gesturePlugin());
Alpine.start();
```

The plugin registers `$store.gesture` and the `x-gesture` directive. Every
element carrying `x-gesture` gets **its own recognizer**, so several surfaces on
a page work independently.

```html
<div x-data="{ onSwipe(d) { console.log(d.direction) } }">
  <div x-gesture.tap="onTap" x-gesture.swipe="onSwipe">Tap or swipe me</div>
  <div x-gesture.pan="onPan">Drag me</div>
  <div x-gesture.pinch="onPinch">Pinch me</div>
</div>
```

Modifiers: `.tap`, `.doubletap`, `.longpress`, `.swipe`, `.pan`, `.pinch`. A bare
`x-gesture="handler"` is a `.tap`. The handler is called with the gesture detail
as its first argument and the merged `x-data` scope as `this` — the same
contract as `x-on`.

> **Give the surface `touch-action: none`** (Tailwind: `touch-none`) whenever a
> gesture has to win over the browser's own panning or pinch-zoom. Without it
> the page scrolls and the handler never sees the move.

## API

### Exports

| Export                          | Description                                                                                                                                                                                                                                                                                 | Type       |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| `GestureController`             | The recognizer class. Getters `state` and `isTracking`; methods `mount`, `attach(el)`, `detach`, `cancel`, `destroy`                                                                                                                                                                        | `class`    |
| `createGestureController`       | `createGestureController(options?) => GestureController` — constructs but **does not mount**, so an `element` option is not attached until you call `mount()`                                                                                                                               | `function` |
| `gesturePlugin`                 | `Alpine.plugin()` factory — `gesturePlugin(options?) => (alpine) => void`. Registers `$store.gesture` + `x-gesture`                                                                                                                                                                         | `function` |
| `DEFAULT_GESTURE_STORE_KEY`     | Default store key, `"gesture"`                                                                                                                                                                                                                                                              | `const`    |
| `DEFAULT_GESTURE_DIRECTIVE_KEY` | Default directive name, `"gesture"` — the `x-gesture` part                                                                                                                                                                                                                                  | `const`    |
| `GestureEvents`                 | Event map — `change`, `gesture`, and one per kind: `tap`, `doubletap`, `longpress`, `swipe`, `pan`, `pinch`                                                                                                                                                                                 | `type`     |
| `GestureKind`                   | `"tap" \| "doubletap" \| "longpress" \| "swipe" \| "pan" \| "pinch"`                                                                                                                                                                                                                        | `type`     |
| `GestureDirection`              | `"up" \| "down" \| "left" \| "right" \| "none"`                                                                                                                                                                                                                                             | `type`     |
| `GesturePhase`                  | `"start" \| "move" \| "end"` — the streaming gestures (`pan`, `pinch`) report all three                                                                                                                                                                                                     | `type`     |
| `GestureState`                  | Live state: `active`, `kind`, `x`, `y`, `distanceX/Y`, `totalDistance`, `velocityX/Y`, `pointerCount`, `scale`, `rotation`, `direction`, `button`, `buttons`, `pointerType`                                                                                                                 | `type`     |
| `GestureOptions`                | Controller and plugin options — see [Options](#options)                                                                                                                                                                                                                                     | `type`     |
| `GestureChangeDetail`           | `change` payload — `{ state, previous }`                                                                                                                                                                                                                                                    | `type`     |
| `GesturePointerFields`          | `{ x, y, target, button, buttons, pointerType }` — on every gesture detail                                                                                                                                                                                                                  | `type`     |
| `GestureDetailMap`              | Maps each of the six kinds to its detail type. `tap`/`doubletap`/`longpress` carry only the pointer fields plus `kind`; `swipe` adds `direction`/`velocityX`/`velocityY`; `pan` adds `phase`/`distanceX/Y`/`velocityX/Y`/`direction`; `pinch` adds `phase`/`scale`/`rotation`/`distanceX/Y` | `type`     |
| `GestureStore`                  | What `$store.gesture` exposes: every `GestureState` field plus `cancel()`                                                                                                                                                                                                                   | `type`     |
| `GestureManager`                | `{ id, state, isTracking, mount, destroy, cancel, attach, detach }` — the structural contract `GestureController` satisfies                                                                                                                                                                 | `type`     |
| `GestureMouseButton`            | `0 \| 1 \| 2 \| 3 \| 4`                                                                                                                                                                                                                                                                     | `type`     |
| `GesturePointerType`            | `"mouse" \| "touch" \| "pen"`                                                                                                                                                                                                                                                               | `type`     |
| `GesturePointerTypeName`        | `GesturePointerType \| (string & {})` — an open union, because a browser may report a pointer type this version does not know                                                                                                                                                               | `type`     |
| `GestureAlpine`                 | Alias of Alpine's own `Alpine` type                                                                                                                                                                                                                                                         | `type`     |
| `GesturePluginCallback`         | `(alpine: Alpine) => void`                                                                                                                                                                                                                                                                  | `type`     |

A recognized gesture also carries `state` (a `GestureState` snapshot) and
`originalEvent` (the `PointerEvent`) on top of its kind-specific fields — those
come from the internal `GestureRecognizedDetail`, which is what the events and
the directive handler actually receive.

`gesturePlugin` is also the package's `default` export.

### Events

Every recognized gesture is emitted twice: on the shared `gesture` channel, and
on a per-kind channel (`tap`, `swipe`, …) **only if something is listening**.
Subscribe to whichever you need.

```ts
gestures.on("gesture", (detail) => {
  detail.kind; // one of the six
});

gestures.on("swipe", (detail) => {
  detail.direction; // 'up' | 'down' | 'left' | 'right'
  detail.velocityX; // px per ms — displacement / elapsed ms, not px/s
  detail.velocityY;
  detail.originalEvent; // the PointerEvent
});
```

| Kind        | When                                                                                     | Detail beyond the pointer fields                   |
| ----------- | ---------------------------------------------------------------------------------------- | -------------------------------------------------- |
| `tap`       | Pointer up within `tapThreshold` of where it went down                                   | —                                                  |
| `doubletap` | A second tap within `doubleTapInterval` of the first                                     | —                                                  |
| `longpress` | After `longPressDelay` with the finger still down and within `tapThreshold` of its start | —                                                  |
| `swipe`     | Pointer up at least `swipeThreshold` away **and** at least `swipeVelocity` px/ms         | `direction`, `velocityX`, `velocityY`              |
| `pan`       | First move past `panThreshold`, then every move, then once on release                    | `phase`, `distanceX/Y`, `velocityX/Y`, `direction` |
| `pinch`     | On the second pointer down, every move, and on release below two pointers                | `phase`, `scale`, `rotation`, `distanceX/Y`        |

`change` fires on every state patch — pointer down, move, up, cancel — carrying
`{ state, previous }`, and is what the store syncs from.

**The recognisers are not mutually exclusive in the way the names suggest.**
`pan` and `swipe` can both fire for one drag: a fast, long flick crosses
`panThreshold` on the way to `swipeThreshold`, so it reports `pan`
(`start`/`move`/`end`) and then `swipe`. Conversely a pinch suppresses both,
because `#multiTouch` is set as soon as a second finger lands.

### Store API

```ts
$store.gesture.active; // a pointer is down
$store.gesture.kind; // 'tap' | 'doubletap' | 'longpress' | 'swipe' | 'pan' | 'pinch' | null
$store.gesture.x;
$store.gesture.y;
$store.gesture.distanceX;
$store.gesture.distanceY;
$store.gesture.totalDistance;
$store.gesture.velocityX;
$store.gesture.velocityY;
$store.gesture.pointerCount; // fingers down
$store.gesture.scale; // pinch scale, 1 at rest
$store.gesture.rotation; // pinch rotation in degrees
$store.gesture.direction;
$store.gesture.button;
$store.gesture.buttons;
$store.gesture.pointerType; // 'mouse' | 'touch' | 'pen' | ''

$store.gesture.cancel();
```

There is one store for the whole page, not one per element. It follows **the
surface currently being touched, or the last one that was** — a controller
going idle does not blank the state of a surface still in use. So `$store.gesture`
is right for "what is happening somewhere on this page" and wrong for "what is
happening on _this_ element"; for the latter, read the handler's detail.

`cancel()` abandons the interaction on the focused surface and emits no
gesture. It is the escape hatch for a drag the user has walked away from.

### Options

```ts
type GestureOptions = {
  id?: string; // default: generateId('gesture')
  element?: Element; // default: undefined — attach on mount
  gestures?: readonly GestureKind[]; // default: all six
  tapThreshold?: number; // default: 10 (px)
  doubleTapInterval?: number; // default: 300 (ms)
  longPressDelay?: number; // default: 500 (ms)
  swipeThreshold?: number; // default: 50 (px)
  swipeVelocity?: number; // default: 0.3 (px/ms)
  panThreshold?: number; // default: 10 (px)
  preventDefault?: boolean; // default: undefined — **never read**
  mouseButtons?: readonly GestureMouseButton[]; // default: [0] — left button only
  storeKey?: string; // default: 'gesture'
  directiveKey?: string; // default: 'gesture'
};
```

| Option              | Default                 | Description                                                                                                                                                                         |
| ------------------- | ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `gestures`          | all six                 | Narrows what the recognizer looks for. A kind not in the list is not detected **and** its per-kind event never fires — the check happens before the emit                            |
| `tapThreshold`      | `10`                    | Movement at or below this still counts as a tap. It also gates the long press: moving past it cancels a pending `longpress`                                                         |
| `doubleTapInterval` | `300`                   | Window in which a second tap becomes a `doubletap`. The first tap has already fired as `tap` by then                                                                                |
| `longPressDelay`    | `500`                   | Hold time before `longpress` fires. The gesture fires **while still down**, not on release                                                                                          |
| `swipeThreshold`    | `50`                    | Minimum travel, in px, for a swipe                                                                                                                                                  |
| `swipeVelocity`     | `0.3`                   | Minimum speed in **px per millisecond** — 0.3 px/ms is 300 px/s. Compared against `Math.hypot(vx, vy)`                                                                              |
| `panThreshold`      | `10`                    | Movement before the first `pan` of a drag. Every later move reports `"move"`                                                                                                        |
| `mouseButtons`      | `[0]`                   | Which mouse buttons start a gesture — left only by default. `pointerType` `touch` and `pen` always report button `0` and are always accepted, so this option only ever filters mice |
| `element`           | —                       | Attach target. At plugin level this is a surface with no `x-gesture` handlers whose live values still reach the store                                                               |
| `storeKey`          | `"gesture"`             | `$store` key. Plugin-only                                                                                                                                                           |
| `directiveKey`      | `"gesture"`             | Directive name. Plugin-only. `gesturePlugin({ directiveKey: 'swipe' })` registers `x-swipe`                                                                                         |
| `id`                | `generateId("gesture")` | Controller id. The plugin does not use it — it builds one controller per element and lets each generate its own                                                                     |

**`preventDefault` is declared and never read.** The controller does not call
`preventDefault()` on any pointer event, and the browser is left to do whatever
it would do — which is exactly why `touch-action: none` is on you.

### Avoiding name collisions

`guardStore` and `guardDirective` both throw a `RegistrationError` if another
package has already claimed `gesture`. Move the names without touching the
controller:

```ts
Alpine.plugin(gesturePlugin({ storeKey: "pointer", directiveKey: "pointer" }));
```

`DEFAULT_GESTURE_STORE_KEY` and `DEFAULT_GESTURE_DIRECTIVE_KEY` keep the
defaults discoverable from TypeScript.

## SSR

> SSR-safe — no `window`/`document` at import time. All DOM access is deferred
> to `attach()`, which is only reachable from `mount()` or an explicit call.

`createGestureController()` and `gesturePlugin()` are both safe to invoke during
SSR: nothing is attached, and the plugin's store is registered with the idle
state so a template that reads `$store.gesture.active` gets `false` rather than
`undefined`. Pointer Events are not available on the server, so there is nothing
to recognise.

## Accessibility

Not applicable — this is a Primitives-layer package and it produces no roles,
ARIA attributes or key bindings. Gestures are a pointer-only affordance.

The honest consequence: **nothing here is reachable by keyboard.** If a swipe
or a long press is the only way to do something, it is not available to a
keyboard or screen-reader user. Pair every gesture with a visible control —
`@click` on a real button is enough, and the browser already synthesises a
`click` from a tap in most cases.

Give a gesture surface `touch-action: none` only when it must win over browser
panning, and keep it on an element that is not itself a document scroll region —
a `touch-none` on a page-level container makes the page unscrollable by touch.

## Integration

- **@ailura/alpinejs-scroll** — a horizontal `pan` and a vertical scroll are
  competing claims on the same drag. Gate the pan on the gesture's
  `direction` and let vertical movement through.
- **@ailura/alpinejs-carousel** — the package already owns drag-to-swipe with
  ARIA; reach for `x-gesture.swipe` only on a surface the carousel does not own.

## Limitations

- **`preventDefault` does nothing.** It is on the public `GestureOptions` type
  and is never read by the controller. No pointer event is ever cancelled.
  `touch-action: none` is the only way to suppress browser panning and
  pinch-zoom, and it has to be set in CSS.
- **`pan` and `swipe` are not exclusive.** A long, fast flick fires `pan`
  (`start`, `move`, `end`) and then `swipe` for the same drag. If that matters,
  narrow the list with `gestures: ['swipe']` and drop the pan.
- **A second tap reports `doubletap`, not a second `tap`.** A handler on
  `.tap` fires once for a double-tap gesture. Bind both if you need both.
- **`longpress` fires while the finger is down, not on release**, and moving
  more than `tapThreshold` px or adding a second finger cancels it. It does not
  suppress the browser's own context menu — call `preventDefault()` yourself.
- **Velocity is px/ms, not px/s.** `swipeVelocity: 0.3` means 0.3 px/ms. The
  detail's `velocityX`/`velocityY` are in the same unit.
- **`swipe` never fires for a multi-touch interaction** and never after a
  `longpress` — the recognizer returns early in both cases.
- **`rotation` is unbounded and signed**, in degrees, relative to the angle
  between the first two fingers at the moment the second went down. It is not
  normalised to ±180 and does not wrap.
- **`scale` is relative to the initial two-finger spread.** It is forced to `1`
  when that spread is under 1px, so two fingers landing on the same pixel report
  no scale change rather than a divide-by-zero.
- **One store for the whole page.** `$store.gesture` follows the focused
  surface, so a second surface's values overwrite the first's. Read the handler
  detail when you need per-element state.
- **`x-gesture` registers a controller even for an unknown modifier.**
  `x-gesture.swipes="fn"` builds a recognizer whose kind filter never matches —
  no error, no gesture, and a live controller until the element is removed.
- **`$store.gesture.cancel()` targets the focused surface only**, which is
  usually right but is not addressable per element.
- **Raw `<button>` must be a plain tag for the directive to see it.** A gesture
  surface that is an interactive element needs its own `role` and `tabindex`;
  the package sets neither.
- **The plugin does not pass `options.id` to the controllers it creates** — each
  one generates its own id, so `options.id` is inert at plugin level.

## Size

`8.24 kB raw / 2.74 kB gzip` · budget `3 kB` · externalized peers: `alpinejs`,
`@ailura/alpinejs-core` · `size-limit` + `publint` + `attw` verified.

The raw size is the largest in the Primitives layer, and it is close to the
declared budget's neighbourhood for a package that registers no store keys worth
the name. Six recognisers, a multi-pointer map, and seven typed events account
for it.

## Architecture

[Primitives layer](../../ARCHITECTURE.md) — controllers own state, Alpine owns
reactivity. See canon, guards, and SSR rules in
[ARCHITECTURE.md](../../ARCHITECTURE.md).

## Testing

```sh
pnpm test              # vp test (happy-dom)
pnpm run typecheck     # tsc --noEmit
```

Three suites: `pointer.test.ts` for the recognisers' thresholds and event
ordering, `events.test.ts` for the per-kind channels, `directive.test.ts` for
`x-gesture` wiring and refcounted teardown.

## License

MIT
