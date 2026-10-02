// @vitest-environment happy-dom
/**
 * The wheel: the one gesture the mouse and the trackpad can make that Pointer
 * Events cannot describe.
 *
 * The bug this file exists for: all six pre-existing kinds are driven by
 * Pointer Events, so on a PC or a laptop the wheel produced nothing at all —
 * no cursor position, no deltas, and therefore no cursor-anchored zoom, which
 * is exactly what a desktop user expects from the same surface a phone zooms
 * with two fingers on. It also pins the two decisions that are easy to undo by
 * accident: the listener is opt-in (so an existing consumer pays nothing for
 * it) and it is ignored while a pointer is down (so a scroll cannot corrupt a
 * running pinch).
 */
import { afterEach, describe, expect, test, vi } from "vite-plus/test";

import { GestureController } from "../src/controller";
import type { GestureWheelDetail } from "../src/types";

const mounted: GestureController[] = [];

function setup(options = {}): { controller: GestureController; element: HTMLElement } {
  const element = document.createElement("div");
  document.body.appendChild(element);
  const controller = new GestureController({ element, ...options });
  controller.mount();
  mounted.push(controller);
  return { controller, element };
}

/** A controller with the wheel opted in, which is never the default. */
function wheelSurface(options = {}) {
  return setup({ gestures: ["wheel"], ...options });
}

/** Only the wheel details, so the delta assertions read cleanly. */
function wheelRecorder(controller: GestureController): GestureWheelDetail[] {
  const seen: GestureWheelDetail[] = [];
  controller.on("wheel", (detail) => {
    seen.push(detail as unknown as GestureWheelDetail);
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
  fields["ctrlKey"] = init.ctrlKey ?? false;
  target.dispatchEvent(event);
  return event;
}

afterEach(() => {
  while (mounted.length) mounted.pop()?.destroy();
  document.body.replaceChildren();
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

  test("a trackpad pinch is the same path, flagged with ctrlKey", () => {
    const { controller, element } = wheelSurface();
    const seen = wheelRecorder(controller);

    wheel(element, { deltaY: -40, ctrlKey: true });

    expect(seen.at(-1)?.ctrlKey).toBe(true);
    expect(seen.at(-1)?.scale).toBeGreaterThan(1);
  });

  test("the state carries the deltas and the scale", () => {
    const { controller, element } = wheelSurface();

    wheel(element, { deltaX: 3, deltaY: 4, deltaZ: 5, x: 12, y: 34 });

    expect(controller.state.deltaX).toBe(3);
    expect(controller.state.deltaY).toBe(4);
    expect(controller.state.deltaZ).toBe(5);
    expect(controller.state.x).toBe(12);
    expect(controller.state.y).toBe(34);
    expect(controller.state.pointerType).toBe("mouse");
    expect(controller.state.buttons).toBe(0);
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
      expect(seen).toHaveLength(2);
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
      modes.push((detail as unknown as GestureWheelDetail).deltaMode);
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
  test("the page scroll is cancelled only when the option asks for it", () => {
    const { element } = wheelSurface();
    expect(wheel(element, { deltaY: -100 }).defaultPrevented).toBe(false);

    const blocking = wheelSurface({ preventDefault: true });
    expect(wheel(blocking.element, { deltaY: -100 }).defaultPrevented).toBe(true);
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
