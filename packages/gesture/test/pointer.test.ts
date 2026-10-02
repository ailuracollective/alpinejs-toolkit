// @vitest-environment happy-dom
/**
 * Pinch and rotation, which the old controller declared but never computed:
 * `scale` and `rotation` sat at their defaults and no `pinch` event was ever
 * emitted, so a two-finger gesture on a phone produced nothing at all.
 */
import { afterEach, describe, expect, test, vi } from "vite-plus/test";

import { GestureController } from "../src/controller";
import type { GesturePinchDetail } from "../src/types";

/** Every gesture kind the controller recognised, in order. */
function recorder(controller: GestureController): string[] {
  const kinds: string[] = [];
  controller.on("gesture", (detail) => {
    kinds.push(detail.kind);
  });
  return kinds;
}

/**
 * Only the pinch details, so the scale/rotation assertions read cleanly.
 *
 * `pinch` is declared as the whole `GestureRecognizedDetail` union, so the
 * members `scale`/`rotation`/`phase` need the narrowing the emitter already
 * guarantees.
 */
function pinchRecorder(controller: GestureController): GesturePinchDetail[] {
  const seen: GesturePinchDetail[] = [];
  controller.on("pinch", (detail) => {
    seen.push(detail as unknown as GesturePinchDetail);
  });
  return seen;
}

const mounted: GestureController[] = [];

function setup(options = {}): { controller: GestureController; element: HTMLElement } {
  const element = document.createElement("div");
  document.body.appendChild(element);
  const controller = new GestureController({ element, ...options });
  controller.mount();
  mounted.push(controller);
  return { controller, element };
}

function finger(target: Element, pointerId: number): (type: string, x: number, y: number) => void {
  return (type, x, y) => {
    target.dispatchEvent(
      new PointerEvent(type, {
        bubbles: true,
        pointerId,
        pointerType: "touch",
        isPrimary: pointerId === 1,
        clientX: x,
        clientY: y,
        buttons: 1,
      })
    );
  };
}

afterEach(() => {
  while (mounted.length) mounted.pop()?.destroy();
  document.body.replaceChildren();
});

describe("pinch", () => {
  test("two fingers measure scale from the spread they started with", () => {
    const { controller, element } = setup();
    const seen = pinchRecorder(controller);
    const emit = finger(element, 1);
    const second = finger(element, 2);

    emit("pointerdown", 0, 0);
    second("pointerdown", 100, 0);
    // Fingers move in turn, so each move reports the spread as of that event.
    // The last one is the finished gesture: 100px -> 200px.
    emit("pointermove", -50, 0);
    second("pointermove", 150, 0);

    const moves = seen.filter((d) => d.phase === "move");
    expect(moves.at(-1)?.scale).toBeCloseTo(2, 1);
    expect(controller.state.scale).toBeCloseTo(2, 1);
    expect(controller.state.pointerCount).toBe(2);
    expect(controller.state.kind).toBe("pinch");
  });

  test("pinching in shrinks below 1", () => {
    const { controller, element } = setup();
    const seen = pinchRecorder(controller);
    const emit = finger(element, 1);
    const second = finger(element, 2);

    emit("pointerdown", 0, 0);
    second("pointerdown", 100, 0);
    emit("pointermove", 25, 0);
    second("pointermove", 75, 0);

    expect(seen.filter((d) => d.phase === "move").at(-1)?.scale).toBeCloseTo(0.5, 1);
    expect(controller.state.scale).toBeCloseTo(0.5, 1);
  });

  test("the end detail carries the final scale, then state resets", () => {
    const { controller, element } = setup();
    const seen = pinchRecorder(controller);
    const emit = finger(element, 1);
    const second = finger(element, 2);

    emit("pointerdown", 0, 0);
    second("pointerdown", 100, 0);
    emit("pointermove", -50, 0);
    second("pointermove", 150, 0);
    emit("pointerup", -50, 0);

    const end = seen.find((d) => d.phase === "end");
    expect(end?.scale).toBeCloseTo(2, 1);
    expect(controller.state.scale).toBe(1);
    expect(controller.state.active).toBe(true);
  });

  test("rotation is measured between the fingers", () => {
    const { controller, element } = setup();
    const emit = finger(element, 1);
    const second = finger(element, 2);

    emit("pointerdown", 0, 0);
    second("pointerdown", 100, 0);
    // The second finger swings a quarter turn up from its starting bearing.
    second("pointermove", 0, 100);

    expect(controller.state.rotation).toBeCloseTo(90, 0);
  });

  test("a pinch is never reported as a tap", () => {
    const { controller, element } = setup();
    const kinds = recorder(controller);
    const emit = finger(element, 1);
    const second = finger(element, 2);

    emit("pointerdown", 0, 0);
    second("pointerdown", 100, 0);
    emit("pointerup", 0, 0);
    second("pointerup", 100, 0);

    expect(kinds).toContain("pinch");
    expect(kinds).not.toContain("tap");
    expect(kinds).not.toContain("doubletap");
  });

  test("a third finger keeps the two leading ones as the reference", () => {
    const { controller, element } = setup();
    const emit = finger(element, 1);
    const second = finger(element, 2);
    const third = finger(element, 3);

    emit("pointerdown", 0, 0);
    second("pointerdown", 100, 0);
    // The third finger must not become part of the measurement.
    third("pointerdown", 0, 100);
    emit("pointermove", -50, 0);
    second("pointermove", 150, 0);

    expect(controller.state.pointerCount).toBe(3);
    expect(controller.state.scale).toBeCloseTo(2, 1);
  });

  test("a second finger cancels a pending long press", () => {
    vi.useFakeTimers();
    try {
      const { controller, element } = setup({ longPressDelay: 100 });
      const kinds = recorder(controller);
      const emit = finger(element, 1);
      const second = finger(element, 2);

      emit("pointerdown", 0, 0);
      second("pointerdown", 50, 0);
      vi.advanceTimersByTime(200);

      expect(kinds).not.toContain("longpress");
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("pointercancel", () => {
  test("a cancelled pointer emits no gesture", () => {
    const { controller, element } = setup();
    const kinds = recorder(controller);
    const emit = finger(element, 1);

    emit("pointerdown", 0, 0);
    element.dispatchEvent(
      new PointerEvent("pointercancel", {
        bubbles: true,
        pointerId: 1,
        pointerType: "touch",
        clientX: 0,
        clientY: 0,
      })
    );
    emit("pointerup", 0, 0);

    expect(kinds).toEqual([]);
    expect(controller.state.active).toBe(false);
    expect(controller.state.pointerCount).toBe(0);
  });
});

describe("wheel during a pointer interaction", () => {
  test("a wheel turn while a pinch runs leaves it alone", () => {
    // The controller opted into both kinds explicitly: the wheel is opt-in,
    // so this test has to ask for it rather than inherit it.
    const { controller, element } = setup({ gestures: ["pinch", "wheel"] });
    const kinds = recorder(controller);
    const emit = finger(element, 1);
    const second = finger(element, 2);

    emit("pointerdown", 0, 0);
    second("pointerdown", 100, 0);
    emit("pointermove", -50, 0);
    const pinchScale = controller.state.scale;

    const scroll = new WheelEvent("wheel", { bubbles: true, deltaY: -100 });
    element.dispatchEvent(scroll);

    // Corrupting the pinch baseline here would make a two-finger zoom snap to
    // whatever the mouse wheel last did.
    expect(kinds).not.toContain("wheel");
    expect(controller.state.scale).toBe(pinchScale);
    expect(controller.state.kind).toBe("pinch");
    expect(scroll.defaultPrevented).toBe(false);

    second("pointermove", 150, 0);
    expect(controller.state.scale).toBeCloseTo(2, 1);
  });
});

describe("single-pointer lifecycle", () => {
  test("pan reports start, then move, then end", () => {
    const { controller, element } = setup();
    const phases: string[] = [];
    controller.on("pan", (detail) => {
      if (detail.kind === "pan") phases.push(detail.phase);
    });
    const emit = finger(element, 1);

    emit("pointerdown", 0, 0);
    emit("pointermove", 20, 0);
    emit("pointermove", 40, 0);
    emit("pointerup", 60, 0);

    expect(phases).toEqual(["start", "move", "end"]);
  });

  test("an untracked pointer is ignored", () => {
    const { controller, element } = setup();
    const kinds = recorder(controller);
    const emit = finger(element, 7);

    // A move with no preceding down: a mouse hovering the surface.
    emit("pointermove", 50, 0);
    emit("pointerup", 50, 0);

    expect(kinds).toEqual([]);
    expect(controller.state.active).toBe(false);
  });

  test("pointerCount is real while both fingers are down", () => {
    const { controller, element } = setup();
    const emit = finger(element, 1);
    const second = finger(element, 2);

    emit("pointerdown", 0, 0);
    expect(controller.state.pointerCount).toBe(1);
    second("pointerdown", 100, 0);
    expect(controller.state.pointerCount).toBe(2);
    second("pointerup", 100, 0);
    expect(controller.state.pointerCount).toBe(1);
    emit("pointerup", 0, 0);
    expect(controller.state.pointerCount).toBe(0);
  });
});
