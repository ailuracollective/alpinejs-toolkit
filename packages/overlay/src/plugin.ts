import { guardMagic, guardStore } from "@ailura/alpinejs-core/guards";
import { readAlpineStore, resolvePluginKeys } from "@ailura/alpinejs-core/registration";
import type { Alpine } from "alpinejs";

import { OverlayController } from "./controller";
import { syncStack } from "./store";
import type { OverlayOptions, OverlayPluginCallback, OverlayStore } from "./types";
import { DEFAULT_OVERLAY_MAGIC_KEY, DEFAULT_OVERLAY_STORE_KEY } from "./types";

const packageName = "@ailura/alpinejs-overlay";

export function overlayPlugin(options: OverlayOptions = {}): OverlayPluginCallback {
  const { storeKey, magicKey } = resolvePluginKeys(
    options,
    DEFAULT_OVERLAY_STORE_KEY,
    DEFAULT_OVERLAY_MAGIC_KEY
  );

  return function registerOverlay(alpine: Alpine): void {
    // Constructed, not created through the factory: the factory also calls
    // `mount()`, and the plugin owns no teardown of its own to hang off it.
    const controller = new OverlayController(options);
    const store = controller.toStore() as OverlayStore;

    // Keep count/stack/root in sync on change. `store.stack` is a detached
    // projection: `syncStack` refills that same array in place from the
    // controller snapshot, so the store object identity never changes.
    const sync = (): void => {
      syncStack(store.stack, controller.state.stack);
      // `count` is derived from the projection rather than copied from the
      // controller, so the two can never disagree — the test file pins that.
      (store as { count: number }).count = controller.state.stack.length;
      (store as { root: typeof store.root }).root = controller.state.root;
      (store as { baseZIndex: number }).baseZIndex = controller.state.baseZIndex;
      (store as { step: number }).step = controller.state.step;
    };

    // `on` registers the unsubscribe on the controller's cleanup stack, and this
    // callback returns void, so the subscription lives as long as the store does.
    // Nothing calls `store.destroy()` for you — the host that registered the
    // plugin owns that, and calling it releases an owned portal root.
    controller.on("change", sync);

    guardStore(alpine, storeKey, store, packageName);
    if (magicKey) {
      // The magic IS the store: one object under two names, so a template can
      // read `$overlay.count` and a script can call `$store.overlay.claim(…)` on
      // the same state.
      guardMagic(
        alpine,
        magicKey,
        () => readAlpineStore<OverlayStore>(alpine, storeKey),
        packageName
      );
    }
  };
}

export default overlayPlugin;
