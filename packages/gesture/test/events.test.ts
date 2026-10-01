/**
 * `GestureEvents` must not declare events the controller never emits.
 *
 * There is NO usable compile-time assertion for this: `GestureEvents extends
 * Record<string, unknown[]>`, so `keyof GestureEvents` collapses to
 * `string | number` and any mapped-type or listener-arity check still resolves
 * for a key that is no longer declared (verified: restoring the `state` line
 * leaves every such check green). The compile-time guarantee is the deleted
 * declaration itself, reviewed in the diff. What the runtime can honestly prove
 * is the complement: every event the controller actually emits is a declared
 * key, and nothing ever reaches a defensive `"state"` handler.
 */
// @vitest-environment happy-dom
import { afterEach, describe, expect, test, vi } from "vite-plus/test";

import { GestureController } from "../src/controller";
import type { GestureEvents } from "../src/events";
import type { GestureChangeDetail } from "../src/types";

/** Every event the controller can emit, checked against the declared map. */
const DECLARED_EVENTS = [
  "change",
  "gesture",
  "tap",
  "doubletap",
  "longpress",
  "swipe",
  "pan",
  "pinch",
] as const satisfies ReadonlyArray<keyof GestureEvents>;

/** Compile-time evidence that `change` still carries the declared detail. */
type ChangePayload = GestureEvents["change"];
const changeIsTyped: ChangePayload extends [GestureChangeDetail] ? true : false = true;
void changeIsTyped;

/** Exposes the protected event bus so the test can subscribe generically. */
class ObservableGestureController extends GestureController {
  get bus() {
    return this.events;
  }
}

type AnyBus = {
  on: (event: string, listener: (...args: unknown[]) => void) => () => void;
};

function pointerEvent(type: string, init: PointerEventInit): Event {
  if (typeof PointerEvent === "function") return new PointerEvent(type, { bubbles: true, ...init });
  const fallback = new MouseEvent(type, {
    bubbles: true,
    clientX: init.clientX,
    clientY: init.clientY,
  });
  return fallback;
}

const mounted: Array<{ controller: ObservableGestureController; element: HTMLElement }> = [];

function createController(): {
  controller: ObservableGestureController;
  element: HTMLElement;
} {
  const element = document.createElement("div");
  document.body.appendChild(element);
  const controller = new ObservableGestureController({ element });
  controller.mount();
  mounted.push({ controller, element });
  return { controller, element };
}

/** Subscribe to every declared key plus a defensive `"state"` handler. */
function subscribeToEverything(controller: ObservableGestureController) {
  const bus = controller.bus as unknown as AnyBus;
  const seen: string[] = [];
  const stateHandler = vi.fn();
  for (const key of DECLARED_EVENTS) {
    bus.on(key, () => {
      seen.push(key);
    });
  }
  bus.on("state", stateHandler);
  return { seen, stateHandler };
}

afterEach(() => {
  while (mounted.length) {
    mounted.pop()?.controller.destroy();
  }
  document.body.innerHTML = "";
});

describe("GestureEvents declarations", () => {
  test("emitted gestures never reach a state handler", () => {
    const { controller, element } = createController();
    const { seen, stateHandler } = subscribeToEverything(controller);

    element.dispatchEvent(
      pointerEvent("pointerdown", { clientX: 5, clientY: 5, button: 0, buttons: 1 })
    );
    element.dispatchEvent(
      pointerEvent("pointerup", { clientX: 6, clientY: 5, button: 0, buttons: 0 })
    );

    expect(seen).toContain("change");
    expect(seen).toContain("gesture");
    expect(seen).toContain("tap");
    expect(stateHandler).not.toHaveBeenCalled();
    expect(seen).not.toContain("state");
    // Complement of the deleted declaration: nothing is emitted that is not declared.
    for (const key of seen) {
      expect(DECLARED_EVENTS).toContain(key);
    }
  });

  test("cancel and pan also never reach a state handler", () => {
    const { controller, element } = createController();
    const { seen, stateHandler } = subscribeToEverything(controller);

    element.dispatchEvent(
      pointerEvent("pointerdown", { clientX: 0, clientY: 0, button: 0, buttons: 1 })
    );
    element.dispatchEvent(
      pointerEvent("pointermove", { clientX: 60, clientY: 0, button: 0, buttons: 1 })
    );
    controller.cancel();
    element.dispatchEvent(
      pointerEvent("pointerup", { clientX: 60, clientY: 0, button: 0, buttons: 0 })
    );

    expect(seen).toContain("pan");
    expect(stateHandler).not.toHaveBeenCalled();
    for (const key of seen) {
      expect(DECLARED_EVENTS).toContain(key);
    }
  });
});
