// @vitest-environment happy-dom
/**
 * The timer demo's `x-data` expressions must evaluate, and the countdown must
 * count DOWN.
 *
 * The regression this pins: both countdown widgets declared their `clock`
 * formatter as a property of the very object literal that used it —
 *
 *     x-data="{ clock: (ms) => …, timer: $timer({ mode: 'down', format: ({ remaining }) => clock(remaining ?? 0) }) }"
 *
 * A property name creates no binding, so `clock` inside the `format` closure
 * was a free variable. The controller called that closure while building the
 * view, the whole `x-data` threw `clock is not defined`, and because the object
 * never evaluated, the `clock(...)` reads in the `x-text` readouts failed too.
 * Nothing about the page looked wrong: it was a runtime failure inside a string
 * that reads perfectly well.
 *
 * The expressions now start with `const`, which makes Alpine wrap them in an
 * IIFE so `clock` is a real binding the closure captures. The countup is a
 * plain object literal because it captures nothing — and an expression that
 * does not start with `let`/`const` is not wrapped, so a `return` there would
 * be a syntax error.
 *
 * The second half pins what the demo claims to demonstrate: `formatted` is a
 * breakdown of ELAPSED in both directions, so a countdown has to format
 * `remaining`. The old demo formatted `hours`/`minutes`/`seconds` and both
 * "countdowns" ticked upwards from 00:00.
 *
 * The markup is mounted for real rather than evaluated through
 * `Alpine.evaluate`, whose default receiver discards the result.
 */

import { reset, resume, settled, start } from "@ailura/alpinejs-testing";
import timerPlugin from "@ailura/alpinejs-timer";
import Alpine from "alpinejs";
import { afterEach, beforeAll, beforeEach, describe, expect, test } from "vite-plus/test";

import { countdownTimerData, countupTimerData } from "../src/demo/timer-demo";

/** Captures what Alpine reports, so a thrown expression cannot pass silently. */
function captureErrors<T>(run: () => T): { result: T; errors: string[] } {
  const errors: string[] = [];
  const original = console.error;
  console.error = (...args: unknown[]): void => {
    errors.push(args.map(String).join(" "));
  };
  try {
    return { result: run(), errors };
  } finally {
    console.error = original;
  }
}

function referenceErrors(errors: string[]): string[] {
  return errors.filter((e) => /is not defined|SyntaxError|Unexpected token/.test(e));
}

function text(testid: string): string {
  return document.querySelector(`[data-testid="${testid}"]`)?.textContent ?? "";
}

beforeAll(() => start(() => {}));

beforeEach(() => {
  Alpine.plugin(timerPlugin());
  resume();
});

afterEach(() => {
  document.body.innerHTML = "";
  reset();
});

describe("timer demo x-data expressions", () => {
  test("no expression calls a name it only declared as a property", () => {
    // The exact shape that broke: `clock` used inside the object literal that
    // also declares it as a property.
    for (const expression of [countdownTimerData(1_000), countupTimerData(1_000)]) {
      const declaredAsProperty = /[{,]\s*clock\s*:/.test(expression);
      const used = /\bclock\s*\(/.test(expression);
      if (declaredAsProperty && used) {
        throw new Error(
          `x-data declares \`clock\` as a property and also calls it — the closure ` +
            `captures a free variable. Keep the object literal synchronous and ` +
            `self-contained.\n${expression}`
        );
      }
    }
    expect(true).toBe(true);
  });

  test("the countdown widget mounts without a ReferenceError", async () => {
    const { errors } = captureErrors(() => {
      document.body.innerHTML = `<div x-data="${countdownTimerData(10_000)}">
        <span data-testid="formatted" x-text="timer.formatted"></span>
        <span data-testid="clock" x-text="clock(timer.remaining ?? 0)"></span>
      </div>`;
    });
    await settled();

    expect(referenceErrors(errors)).toEqual([]);
    expect(text("formatted")).toMatch(/^\d{2}:\d{2}$/);
    expect(text("clock")).toMatch(/^\d{2}:\d{2}$/);
  });

  test("the countup widget mounts without a ReferenceError", async () => {
    const { errors } = captureErrors(() => {
      document.body.innerHTML = `<div x-data="${countupTimerData(60_000)}">
        <span data-testid="countup" x-text="counter.formatted"></span>
      </div>`;
    });
    await settled();

    expect(referenceErrors(errors)).toEqual([]);
    expect(text("countup")).toMatch(/^\d{2}:\d{2}/);
  });
});

describe("the demo's countdown actually counts down", () => {
  test("formatted starts at the duration and decreases", async () => {
    captureErrors(() => {
      document.body.innerHTML = `<div x-data="${countdownTimerData(10_000)}">
        <span data-testid="formatted" x-text="timer.formatted"></span>
        <button data-testid="go" @click="timer.toggle()"></button>
      </div>`;
    });
    await settled();

    // A 10s countdown shows the time REMAINING, so it starts high...
    expect(text("formatted")).toBe("00:10");

    document.querySelector<HTMLButtonElement>('[data-testid="go"]')?.click();
    await new Promise((resolve) => setTimeout(resolve, 1_300));
    await settled();

    // ...and goes down. Formatting `elapsed` instead climbed from 00:00, which is
    // what the demo used to do.
    expect(text("formatted")).not.toBe("00:00");
    expect(text("formatted") < "00:10").toBe(true);
  });

  test("elapsed and remaining move in opposite directions", async () => {
    captureErrors(() => {
      document.body.innerHTML = `<div x-data="${countdownTimerData(10_000)}">
        <span data-testid="elapsed" x-text="String(timer.elapsed)"></span>
        <span data-testid="remaining" x-text="String(timer.remaining)"></span>
        <button data-testid="go" @click="timer.toggle()"></button>
      </div>`;
    });
    await settled();
    document.querySelector<HTMLButtonElement>('[data-testid="go"]')?.click();
    await new Promise((resolve) => setTimeout(resolve, 1_300));
    await settled();

    const elapsed = Number(text("elapsed"));
    const remaining = Number(text("remaining"));

    expect(elapsed).toBeGreaterThan(0);
    expect(remaining).toBeLessThan(10_000);
  });
});
