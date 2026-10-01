import { guardMagic } from "@ailura/alpinejs-core/guards";
import type { Alpine } from "alpinejs";

import { createTimerController, createStopwatchController } from "./controller";
import type {
  CreateTimerPluginOptions,
  StopwatchController,
  StopwatchOptions,
  TimerController,
  TimerMagic,
  TimerOptions,
} from "./types";
import { DEFAULT_TIMER_MAGIC_KEY } from "./types";

const packageName = "@ailura/alpinejs-timer";

function reactiveController<T extends object>(
  controller: T,
  reactive: (v: unknown) => unknown,
  fields: ReadonlyArray<keyof T>
): T {
  const view = reactive({}) as unknown as Record<string, unknown>;
  // Delegate prototype methods via closure so `this` stays the real controller
  // (never the reactive proxy — class `#private` members would throw).
  //
  // The WHOLE prototype chain, not just the nearest one. `StopwatchControllerImpl`
  // extends `TimerControllerImpl`, so walking one level only copied `lap` and
  // friends: a stopwatch built through the magic had `start`, `pause`, `reset`
  // and `toggle` as `undefined`, and could never be armed. The docs worked
  // around it by telling people not to use the magic for stopwatches — which was
  // only tolerable while a stopwatch was a separate magic method; with `$timer`
  // collapsed into one call it is the *only* way to build one.
  const delegated = new Set<string>();
  for (
    let proto = Object.getPrototypeOf(controller) as object | null;
    proto && proto !== Object.prototype;
    proto = Object.getPrototypeOf(proto) as object | null
  ) {
    for (const key of Object.getOwnPropertyNames(proto)) {
      if (delegated.has(key)) continue;
      const descriptor = Object.getOwnPropertyDescriptor(proto, key);
      if (key === "constructor" || typeof descriptor?.value !== "function") continue;
      delegated.add(key);
      view[key] = (...args: unknown[]) =>
        (controller as unknown as Record<string, (...a: unknown[]) => unknown>)[key](...args);
    }
  }
  // Class getters are invisible to the proxy, so the values Alpine must
  // re-render on are copied onto the view by hand and refreshed on every event
  // the controller emits.
  const sync = (): void => {
    const source = controller as unknown as Record<string, unknown>;
    for (const key of fields) view[key as string] = source[key as string];
  };
  const on = (controller as unknown as { on?: (event: string, fn: () => void) => void }).on;
  if (on) {
    const subscribe = on.bind(controller);
    for (const event of ["tick", "complete", "start", "pause", "reset", "change", "lap"]) {
      subscribe(event, sync);
    }
  }
  sync();
  return view as unknown as T;
}

export function timerPlugin(options: CreateTimerPluginOptions = {}): (alpine: Alpine) => void {
  const magicKey = options.magicKey ?? DEFAULT_TIMER_MAGIC_KEY;

  return function registerTimer(alpine: Alpine): void {
    const maybeReactive = (alpine as unknown as { reactive?: (v: unknown) => unknown }).reactive;

    // The `cleanup` of the element whose expression Alpine is evaluating
    // right now. Alpine 3.17 gives a plugin no teardown of its own — `plugin()`
    // discards the callback's return value and the Alpine object exposes no
    // `cleanup`/`stop()` — but it does hand the magic callback `(el, utilities)`
    // for that element, and `cleanup` queues a teardown in `el._x_cleanups`,
    // which `cleanupElement` drains when the element leaves the tree. The
    // factory call happens synchronously right afterwards in the same
    // expression, so that is the element the view belongs to.
    let elementCleanup: ((callback: () => void) => void) | null = null;

    const wrap = <T extends object>(controller: T, fields: ReadonlyArray<keyof T>): T => {
      const view = maybeReactive
        ? reactiveController(controller, maybeReactive, fields)
        : controller;
      // Outside a template expression no magic callback has run, so there is
      // no element to hang the teardown on: the view is still returned fully
      // usable, and the caller owns `dispose()`.
      elementCleanup?.(() => {
        // `dispose()` is the controller's own release hook; it clears the
        // pending timeout and runs the `BaseController` teardown, so a
        // released view can no longer be re-armed with `start()`.
        (controller as { dispose(): void }).dispose();
      });
      return view;
    };

    const TIMER_FIELDS = [
      "id",
      "direction",
      "running",
      "paused",
      "completed",
      "elapsed",
      "remaining",
      "duration",
      "progress",
      "formatted",
      "iteration",
    ] as const;

    const STOPWATCH_FIELDS = [
      ...TIMER_FIELDS,
      "laps",
      "lastLap",
      "fastestLap",
      "slowestLap",
    ] as const;

    // One callable, not a namespace of four. `mode` is the whole difference
    // between a countdown, a countup and a stopwatch, so it is one option and
    // not three method names the caller has to choose between correctly.
    const magic = ((opts?: TimerOptions | StopwatchOptions) => {
      if (opts?.mode === "stopwatch") {
        // Narrowed by the branch, so the cast is only about the generic
        // `StopwatchControllerImpl` and the public `StopwatchController`.
        const stopwatch = createStopwatchController(opts as StopwatchOptions);
        return wrap(stopwatch, STOPWATCH_FIELDS) as unknown as StopwatchController;
      }
      const timer = createTimerController(opts as TimerOptions | undefined);
      return wrap(timer, TIMER_FIELDS) as unknown as TimerController;
    }) as TimerMagic;

    guardMagic(
      alpine,
      magicKey,
      (_el, utilities) => {
        elementCleanup = utilities.cleanup;
        // Only the factory call that follows in the same expression belongs
        // to this element; a later call from an event handler or from plain
        // JavaScript must not inherit it.
        queueMicrotask(() => {
          elementCleanup = null;
        });
        return magic;
      },
      packageName
    );
  };
}

export default timerPlugin;
