// @vitest-environment happy-dom
/**
 * The wheel: the one gesture the mouse and the trackpad can make that Pointer
 * Events cannot describe.
 *
 * The bug this file exists for: all six pre-existing kinds are driven by
 * Pointer Events, so on a PC or a laptop the wheel produced nothing at all —
 * no cursor position, no deltas, and therefore no cursor-anchored zoom, which
 * is exactly what a desktop user expects from the same surface a phone zooms
 * with two fingers on. It also pins three decisions that are easy to undo by
 * accident: the listener is opt-in (so an existing consumer pays nothing for
 * it) it is ignored while a pointer is down (so a scroll cannot corrupt a
 * running pinch), and only Ctrl+wheel is recognized — that is the browser's own
 * page zoom, the one gesture worth claiming, while a plain wheel stays the
 * user's scroll.
 */
import { afterEach, describe, expect, test, vi } from "vite-plus/test";

import { GestureController } from "../src/controller";
import type { GestureRecognizedDetail } from "../src/types";

const mounted: GestureController[] = [];

/** A controller on `element`, already mounted and tracked for teardown. */
function attachOn(element: HTMLElement, options = {}): GestureController {
  const controller = new GestureController({ element, ...options });
  controller.mount();
  mounted.push(controller);
  return controller;
}

function setup(options = {}): { controller: GestureController; element: HTMLElement } {
  const element = document.createElement("div");
  document.body.appendChild(element);
  return { controller: attachOn(element, options), element };
}

/** A controller with the wheel opted in, which is never the default. */
function wheelSurface(options = {}) {
  return setup({ gestures: ["wheel"], ...options });
}

/**
 * Exactly what a `wheel` listener receives: the wheel detail, plus the
 * `state` every emitted detail carries. `committedScale` lives on that state
 * rather than on the detail, which is why the per-kind detail alone is not the
 * type these tests record.
 */
type WheelDetail = Extract<GestureRecognizedDetail, { kind: "wheel" }>;

/** Only the wheel details, so the delta assertions read cleanly. */
function wheelRecorder(controller: GestureController): WheelDetail[] {
  const seen: WheelDetail[] = [];
  controller.on("wheel", (detail) => {
    seen.push(detail as unknown as WheelDetail);
  });
  return seen;
}

interface WheelInit {
  deltaX?: number;
  deltaY?: number;
  deltaZ?: number;
  deltaMode?: number;
  ctrlKey?: boolean;
  x?: number;
  y?: number;
}

/**
 * Dispatch one wheel tick.
 *
 * happy-dom's `WheelEvent` takes the wheel fields but drops the ones it
 * inherits from `MouseEvent` (`clientX`, `clientY`) and `KeyboardEvent`
 * (`ctrlKey`), so those are assigned explicitly — the controller reads them off
 * the event exactly as a browser would.
 *
 * `ctrlKey` defaults to `true` because that is the only tick the recognizer
 * claims: Ctrl+wheel is the browser's own page zoom, and a plain wheel is left
 * to the page. A test that means a plain wheel passes `ctrlKey: false`.
 */
function wheel(target: Element, init: WheelInit = {}): WheelEvent {
  const event = new WheelEvent("wheel", {
    bubbles: true,
    cancelable: true,
    deltaX: init.deltaX ?? 0,
    deltaY: init.deltaY ?? 0,
    deltaZ: init.deltaZ ?? 0,
    deltaMode: init.deltaMode ?? 0,
  });
  const fields = event as unknown as Record<string, unknown>;
  fields["clientX"] = init.x ?? 0;
  fields["clientY"] = init.y ?? 0;
  fields["ctrlKey"] = init.ctrlKey ?? true;
  target.dispatchEvent(event);
  return event;
}

/**
 * The `passive` flag of every `wheel` listener registered on `element`, in
 * order.
 *
 * happy-dom does not enforce passivity, so a dispatched event's
 * `defaultPrevented` cannot prove the flag reached the DOM — only the
 * registration itself can.
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

afterEach(() => {
  while (mounted.length) mounted.pop()?.destroy();
  document.body.replaceChildren();
  vi.restoreAllMocks();
});

describe("wheel ticks", () => {
  test("a downward turn zooms out and reports the cursor position", () => {
    const { controller, element } = wheelSurface();
    const seen = wheelRecorder(controller);

    wheel(element, { deltaY: 100, x: 40, y: 60 });

    const detail = seen.at(-1);
    expect(detail?.kind).toBe("wheel");
    expect(detail?.phase).toBe("move");
    expect(detail?.x).toBe(40);
    expect(detail?.y).toBe(60);
    expect(detail?.deltaY).toBe(100);
    // exp(-100 * 0.002) ≈ 0.82: less than 1, so the turn zooms out.
    expect(detail?.scale).toBeLessThan(1);
    expect(controller.state.kind).toBe("wheel");
    expect(controller.state.scale).toBeCloseTo(0.82, 2);
  });

  test("a wheel detail reports the pointer fields a consumer switches on", () => {
    const { controller, element } = wheelSurface();
    const seen = wheelRecorder(controller);

    const event = wheel(element, { deltaY: 100, x: 40, y: 60 });

    // A wheel is not a pointer event: it carries no `pointerType` and no
    // button state, so the detail reports the mouse at rest. Pinned because
    // that shape is what `baseFields()` has to synthesise for a
    // `WheelEvent`, and a consumer switching on `pointerType` depends on it.
    const detail = seen.at(-1) as unknown as GestureRecognizedDetail | undefined;
    expect(detail?.pointerType).toBe("mouse");
    expect(detail?.button).toBe(0);
    expect(detail?.buttons).toBe(0);
    expect(detail?.target).toBe(element);
    expect(detail?.originalEvent).toBe(event);
    expect(detail?.state).toBe(controller.state);
  });

  test("an upward turn zooms in", () => {
    const { controller, element } = wheelSurface();
    const seen = wheelRecorder(controller);

    wheel(element, { deltaY: -100 });

    expect(seen.at(-1)?.scale).toBeGreaterThan(1);
    expect(controller.state.scale).toBeCloseTo(1.22, 2);
  });

  test("a horizontal wheel is a scroll, not a zoom", () => {
    const { controller, element } = wheelSurface();
    const seen = wheelRecorder(controller);

    wheel(element, { deltaX: 120, deltaY: 0 });

    // The X axis is reported but does not drive the scale, otherwise a
    // trackpad two-finger scroll would zoom.
    expect(seen.at(-1)?.deltaX).toBe(120);
    expect(seen.at(-1)?.scale).toBe(1);
    expect(controller.state.scale).toBe(1);
  });

  test("a trackpad pinch arrives on the same path as Ctrl+wheel", () => {
    const { controller, element } = wheelSurface();
    const seen = wheelRecorder(controller);

    // A browser reports a trackpad pinch as a wheel with `ctrlKey` set, so the
    // gate that makes Ctrl+wheel a gesture admits a pinch with no
    // special-casing — there is nothing left to tell apart here.
    wheel(element, { deltaY: -40, ctrlKey: true });

    expect(seen.at(-1)?.ctrlKey).toBe(true);
    expect(seen.at(-1)?.scale).toBeGreaterThan(1);
  });

  test("the state carries the deltas and the scale, but not the tilt axis", () => {
    const { controller, element } = wheelSurface();

    wheel(element, { deltaX: 3, deltaY: 4, deltaZ: 5, x: 12, y: 34 });

    expect(controller.state.deltaX).toBe(3);
    expect(controller.state.deltaY).toBe(4);
    expect(controller.state.x).toBe(12);
    expect(controller.state.y).toBe(34);
    expect(controller.state.pointerType).toBe("mouse");
    expect(controller.state.buttons).toBe(0);
  });

  test("deltaZ rides the detail, normalized, and stays off the state", () => {
    const { controller, element } = wheelSurface();
    const seen = wheelRecorder(controller);

    // A line-mode tilt: 5 lines of tilt is 80 pixels, not 5.
    wheel(element, { deltaZ: 5, deltaMode: 1 });

    expect(seen.at(-1)?.deltaZ).toBe(80);
    // Z is the device's tilt axis. Nothing computes from it, so mirroring it
    // into the continuously-observed state would advertise a value the
    // recognizer does not use. It belongs to the event that carried it.
    expect("deltaZ" in controller.state).toBe(false);
  });
});

describe("wheel sessions", () => {
  test("the scale accumulates within a session and resets after the idle delay", () => {
    vi.useFakeTimers();
    try {
      const { controller, element } = wheelSurface();
      const seen = wheelRecorder(controller);

      wheel(element, { deltaY: -100 });
      const first = controller.state.scale;
      wheel(element, { deltaY: -100 });
      const second = controller.state.scale;

      // Two equal turns compose: the second is not a reset to 1.
      expect(second).toBeGreaterThan(first);
      expect(seen).toHaveLength(2);

      vi.advanceTimersByTime(200);

      expect(controller.state.active).toBe(false);
      expect(controller.state.kind).toBeNull();
      expect(controller.state.scale).toBe(1);
      expect(controller.state.deltaY).toBe(0);
      // This used to end here, with the state assertions above the whole
      // story: the end of a wheel session was reported by its absence, so a
      // consumer had to poll `active` to notice it. It is an event now — one,
      // carrying the scale the session committed.
      expect(seen.filter((d) => d.phase === "end")).toHaveLength(1);
    } finally {
      vi.useRealTimers();
    }
  });

  test("the end detail carries the committed scale and the tick it ended on", () => {
    vi.useFakeTimers();
    try {
      const { controller, element } = wheelSurface();
      const seen = wheelRecorder(controller);

      wheel(element, { deltaY: -100, x: 12, y: 34 });
      const last = wheel(element, { deltaY: -100, x: 12, y: 34 });
      vi.advanceTimersByTime(200);

      const end = seen.find((d) => d.phase === "end");
      // Every session value is back at rest: the deltas are the input that
      // ended, and there was none.
      expect(end?.scale).toBe(1);
      expect(end?.deltaX).toBe(0);
      expect(end?.deltaY).toBe(0);
      expect(end?.deltaZ).toBe(0);
      expect(end?.deltaMode).toBe(0);
      // Still the gesture the session was: a plain wheel never got this far.
      expect(end?.ctrlKey).toBe(true);
      // There is no new input to report, so the detail carries the last tick
      // rather than `null`, which would be a second meaning for the same
      // detail depending on the phase.
      expect(end?.originalEvent).toBe(last);
      // exp(200 × 0.002): the two ticks of one session compose once, from a
      // base of 1. Multiplying each tick's session scale into the total would
      // report exp(200 × 0.002) × exp(100 × 0.002) instead.
      expect(end?.state.committedScale).toBeCloseTo(Math.exp(200 * 0.002), 10);
      expect(controller.state.committedScale).toBeCloseTo(Math.exp(200 * 0.002), 10);
      // The state reset happens first, so the `change` event and the detail
      // agree that the session is over.
      expect(end?.state).toBe(controller.state);
      expect(end?.state.active).toBe(false);

      // Exactly once: the timer the end came from is the timer it cleared.
      vi.advanceTimersByTime(500);
      expect(seen.filter((d) => d.phase === "end")).toHaveLength(1);
    } finally {
      vi.useRealTimers();
    }
  });

  test("the committed scale survives the session that produced it", () => {
    vi.useFakeTimers();
    try {
      const { controller, element } = wheelSurface();

      wheel(element, { deltaY: -100 });
      expect(controller.state.committedScale).toBeCloseTo(1.22, 2);
      vi.advanceTimersByTime(200);

      wheel(element, { deltaY: -100 });
      // Two sessions of exp(100 × 0.002), composed once each. The session
      // scale itself is back at its own starting point, so this is two ticks of
      // zoom — not every tick that has ever arrived on this surface.
      expect(controller.state.committedScale).toBeCloseTo(Math.exp(100 * 0.002) ** 2, 2);
      expect(controller.state.scale).toBeCloseTo(1.22, 2);
    } finally {
      vi.useRealTimers();
    }
  });

  test("resetScale() drops the zoom the sessions accumulated", () => {
    vi.useFakeTimers();
    try {
      const { controller, element } = wheelSurface();

      wheel(element, { deltaY: -100 });
      vi.advanceTimersByTime(200);
      wheel(element, { deltaY: -100 });
      expect(controller.state.committedScale).toBeCloseTo(Math.exp(100 * 0.002) ** 2, 2);

      controller.resetScale();

      expect(controller.state.committedScale).toBe(1);
      wheel(element, { deltaY: -100 });
      expect(controller.state.committedScale).toBeCloseTo(Math.exp(200 * 0.002), 2);
    } finally {
      vi.useRealTimers();
    }
  });

  test("scaleRange clamps the committed scale at both ends", () => {
    vi.useFakeTimers();
    try {
      const { controller, element } = wheelSurface({ scaleRange: [0.9, 1.5] });

      wheel(element, { deltaY: -100 });
      wheel(element, { deltaY: -100 });
      expect(controller.state.committedScale).toBeCloseTo(1.49, 2);
      // The third tick would take it to 1.82, past the top of the range.
      wheel(element, { deltaY: -100 });
      expect(controller.state.committedScale).toBe(1.5);

      vi.advanceTimersByTime(200);
      // The other end, from the bound: 1.5 × exp(-300 × 0.002) is 0.82.
      wheel(element, { deltaY: 100 });
      wheel(element, { deltaY: 100 });
      wheel(element, { deltaY: 100 });
      expect(controller.state.committedScale).toBe(0.9);
    } finally {
      vi.useRealTimers();
    }
  });

  test("cancel() and detach() close the session without an end", () => {
    vi.useFakeTimers();
    try {
      const { controller, element } = wheelSurface();
      const seen = wheelRecorder(controller);

      wheel(element, { deltaY: -100 });
      controller.cancel();
      vi.advanceTimersByTime(500);

      // A cancelled interaction is not a completed one, so it gets no `end`.
      expect(seen.filter((d) => d.phase === "end")).toHaveLength(0);
      expect(controller.state.committedScale).toBe(1);

      const detached = wheelSurface();
      const detachedSeen = wheelRecorder(detached.controller);
      wheel(detached.element, { deltaY: -100 });
      detached.controller.detach();
      vi.advanceTimersByTime(500);

      // And detaching is not a gesture at all: the surface is gone, so there
      // is nobody left to report a zoom to.
      expect(detachedSeen.filter((d) => d.phase === "end")).toHaveLength(0);
    } finally {
      vi.useRealTimers();
    }
  });

  test("each tick restarts the idle clock", () => {
    vi.useFakeTimers();
    try {
      const { controller, element } = wheelSurface();

      wheel(element, { deltaY: -50 });
      vi.advanceTimersByTime(120);
      wheel(element, { deltaY: -50 });
      vi.advanceTimersByTime(120);

      // 240ms have passed since the first tick but only 120ms since the last
      // one, so the session is still open and the scale has compounded.
      expect(controller.state.active).toBe(true);
      expect(controller.state.scale).toBeGreaterThan(1.1);
    } finally {
      vi.useRealTimers();
    }
  });

  test("cancel() ends the session without emitting", () => {
    vi.useFakeTimers();
    try {
      const { controller, element } = wheelSurface();
      const seen = wheelRecorder(controller);

      wheel(element, { deltaY: -100 });
      controller.cancel();
      expect(controller.state.active).toBe(false);
      expect(controller.state.scale).toBe(1);
      expect(controller.state.deltaY).toBe(0);
      expect(seen).toHaveLength(1);

      // The cancelled session does not resume into the old accumulation.
      vi.advanceTimersByTime(500);
      wheel(element, { deltaY: -100 });
      expect(controller.state.scale).toBeCloseTo(1.22, 2);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("deltaMode", () => {
  test("line and page deltas normalize to the same pixels as pixels", () => {
    const scales = [0, 1, 2].map((deltaMode) => {
      const { controller, element } = wheelSurface();
      // Every mode describes the same physical movement of 100px.
      const unit = deltaMode === 1 ? 100 / 16 : deltaMode === 2 ? 1 : 100;
      wheel(element, { deltaY: unit, deltaMode });
      return controller.state.scale;
    });

    expect(scales[1]).toBeCloseTo(scales[0], 10);
    expect(scales[2]).toBeCloseTo(scales[0], 10);
  });

  test("the raw mode still reaches the detail", () => {
    const { controller, element } = wheelSurface();
    const modes: number[] = [];
    controller.on("wheel", (detail) => {
      modes.push((detail as unknown as WheelDetail).deltaMode);
    });

    wheel(element, { deltaY: 3, deltaMode: 1 });

    expect(modes).toEqual([1]);
  });
});

describe("opt-in", () => {
  test("a controller that never enabled wheel does not react to a wheel event", () => {
    const { controller, element } = setup();
    const seen = wheelRecorder(controller);

    const event = wheel(element, { deltaY: -100, x: 10, y: 10 });

    // Not merely unreported: no listener is attached at all, so nothing about
    // the state moved and the page kept its own scroll.
    expect(seen).toEqual([]);
    expect(controller.state.active).toBe(false);
    expect(controller.state.kind).toBeNull();
    expect(controller.state.scale).toBe(1);
    expect(event.defaultPrevented).toBe(false);
  });

  test("enableGestures turns it on after the fact, and is idempotent", () => {
    const { controller, element } = setup();
    const seen = wheelRecorder(controller);

    controller.enableGestures(["wheel"]);
    controller.enableGestures(["wheel"]);
    wheel(element, { deltaY: -100 });

    expect(seen).toHaveLength(1);
    expect(controller.state.scale).toBeGreaterThan(1);
  });
});

describe("preventDefault", () => {
  test("the browser's own zoom is cancelled only when the option asks for it", () => {
    const { element } = wheelSurface();
    expect(wheel(element, { deltaY: -100 }).defaultPrevented).toBe(false);

    const blocking = wheelSurface({ preventDefault: true });
    expect(wheel(blocking.element, { deltaY: -100 }).defaultPrevented).toBe(true);
  });
});

/**
 * Ctrl+wheel is the gesture; a plain wheel is the page's.
 *
 * The gate lives in the recognizer rather than in a handler, which is what
 * makes the cancel safe: with the option set, a plain wheel is still not
 * cancelled, so turning the wheel over the surface scrolls the page exactly as
 * it does everywhere else.
 */
describe("a plain wheel is not a gesture", () => {
  test("no event, no state, and not even a cancel", () => {
    const { controller, element } = wheelSurface({ preventDefault: true });
    const seen = wheelRecorder(controller);

    const event = wheel(element, { deltaY: -100, ctrlKey: false });

    expect(seen).toEqual([]);
    expect(controller.state.active).toBe(false);
    expect(controller.state.kind).toBeNull();
    expect(controller.state.scale).toBe(1);
    expect(controller.state.deltaY).toBe(0);
    // The point of gating in the recognizer: nothing here can hijack the
    // scroll, even with the option set to cancel the browser's zoom.
    expect(event.defaultPrevented).toBe(false);
  });

  test("a Ctrl+wheel on the same surface is the gesture the option is for", () => {
    const { controller, element } = wheelSurface({ preventDefault: true });
    const seen = wheelRecorder(controller);

    const event = wheel(element, { deltaY: -100, ctrlKey: true });

    expect(seen).toHaveLength(1);
    expect(controller.state.scale).toBeGreaterThan(1);
    expect(event.defaultPrevented).toBe(true);
  });
});

/**
 * The per-element opt-in behind `x-gesture.wheel.prevent`.
 *
 * The non-obvious half is the listener: `passive` is read when a listener is
 * added, so a controller whose wheel listener is already attached cannot be
 * switched to a cancellable one by flipping a field — the listener has to be
 * added again. These tests pin the registration, not the field: happy-dom does
 * not enforce passivity, so `defaultPrevented` alone proves nothing about what
 * the DOM was told.
 */
describe("enablePreventDefault", () => {
  test("an already-attached listener is added again, non-passive", () => {
    const element = document.createElement("div");
    document.body.appendChild(element);
    const flags = wheelFlags(element);
    const controller = attachOn(element, { gestures: ["wheel"] });

    // Passive to begin with: an existing consumer keeps the browser's scroll.
    expect(flags).toEqual([true]);

    controller.enablePreventDefault();

    // Two registrations, not one mutated field: the DOM only ever learns the
    // flag from a second `addEventListener` call.
    expect(flags).toEqual([true, false]);
    expect(wheel(element, { deltaY: -100 }).defaultPrevented).toBe(true);
    // One tick, one accumulation: exp(-100 × 0.002). A left-behind passive
    // listener would still be receiving ticks, and the scale would be the one
    // for two of them (exp(-200 × 0.002)) instead.
    expect(controller.state.scale).toBeCloseTo(1.22, 2);
  });

  test("the flag re-attaches exactly once, however often it is set", () => {
    const { controller, element } = wheelSurface();
    const flags = wheelFlags(element);

    controller.enablePreventDefault();
    controller.enablePreventDefault();

    // The listener was already attached when the flag came on, so exactly one
    // re-registration: the second call has nothing left to flip, which is what
    // keeps a second `x-gesture.*` on the element from re-touching it.
    expect(flags).toEqual([false]);
    expect(wheel(element, { deltaY: -100 }).defaultPrevented).toBe(true);
  });

  test("a controller configured with the option needs no re-attach", () => {
    const { controller, element } = wheelSurface({ preventDefault: true });
    const flags = wheelFlags(element);

    // The two paths agree: there is nothing left to flip, so nothing is
    // re-registered and the listener stays exactly the one the option built.
    controller.enablePreventDefault();
    expect(flags).toEqual([]);
    expect(wheel(element, { deltaY: -100 }).defaultPrevented).toBe(true);
  });

  test("a flag set before attach is honoured by the attach itself", () => {
    const element = document.createElement("div");
    document.body.appendChild(element);
    const controller = new GestureController({ element, gestures: ["wheel"] });
    mounted.push(controller);

    controller.enablePreventDefault();
    const flags = wheelFlags(element);
    controller.mount();

    // The listener `mount()` builds is cancellable, whether or not the flag
    // came with an attach of its own.
    expect(flags.at(-1)).toBe(false);
    expect(flags.some(Boolean)).toBe(false);
    expect(wheel(element, { deltaY: -100 }).defaultPrevented).toBe(true);
  });

  test("the flag does not resurrect a wheel listener on a controller without one", () => {
    const element = document.createElement("div");
    document.body.appendChild(element);
    const flags = wheelFlags(element);
    const controller = attachOn(element);

    controller.enablePreventDefault();

    // Wheel is opt-in: opting into the scroll suppression is not opting into
    // the listener, so an existing consumer still pays for no wheel at all.
    expect(flags).toEqual([]);
    expect(wheel(element, { deltaY: -100 }).defaultPrevented).toBe(false);
  });
});

describe("wheel and pinch together", () => {
  test("a wheel while a pointer is down is ignored", () => {
    const { controller, element } = setup({ gestures: ["wheel", "pinch"] });
    controller.enableGestures(["wheel"]);
    const kinds: string[] = [];
    controller.on("gesture", (detail) => {
      kinds.push(detail.kind);
    });

    const finger = (type: string, pointerId: number, x: number, y: number) => {
      element.dispatchEvent(
        new PointerEvent(type, {
          bubbles: true,
          pointerId,
          pointerType: "touch",
          clientX: x,
          clientY: y,
          buttons: 1,
        })
      );
    };

    finger("pointerdown", 1, 0, 0);
    finger("pointerdown", 2, 100, 0);
    finger("pointermove", 1, -50, 0);
    const pinchScale = controller.state.scale;
    wheel(element, { deltaY: -100 });

    // A wheel turn mid-drag is a different interaction: it must not shift the
    // running pinch scale, and it must not emit a wheel of its own.
    expect(kinds).not.toContain("wheel");
    expect(controller.state.scale).toBe(pinchScale);
    expect(controller.state.deltaY).toBe(0);
    expect(controller.state.kind).toBe("pinch");
  });
});
