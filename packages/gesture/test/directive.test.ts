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
import { afterEach, beforeAll, beforeEach, describe, expect, test, vi } from "vite-plus/test";

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
 *
 * `ctrlKey` defaults to `true`: the recognizer claims Ctrl+wheel only (it is
 * the browser's own page zoom), and a plain wheel belongs to the page. A test
 * that means a plain wheel passes `ctrlKey: false`.
 */
function wheel(
  target: Element,
  init: WheelEventInit & { x?: number; y?: number; ctrlKey?: boolean } = {}
): WheelEvent {
  const event = new WheelEvent("wheel", { bubbles: true, cancelable: true, ...init });
  const fields = event as unknown as Record<string, unknown>;
  fields["clientX"] = init.x ?? 0;
  fields["clientY"] = init.y ?? 0;
  fields["ctrlKey"] = init.ctrlKey ?? true;
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
  vi.restoreAllMocks();
});

/**
 * The `passive` flag of every `wheel` listener registered on `element`, in
 * order.
 *
 * Installed before `mount()`, because the directive attaches its listeners
 * while Alpine initializes the tree. happy-dom does not enforce passivity, so
 * the registration is the only place the flag can be observed from.
 */
function wheelFlags(element: Element): boolean[] {
  const flags: boolean[] = [];
  const add = element.addEventListener.bind(element);
  vi.spyOn(element, "addEventListener").mockImplementation(((
    type: string,
    listener: EventListenerOrEventListenerObject,
    options?: boolean | AddEventListenerOptions
  ) => {
    if (type === "wheel") flags.push((options as AddEventListenerOptions)?.passive === true);
    add(type, listener, options);
  }) as EventTarget["addEventListener"]);
  return flags;
}

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
  "committedScale",
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

describe("x-gesture .prevent", () => {
  /**
   * The reserved modifier, not a gesture kind.
   *
   * `x-gesture.prevent="fn"` on its own filters down to nothing, and a
   * directive with no gesture left is the bare directive: a `.tap`. Were
   * `prevent` treated as a kind instead, that binding would build a recognizer
   * whose kind filter never matches — the same dead binding as a misspelled
   * modifier, which is exactly what the modifier must not be.
   */
  test("a directive whose only modifier is the flag is still a tap", async () => {
    const el = html(`
      <div x-data="{ log: [] }">
        <div id="surface" x-gesture.prevent="log.push('tap')"></div>
      </div>
    `);
    mount(el as HTMLElement);
    await settled();
    const surface = find(el, "#surface");

    tap(surface);
    await settled();

    expect([...scope<{ log: string[] }>(el).log]).toEqual(["tap"]);
  });

  test("the flag does not widen the kinds a handler is filtered by", async () => {
    const el = html(`
      <div x-data="{ log: [] }">
        <div id="surface" x-gesture.wheel.prevent="log.push('wheel')"></div>
      </div>
    `);
    mount(el as HTMLElement);
    await settled();
    const surface = find(el, "#surface");

    tap(surface);
    wheel(surface, { deltaY: -100 });
    await settled();

    // `wheel` and nothing else: the handler filter is `wheel`, so `prevent`
    // cannot have survived into the kinds as a gesture of its own.
    expect([...scope<{ log: string[] }>(el).log]).toEqual(["wheel"]);
  });

  test("the modifier attaches the wheel listener non-passive and cancels the tick", async () => {
    const el = html(`
      <div x-data>
        <div id="surface" x-gesture.wheel.prevent="() => {}"></div>
      </div>
    `);
    // Installed before `mount()`, so the registration the directive performs
    // is the one under observation.
    const surface = find(el, "#surface");
    const flags = wheelFlags(surface);
    mount(el as HTMLElement);
    await settled();

    // One registration, and it is non-passive — a passive wheel listener
    // ignores `preventDefault()`, so this is what stops the page scrolling.
    expect(flags).toEqual([false]);
    expect(wheel(surface, { deltaY: -100 }).defaultPrevented).toBe(true);
  });

  test("the flag is per element: one surface opts in, its neighbour does not", async () => {
    const el = html(`
      <div x-data>
        <div id="blocking" x-gesture.wheel.prevent="() => {}"></div>
        <div id="plain" x-gesture.wheel="() => {}"></div>
      </div>
    `);
    const blocking = find(el, "#blocking");
    const plain = find(el, "#plain");
    const blockingFlags = wheelFlags(blocking);
    const plainFlags = wheelFlags(plain);
    mount(el as HTMLElement);
    await settled();

    // One plugin registration, two controllers, two answers: the modifier is
    // not global, and a surface that does not ask for it keeps the browser's
    // own Ctrl+wheel zoom.
    expect(blockingFlags).toEqual([false]);
    expect(plainFlags).toEqual([true]);
    expect(wheel(blocking, { deltaY: -100 }).defaultPrevented).toBe(true);
    expect(wheel(plain, { deltaY: -100 }).defaultPrevented).toBe(false);
  });

  test("a plain wheel is the page's, even on a surface that claimed Ctrl+wheel", async () => {
    const el = html(`
      <div x-data="{ zoomed: 0 }">
        <div
          id="surface"
          x-gesture.wheel.prevent="zoomed++"
          class="touch-none"
        ></div>
      </div>
    `);
    const surface = find(el, "#surface");
    mount(el as HTMLElement);
    await settled();

    // Scrolling the page over the surface is not hijacked: the modifier claims
    // the browser's own zoom gesture, not the wheel.
    const plain = wheel(surface, { deltaY: 120, ctrlKey: false });
    await settled();

    expect(scope<{ zoomed: number }>(el).zoomed).toBe(0);
    expect(plain.defaultPrevented).toBe(false);

    // The gesture it did claim still works, on the same surface.
    wheel(surface, { deltaY: -100 });
    await settled();

    expect(scope<{ zoomed: number }>(el).zoomed).toBe(1);
  });

  test("a later directive on the same element without the flag does not undo it", async () => {
    const el = html(`
      <div x-data="{ log: [] }">
        <div
          id="surface"
          x-gesture.wheel.prevent="log.push('wheel')"
          x-gesture.tap="log.push('tap')"
        ></div>
      </div>
    `);
    const surface = find(el, "#surface");
    const flags = wheelFlags(surface);
    mount(el as HTMLElement);
    await settled();

    // Both directives share one controller. The flag belongs to that
    // controller, so the second one — which omits it — must not re-attach the
    // wheel listener as passive.
    expect(flags).toEqual([false]);

    tap(surface);
    wheel(surface, { deltaY: -100 });
    await settled();

    expect([...scope<{ log: string[] }>(el).log]).toEqual(["tap", "wheel"]);
  });

  test("the plugin-level option still cancels, and the two paths agree", async () => {
    // A second registration under its own names: `start()` already claimed the
    // default `gesture` store and directive for this process.
    Alpine.plugin(
      gesturePlugin({ preventDefault: true, storeKey: "gesture-pd", directiveKey: "gesture-pd" })
    );
    const el = html(`
      <div x-data>
        <div id="surface" x-gesture-pd.wheel="() => {}"></div>
      </div>
    `);
    const surface = find(el, "#surface");
    const flags = wheelFlags(surface);
    mount(el as HTMLElement);
    await settled();

    // Same listener the modifier produces, so an existing consumer that set the
    // option globally sees no change at all.
    expect(flags).toEqual([false]);
    expect(wheel(surface, { deltaY: -100 }).defaultPrevented).toBe(true);
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

  test("mirrors the committed scale, which outlives the session", async () => {
    const el = html(`
      <div>
        <div id="surface" x-gesture.wheel="() => {}"></div>
      </div>
    `);
    mount(el as HTMLElement);
    await settled();
    const surface = find(el, "#surface");

    // The mirror needs no list of its own for this key: it is generated from
    // the same `emptyState()` the recognizer starts from.
    wheel(surface, { deltaY: -100 });
    await settled();

    expect(store().committedScale).toBeGreaterThan(1);
    // The session scale is the zoom in progress; the committed one is the zoom
    // the surface is left at, which is what a consumer binds its transform to.
    expect(store().scale).toBeGreaterThan(1);

    store().cancel();
    await settled();

    // `cancel()` drops the whole session, the committed zoom included.
    expect(store().committedScale).toBe(1);
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
