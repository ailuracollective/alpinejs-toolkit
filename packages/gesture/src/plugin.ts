import { guardDirective, guardStore } from "@ailura/alpinejs-core/guards";
import { resolveStoreKey } from "@ailura/alpinejs-core/registration";
import type { Alpine } from "alpinejs";

import { GestureController, emptyState } from "./controller";
import type {
  GestureKind,
  GestureOptions,
  GestureRecognizedDetail,
  GestureState,
  GestureStore,
} from "./types";
import { DEFAULT_GESTURE_DIRECTIVE_KEY, DEFAULT_GESTURE_STORE_KEY } from "./types";

const packageName = "@ailura/alpinejs-gesture";

/** One controller per element, refcounted: several `x-gesture.*` on one element share it. */
interface Binding {
  readonly controller: GestureController;
  refs: number;
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
    const view = (reactive?.(emptyState()) ?? emptyState()) as unknown as Record<string, unknown>;

    const sync = (controller: GestureController, state: GestureState): void => {
      // An idle controller must not stomp the state of the one in use.
      if (!state.active && controller !== focused) return;
      if (state.active) focused = controller;
      for (const key of STATE_KEYS) view[key] = state[key];
    };

    // One readable accessor per state key, generated from the same list
    // `sync()` writes through, so the mirror cannot drift from the state: a
    // key added to `emptyState()` is readable here without being restated.
    // They are defined as own enumerable properties rather than through a
    // `Proxy` because Alpine has to see a plain object it can walk.
    const store = {} as GestureStore;
    for (const key of STATE_KEYS) {
      Object.defineProperty(store, key, {
        get: () => view[key] as GestureState[typeof key],
        enumerable: true,
      });
    }
    store.cancel = () => focused?.cancel();

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
        const kinds = (modifiers.length ? modifiers : ["tap"]) as GestureKind[];

        const binding = bind(el);
        const { controller } = binding;
        // The modifier is the opt-in: `x-gesture.wheel="..."` on its own must
        // turn the wheel on for this element. It is a union over whatever the
        // plugin was configured with, so it can only add, never narrow — and
        // `wheel` is deliberately absent from the controller's default set, so
        // this call is the only thing that attaches that listener.
        controller.enableGestures(kinds);
        binding.refs += 1;

        // `evaluateLater` auto-evaluates a function result: the handler is
        // called with `params` as its arguments and the merged data scope as
        // `this`, exactly like `x-on:click="handler"` does. So the detail is
        // delivered through `params` and the receiver is only a sink for the
        // handler's return value. (Passing the function to the receiver, as a
        // naive `evaluateLater(expr)((fn) => fn(detail))` does, calls the
        // handler with no `this` and no arguments.)
        const onGesture = (detail: GestureRecognizedDetail): void => {
          if (!kinds.includes(detail.kind)) return;
          getHandler(() => {}, { scope: {} as never, params: [detail] as never });
        };
        const off = controller.on("gesture", onGesture as never);

        cleanup(() => {
          off();
          if (--binding.refs > 0) return;
          bindings.delete(el);
          if (focused === controller) focused = null;
          controller.destroy();
        });
      },
      packageName
    );
  };
}

export default gesturePlugin;
