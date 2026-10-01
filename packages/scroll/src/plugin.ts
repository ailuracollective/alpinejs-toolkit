import { guardMagic, guardStore } from "@ailura/alpinejs-core/guards";
import { readAlpineStore, resolvePluginKeys } from "@ailura/alpinejs-core/registration";
import type { Alpine } from "alpinejs";

import { ScrollController } from "./controller";
import {
  DEFAULT_SCROLL_MAGIC_KEY,
  DEFAULT_SCROLL_STORE_KEY,
  type ScrollOptions,
  type ScrollPluginCallback,
  type ScrollState,
  type ScrollStore,
} from "./types";

const packageName = "@ailura/alpinejs-scroll";

export function scrollPlugin(options: ScrollOptions = {}): ScrollPluginCallback {
  const { storeKey, magicKey } = resolvePluginKeys(
    options,
    DEFAULT_SCROLL_STORE_KEY,
    DEFAULT_SCROLL_MAGIC_KEY
  );

  return function registerScroll(alpine: Alpine): void {
    const controller = new ScrollController(options);
    controller.mount();

    const store: ScrollStore = {
      x: controller.state.x,
      y: controller.state.y,
      direction: controller.state.direction,
      atTop: controller.state.atTop,
      atBottom: controller.state.atBottom,
      progress: controller.state.progress,
      locked: controller.state.locked,
      lockCount: controller.state.lockCount,
      activeSection: controller.state.activeSection,
      visibleSections: [...controller.state.visibleSections],
      scrollIntoView(target, opts) {
        controller.scrollIntoView(target as Element | { x: number; y: number }, opts);
      },
      by(delta, _opts) {
        controller.by(delta, _opts);
      },
      toTop(opts) {
        controller.toTop(opts);
      },
      toBottom(opts) {
        controller.toBottom(opts);
      },
      lock(reason = "store") {
        return controller.lockWithHandle(reason);
      },
      unlock(handle) {
        controller.unlock(handle);
      },
      unlockAll() {
        controller.unlockAll();
      },
      destroy() {
        controller.destroy();
      },
    };

    // Bridge reactivity
    controller.on("change", (detail) => {
      const state: ScrollState = detail.state;
      const target = readAlpineStore<Record<string, unknown>>(
        alpine,
        storeKey,
        store as unknown as Record<string, unknown>
      );
      target["x"] = state.x;
      target["y"] = state.y;
      target["direction"] = state.direction;
      target["atTop"] = state.atTop;
      target["atBottom"] = state.atBottom;
      target["progress"] = state.progress;
      target["locked"] = state.locked;
      target["lockCount"] = state.lockCount;
      target["activeSection"] = state.activeSection;
      target["visibleSections"] = [...state.visibleSections];
    });

    guardStore(alpine, storeKey, store as unknown as Record<string, unknown>, packageName);
    if (magicKey) {
      guardMagic(
        alpine,
        magicKey,
        () => readAlpineStore<ScrollStore>(alpine, storeKey),
        packageName
      );
    }
  };
}

export default scrollPlugin;
