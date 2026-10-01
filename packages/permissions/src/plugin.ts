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

    const base = controller.toStore() as unknown as PermissionsStore;
    // Every method is re-declared here rather than inherited from `base`. The
    // spread carries the detached `registry` record by reference, which `sync`
    // then fills in place — a `get registry()` override would shadow that record
    // with a throwaway object on every read and `$store.permissions.registry`
    // would read empty forever.
    const store: PermissionsStore = {
      ...base,
      get: (n: string) => controller.get(n),
      query: (n: string) => controller.query(n),
      request: (n: string, o?: unknown) => controller.request(n, o),
      refresh: (n: string) => controller.refresh(n),
      watch: (n: string) => controller.watch(n),
      register: (a) => controller.register(a),
    };

    // Keys are deleted as well as written, so unregistering an adapter empties
    // its entry rather than leaving a frozen snapshot behind.
    const sync = (): void => {
      // Before `guardStore` runs there is no Alpine proxy yet; fall back to the
      // store object itself, which is the same record Alpine will wrap.
      const proxy = readAlpineStore<Record<string, unknown>>(alpine, storeKey);
      const target = (proxy ?? store) as unknown as { registry: Record<string, unknown> };
      if (target) {
        const reg = controller.getRegistry();
        for (const k in reg) target.registry[k] = reg[k];
        for (const k in target.registry) {
          if (!(k in reg)) delete target.registry[k];
        }
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
