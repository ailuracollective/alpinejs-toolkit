---
title: Timer
---

@ailura/alpinejs-timer

A `$timer` magic for countdowns, countups, and stopwatches. The plugin owns the
drift: it schedules against timestamps rather than counting ticks, so a background tab
does not make a 30 second timer jump.

## Install

```sh
pnpm add alpinejs @ailura/alpinejs-timer
```

## Register the plugin

Do this once, before `Alpine.start()`.

```ts
import Alpine from "alpinejs";
import timerPlugin from "@ailura/alpinejs-timer";

Alpine.plugin(timerPlugin());

Alpine.start();
```

That registers the `$timer` magic. There is no store.

## Minimal example

A 30 second countdown that starts on click.

```html
<div x-data="{ tm: $timer.countdown({ duration: 30000 }) }">
  <p><span x-text="tm.formatted"></span> remaining</p>
  <p>Progress: <span x-text="Math.round(tm.progress * 100) + '%'"></span></p>

  <button @click="tm.start()">Start</button>
  <button @click="tm.pause()">Pause</button>
  <button @click="tm.restart()">Restart</button>
</div>
```

Each factory takes an options object and returns a fresh timer. Build it once in
`x-data` and drive it through `tm`, because a timer built inside a binding expression
would be recreated on every render.

## Choosing a kind

- `countdown({ duration })` — counts down to zero from a duration. `duration` is
  required.
- `countup({ limit })` — counts up toward a limit, useful for a progress bar.
- `stopwatch()` — counts up with no target.
- `create({ direction })` — the general factory, `'up'` or `'down'`.

```js
$timer.countdown({ duration: 30000 });
$timer.countup({ limit: 30000 });
$timer.stopwatch();
```

:::caution[`$timer.stopwatch()` comes back without its controls]
The magic builds the stopwatch view by copying the methods defined directly on the
stopwatch class, which leaves out everything it inherits from the timer class. You get
`lap` and the reactive fields, but `start()`, `pause()`, `reset()` and `toggle()` are
`undefined` on that object, so a stopwatch created through the magic can never be armed.
Use `countdown()`, `countup()` or `create()` for the magic, and build a stopwatch with the
standalone factory when you need laps:

```ts
import { createStopwatch } from "@ailura/alpinejs-timer";

const sw = createStopwatch(); // full surface: start, pause, reset, lap, …
sw.start();
```

:::

## Variants

**Toggle and reset from one control.** `toggle()` flips between running and paused,
`reset()` goes back to zero and stops, and `restart()` goes back and begins again. These
live on the countdown, countup and `create()` views.

```js
tm.toggle();
tm.reset();
tm.restart();
```

**Watch completion.** Pass `onComplete` (or `onTick`) and the timer calls you when it
reaches the end, so you do not have to poll `remaining`.

```js
$timer.countdown({ duration: 30000, onComplete: () => celebrate() });
```

**Record laps on a stopwatch.** `createStopwatch()` also tracks laps, with the fastest
and slowest kept for you.

```ts
import { createStopwatch } from "@ailura/alpinejs-timer";

const sw = createStopwatch();
sw.start();
sw.lap();
sw.laps; // every recorded lap
sw.lastLap; // the most recent
sw.fastestLap; // the fastest so far
```

## API reference

Every method below is on the object `$timer.countdown()`, `$timer.countup()` and
`$timer.create()` return, named `tm` in the examples.

| Name           | Type   | Purpose                                                   |
| -------------- | ------ | --------------------------------------------------------- |
| `tm.formatted` | store  | The time as a display string.                             |
| `tm.remaining` | store  | Milliseconds left, or `null` when there is no `duration`. |
| `tm.elapsed`   | store  | Milliseconds elapsed.                                     |
| `tm.duration`  | store  | The target in milliseconds.                               |
| `tm.progress`  | store  | From 0 to 1, for a progress bar.                          |
| `tm.running`   | store  | Whether it is ticking.                                    |
| `tm.paused`    | store  | Whether it is paused.                                     |
| `tm.completed` | store  | Whether it reached the end.                               |
| `tm.direction` | store  | `'up'` or `'down'`.                                       |
| `tm.iteration` | store  | How many times a repeating timer has restarted.           |
| `tm.start()`   | method | Start, or resume after a pause.                           |
| `tm.pause()`   | method | Pause.                                                    |
| `tm.resume()`  | method | Resume from a pause.                                      |
| `tm.toggle()`  | method | Start if paused, pause if running.                        |
| `tm.reset()`   | method | Back to zero, stopped.                                    |
| `tm.restart()` | method | Back to zero and start.                                   |
| `tm.destroy()` | method | Tear the timer down.                                      |

:::caution[A timer built in a binding never advances]
`x-text="$timer.countdown({ duration: 30000 }).formatted"` builds a new timer on every
evaluation, so the displayed time restarts constantly and looks random. Always assign it
once to the component state, then read from that.
:::

## Teardown

A timer built in a template expression belongs to the element that expression is on.
When Alpine removes that element, the view is torn down for you: the pending timeout is
cleared and the controller is destroyed, so it can no longer tick or be re-armed with
`start()`. That covers the `x-data` case above, where the timer lives and dies with the
component it is declared on.

:::caution[A timer built from plain JavaScript has no element to die with]
Call a factory from an event handler, a callback, or your own module and no magic
callback has run for that element, so there is no cleanup to register against. The view
is still returned fully usable — `start()`, `pause()` and the reactive fields all work —
but nothing will release it for you. You own it: call `tm.destroy()` (or `tm.dispose()`)
when you are done.
:::

## Plugin options

```ts
timerPlugin({ magicKey: "stopwatch" });
```

`magicKey` defaults to `timer`. The options each factory accepts are `direction`,
`duration`, `limit` (count-up), `initialElapsed`, `autoStart`, `precision` (default
`16`), `repeat`, `format`, `onTick`, and `onComplete`.
