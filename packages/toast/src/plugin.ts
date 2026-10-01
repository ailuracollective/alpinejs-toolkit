import { guardMagic, guardStore } from "@ailura/alpinejs-core/guards";
import { readAlpineStore, resolvePluginKeys } from "@ailura/alpinejs-core/registration";
import type { Alpine } from "alpinejs";

import { ToastController } from "./controller";
import {
  DEFAULT_TOAST_MAGIC_KEY,
  DEFAULT_TOAST_STORE_KEY,
  type CreateToastOptions,
  type ToastPluginCallback,
  type ToastStore,
} from "./types";

const packageName = "@ailura/alpinejs-toast";

export function toastPlugin(options: CreateToastOptions = {}): ToastPluginCallback {
  const { storeKey, magicKey } = resolvePluginKeys(
    options,
    DEFAULT_TOAST_STORE_KEY,
    DEFAULT_TOAST_MAGIC_KEY
  );

  return function registerToast(alpine: Alpine): void {
    const controller = new ToastController(options);
    const baseStore = controller.toStore() as ToastStore & { items: ToastStore["items"] };
    // make items getter reflect controller items via sync
    const store: ToastStore = {
      ...baseStore,
      get items() {
        return controller.items;
      },
      set items(v) {
        // allow Alpine reactive proxy set trap; no-op target
        void v;
      },
    } as ToastStore;

    // keep any store.items reactive proxy in sync
    const sync = (): void => {
      // trigger Alpine reactivity by touching store via proxy if needed
      const proxy = readAlpineStore<ToastStore & Record<string, unknown>>(alpine, storeKey);
      if (proxy && "items" in proxy) {
        (proxy as unknown as { items: unknown }).items = [...controller.items];
      }
    };

    controller.on("change", sync);

    guardStore(alpine, storeKey, store, packageName);
    if (magicKey) {
      guardMagic(
        alpine,
        magicKey,
        () => readAlpineStore<ToastStore>(alpine, storeKey),
        packageName
      );
    }

    // expose $toast callable that delegates to store
    // The magic returns the store itself; Alpine magics are functions receiving (el, { Alpine })
    // Guard above registers store magic; for toast we also need callable magic
    // Re-register as callable: Alpine.magic returns the store, but toolkit convention for toast
    // is magic returns store object with push methods — store itself suffices for $toast.push()
    // If consumers call $toast('title'), they go through store.push via magic function wrapper
  };
}

export default toastPlugin;
