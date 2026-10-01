# @ailura/alpinejs-timer

<p align="center">

[![bundlephobia minzip](https://badgen.net/bundlephobia/minzip/@ailura/alpinejs-timer)](https://bundlephobia.com/package/@ailura/alpinejs-timer)

</p>

> One callable, `$timer(options)`, that builds a countdown, a countup or a stopwatch on a drift-resistant engine — elapsed time is recomputed from the wall clock on every tick, never accumulated.

## Installation

```sh
pnpm add @ailura/alpinejs-timer alpinejs
# or
npm install @ailura/alpinejs-timer alpinejs
```

Requires `alpinejs@^3.0.0` as peer. `@ailura/alpinejs-core` is a **peer
dependency**, not a dependency: no package in this toolkit has a
`dependencies` block, so the host installs it too.

## Usage

### 1. Standalone (framework-agnostic)

```ts
import { createTimerController, createStopwatchController } from "@ailura/alpinejs-timer";

const ctrl = createTimerController({ duration: 30_000, autoStart: true });
ctrl.on("tick", (snapshot) => console.log(snapshot.elapsed));
ctrl.on("complete", (snapshot) => console.log("done at", snapshot.elapsed));
ctrl.start();
ctrl.pause();
ctrl.resume();
ctrl.restart();
ctrl.reset();
ctrl.destroy(); // clears the pending timeout; every later mutation is a no-op
```

The stopwatch surface adds laps on top of the same methods:

```ts
import { createStopwatchController } from "@ailura/alpinejs-timer";

const sw = createStopwatchController();
sw.start();
const lap = sw.lap(); // → { id, index, elapsed, split, formatted, splitFormatted }
sw.fastestLap?.split;
sw.lastLap?.index;
sw.removeLap(lap!.id);
sw.clearLaps();
sw.destroy();
```

`createTimerController` and `createStopwatchController` return real controller
instances, so `laps` reads straight off the object. The Alpine magic returns a
reactive view instead — see [Laps in a template](#laps-in-a-template).

### 2. Alpine

```ts
import Alpine from "alpinejs";
import timerPlugin from "@ailura/alpinejs-timer";

Alpine.plugin(timerPlugin());
Alpine.start();
```

```html
<div x-data="{ t: $timer({ mode: 'down', duration: 60_000, autoStart: true }) }">
  <output x-text="t.formatted"></output>
  <progress max="1" x-bind:value="t.progress ?? 0"></progress>
  <button type="button" @click="t.toggle()" x-text="t.running ? 'Pause' : 'Start'"></button>
  <button type="button" @click="t.restart()">Restart</button>
</div>
```

The plugin registers `$timer` — a **callable**, not a namespace. Every call
builds a fresh instance, so `$timer()` twice is two independent timers.

> `formatted` is always a rendering of **elapsed**, in both directions, and the
> default layout has no hour field — it is `mm:ss.mmm`, so a 1-hour countdown
> reads `60:00.000`. To show time remaining, pass a `format` that formats the
> `remaining` part the callback is handed.

```html
<div
  x-data="{
    t: $timer({
      duration: 3_600_000,
      format: ({ remaining }) => new Date(remaining ?? 0).toISOString().slice(11, 19),
    })
  }"
>
  <output x-text="t.formatted"></output>
</div>
```

### Laps in a template

`lap()` records a lap on the controller but emits no event, so the lap fields on
the magic's reactive view are not refreshed by it. Use the `onLap` callback to
push laps into your own Alpine state — it is the option that is reactive:

```html
<div
  x-data="{ laps: [], sw: null }"
  x-init="sw = $timer({ mode: 'stopwatch', onLap: (lap) => laps.push(lap.splitFormatted) })"
>
  <output x-text="sw.formatted"></output>
  <button type="button" @click="sw.start()">Start</button>
  <button type="button" @click="sw.lap()">Lap</button>
  <button type="button" @click="sw.reset()">Reset</button>
  <ol>
    <template x-for="(split, i) in laps" :key="i">
      <li x-text="'Lap ' + (i + 1) + ' — ' + split"></li>
    </template>
  </ol>
</div>
```

## API

| Export                      | Description                                                                                                                                                    | Type             |
| --------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------- |
| `TimerControllerImpl`       | Controller class — countdown/countup state, `start`/`pause`/`resume`/`toggle`/`reset`/`restart`/`dispose`; emits `tick`, `complete`, `start`, `pause`, `reset` | `class`          |
| `StopwatchControllerImpl`   | Extends `TimerControllerImpl` with `lap()`, `laps`, `lastLap`, `fastestLap`, `slowestLap`, `removeLap()`, `clearLaps()`                                        | `class`          |
| `createTimerController`     | `createTimerController(options?) => TimerControllerImpl`                                                                                                       | `function`       |
| `createStopwatchController` | `createStopwatchController(options?) => StopwatchControllerImpl`                                                                                               | `function`       |
| `timerPlugin`               | Alpine plugin factory — `timerPlugin(options?) => AlpineCallback`; registers `$timer`                                                                          | `function`       |
| `DEFAULT_TIMER_MAGIC_KEY`   | Default magic key — `"timer"`                                                                                                                                  | `string` (const) |
| `TimerController`           | Public controller interface — the 12 readonly fields plus the 7 methods                                                                                        | `type`           |
| `StopwatchController`       | `TimerController` plus the lap surface                                                                                                                         | `type`           |
| `StopwatchLap`              | One recorded lap — `{ id, index, elapsed, split, formatted, splitFormatted }`                                                                                  | `type`           |
| `StopwatchOptions`          | `CreateTimerOptions` with `mode` narrowed to `"stopwatch"`, plus `lapFormat`, `lapFormatPattern`, `onLap`                                                      | `type`           |
| `TimerOptions`              | Alias of `CreateTimerOptions` — the argument of `$timer()`                                                                                                     | `type`           |
| `CreateTimerOptions`        | Constructor options, every field documented under [Options](#options)                                                                                          | `type`           |
| `CreateTimerPluginOptions`  | Plugin options — `{ magicKey? }`                                                                                                                               | `type`           |
| `TimerMagic`                | `$timer` — an overloaded call: `TimerController` or `StopwatchController`                                                                                      | `type`           |
| `TimerMode`                 | `"down" \| "up" \| "stopwatch"`                                                                                                                                | `type`           |
| `TimerDirection`            | `"up" \| "down"` — resolved from `mode`; a stopwatch reports `"down"`                                                                                          | `type`           |
| `TimerSnapshot`             | Immutable value object emitted with `tick`/`complete` and passed to `onTick`/`onComplete`                                                                      | `type`           |
| `TimerState`                | Alias of `TimerSnapshot`                                                                                                                                       | `type`           |
| `TimerFormatParts`          | What a custom `format` is handed — `{ hours, minutes, seconds, milliseconds, elapsed, remaining }`                                                             | `type`           |
| `TimerFormatter`            | `(parts: TimerFormatParts) => string`                                                                                                                          | `type`           |
| `TimerEvents`               | Event map for `controller.on(…)`                                                                                                                               | `type`           |
| `TimerAlpine`               | The `Alpine` type the plugin accepts — `unknown`                                                                                                               | `type`           |
| `TimerPluginCallback`       | `(alpine: unknown) => void`                                                                                                                                    | `type`           |

### Options

```ts
type CreateTimerOptions = {
  mode?: TimerMode; // "down" (default) | "up" | "stopwatch"
  duration?: number; // stop after this many ms — default: null (runs until stopped)
  limit?: number; // the same target, spelled for a countup
  initialElapsed?: number; // starting value — default: 0
  autoStart?: boolean; // call start() in the constructor — default: false
  precision?: number; // ms between ticks — default: 16
  repeat?: boolean | number; // restart on completion; a number caps the repeats
  format?: TimerFormatter; // custom layout for `formatted`
  formatPattern?: string; // accepted, never read — use `format`
  onTick?: (timer: TimerSnapshot) => void;
  onComplete?: (timer: TimerSnapshot) => void;
  id?: string; // controller id — default: generateId("timer")
};
```

| Option           | Default  | Description                                                                                                  |
| ---------------- | -------- | ------------------------------------------------------------------------------------------------------------ |
| `mode`           | `"down"` | `"up"` counts up, `"stopwatch"` builds a `StopwatchController`. Any other value is treated as `"down"`.      |
| `duration`       | `null`   | Milliseconds before the timer stops and `complete` fires. `null` runs until stopped. `limit` is an alias.    |
| `initialElapsed` | `0`      | Starting value, e.g. to resume a countdown where it left off. `start()` builds on it rather than zeroing it. |
| `autoStart`      | `false`  | `start()` in the constructor. Needed for a timer built in `x-init` to be running on first paint.             |
| `precision`      | `16`     | Milliseconds between ticks. Because elapsed is recomputed each tick, this is refresh rate only — see below.  |
| `repeat`         | `false`  | `true` restarts forever on completion; a number restarts that many times. `iteration` counts the restarts.   |
| `format`         | —        | Replaces the `mm:ss.mmm` default. Receives the elapsed breakdown plus `remaining`.                           |
| `onTick`         | —        | Called with a `TimerSnapshot` on every tick, including the final one at completion.                          |
| `onComplete`     | —        | Called with a `TimerSnapshot` after `complete` is emitted. A `repeat` restart happens after this returns.    |

Plugin-level:

```ts
type CreateTimerPluginOptions = {
  magicKey?: string; // default: DEFAULT_TIMER_MAGIC_KEY ("timer")
};
```

### Avoiding name collisions

There is no store here — only one magic. If `$timer` is already taken:

```ts
Alpine.plugin(timerPlugin({ magicKey: "clock" })); // → $clock
```

`DEFAULT_TIMER_MAGIC_KEY` keeps the default discoverable from TypeScript.

## Events

```ts
import type { TimerSnapshot } from "@ailura/alpinejs-timer";

const ctrl = createTimerController();
const off = ctrl.on("tick", (snapshot: TimerSnapshot) => console.log(snapshot.elapsed));
off(); // `on` returns the unsubscribe
```

| Event      | Detail          | Emitted when                                                    |
| ---------- | --------------- | --------------------------------------------------------------- |
| `start`    | none            | A stopped or paused timer begins running                        |
| `pause`    | none            | A running timer is paused                                       |
| `tick`     | `TimerSnapshot` | Every `precision` ms, and once more at the moment of completion |
| `complete` | `TimerSnapshot` | `elapsed` reached `duration`; carries `completed: true`         |
| `reset`    | none            | `reset()` cleared the state                                     |

`destroy()` does not emit `complete` — a released timer just stops.

## Drift resistance

The engine is a repeating `setTimeout`, and it deliberately does **not** add the
interval to a counter. Each tick computes `elapsed = startElapsed + (Date.now() -
startWall)`, so a timeout that fires late, a background tab that throttles
timers to once a second, or a dropped frame all cost nothing: the next tick
lands on the true elapsed time rather than on the sum of a series of
individually-late intervals.

Two consequences worth knowing:

- `precision` (default 16 ms) is how often the value is **refreshed**, not how
  far it may wander. A throttled tab still reports correct elapsed time, just
  less often.
- The clock is `Date.now()`, which is wall-clock, not monotonic. A system clock
  change mid-run moves the timer with it.

`remaining` is always `duration - elapsed` clamped at 0, in both directions — for
a countup with a `limit` it means "how far to the target", not "time left".

## SSR

> Import-safe: no `window`/`document` is read at module scope, and the engine
> only ever touches `Date.now()` and `setTimeout`, both of which a Node server
> has. Build a timer after mount and `start()` it on the client; nothing here
> needs a browser to be importable.

## Integration

- **@ailura/alpinejs-core** — `BaseController` (lifecycle, typed events) and
  `generateId()`.
- Standalone in any stack — the controller has no Alpine import at runtime.

## Limitations

- **Lap fields are not reactive through the magic.** `lap()` records the lap on
  the controller but emits no event, so `sw.laps` / `sw.lastLap` on the view
  `$timer()` returns stay at their initial values. Use the `onLap` option, as
  shown above, or the standalone `createStopwatchController()`.
- **`formatted` has no hour field.** The default is `mm:ss.mmm` with minutes
  unbounded, and it renders _elapsed_ in both directions. A countdown has to
  format `remaining` itself.
- **`direction` reads `"down"` on a stopwatch.** `mode: "stopwatch"` is not
  `"up"`, and the constructor maps anything else to its default. `elapsed` is
  what counts up; the `StopwatchController` type is what distinguishes it.
- **`formatPattern` / `lapFormatPattern` are accepted and never read.** There is
  no pattern parser; pass `format` / `lapFormat`.
- **Mutators are not all frozen-guarded.** `start()` is a no-op after `destroy()`,
  but `pause()`, `reset()` and the lap methods still mutate their fields. Release
  a view rather than relying on every method being inert.
- **`repeat` is not re-entrant.** A `repeat` restart happens inside the
  completion tick, after `onComplete` has returned; `iteration` counts restarts,
  not completions.
- **Test coverage is one file** (`test/magic-cleanup.test.ts`, 5 tests) covering
  element teardown through Alpine's `cleanup()` and standalone disposal. The
  engine's own drift behaviour is not under test.

## Size

`4.88 kB raw / 1.94 kB gzip` · budget `3.5 kB` · externalized peers: `alpinejs`,
`@ailura/alpinejs-core` · `size-limit` + `publint` + `attw` verified.

## Architecture

[Primitives layer](../../ARCHITECTURE.md) — controllers own state, Alpine owns reactivity. See canon, guards, and SSR rules in [ARCHITECTURE.md](../../ARCHITECTURE.md).

## Testing

```sh
pnpm test              # vp test (happy-dom)
pnpm run typecheck     # tsc --noEmit
```

Uses `@ailura/alpinejs-testing` — `html`/`mount`/`settled`/`start`/`resume`/`reset`. See [ARCHITECTURE.md §8](../../ARCHITECTURE.md).

## License

MIT
