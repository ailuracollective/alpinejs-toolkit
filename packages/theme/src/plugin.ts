import { guardMagic, guardStore } from "@ailura/alpinejs-core/guards";
import { readAlpineStore, resolvePluginKeys } from "@ailura/alpinejs-core/registration";
import type { Alpine } from "alpinejs";

import { createThemeController, type ThemeController } from "./controller";
import {
  type CreateThemeOptions,
  type ThemeStore,
  DEFAULT_THEME_MAGIC_KEY,
  DEFAULT_THEME_STORE_KEY,
} from "./types";

export type ThemePluginCallback = (alpine: Alpine) => void;

const packageName = "@ailura/alpinejs-theme";

export function themePlugin(options: CreateThemeOptions = {}): ThemePluginCallback {
  const { storeKey, magicKey } = resolvePluginKeys(
    options,
    DEFAULT_THEME_STORE_KEY,
    DEFAULT_THEME_MAGIC_KEY
  );
  const reapplyEvents = options.reapplyEvents;

  return function registerTheme(alpine: Alpine): void {
    const manager = createThemeController(options);
    const reapply = createReapplyCleanup();
    const store = createThemeStore(manager, reapply.release);

    manager.on("change", (detail) => {
      // `target` is the whole projection: `alpine.store(storeKey)` returns
      // Alpine's reactive proxy of the very object created below, and a write
      // through that proxy lands on the created object, so writing the base
      // store again would only repeat the same assignment. The `?? store`
      // fallback covers the case where the store is not registered (yet),
      // where `target` IS `store`.
      const target = readAlpineStore<ThemeStore>(alpine, storeKey, store);
      target.current = detail.current;
      target.system = detail.system;
      target.resolved = detail.resolved;
    });

    guardStore(alpine, storeKey, store, packageName);
    if (magicKey) {
      guardMagic(
        alpine,
        magicKey,
        () => readAlpineStore<ThemeStore>(alpine, storeKey),
        packageName
      );
    }

    // `reapplyEvents` listeners are the *plugin's*, not the controller's: they
    // are `document` listeners, and a controller that is reused through the
    // singleton should not accumulate one set per registration. That is also
    // why the store's `destroy()` releases them explicitly — see
    // `createThemeStore`.
    if (reapplyEvents && reapplyEvents.length > 0 && typeof document !== "undefined") {
      const reapplyHandler = (): void => manager.apply();
      for (const type of reapplyEvents) {
        document.addEventListener(type, reapplyHandler);
        reapply.add(type, reapplyHandler);
      }
    }
  };
}

/**
 * Bookkeeping for the `document` listeners this plugin registers. Removal is
 * idempotent: entries are spliced out as they are released, and a listener
 * offered after teardown is never registered.
 */
function createReapplyCleanup() {
  const registered: Array<{ type: string; handler: EventListener }> = [];
  let released = false;
  return {
    add(type: string, handler: EventListener): void {
      if (released) return;
      registered.push({ type, handler });
    },
    release(): void {
      released = true;
      for (const { type, handler } of registered.splice(0)) {
        document.removeEventListener(type, handler);
      }
    },
  };
}

/**
 * The `$store.theme` projection, plus the listener release the plugin owns.
 *
 * Exported so a host that registers the plugin by hand — a test, or a
 * micro-frontend with its own boot — can wire the same teardown the plugin
 * would have. The default release is a no-op for exactly that reason: a store
 * built without `reapplyEvents` has nothing to release.
 */
export function createThemeStore(
  manager: ThemeController,
  releaseReapplyListeners: () => void = () => {}
): ThemeStore {
  return {
    current: manager.current,
    system: manager.system,
    resolved: manager.resolved,
    set(value) {
      manager.set(value);
    },
    toggle() {
      manager.toggle();
    },
    reset() {
      manager.reset();
    },
    apply() {
      manager.apply();
    },
    destroy() {
      // The plugin's own `reapplyEvents` listeners go first: while the manager
      // is still live, an event arriving mid-teardown would re-apply a theme to
      // a DOM the controller is about to release. Once the manager is destroyed
      // `apply()` is a silent no-op, so a surviving listener would be a leak
      // the handle could no longer honestly advertise.
      releaseReapplyListeners();
      manager.destroy();
    },
  };
}

export default themePlugin;
