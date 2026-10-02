// @vitest-environment happy-dom
/**
 * `x-gesture` — the Alpine binding, end to end.
 *
 * The bug this file exists for: the directive used to share ONE controller
 * across every element it was applied to, and `attach()` detaches whatever it
 * was previously attached to. With two gesture surfaces in one page the second
 * `x-gesture` moved the listeners off the first, so the first surface went
 * completely silent — which is what a phone user sees as "it does nothing".
 *
 * The handler contract is covered here too: `evaluateLater` auto-evaluates a
 * function result, so the detail must travel through `params` (giving the
 * handler its `this` and the detail) instead of being applied by the receiver
 * (which called it with neither).
 */
import { html, mount, reset, resume, settled, start } from "@ailura/alpinejs-testing";
import Alpine from "alpinejs";
import { afterEach, beforeAll, beforeEach, describe, expect, test } from "vite-plus/test";

import { gesturePlugin } from "../src/plugin";
import type { GestureStore } from "../src/types";

interface PointerInit extends PointerEventInit {
  pointerId?: number;
  pointerType?: string;
}

function pointer(type: string, init: PointerInit = {}): PointerEvent {
  return new PointerEvent(type, {
    bubbles: true,
    pointerId: 1,
    pointerType: "touch",
    isPrimary: true,
    ...init,
  });
}

/** The `x-data` scope Alpine built for the first child of the snippet root. */
function scope<T>(root: Element): T {
  const child = root.firstElementChild;
  if (!(child instanceof HTMLElement)) throw new Error("snippet root has no element");
  return Alpine.$data(child) as T;
}

function find(root: ParentNode, selector: string): HTMLElement {
  const found = root.querySelector(selector);
  if (!(found instanceof HTMLElement)) throw new Error(`no element for ${selector}`);
  return found;
}

function at([x, y]: [number, number], pointerId: number): PointerInit {
  return { clientX: x, clientY: y, pointerId };
}

/** Down, move through the middle points, up — the whole life of one finger. */
function swipe(target: Element, points: Array<[number, number]>, pointerId = 1): void {
  target.dispatchEvent(pointer("pointerdown", at(points[0], pointerId)));
  for (const point of points.slice(1, -1)) {
    target.dispatchEvent(pointer("pointermove", at(point, pointerId)));
  }
  target.dispatchEvent(pointer("pointerup", at(points[points.length - 1], pointerId)));
}

function tap(target: Element, [x, y] = [10, 10] as [number, number], pointerId = 1): void {
  target.dispatchEvent(pointer("pointerdown", at([x, y], pointerId)));
  target.dispatchEvent(pointer("pointerup", at([x, y], pointerId)));
}

/**
 * One wheel tick. happy-dom's `WheelEvent` drops the inherited `clientX` /
 * `clientY` / `ctrlKey` fields, so they are assigned the way a browser sets
 * them before dispatch.
 */
function wheel(
  target: Element,
  init: WheelEventInit & { x?: number; y?: number } = {}
): WheelEvent {
  const event = new WheelEvent("wheel", { bubbles: true, cancelable: true, ...init });
  const fields = event as unknown as Record<string, unknown>;
  fields["clientX"] = init.x ?? 0;
  fields["clientY"] = init.y ?? 0;
  target.dispatchEvent(event);
  return event;
}

beforeAll(() => {
  start(gesturePlugin());
});

beforeEach(() => {
  resume();
});

afterEach(() => {
  reset();
});

const store = () => Alpine.store("gesture") as GestureStore;

/**
 * Every key the state declares, spelled out here on purpose.
 *
 * The store's accessors are generated from that list, so a key dropped from
 * the generation would be readable as `undefined` from `$store.gesture` and
 * nothing else would fail. This is the test that makes the mirror's own-key
 * set a contract rather than a side effect.
 */
const STATE_KEYS = [
  "active",
  "kind",
  "x",
  "y",
  "distanceX",
  "distanceY",
  "totalDistance",
  "velocityX",
  "velocityY",
  "pointerCount",
  "scale",
  "rotation",
  "direction",
  "button",
  "buttons",
  "pointerType",
  "deltaX",
  "deltaY",
];

describe("the store mirror", () => {
  test("carries every state key plus cancel, and nothing else", () => {
    const own = Object.getOwnPropertyNames(store());

    // Compared as a set: the order is an implementation detail, the keys are
    // the contract.
    expect(new Set(own)).toEqual(new Set([...STATE_KEYS, "cancel"]));
    expect(own).toHaveLength(STATE_KEYS.length + 1);
  });

  test("each state key is a read-through own accessor Alpine can walk", () => {
    for (const key of STATE_KEYS) {
      const descriptor = Object.getOwnPropertyDescriptor(store(), key);
      expect(descriptor?.enumerable, `${key} must be enumerable`).toBe(true);
      expect(typeof descriptor?.get, `${key} must be a getter`).toBe("function");
      // Nothing writes through the store: the mirror follows the recognizer.
      expect(descriptor?.set, `${key} must not have a setter`).toBeUndefined();
    }
  });

  test("reads live controller state through the generated accessors", async () => {
    const el = html(`
      <div x-data="{}"><div id="surface" x-gesture.tap="() => {}"></div></div>
    `);
    mount(el as HTMLElement);
    await settled();

    // The values come from the live controller, through the generated accessors.
    tap(find(el, "#surface"), [12, 34]);
    await settled();

    expect(store().x).toBe(12);
    expect(store().y).toBe(34);
  });
});

describe("x-gesture on multiple elements", () => {
  test("every surface fires, not only the last one bound", async () => {
    const el = html(`
      <div x-data="{ log: [] }">
        <div id="a" x-gesture.tap="log.push('a')"></div>
        <div id="b" x-gesture.tap="log.push('b')"></div>
      </div>
    `);
    mount(el as HTMLElement);
    await settled();

    tap(find(el, "#a"));
    await settled();
    tap(find(el, "#b"));
    await settled();

    expect([...scope<{ log: string[] }>(el).log]).toEqual(["a", "b"]);
  });

  test("a surface added later does not silence the earlier one", async () => {
    const el = html(`
      <div x-data="{ log: [] }">
        <div id="a" x-gesture.tap="log.push('a')"></div>
        <div id="late" x-data="{}"><span id="b" x-gesture.tap="log.push('b')"></span></div>
      </div>
    `);
    mount(el as HTMLElement);
    await settled();

    tap(find(el, "#a"));
    await settled();
    tap(find(el, "#b"));
    await settled();
    // Past the doubletap window, or this would be a `doubletap` and `.tap` is
    // correctly not called again.
    await new Promise((resolve) => setTimeout(resolve, 350));
    tap(find(el, "#a"));
    await settled();

    expect([...scope<{ log: string[] }>(el).log]).toEqual(["a", "b", "a"]);
  });
});

describe("handler contract", () => {
  test("the handler receives the detail and its own `this`", async () => {
    const el = html(`
      <div x-data="{ seen: null, onTap(d) { this.seen = d } }">
        <div id="surface" x-gesture.tap="onTap"></div>
      </div>
    `);
    mount(el as HTMLElement);
    await settled();

    tap(find(el, "#surface"));
    await settled();

    const data = scope<{ seen: { kind: string } | null }>(el);
    expect(data.seen?.kind).toBe("tap");
  });

  test("each modifier only sees its own gesture", async () => {
    const el = html(`
      <div x-data="{ log: [] }">
        <div id="surface" x-gesture.tap="log.push('tap')" x-gesture.swipe="log.push('swipe')"></div>
      </div>
    `);
    mount(el as HTMLElement);
    await settled();
    const surface = find(el, "#surface");
    const log = () => [...scope<{ log: string[] }>(el).log];

    tap(surface);
    await settled();
    swipe(surface, [
      [0, 0],
      [40, 0],
      [120, 0],
    ]);
    await settled();

    expect(log()).toEqual(["tap", "swipe"]);
  });
});

describe("$store.gesture", () => {
  test("mirrors the live state of the surface in use", async () => {
    const el = html(`
      <div>
        <div id="a" x-gesture.pan="() => {}"></div>
        <div id="b" x-gesture.pan="() => {}"></div>
      </div>
    `);
    mount(el as HTMLElement);
    await settled();

    const a = find(el, "#a");
    a.dispatchEvent(pointer("pointerdown", { clientX: 0, clientY: 0 }));
    a.dispatchEvent(pointer("pointermove", { clientX: 30, clientY: 0 }));
    await settled();

    expect(store().active).toBe(true);
    expect(store().kind).toBe("pan");
    expect(store().distanceX).toBe(30);
    expect(store().pointerCount).toBe(1);

    a.dispatchEvent(pointer("pointerup", { clientX: 30, clientY: 0 }));
    await settled();
    expect(store().active).toBe(false);
  });

  test("cancel() drops the gesture in progress", async () => {
    const el = html(`
      <div x-data="{ taps: 0, onTap() { this.taps++ } }">
        <div id="surface" x-gesture.tap="onTap"></div>
      </div>
    `);
    mount(el as HTMLElement);
    await settled();
    const surface = find(el, "#surface");

    surface.dispatchEvent(pointer("pointerdown", { clientX: 5, clientY: 5 }));
    store().cancel();
    surface.dispatchEvent(pointer("pointerup", { clientX: 5, clientY: 5 }));
    await settled();

    expect(scope<{ taps: number }>(el).taps).toBe(0);
    expect(store().active).toBe(false);
  });
});

describe("x-gesture.wheel", () => {
  test("the modifier alone is enough to turn the wheel on", async () => {
    const el = html(`
      <div x-data="{ seen: null, onWheel(d) { this.seen = d } }">
        <div id="surface" x-gesture.wheel="onWheel"></div>
      </div>
    `);
    mount(el as HTMLElement);
    await settled();

    wheel(find(el, "#surface"), { deltaY: -100, x: 30, y: 40 });
    await settled();

    const seen = scope<{ seen: { kind: string; scale: number; deltaY: number } | null }>(el).seen;
    expect(seen?.kind).toBe("wheel");
    expect(seen?.deltaY).toBe(-100);
    expect(seen?.scale).toBeGreaterThan(1);
  });

  test("a surface without the modifier ignores the wheel", async () => {
    const el = html(`
      <div x-data="{ taps: 0, onTap() { this.taps++ } }">
        <div id="surface" x-gesture.tap="onTap"></div>
      </div>
    `);
    mount(el as HTMLElement);
    await settled();
    const surface = find(el, "#surface");

    // The tap gives the shared store a known state, so the assertion below is
    // about this surface's wheel never firing, not about a leftover session.
    tap(surface);
    await settled();
    expect(store().kind).toBe("tap");

    wheel(surface, { deltaY: -100 });
    await settled();

    expect(scope<{ taps: number }>(el).taps).toBe(1);
    expect(store().kind).toBe("tap");
    expect(store().scale).toBe(1);
    expect(store().deltaY).toBe(0);
  });

  test("a shared controller survives while a wheel binding is still mounted", async () => {
    const el = html(`
      <div x-data="{ log: [] }">
        <div id="surface" x-gesture.tap="log.push('tap')" x-gesture.wheel="log.push('wheel')"></div>
      </div>
    `);
    mount(el as HTMLElement);
    await settled();
    const surface = find(el, "#surface");

    tap(surface);
    wheel(surface, { deltaY: -100 });
    wheel(surface, { deltaY: -100 });
    await settled();

    expect([...scope<{ log: string[] }>(el).log]).toEqual(["tap", "wheel", "wheel"]);
  });
});

describe("$store.gesture", () => {
  test("mirrors the wheel deltas and scale", async () => {
    const el = html(`
      <div>
        <div id="surface" x-gesture.wheel="() => {}"></div>
      </div>
    `);
    mount(el as HTMLElement);
    await settled();

    wheel(find(el, "#surface"), { deltaX: 2, deltaY: 50, x: 12, y: 34 });
    await settled();

    expect(store().active).toBe(true);
    expect(store().kind).toBe("wheel");
    expect(store().x).toBe(12);
    expect(store().y).toBe(34);
    expect(store().deltaX).toBe(2);
    expect(store().deltaY).toBe(50);
    // The tilt axis is not mirrored: it drives nothing in the recognizer, so
    // it rides the `wheel` detail and not the state.
    expect("deltaZ" in store()).toBe(false);
    expect(store().scale).toBeLessThan(1);
  });

  test("cancel() ends the wheel session", async () => {
    const el = html(`
      <div>
        <div id="surface" x-gesture.wheel="() => {}"></div>
      </div>
    `);
    mount(el as HTMLElement);
    await settled();
    const surface = find(el, "#surface");

    wheel(surface, { deltaY: -100 });
    await settled();
    expect(store().scale).toBeGreaterThan(1);

    store().cancel();
    await settled();

    expect(store().active).toBe(false);
    expect(store().scale).toBe(1);
    expect(store().deltaY).toBe(0);
  });
});

describe("store focus", () => {
  test("an idle surface does not overwrite the state of the one in use", async () => {
    const el = html(`
      <div>
        <div id="a" x-gesture.pan="() => {}"></div>
        <div id="b" x-gesture.pan="() => {}"></div>
      </div>
    `);
    mount(el as HTMLElement);
    await settled();
    const a = find(el, "#a");
    const b = find(el, "#b");

    a.dispatchEvent(pointer("pointerdown", { clientX: 0, clientY: 0 }));
    a.dispatchEvent(pointer("pointermove", { clientX: 40, clientY: 0 }));
    expect(store().distanceX).toBe(40);

    // A second surface starts and finishes its own pan: the store follows it,
    // then keeps the last surface's values rather than a stale interleaving.
    b.dispatchEvent(pointer("pointerdown", { clientX: 0, clientY: 0 }));
    b.dispatchEvent(pointer("pointermove", { clientX: 15, clientY: 0 }));
    b.dispatchEvent(pointer("pointerup", { clientX: 15, clientY: 0 }));
    await settled();

    expect(store().active).toBe(false);
    expect(store().distanceX).toBe(15);
  });
});

describe("teardown", () => {
  test("removing a surface detaches its listeners", async () => {
    const el = html(`
      <div x-data="{ log: [] }">
        <div id="a" x-gesture.tap="log.push('a')"></div>
      </div>
    `);
    mount(el as HTMLElement);
    await settled();

    const a = find(el, "#a");
    tap(a);
    await settled();
    expect(scope<{ log: string[] }>(el).log).toHaveLength(1);

    a.remove();
    await settled();
    tap(a);
    await settled();
    expect(scope<{ log: string[] }>(el).log).toHaveLength(1);
  });
});
