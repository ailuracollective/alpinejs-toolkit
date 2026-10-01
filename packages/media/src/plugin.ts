import { guardStore } from "@ailura/alpinejs-core/guards";
import { readAlpineStore, resolveStoreKey } from "@ailura/alpinejs-core/registration";
import type { Alpine } from "alpinejs";

import { createMediaController, MediaController } from "./controller";
import {
  DEFAULT_MEDIA_STORE_KEY,
  type CreateMediaOptions,
  type MediaPluginCallback,
  type MediaStore,
} from "./types";

const packageName = "@ailura/alpinejs-media";

export function mediaPlugin(options: CreateMediaOptions = {}): MediaPluginCallback {
  const storeKey = resolveStoreKey(options, DEFAULT_MEDIA_STORE_KEY);

  return function registerMedia(alpine: Alpine): void {
    const controller = createMediaController(options);

    const store: MediaStore = {
      width: controller.width,
      height: controller.height,
      breakpoint: controller.breakpoint,
      prefersReducedMotion: controller.prefersReducedMotion,
      prefersColorScheme: controller.snapshot().prefersColorScheme,
      isDark: controller.isDark,
      refresh() {
        controller.refresh();
      },
      destroy() {
        controller.destroy();
      },
    };

    // Sync reactivity: push snapshot fields onto reactive store on change.
    // `target` is the whole projection: `alpine.store(storeKey)` returns Alpine's
    // reactive proxy of the very object registered below, and a write through
    // that proxy lands on the registered object, so writing the base store
    // again would only repeat the same assignment. The `?? store` fallback
    // covers the case where the store is not registered (yet), where `target`
    // IS `store`.
    controller.on("change", (detail) => {
      const reactive = readAlpineStore<MediaStore>(alpine, storeKey);
      const target = (reactive ?? store) as unknown as Record<string, unknown>;
      target["width"] = detail.width;
      target["height"] = detail.height;
      target["breakpoint"] = detail.breakpoint;
      target["prefersReducedMotion"] = detail.prefersReducedMotion;
      target["prefersColorScheme"] = detail.prefersColorScheme;
      target["isDark"] = detail.isDark;
    });

    guardStore(alpine, storeKey, store, packageName);
  };
}

export { createMediaController, MediaController };

export default mediaPlugin;
