// @vitest-environment happy-dom
/**
 * `$timer` teardown through Alpine's own `cleanup()` utility.
 *
 * A timer created by the magic owns a drift-corrected `setTimeout` that
 * nothing released, and Alpine 3.17 gives a plugin no teardown of its own:
 * `plugin()` discards the callback's return value and the Alpine object exposes
 * no `cleanup`/`stop()`. The magic callback, however, is invoked as
 * `(el, utilities)` for the element whose expression is being evaluated, and
 * `cleanup` is in those utilities. The factory call happens immediately
 * afterwards in the same expression, so that is the element the view belongs to.
 *
 * Every timing assertion runs on a controlled clock (`vi.useFakeTimers` plus
 * `vi.advanceTimersByTime`), never on a sleep. The clock is only installed
 * around the timer advancement: Alpine's `nextTick` schedules through
 * `setTimeout`, so `settled()` would deadlock while timers are faked.
 */
import { html, mount, reset, resume, start } from "@ailura/alpinejs-testing";
import Alpine, { type Alpine as AlpineInstance, type MagicUtilities } from "alpinejs";
import { afterEach, beforeAll, beforeEach, describe, expect, test, vi } from "vite-plus/test";

import { timerPlugin } from "../src/plugin";
import type { TimerMagic } from "../src/types";

/** Counts the controller's `onTick` callbacks, the observable proof of ticking. */
const tick = vi.fn();

declare global {
  // eslint-disable-next-line no-var
  var __ticks: ((snapshot: unknown) => void) | undefined;
}

type PublishedView = { start(): void; dispose(): void; elapsed: number };

function published(): PublishedView {
  return (globalThis as unknown as { __tm: PublishedView }).__tm;
}

beforeAll(() => {
  start(timerPlugin());
});

/**
 * `settled()` cannot be used with a faked clock: Alpine's `nextTick` releases
 * through `setTimeout`, so the promise never resolves. This drives the same
 * flush by hand — yield so `nextTick` has registered its timeout, then advance
 * the faked clock by a millisecond to let it fire. Every millisecond advanced
 * is also one millisecond of the timer's own clock, which is what makes the
 * assertions below a controlled clock rather than a sleep.
 */
async function settle(times = 4): Promise<void> {
  for (let i = 0; i < times; i += 1) {
    const released = Alpine.nextTick();
    await Promise.resolve();
    vi.advanceTimersByTime(1);
    await released;
  }
}

beforeEach(() => {
  resume();
  vi.useFakeTimers();
  tick.mockClear();
  globalThis.__ticks = tick;
});

afterEach(() => {
  vi.useRealTimers();
  delete (globalThis as unknown as { __tm?: unknown }).__tm;
  reset();
});

describe("$timer teardown through the element's cleanup", () => {
  test("a view created in a template expression keeps ticking while the element lives", async () => {
    mount(
      html(
        '<div x-data="{ tm: $timer({ mode: `down`, duration: 1000, autoStart: true, onTick: (s) => window.__ticks(s) }) }">' +
          '<span x-text="tm.formatted"></span></div>'
      )
    );
    await settle();
    expect(tick).not.toHaveBeenCalled();

    vi.advanceTimersByTime(50);
    expect(tick).toHaveBeenCalled();
  });

  test("a view created in a template expression stops ticking after element removal", async () => {
    const root = html(
      '<div x-data="{ tm: $timer({ mode: `down`, duration: 60000, autoStart: true, onTick: (s) => window.__ticks(s) }) }" x-init="window.__tm = tm">' +
        '<span x-text="tm.formatted"></span></div>'
    );
    mount(root);
    await settle();

    vi.advanceTimersByTime(100);
    const whileAlive = tick.mock.calls.length;
    expect(whileAlive).toBeGreaterThan(0);

    root.remove();
    await settle();

    vi.advanceTimersByTime(5000);
    expect(tick.mock.calls.length).toBe(whileAlive);
  });

  test("the released view is torn down, not merely paused", async () => {
    const root = html(
      '<div x-data="{ tm: $timer({ mode: `down`, duration: 60000, autoStart: true, onTick: (s) => window.__ticks(s) }) }" x-init="window.__tm = tm"></div>'
    );
    mount(root);
    await settle();

    vi.advanceTimersByTime(100);
    const whileAlive = tick.mock.calls.length;
    expect(whileAlive).toBeGreaterThan(0);

    root.remove();
    await settle();

    // `start()` on a destroyed controller is a no-op, so nothing re-arms the
    // timeout. A mere `clearTimeout` would schedule again here.
    published().start();
    vi.advanceTimersByTime(5000);
    expect(tick.mock.calls.length).toBe(whileAlive);
  });
});

describe("$timer called outside a template expression", () => {
  /** Minimal Alpine double capturing the registered magic callback. */
  function captureMagic(): (el: Element, utilities: MagicUtilities) => TimerMagic {
    let captured: ((el: Element, utilities: MagicUtilities) => TimerMagic) | undefined;
    const alpine = {
      magic(name: string, callback: (el: Element, utilities: MagicUtilities) => TimerMagic) {
        if (name === "timer") captured = callback;
      },
    } as unknown as AlpineInstance;
    timerPlugin()(alpine);
    if (!captured) throw new Error("timer magic was not registered");
    return captured;
  }

  test("a factory called from plain JavaScript returns a fully usable view", async () => {
    const magic = captureMagic();
    const cleanups: Array<() => void> = [];
    // The magic callback ran, but the factory is called a turn later, from
    // plain JavaScript rather than from the same expression: there is no live
    // element, so nothing is registered for release.
    const factories = magic(document.createElement("div"), {
      cleanup: (cb: () => void) => cleanups.push(cb),
    } as unknown as MagicUtilities);
    await Promise.resolve();
    const view = factories({ mode: "down", duration: 1000 });

    view.start();
    vi.advanceTimersByTime(100);
    expect(view.elapsed).toBeGreaterThan(0);
    expect(view.running).toBe(true);

    const after = view.elapsed;
    vi.advanceTimersByTime(1000);
    expect(view.elapsed).not.toBe(after);
    expect(cleanups.length).toBe(0);

    // The caller owns the teardown when there is no element to hang it on.
    view.dispose();
    const disposed = view.elapsed;
    vi.advanceTimersByTime(1000);
    expect(view.elapsed).toBe(disposed);
  });

  test("a factory called in the same expression as the magic registers its teardown", () => {
    const magic = captureMagic();
    const cleanups: Array<() => void> = [];
    const view = magic(document.createElement("div"), {
      cleanup: (cb: () => void) => cleanups.push(cb),
    } as unknown as MagicUtilities)({ mode: "stopwatch" });

    expect(cleanups.length).toBe(1);

    view.start();
    vi.advanceTimersByTime(100);
    const elapsed = view.elapsed;
    expect(elapsed).toBeGreaterThan(0);

    // Alpine drains `el._x_cleanups`; the DOM tests above prove that path for
    // real, this one only checks the teardown is registered and runs.
    for (const off of cleanups) off();
    const released = view.elapsed;
    vi.advanceTimersByTime(1000);
    expect(view.elapsed).toBe(released);
  });
});
