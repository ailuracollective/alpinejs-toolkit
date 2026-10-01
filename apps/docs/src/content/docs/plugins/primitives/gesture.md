---
title: Gesture
---

@ailura/alpinejs-gesture

Pointer-event gestures as an `x-gesture` directive with modifiers, plus a `gesture`
store with the live values. Six gestures: tap, doubletap, longpress, swipe, pan, and
pinch.

## Install

```sh
pnpm add alpinejs @ailura/alpinejs-gesture
```

## Register the plugin

Do this once, before `Alpine.start()`.

```ts
import Alpine from "alpinejs";
import gesturePlugin from "@ailura/alpinejs-gesture";

Alpine.plugin(gesturePlugin());

Alpine.start();
```

That registers the `x-gesture` directive and the `gesture` store.

## Minimal example

A box that reports each gesture as it happens.

```html
<div
  x-data
  x-gesture.tap="console.log('tap')"
  x-gesture.swipe="console.log('swipe', $store.gesture.distanceX, $store.gesture.distanceY)"
  x-gesture.pinch="console.log('scale', $store.gesture.scale)"
>
  <p>Active: <span x-text="$store.gesture.active"></span></p>
  <p>Kind: <span x-text="$store.gesture.kind"></span></p>
  <p>Fingers down: <span x-text="$store.gesture.pointerCount"></span></p>
  <p>Try a tap, a swipe, or a pinch.</p>
</div>
```

The modifier is the gesture name and the value is the handler. Several can coexist on
one element, which is how you tell a swipe from a pan on the same surface.

Every element that carries `x-gesture` gets its own recognizer, so a page with
two gesture surfaces does not need a single shared one.

The handler is called with the gesture detail as its first argument and the
merged `x-data` scope as `this`, the same contract as `x-on:click="handler"`:

```js
x-data="{
  onSwipe(d) {
    // `d.kind`, `d.direction`, `d.state`, `d.originalEvent`
    console.log(d.direction, this.$store.gesture.active);
  },
}"
```

:::caution[A gesture surface needs `touch-action: none`]
A two-finger pinch on a page that is still allowed to pan or zoom is claimed by
the browser: the page moves or zooms and the handler never runs. Put
`touch-action: none` (Tailwind: `touch-none`) on the surface, plus
`user-select: none` (`select-none`) so a long press does not start a selection.
:::

## The live values

`$store.gesture` holds what the pointer is doing right now, which is what you need for
anything visual: a drag position, a live scale factor, a direction.

| Value                                                 | Meaning                                             |
| ----------------------------------------------------- | --------------------------------------------------- |
| `active` / `kind`                                     | Whether a gesture is running, and which.            |
| `x` / `y`                                             | Current pointer position.                           |
| `distanceX` / `distanceY` / `totalDistance`           | How far it moved.                                   |
| `velocityX` / `velocityY`                             | How fast.                                           |
| `scale` / `rotation`                                  | Pinch and rotate.                                   |
| `pointerCount` / `pointerType` / `button` / `buttons` | How many fingers, and which button.                 |
| `direction`                                           | `"up"`, `"down"`, `"left"`, `"right"`, or `"none"`. |

The store follows the surface currently being touched, and keeps that surface's
last values once the gesture ends. `scale` and `rotation` are measured from the
spread and the bearing the two fingers started with, so they are `1` and `0`
until a second finger is down.

`cancel()` is how you stop a gesture the user does not want: cancel it when a nested
scroll takes over, so the handler does not also fire. It acts on the surface in
use.

`pan` and `pinch` also report a `phase` of `start`, `move` then `end`, so a
dragged element or a zoom transform can follow the gesture and settle when it
finishes.

## Tuning the thresholds

The defaults are tuned for touch. On a surface where a small movement is easy by
accident, raise the swipe threshold and the long-press delay. `swipeThreshold` defaults
to `50` px and `longPressDelay` to `500` ms, so the values below are both raises.

```js
gesturePlugin({
  swipeThreshold: 80,
  longPressDelay: 600,
});
```

## API reference

| Name                                                                 | Type      | Purpose                                                                                          |
| -------------------------------------------------------------------- | --------- | ------------------------------------------------------------------------------------------------ |
| `x-gesture`                                                          | directive | The gesture handlers. Modifiers: `.tap`, `.doubletap`, `.longpress`, `.swipe`, `.pan`, `.pinch`. |
| `$store.gesture.cancel()`                                            | method    | Abandon the gesture in progress.                                                                 |
| `$store.gesture.active`                                              | store     | Whether a gesture is running.                                                                    |
| `$store.gesture.kind`                                                | store     | The recognised kind, or `null`.                                                                  |
| `$store.gesture.x` / `y`                                             | store     | Current pointer position.                                                                        |
| `$store.gesture.distanceX` / `distanceY` / `totalDistance`           | store     | Movement so far.                                                                                 |
| `$store.gesture.velocityX` / `velocityY`                             | store     | Current velocity.                                                                                |
| `$store.gesture.scale` / `rotation`                                  | store     | Pinch scale and rotation.                                                                        |
| `$store.gesture.pointerCount` / `pointerType` / `button` / `buttons` | store     | Pointer details.                                                                                 |
| `$store.gesture.direction`                                           | store     | `"up"`, `"down"`, `"left"`, `"right"`, or `"none"`.                                              |

Plugin options include `id`, `element`, `gestures`, `tapThreshold`,
`doubleTapInterval`, `longPressDelay`, `swipeThreshold`, `swipeVelocity`,
`panThreshold`, `preventDefault` and `mouseButtons`.

:::caution[Touch and mouse produce the same gestures]
A handler written for touch fires on a trackpad or a mouse too, and `distanceX` on a
mouse drag is large compared with the touch defaults. If a desktop drag is
over-triggering, raise `swipeThreshold` rather than branching on `pointerType` in every
handler.
:::
