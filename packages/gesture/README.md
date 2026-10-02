# @ailura/alpinejs-gesture

<p align="center">

[![bundlephobia minzip](https://badgen.net/bundlephobia/minzip/@ailura/alpinejs-gesture)](https://bundlephobia.com/package/@ailura/alpinejs-gesture)

</p>

> Alpine.js headless gesture recognition — tap, doubletap, longpress, swipe, pan and pinch from Pointer Events, plus an opt-in `wheel` for desktop zoom, on `@ailura/alpinejs-core`.

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

// gestures.destroy() when done — detaches the four pointer listeners, clears the timer
```

`createGestureController(options?)` does **not** mount. Pass `element` in the
options and call `mount()`, or skip both and call `attach(el)` later — the
controller follows exactly one element at a time, so `attach()` detaches from
the previous one.

The seventh kind, `wheel`, is **opt-in**: it is not in the default set, so no
`wheel` listener is attached unless you ask for one. Turn it on in the options
or, for a controller that is already attached, with `enableGestures()`:

```ts
// Either at construction …
const zoom = createGestureController({ element: surface, gestures: ["wheel"] });

// … or on an existing controller, which is what the directive does for
// `x-gesture.wheel="handler"`.
const gestures = createGestureController({ element: surface });
gestures.mount();
gestures.enableGestures(["wheel"]);

gestures.on("wheel", ({ state, x, y }) => {
  // `state.committedScale` is the absolute zoom — every session folded into
  // this one — so it outlives the session that produced it. Apply it anchored
  // at the cursor.
  surface.style.transformOrigin = `${x}px ${y}px`;
  surface.style.transform = `scale(${state.committedScale})`;
});
```

See [Desktop zoom with the wheel](#desktop-zoom-with-the-wheel) and
[Zoom that outlives a gesture](#zoom-that-outlives-a-gesture).

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
  <div x-gesture.wheel="onWheel">Zoom me with the wheel</div>
</div>
```

Modifiers: `.tap`, `.doubletap`, `.longpress`, `.swipe`, `.pan`, `.pinch`,
`.wheel`. A bare
`x-gesture="handler"` is a `.tap`. The handler is called with the gesture detail
as its first argument and the merged `x-data` scope as `this` — the same
contract as `x-on`.

> **`.wheel` is the only modifier that is not on by default.** Every other
> modifier adds a _filter_ to a recognizer that is already listening;
> `.wheel` is what attaches the `wheel` listener in the first place. Without it
> a wheel over the surface reaches the browser and nothing else.

> **Give the surface `touch-action: none`** (Tailwind: `touch-none`) whenever a
> gesture has to win over the browser's own panning or pinch-zoom. Without it
> the page scrolls and the handler never sees the move.

### 3. Desktop zoom with the wheel

`pinch` needs two fingers, so on a PC or laptop it never fires. The seventh
kind, `wheel`, gives a mouse wheel the same output: a `committedScale` you can
apply, anchored wherever the cursor is.

```html
<div
  x-data="{
    zoom: 1,
    ox: 0,
    oy: 0,
    handleWheel(d) {
      // The end of the session is a real event, and it arrives at rest:
      // scale back to 1, deltas at 0, and state.committedScale already
      // holding the zoom the session reached. There is nothing to commit,
      // so nothing is.
      if (d.phase === 'end') return
      // d.x / d.y are clientX / clientY, so they are viewport coordinates
      // and transform-origin wants them relative to the surface.
      const r = this.$refs.surface.getBoundingClientRect()
      this.ox = d.x - r.left
      this.oy = d.y - r.top
      // state.committedScale is absolute: every session before this one is
      // folded into it, so a second burst compounds on the first by itself.
      this.zoom = d.state.committedScale
    },
  }"
>
  <div x-ref="surface" x-gesture.wheel="handleWheel">
    <div :style="'transform: scale(' + zoom + '); transform-origin: ' + ox + 'px ' + oy + 'px'">
      Zoom with the wheel
    </div>
  </div>
</div>
```

What the package does and what it leaves to you:

- **It is opt-in.** `x-gesture.wheel` — or listing `wheel` in `options.gestures`,
  or `controller.enableGestures(['wheel'])` — is the only thing that attaches
  the listener. An existing consumer that never asks for it pays no `wheel`
  listener and sees no behaviour change.
- **It owns the math.** `d.scale` is `exp(-Σ deltaY × wheelScaleFactor)`
  accumulated across one wheel session and clamped to a positive floor, so it
  means the same thing as a pinch scale. You do not reimplement the
  exponential.
- **It does not scale anything.** A plain wheel does **not** zoom by itself: the
  recognizer reports a number, and applying it is the consumer's line. Nothing
  on your page moves until you bind `committedScale` to a transform.
- **Y only.** `deltaX > 0` is a horizontal scroll, not a zoom — only `deltaY`
  drives `scale`. Wheel down (`deltaY > 0`) zooms out, wheel up zooms in.
- **The session ends with an event.** After `wheelIdleDelay` ms (default `160`)
  with no tick, the recognizer emits one `wheel` with `phase: 'end'` — so the
  zoom is committed _on_ an event rather than by polling for the absence of
  input. The detail is at rest: `scale` is back to `1` and the deltas to `0`,
  because nothing is being reported any more, while `committedScale` carries
  what the session contributed. `originalEvent` is the last tick's `WheelEvent`,
  since there is no new input to report. There is no `phase: 'start'`: a wheel
  has no press to begin from, so a session opens with its first tick and that
  tick is already a `"move"`.
- **A cancelled or detached surface gets no `end`.** `cancel()` and `detach()`
  both clear the pending timer, so an abandoned interaction is never mistaken
  for a completed one.
- **The cursor is the anchor.** `d.x`/`d.y` and `$store.gesture.x`/`.y` are
  the pointer position at the tick, and `active` stays `true` for the whole
  session, so the store keeps streaming them while the wheel turns.
- **A wheel turn during a drag is ignored.** A tick while any pointer is down
  belongs to the interaction already running, so it cannot corrupt a pinch.
- **A trackpad pinch arrives here too**, as a `wheel` with `ctrlKey: true`; it
  takes the same path and `d.ctrlKey` tells you which one it was.
- **`deltaMode` is normalized to pixels** for you (line ×16, page ×100), so the
  zoom speed does not depend on the hardware. The raw mode still reaches the
  detail as `d.deltaMode`.
- **Set `preventDefault: true` to suppress the page scroll.** It is the only
  way to keep the page still while zooming; the listener is then attached
  non-passive, which is what makes cancelling legal. It applies to `wheel`
  only — no pointer event is ever cancelled.
- **Bounds are yours.** `scaleRange` clamps `committedScale` after every session
  multiplies into it, and the package ships no default for it — see
  [Zoom that outlives a gesture](#zoom-that-outlives-a-gesture).

```ts
Alpine.plugin(gesturePlugin({ preventDefault: true }));
```

### 4. Zoom that outlives a gesture

`scale` is relative to the session that produced it: it starts at `1` on every
pinch and every wheel session and is back to `1` when that one ends. The
absolute zoom is **`committedScale`**, and keeping it is the package's job
rather than yours — it is the number a transform binds to, already accumulated
across every pinch and every wheel session so far. It is a member of
`GestureState`, and every recognized detail carries that state, so a handler
reads it as `detail.state.committedScale` and the store as
`$store.gesture.committedScale`.

```ts
const zoom = createGestureController({ element: surface, scaleRange: [0.5, 3] });

zoom.on("pinch", ({ state }) => {
  surface.style.transform = `scale(${state.committedScale})`;
});

zoom.resetScale(); // back to 100%, without cancelling the interaction
```

- **`committedScale` is absolute; `scale` is not.** Both are on the mirrored
  state, and the state's snapshot rides along on every detail, so the
  transform, the readout and the session all report the same zoom. A session's
  own scale is multiplied into the total, never compounded step by step: a
  pinch spreading in two steps to 1.25 and then 2 commits 2, a zoom the fingers
  did describe.
- **It outlives the session that produced it.** Nothing resets it when the
  fingers lift or when a wheel session idles out, so two pinches compound with
  no base of your own to carry forward. It starts at `1`, and a session that
  returns to its baseline returns the surface to the zoom it started from.
- **`cancel()` drops it.** An abandoned interaction leaves no zoom behind, the
  same way it already dropped the accumulated wheel scale.
- **`scaleRange` is a `[min, max]` pair, and it is your policy.** Set it and
  `committedScale` is clamped to it after every session multiplies into it. The
  package ships **no default bound**: what a surface considers its minimum and
  maximum zoom is not something a recognizer can know, and a default would be
  wrong for every surface that wants a different one. The runaway floor on a
  wheel session's own scale is separate — it exists so the math cannot run away
  within one session. Note that `scaleRange` is a controller option and
  `x-gesture` carries no options, so a surface driven from markup has to clamp
  the number itself.
- **`resetScale()` is back to 100% without cancelling.** It returns
  `committedScale` to `1` and leaves the interaction alone — for a "fit" or
  "reset" control that should not abort a pinch in progress. The base of a
  session already running moves with it, so that session carries on from the
  reset instead of snapping the surface back. It is a `GestureController`
  method, not part of `GestureStore`, so it is **not** on `$store.gesture`: a
  surface driven from markup has no way to call it.

## API

### Exports

| Export                          | Description                                                                                                                                                                                                                                                                                                                                                                                                              | Type       |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------- |
| `GestureController`             | The recognizer class. Getters `state` and `isTracking`; methods `mount`, `attach(el)`, `detach`, `enableGestures(kinds)`, `resetScale`, `cancel`, `destroy`. `enableGestures` unions kinds into the enabled set — it is what turns the opt-in `wheel` listener on for an already-attached controller; `resetScale` returns `committedScale` to `1` without cancelling                                                    | `class`    |
| `createGestureController`       | `createGestureController(options?) => GestureController` — constructs but **does not mount**, so an `element` option is not attached until you call `mount()`                                                                                                                                                                                                                                                            | `function` |
| `gesturePlugin`                 | `Alpine.plugin()` factory — `gesturePlugin(options?) => (alpine) => void`. Registers `$store.gesture` + `x-gesture`                                                                                                                                                                                                                                                                                                      | `function` |
| `DEFAULT_GESTURE_STORE_KEY`     | Default store key, `"gesture"`                                                                                                                                                                                                                                                                                                                                                                                           | `const`    |
| `DEFAULT_GESTURE_DIRECTIVE_KEY` | Default directive name, `"gesture"` — the `x-gesture` part                                                                                                                                                                                                                                                                                                                                                               | `const`    |
| `GestureEvents`                 | Event map — `change`, `gesture`, and one per kind: `tap`, `doubletap`, `longpress`, `swipe`, `pan`, `pinch`, `wheel`                                                                                                                                                                                                                                                                                                     | `type`     |
| `GestureKind`                   | `"tap" \| "doubletap" \| "longpress" \| "swipe" \| "pan" \| "pinch" \| "wheel"`                                                                                                                                                                                                                                                                                                                                          | `type`     |
| `GestureDirection`              | `"up" \| "down" \| "left" \| "right" \| "none"`                                                                                                                                                                                                                                                                                                                                                                          | `type`     |
| `GesturePhase`                  | `"start" \| "move" \| "end"` — `pan` and `pinch` report all three; `wheel` reports `"move"` for every tick and one `"end"` when the session closes, and has no `"start"` because a wheel has no press to begin from                                                                                                                                                                                                      | `type`     |
| `GestureState`                  | Live state: `active`, `kind`, `x`, `y`, `distanceX/Y`, `totalDistance`, `velocityX/Y`, `pointerCount`, `scale`, `committedScale`, `rotation`, `direction`, `button`, `buttons`, `pointerType`, `deltaX/Y`                                                                                                                                                                                                                | `type`     |
| `GestureOptions`                | Controller and plugin options — see [Options](#options)                                                                                                                                                                                                                                                                                                                                                                  | `type`     |
| `GestureChangeDetail`           | `change` payload — `{ state, previous }`                                                                                                                                                                                                                                                                                                                                                                                 | `type`     |
| `GesturePointerFields`          | `{ x, y, target, button, buttons, pointerType }` — on every gesture detail                                                                                                                                                                                                                                                                                                                                               | `type`     |
| `GestureDetailMap`              | Maps each of the seven kinds to its detail type. `tap`/`doubletap`/`longpress` carry only the pointer fields plus `kind`; `swipe` adds `direction`/`velocityX`/`velocityY`; `pan` adds `phase`/`distanceX/Y`/`velocityX/Y`/`direction`; `pinch` adds `phase`/`scale`/`rotation`/`distanceX/Y`; `wheel` adds `phase`/`deltaX/Y/Z`/`deltaMode`/`ctrlKey`/`scale` (plus `committedScale` on the state every detail carries) | `type`     |
| `GestureStore`                  | What `$store.gesture` exposes: every `GestureState` field plus `cancel()`                                                                                                                                                                                                                                                                                                                                                | `type`     |
| `GestureManager`                | `{ id, state, isTracking, mount, destroy, cancel, attach, detach }` — the structural contract `GestureController` satisfies                                                                                                                                                                                                                                                                                              | `type`     |
| `GestureMouseButton`            | `0 \| 1 \| 2 \| 3 \| 4`                                                                                                                                                                                                                                                                                                                                                                                                  | `type`     |
| `GesturePointerType`            | `"mouse" \| "touch" \| "pen"`                                                                                                                                                                                                                                                                                                                                                                                            | `type`     |
| `GesturePointerTypeName`        | `GesturePointerType \| (string & {})` — an open union, because a browser may report a pointer type this version does not know                                                                                                                                                                                                                                                                                            | `type`     |
| `GestureAlpine`                 | Alias of Alpine's own `Alpine` type                                                                                                                                                                                                                                                                                                                                                                                      | `type`     |
| `GesturePluginCallback`         | `(alpine: Alpine) => void`                                                                                                                                                                                                                                                                                                                                                                                               | `type`     |

A recognized gesture also carries `state` (a `GestureState` snapshot, so
`detail.state.committedScale` is the absolute zoom) and
`originalEvent` (the `PointerEvent` for the six pointer kinds, the `WheelEvent`
for `wheel`) on top of its kind-specific fields — those
come from the internal `GestureRecognizedDetail`, which is what the events and
the directive handler actually receive.

`gesturePlugin` is also the package's `default` export.

### Events

Every recognized gesture is emitted twice: on the shared `gesture` channel, and
on a per-kind channel (`tap`, `swipe`, …) **only if something is listening**.
Subscribe to whichever you need.

```ts
gestures.on("gesture", (detail) => {
  detail.kind; // one of the seven
});

gestures.on("swipe", (detail) => {
  detail.direction; // 'up' | 'down' | 'left' | 'right'
  detail.velocityX; // px per ms — displacement / elapsed ms, not px/s
  detail.velocityY;
  detail.originalEvent; // the PointerEvent
});

gestures.on("wheel", (detail) => {
  detail.deltaY; // pixels, deltaMode normalized; > 0 is wheel down = zoom out
  detail.scale; // exp(-ΣdeltaY × wheelScaleFactor) for this session
  detail.state.committedScale; // that session's scale folded into every one before it
  detail.ctrlKey; // true when this tick is a trackpad pinch
  detail.originalEvent; // the WheelEvent — the last tick's, on phase 'end'
});
```

| Kind        | When                                                                                     | Detail beyond the pointer fields                                                        |
| ----------- | ---------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| `tap`       | Pointer up within `tapThreshold` of where it went down                                   | —                                                                                       |
| `doubletap` | A second tap within `doubleTapInterval` of the first                                     | —                                                                                       |
| `longpress` | After `longPressDelay` with the finger still down and within `tapThreshold` of its start | —                                                                                       |
| `swipe`     | Pointer up at least `swipeThreshold` away **and** at least `swipeVelocity` px/ms         | `direction`, `velocityX`, `velocityY`                                                   |
| `pan`       | First move past `panThreshold`, then every move, then once on release                    | `phase`, `distanceX/Y`, `velocityX/Y`, `direction`                                      |
| `pinch`     | On the second pointer down, every move, and on release below two pointers                | `phase`, `scale`, `rotation`, `distanceX/Y`                                             |
| `wheel`     | Every tick of an opt-in wheel, unless a pointer is down, plus one `end` per session      | `phase` (`"move"` per tick, one `"end"`), `deltaX/Y/Z`, `deltaMode`, `ctrlKey`, `scale` |

`change` fires on every state patch — pointer down, move, up, cancel — carrying
`{ state, previous }`, and is what the store syncs from.

**The recognisers are not mutually exclusive in the way the names suggest.**
`pan` and `swipe` can both fire for one drag: a fast, long flick crosses
`panThreshold` on the way to `swipeThreshold`, so it reports `pan`
(`start`/`move`/`end`) and then `swipe`. Conversely a pinch suppresses both,
because `#multiTouch` is set as soon as a second finger lands.

### Store API

```ts
$store.gesture.active; // a pointer is down, or a wheel session is running
$store.gesture.kind; // 'tap' | 'doubletap' | 'longpress' | 'swipe' | 'pan' | 'pinch' | 'wheel' | null
$store.gesture.x;
$store.gesture.y;
$store.gesture.distanceX;
$store.gesture.distanceY;
$store.gesture.totalDistance;
$store.gesture.velocityX;
$store.gesture.velocityY;
$store.gesture.pointerCount; // fingers down
$store.gesture.scale; // pinch or wheel scale, 1 at rest
$store.gesture.committedScale; // the absolute zoom: every session folded together, 1 at rest
$store.gesture.rotation; // pinch rotation in degrees
$store.gesture.direction;
$store.gesture.button;
$store.gesture.buttons;
$store.gesture.pointerType; // 'mouse' | 'touch' | 'pen' | '' — a wheel reports 'mouse'
$store.gesture.deltaX; // wheel only: pixels, deltaMode normalized, 0 otherwise
$store.gesture.deltaY;

$store.gesture.cancel();
```

There is one store for the whole page, not one per element. It follows **the
surface currently being touched, or the last one that was** — a controller
going idle does not blank the state of a surface still in use. So `$store.gesture`
is right for "what is happening somewhere on this page" and wrong for "what is
happening on _this_ element"; for the latter, read the handler's detail.

For a wheel that second sentence is not quite true: `x`/`y` and the deltas
stream for the whole wheel session, so `$store.gesture.x` is a usable cursor
anchor — but `scale` is back to `1` once the session ends, while
`committedScale` keeps the zoom the session reached.

`cancel()` abandons the interaction on the focused surface and emits no
gesture. It is the escape hatch for a drag the user has walked away from. It
also drops the committed zoom back to `1`: an abandoned interaction leaves no
zoom behind. To go back to 100% _without_ cancelling, call
`controller.resetScale()` — which is not on the store, so see
[Zoom that outlives a gesture](#zoom-that-outlives-a-gesture).

### Options

```ts
type GestureOptions = {
  id?: string; // default: generateId('gesture')
  element?: Element; // default: undefined — attach on mount
  gestures?: readonly GestureKind[]; // default: the six pointer kinds — 'wheel' is opt-in
  tapThreshold?: number; // default: 10 (px)
  doubleTapInterval?: number; // default: 300 (ms)
  longPressDelay?: number; // default: 500 (ms)
  swipeThreshold?: number; // default: 50 (px)
  swipeVelocity?: number; // default: 0.3 (px/ms)
  panThreshold?: number; // default: 10 (px)
  preventDefault?: boolean; // default: undefined — only read for 'wheel'
  scaleRange?: readonly [number, number]; // default: none — a consumer policy
  mouseButtons?: readonly GestureMouseButton[]; // default: [0] — left button only
  wheelScaleFactor?: number; // default: 0.002
  wheelIdleDelay?: number; // default: 160 (ms)
  storeKey?: string; // default: 'gesture'
  directiveKey?: string; // default: 'gesture'
};
```

| Option              | Default                 | Description                                                                                                                                                                                                                                                                                                                                                                              |
| ------------------- | ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `gestures`          | the six pointer kinds   | Narrows what the recognizer looks for. A kind not in the list is not detected **and** its per-kind event never fires — the check happens before the emit. `wheel` is **not** in the default set: opt in with `gestures: ['pan', 'wheel']` or `controller.enableGestures(['wheel'])`                                                                                                      |
| `tapThreshold`      | `10`                    | Movement at or below this still counts as a tap. It also gates the long press: moving past it cancels a pending `longpress`                                                                                                                                                                                                                                                              |
| `doubleTapInterval` | `300`                   | Window in which a second tap becomes a `doubletap`. The first tap has already fired as `tap` by then                                                                                                                                                                                                                                                                                     |
| `longPressDelay`    | `500`                   | Hold time before `longpress` fires. The gesture fires **while still down**, not on release                                                                                                                                                                                                                                                                                               |
| `swipeThreshold`    | `50`                    | Minimum travel, in px, for a swipe                                                                                                                                                                                                                                                                                                                                                       |
| `swipeVelocity`     | `0.3`                   | Minimum speed in **px per millisecond** — 0.3 px/ms is 300 px/s. Compared against `Math.hypot(vx, vy)`                                                                                                                                                                                                                                                                                   |
| `panThreshold`      | `10`                    | Movement before the first `pan` of a drag. Every later move reports `"move"`                                                                                                                                                                                                                                                                                                             |
| `mouseButtons`      | `[0]`                   | Which mouse buttons start a gesture — left only by default. `pointerType` `touch` and `pen` always report button `0` and are always accepted, so this option only ever filters mice                                                                                                                                                                                                      |
| `wheelScaleFactor`  | `0.002`                 | How fast one wheel pixel changes the scale: `scale = exp(-Σ deltaY × factor)`. Larger zooms faster; `0` freezes it at `1`                                                                                                                                                                                                                                                                |
| `wheelIdleDelay`    | `160`                   | Milliseconds of wheel silence that close a wheel session: one `wheel` with `phase: 'end'` is emitted, and `scale` resets to `1` and the deltas to `0` (`committedScale` does not). Every tick restarts the clock                                                                                                                                                                         |
| `preventDefault`    | `undefined`             | `wheel` only. When set, the wheel listener is attached non-passive and each tick calls `preventDefault()`, which is the only way to suppress the page scroll while zooming. No pointer event is ever cancelled                                                                                                                                                                           |
| `scaleRange`        | — (none)                | `[min, max]` clamping `committedScale` after every session multiplies into it. **No default is shipped**: what a surface considers its minimum and maximum zoom is a consumer policy, and a default would be wrong for every surface that wants a different one. The runaway floor on a wheel session's own scale is separate. Not settable from markup — `x-gesture` carries no options |
| `element`           | —                       | Attach target. At plugin level this is a surface with no `x-gesture` handlers whose live values still reach the store                                                                                                                                                                                                                                                                    |
| `storeKey`          | `"gesture"`             | `$store` key. Plugin-only                                                                                                                                                                                                                                                                                                                                                                |
| `directiveKey`      | `"gesture"`             | Directive name. Plugin-only. `gesturePlugin({ directiveKey: 'swipe' })` registers `x-swipe`                                                                                                                                                                                                                                                                                              |
| `id`                | `generateId("gesture")` | Controller id. The plugin does not use it — it builds one controller per element and lets each generate its own                                                                                                                                                                                                                                                                          |

**`preventDefault` applies to `wheel`, and to nothing else.** The controller
never cancels a pointer event — the browser is left to pan and pinch-zoom, and
`touch-action: none` stays your job. For a wheel the option is the exception:
turning it on attaches the listener non-passive and calls `preventDefault()` on
each tick, which is the only way to stop the page scrolling underneath a zoom.
It is also why the option has to be set at construction: the listener's
passiveness is decided when it is attached.

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
`click` from a tap in most cases. A wheel zoom is the same case with an extra
edge: not every laptop has a wheel, and `Ctrl`+`+`/`-` does not arrive as a
`wheel` event on every platform, so pair the zoom with buttons too.

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

- **`preventDefault` does nothing for pointer gestures.** It is on the public
  `GestureOptions` type and is read only on the `wheel` path. No pointer event
  is ever cancelled. `touch-action: none` is the only way to suppress browser
  panning and pinch-zoom for a touch drag, and it has to be set in CSS.
- **`wheel` is opt-in, so it is silently absent until you ask for it.** With no
  `x-gesture.wheel` modifier, no `wheel` in `options.gestures` and no
  `enableGestures(['wheel'])`, the surface has no wheel listener at all and a
  wheel over it reaches the browser untouched. That is deliberate — it is why
  an existing consumer pays nothing — but it means a missing zoom is a missing
  opt-in, not a bug.
- **A plain wheel does not scale anything on its own.** The recognizer
  accumulates and reports `scale` and `committedScale`; applying one to a
  transform is the consumer's line. Nothing on the page moves until you bind it.
- **The wheel scale is Y-only, and `scale` resets between sessions.** A
  horizontal wheel is a scroll, not a zoom, and `scale` returns to `1` after
  `wheelIdleDelay` of silence. The absolute zoom does not reset: bind
  `committedScale` rather than carrying a base forward by hand.
- **A wheel tick during a drag is ignored.** While any pointer is down the
  `wheel` handler returns early, so a trackpad that reports both cannot corrupt
  a running pinch. The cost is the other direction: a wheel over a surface the
  user is also touching does nothing at all.
- **The wheel session ends with an event, but only a real one.** There is a
  `wheel` detail with `phase: 'end'` once `wheelIdleDelay` of silence closes a
  session, and it arrives at rest: `scale` back to `1`, deltas at `0`,
  `committedScale` carrying what the session contributed, and `originalEvent`
  the last tick's `WheelEvent` rather than a new one. There is no `end` on
  `cancel()` or `detach()`, and no `phase: 'start'` at all — a session opens
  with its first tick, which is already a `"move"`.
- **There is no default zoom bound.** `scaleRange` is the only clamp on
  `committedScale` and it ships unset, because a minimum and maximum zoom is a
  consumer policy. A long trackpad pinch-out can drive the zoom a long way
  without one.
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

`8.68 kB raw / 3.11 kB gzip` · budget `3.2 kB` — about 90 B of headroom ·
externalized peers: `alpinejs`, `@ailura/alpinejs-core` · `size-limit` +
`publint` + `attw` verified.

Measured with `pnpm --filter @ailura/alpinejs-gesture run build && pnpm
--filter @ailura/alpinejs-gesture run size`. The raw size is the largest in the
Primitives layer: seven recognisers, a multi-pointer map, eight typed events,
and the absolute-zoom bookkeeping — `committedScale`, `scaleRange`,
`resetScale()` and the wheel session's `end` — account for it.

The budget was raised from `3 kB` to `3.2 kB` for the absolute zoom, and it is
worth being precise about how tight it had become: the same build without
`committedScale` measures **2.96 kB gzip**, so the old budget had 37 B of
headroom against a feature that costs about 140 B. No subpart of it fit — the
cheapest, `resetScale()`, is half the headroom on its own — so the alternatives
were to raise the budget, to move the zoom bookkeeping into its own package, or
to drop behaviour that was written and reviewed. Trimming was tried first and
bought 30 B of the 140; the rest of the gap was not reachable without giving up
one of the four behaviours, so the budget moved instead.

## Architecture

[Primitives layer](../../ARCHITECTURE.md) — controllers own state, Alpine owns
reactivity. See canon, guards, and SSR rules in
[ARCHITECTURE.md](../../ARCHITECTURE.md).

## Testing

```sh
pnpm test              # vp test (happy-dom)
pnpm run typecheck     # tsc --noEmit
```

Four suites: `pointer.test.ts` for the recognisers' thresholds and event
ordering, `events.test.ts` for the per-kind channels, `directive.test.ts` for
`x-gesture` wiring and refcounted teardown, and `wheel.test.ts` for the opt-in
wheel listener, delta normalization, scale accumulation, the committed zoom
across sessions and the idle `end` event.

## License

MIT
