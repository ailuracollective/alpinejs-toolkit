import { guardDirective, guardStore } from "@ailura/alpinejs-core/guards";
import { resolveStoreKey } from "@ailura/alpinejs-core/registration";
import type { Alpine } from "alpinejs";

import { GestureController } from "./controller";
import type { GestureOptions, GestureRecognizedDetail, GestureState, GestureStore } from "./types";
import { DEFAULT_GESTURE_DIRECTIVE_KEY, DEFAULT_GESTURE_STORE_KEY } from "./types";

const packageName = "@ailura/alpinejs-gesture";

/** One controller per element, refcounted: several `x-gesture.*` on one element share it. */
interface Binding {
  readonly controller: GestureController;
  refs: number;
}

function emptyState(): GestureState {
  return {
    active: false,
    kind: null,
    x: 0,
    y: 0,
    distanceX: 0,
    distanceY: 0,
    totalDistance: 0,
    velocityX: 0,
    velocityY: 0,
    pointerCount: 0,
    scale: 1,
    rotation: 0,
    direction: "none",
    button: 0,
    buttons: 0,
    pointerType: "",
  };
}

/** The state keys the store mirrors, read once instead of per event. */
const STATE_KEYS = Object.keys(emptyState()) as Array<keyof GestureState>;

export function gesturePlugin(options: GestureOptions = {}): (alpine: Alpine) => void {
  const storeKey = resolveStoreKey(options, DEFAULT_GESTURE_STORE_KEY);
  const directiveKey = options.directiveKey ?? DEFAULT_GESTURE_DIRECTIVE_KEY;

  return function registerGesture(alpine: Alpine): void {
    // One recognizer per element. A single shared controller cannot work: the
    // directive is a per-element binding, and `attach()` detaches whatever it
    // was attached to, so the previous element would go silent — on a page
    // with two gesture surfaces, only the last one would ever fire.
    const bindings = new WeakMap<Element, Binding>();
    // The element the store mirrors: the one currently being touched, or the
    // last one that was.
    let focused: GestureController | null = null;

    const reactive = (alpine as unknown as { reactive?: (v: unknown) => unknown }).reactive;
    const view = (reactive
      ? reactive({ ...emptyState() })
      : { ...emptyState() }) as unknown as Record<string, unknown>;

    const sync = (controller: GestureController, state: GestureState): void => {
      // An idle controller must not stomp the state of the one in use.
      if (!state.active && controller !== focused) return;
      if (state.active) focused = controller;
      for (const key of STATE_KEYS) view[key] = state[key];
    };

    const store: GestureStore = {
      get active() {
        return view["active"] as GestureState["active"];
      },
      get kind() {
        return view["kind"] as GestureState["kind"];
      },
      get x() {
        return view["x"] as GestureState["x"];
      },
      get y() {
        return view["y"] as GestureState["y"];
      },
      get distanceX() {
        return view["distanceX"] as GestureState["distanceX"];
      },
      get distanceY() {
        return view["distanceY"] as GestureState["distanceY"];
      },
      get totalDistance() {
        return view["totalDistance"] as GestureState["totalDistance"];
      },
      get velocityX() {
        return view["velocityX"] as GestureState["velocityX"];
      },
      get velocityY() {
        return view["velocityY"] as GestureState["velocityY"];
      },
      get pointerCount() {
        return view["pointerCount"] as GestureState["pointerCount"];
      },
      get scale() {
        return view["scale"] as GestureState["scale"];
      },
      get rotation() {
        return view["rotation"] as GestureState["rotation"];
      },
      get direction() {
        return view["direction"] as GestureState["direction"];
      },
      get button() {
        return view["button"] as GestureState["button"];
      },
      get buttons() {
        return view["buttons"] as GestureState["buttons"];
      },
      get pointerType() {
        return view["pointerType"] as GestureState["pointerType"];
      },
      cancel: () => focused?.cancel(),
    };

    guardStore(alpine, storeKey, store, packageName);

    const bind = (el: Element): Binding => {
      const existing = bindings.get(el);
      if (existing) return existing;
      const controller = new GestureController({ ...options, element: el });
      controller.mount();
      controller.on("change", (detail) => sync(controller, detail.state));
      const binding: Binding = { controller, refs: 0 };
      bindings.set(el, binding);
      return binding;
    };

    // `options.element` is the plugin-level equivalent of the directive: a
    // surface with no handlers whose live values still reach the store.
    if (options.element) bind(options.element);

    // x-gesture.tap="handler": one handler per gesture kind, per element.
    guardDirective(
      alpine,
      directiveKey,
      (el, { expression, modifiers }, { evaluateLater, cleanup }) => {
        const getHandler = evaluateLater(expression);
        const kinds = new Set((modifiers.length ? modifiers : ["tap"]) as string[]);

        const binding = bind(el);
        const { controller } = binding;
        binding.refs += 1;

        // `evaluateLater` auto-evaluates a function result: the handler is
        // called with `params` as its arguments and the merged data scope as
        // `this`, exactly like `x-on:click="handler"` does. So the detail is
        // delivered through `params` and the receiver is only a sink for the
        // handler's return value. (Passing the function to the receiver, as a
        // naive `evaluateLater(expr)((fn) => fn(detail))` does, calls the
        // handler with no `this` and no arguments.)
        const onGesture = (detail: GestureRecognizedDetail): void => {
          if (!kinds.has(detail.kind)) return;
          getHandler(() => {}, { scope: {} as never, params: [detail] as never });
        };
        const off = controller.on("gesture", onGesture as never);

        cleanup(() => {
          off();
          const current = bindings.get(el);
          if (!current) return;
          current.refs -= 1;
          if (current.refs > 0) return;
          bindings.delete(el);
          if (focused === current.controller) focused = null;
          current.controller.destroy();
        });
      },
      packageName
    );
  };
}

export default gesturePlugin;
