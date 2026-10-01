import { createPortalRoot } from "@ailura/alpinejs-ui";
// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, test, vi } from "vite-plus/test";

import { OverlayController } from "../src/controller";
import { overlayPlugin } from "../src/plugin";
import { syncStack } from "../src/store";
import type { OverlayStackEntry, OverlayStore } from "../src/types";

interface PluginHarness {
  readonly store: OverlayStore;
  /** The controller the plugin built internally; available after the first emit. */
  readonly controller: OverlayController;
}

const restoreEmit: Array<() => void> = [];

function createMockAlpine() {
  const stores = new Map<string, unknown>();
  const magics = new Map<string, unknown>();
  const alpine = {
    store(name: string, value?: unknown) {
      if (value !== undefined) {
        stores.set(name, value);
        return;
      }
      return stores.get(name);
    },
    magic(name: string, callback: unknown) {
      magics.set(name, callback);
    },
  } as unknown as import("alpinejs").Alpine;
  return { alpine, stores, magics };
}

/**
 * The plugin builds its own controller internally, so recover it by shadowing
 * `emit` on the prototype and recording the receiver of the first emission.
 */
type EmitFn = (this: OverlayController, ...args: unknown[]) => void;

function mountPlugin(): PluginHarness {
  const proto = OverlayController.prototype as unknown as { emit?: EmitFn };
  const original = Object.getPrototypeOf(OverlayController.prototype).emit as EmitFn;
  let captured: OverlayController | undefined;
  proto.emit = function patched(this: OverlayController, ...args: unknown[]): void {
    captured ??= this;
    return original.apply(this, args);
  };
  restoreEmit.push(() => {
    proto.emit = original;
  });

  const { alpine, stores } = createMockAlpine();
  overlayPlugin({})(alpine);
  const store = stores.get("overlay") as OverlayStore;
  return {
    store,
    get controller(): OverlayController {
      if (!captured) throw new Error("overlay controller was never created");
      return captured;
    },
  };
}

beforeEach(() => {
  // Portal roots live in `document.body`, so every case starts from an empty
  // document: a leftover `#overlay-root` from an earlier case would be ADOPTED
  // (not created) by the next controller and change what `destroy()` owns.
  document.body.innerHTML = "";
});

afterEach(() => {
  while (restoreEmit.length > 0) restoreEmit.pop()?.();
  vi.restoreAllMocks();
  document.body.innerHTML = "";
});

describe("overlay store stack projection", () => {
  // RED-first: pre-fix the store kept the removed entry forever, because
  // `unregister` reassigns the controller's private array while the store still
  // held the previous one.
  test("unregister removes the entry from the store stack", () => {
    const h = mountPlugin();
    h.store.claim("dialog", "d1");
    h.store.claim("menu", "m1");
    expect(h.store.stack.length).toBe(2);

    h.store.unregister("dialog", "d1");

    expect(h.store.stack.map((e) => `${e.plugin}:${e.id}`)).toEqual(["menu:m1"]);
  });

  // RED-first: pre-fix `register` pushed into the reassigned private array that
  // the store no longer referenced, so the third entry was never observed.
  test("claim after unregister appears in the store stack", () => {
    const h = mountPlugin();
    h.store.claim("dialog", "d1");
    h.store.claim("menu", "m1");
    h.store.unregister("dialog", "d1");

    h.store.claim("tooltip", "t1");

    expect(h.store.stack.map((e) => `${e.plugin}:${e.id}`)).toEqual(["menu:m1", "tooltip:t1"]);
  });

  // RED-first: pre-fix `count` was refreshed on every change while
  // `stack.length` was stale, so the two disagreed.
  test("store.count always equals store.stack.length", () => {
    const h = mountPlugin();
    h.store.claim("dialog", "d1");
    h.store.claim("menu", "m1");
    h.store.claim("tabs", "t1");
    h.store.unregister("dialog", "d1");

    // pre-fix: count 2 (fresh controller state) vs stack.length 3 (stale array)
    expect(h.store.count).toBe(h.store.stack.length);
    expect(h.store.count).toBe(2);
  });

  // Guard: the projection is filled in place, so the array identity is stable
  // across changes.
  test("store stack keeps the same array reference across changes", () => {
    const h = mountPlugin();
    const first = h.store.stack;
    h.store.claim("dialog", "d1");
    expect(h.store.stack).toBe(first);

    h.store.claim("menu", "m1");
    expect(h.store.stack).toBe(first);

    h.store.unregister("dialog", "d1");
    expect(h.store.stack).toBe(first);
    expect(h.store.stack.length).toBe(1);
  });

  // Guard (was RED pre-fix): the store array is NOT the controller's private
  // array, so mutating the projection cannot corrupt controller state.
  test("store stack is not the controller's private array", () => {
    const controller = new OverlayController();
    const store = controller.toStore();
    controller.claim("dialog", "d1");

    store.stack.push({ plugin: "ghost", id: "g1", zIndex: 9999, openedAt: 0 });

    expect(store.stack.some((e) => e.id === "g1")).toBe(true);
    expect(controller.state.stack.some((e) => e.id === "g1")).toBe(false);
    expect(controller.isOpen("ghost", "g1")).toBe(false);
  });

  // Guard on the exported helper.
  test("syncStack refills the target in place", () => {
    const target: OverlayStackEntry[] = [];
    const a: OverlayStackEntry = { plugin: "dialog", id: "d1", zIndex: 1000, openedAt: 1 };
    const b: OverlayStackEntry = { plugin: "menu", id: "m1", zIndex: 1010, openedAt: 2 };

    syncStack(target, [a, b]);
    const ref = target;
    expect(target).toEqual([a, b]);

    syncStack(target, [b]);
    expect(target).toBe(ref);
    expect(target).toEqual([b]);

    syncStack(target, []);
    expect(target).toBe(ref);
    expect(target).toEqual([]);
  });

  // RED-first: pre-fix `destroy()` cleared the private array but never emitted
  // `change`, so the plugin's sync never ran and the detached projection kept
  // its two entries.
  test("destroy() empties the store projection and reports a destroy change", () => {
    const h = mountPlugin();
    const actions: string[] = [];
    h.store.on("change", (detail) => {
      actions.push(detail.action);
    });

    h.store.claim("dialog", "d1");
    h.store.claim("menu", "m1");
    expect(h.store.stack.length).toBe(2);

    h.controller.destroy();

    expect(h.controller.state.stack).toEqual([]);
    expect(h.store.stack.length).toBe(0);
    expect(h.store.count).toBe(0);
    expect(actions).toEqual(["claim", "claim", "destroy"]);
  });

  // RED-first: pre-fix `zIndexOf` claimed a slot for a missing entry, so a pure
  // read permanently took a layer just by being rendered in a `:style`.
  test("zIndexOf on an unclaimed entry allocates nothing", () => {
    const controller = new OverlayController();

    const z = controller.zIndexOf("dialog", "d1");

    expect(z).toBe(controller.state.baseZIndex);
    expect(controller.state.stack).toEqual([]);
    expect(controller.isOpen("dialog", "d1")).toBe(false);
  });

  // RED-first: pre-fix the slot-taking API was named `register`, so `claim`
  // did not exist at all.
  test("claim allocates a slot once and is idempotent", () => {
    const controller = new OverlayController();
    const store = controller.toStore();

    const first = store.claim("dialog", "d1");

    expect(first).toBe(controller.state.baseZIndex);
    expect(controller.isOpen("dialog", "d1")).toBe(true);
    expect(controller.state.stack).toHaveLength(1);
    // No plugin here, so nothing projects: the store's `stack`/`count` are
    // filled by the plugin's `change` sync, exactly as in the other packages
    // whose `toStore()` hands out a detached projection. The projection
    // behavior is asserted against the plugin harness above, not here.

    const second = store.claim("dialog", "d1");

    expect(second).toBe(first);
    expect(controller.state.stack).toHaveLength(1);
  });

  // RED-first: pre-fix neither `OverlayStore` nor the object `toStore()` returns
  // carried a `destroy` member, so the host-owned teardown was unreachable from
  // `$store.overlay` and the controller kept holding its portal root.
  test("store.destroy() releases the portal root the controller created", () => {
    const h = mountPlugin();
    h.store.claim("dialog", "d1");

    // The resource itself: the element `createPortalRoot` appended to the body.
    const portal = document.getElementById("overlay-root");
    expect(portal).not.toBeNull();
    expect(h.store.root).toBe(portal);
    expect(h.controller.state.root).toBe(portal);

    // pre-fix: TypeError, `destroy` is not a function
    h.store.destroy();

    // Released: the controller and the store projection both drop the portal
    // reference and the stack it was managing.
    expect(h.controller.state.root).toBeNull();
    expect(h.store.root).toBeNull();
    expect(h.controller.state.stack).toEqual([]);
    expect(h.store.stack).toEqual([]);
    expect(h.store.count).toBe(0);
  });

  // RED-first: the store facade delegates to the controller's own idempotent
  // `destroy()`, which starts with `if (this.lifecycle === "destroyed") return;`.
  // Pre-fix the call threw because the member did not exist.
  test("a second store.destroy() is a no-op rather than a throw", () => {
    const h = mountPlugin();
    h.store.claim("dialog", "d1");

    h.store.destroy();
    // pre-fix: TypeError, `destroy` is not a function
    h.store.destroy();

    expect(h.store.stack).toEqual([]);
    expect(h.store.count).toBe(0);
  });

  // RED-first: pre-fix `destroy()` dropped the portal reference but never
  // detached the node `createPortalRoot` appended to `document.body`, so the
  // element outlived every reference to it. The removal goes through the
  // `removePortalRoot` helper in `@ailura/alpinejs-ui` and only fires for a
  // root this controller created — see the two ownership guards below.
  test("destroy() detaches the portal root node it created", () => {
    const h = mountPlugin();
    h.store.claim("dialog", "d1");
    const portal = document.getElementById("overlay-root");
    expect(portal).not.toBeNull();
    expect(h.store.root).toBe(portal);
    h.store.destroy();
    // pre-fix: the node survives, `document.getElementById("overlay-root")`
    // is still the detached-from-nothing element nobody references any more.
    expect(document.getElementById("overlay-root")).toBeNull();
    expect(h.controller.state.root).toBeNull();
  });

  // Ownership guard (RED pre-fix against any unconditional removal): a root the
  // caller passed in as an `HTMLElement` belongs to the caller. Removing it on
  // destroy would tear down a node the consumer may still be rendering into.
  test("a caller-supplied portal root is not removed by destroy()", () => {
    const host = document.createElement("div");
    host.id = "caller-owned-root";
    document.body.appendChild(host);
    const controller = new OverlayController({ root: host });
    controller.claim("dialog", "d1");
    expect(controller.state.root).toBe(host);

    controller.destroy();

    expect(controller.state.root).toBeNull();
    expect(document.getElementById("caller-owned-root")).toBe(host);
    expect(document.body.contains(host)).toBe(true);
  });

  // The subtle ownership case: the node WAS made by `createPortalRoot`, but by a
  // different caller, and `createPortalRoot` is idempotent — it hands back the
  // element it finds. This controller adopted it, so it must survive.
  test("a portal root createPortalRoot found already present is adopted, not removed", () => {
    // The node was made by `createPortalRoot`, but by a different caller, and
    // the factory is idempotent: it hands back the element it finds instead of
    // creating one. This controller asked for no root at all, so its only
    // contact with the node is the lazy `claim()` fallback below.
    const foreign = createPortalRoot({ id: "overlay-root" });
    expect(foreign).not.toBeNull();
    expect(document.getElementById("overlay-root")).toBe(foreign);

    const controller = new OverlayController();
    expect(controller.state.root).toBeNull();
    controller.claim("dialog", "d1");
    expect(controller.state.root).toBe(foreign);

    controller.destroy();

    expect(document.getElementById("overlay-root")).toBe(foreign);
    expect(document.body.contains(foreign)).toBe(true);
  });

  // Guard: `destroy()` is idempotent, and the idempotence is observable in the
  // DOM, not only in the return value — the node is detached exactly once.
  test("a second destroy() does not throw and does not remove the node twice", () => {
    const h = mountPlugin();
    h.store.claim("dialog", "d1");
    const portal = document.getElementById("overlay-root");
    expect(portal).not.toBeNull();
    const removeChild = vi.spyOn(document.body, "removeChild");

    h.store.destroy();
    expect(removeChild).toHaveBeenCalledTimes(1);
    expect(document.getElementById("overlay-root")).toBeNull();

    // pre-fix on the second call: no throw either (destroy is idempotent), but
    // the point is that the already-detached node is not touched a second time.
    expect(() => h.store.destroy()).not.toThrow();
    expect(removeChild).toHaveBeenCalledTimes(1);
  });

  // Ownership guard for the fix that is still owed: `#resolveRoot` can adopt a
  // root it did not create — a caller-supplied `HTMLElement`, or a
  // `querySelector` result for a plain selector — and `createPortalRoot` is
  // idempotent, returning a pre-existing element for the same id. Any removal
  // therefore has to be gated on an ownership flag the controller does not keep
  // today; this test pins the adoption side of that distinction.
  test("a caller-supplied portal root is adopted without creating a second one", () => {
    const host = document.createElement("div");
    host.id = "caller-owned-root";
    document.body.appendChild(host);
    try {
      const controller = new OverlayController({ root: host });
      controller.claim("dialog", "d1");

      expect(controller.state.root).toBe(host);
      // A selector string resolves to the existing element rather than
      // creating a new portal for the same id.
      const bySelector = new OverlayController({ root: "#caller-owned-root" });
      bySelector.claim("menu", "m1");
      expect(bySelector.state.root).toBe(host);
      expect(document.querySelectorAll("#caller-owned-root")).toHaveLength(1);
    } finally {
      host.remove();
    }
  });

  // Guard: releasing the entry gives the z-index back to the base.
  test("zIndexOf falls back to the base z-index after unregister", () => {
    const controller = new OverlayController();
    controller.claim("dialog", "d1");
    expect(controller.zIndexOf("dialog", "d1")).toBe(controller.state.baseZIndex);

    controller.unregister("dialog", "d1");

    expect(controller.zIndexOf("dialog", "d1")).toBe(controller.state.baseZIndex);
    expect(controller.state.stack).toEqual([]);
    expect(controller.isOpen("dialog", "d1")).toBe(false);
  });
});
