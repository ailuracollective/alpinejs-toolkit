import { guardMagic, guardStore } from "@ailura/alpinejs-core/guards";
import { readAlpineStore, resolvePluginKeys } from "@ailura/alpinejs-core/registration";
import type { Alpine } from "alpinejs";

import { PermissionsController } from "./controller";
import {
  DEFAULT_PERMISSIONS_MAGIC_KEY,
  DEFAULT_PERMISSIONS_STORE_KEY,
  type PermissionsPluginCallback,
  type PermissionsPluginOptions,
  type PermissionsStore,
} from "./types";

const packageName = "@ailura/alpinejs-permissions";

export function permissionsPlugin(
  options: PermissionsPluginOptions = {}
): PermissionsPluginCallback {
  const { storeKey, magicKey } = resolvePluginKeys(
    options,
    DEFAULT_PERMISSIONS_STORE_KEY,
    DEFAULT_PERMISSIONS_MAGIC_KEY
  );

  return function registerPermissions(alpine: Alpine): void {
    const controller = new PermissionsController();
    for (const adapter of options.adapters ?? []) controller.register(adapter);

    // The store is built once, by `toStore()`, and used as it comes back.
    // Re-declaring every method here used to shadow the ones `toStore()` had
    // already bound to this same controller — a second construction of the same
    // closures, byte for byte, for no behaviour. The record `toStore()`
    // returns is a plain object, not a getter, and its `registry` member is a
    // stable object reference, which is what `sync` fills in place: a
    // `get registry()` override would shadow that record with a throwaway
    // object on every read and `$store.permissions.registry` would read empty
    // forever.
    const store = controller.toStore() as unknown as PermissionsStore;

    // Keys are deleted as well as written, so unregistering an adapter empties
    // its entry rather than leaving a frozen snapshot behind.
    const sync = (): void => {
      // Before `guardStore` runs there is no Alpine proxy yet; fall back to the
      // store object itself, which is the same record Alpine will wrap. That
      // fallback is why `target` is never nullish and needs no guard.
      const proxy = readAlpineStore<Record<string, unknown>>(alpine, storeKey);
      const target = (proxy ?? store) as unknown as { registry: Record<string, unknown> };
      const reg = controller.getRegistry();
      for (const k in reg) target.registry[k] = reg[k];
      for (const k in target.registry) {
        if (!(k in reg)) delete target.registry[k];
      }
    };
    controller.on("change", sync);
    // initial sync: adapters registered above exist before this subscription,
    // so no change event will ever arrive for them.
    sync();

    guardStore(alpine, storeKey, store, packageName);
    if (magicKey) {
      guardMagic(
        alpine,
        magicKey,
        () => readAlpineStore<PermissionsStore>(alpine, storeKey),
        packageName
      );
    }
  };
}

export default permissionsPlugin;
