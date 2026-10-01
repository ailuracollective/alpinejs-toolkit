import { guardMagic, guardStore } from "@ailura/alpinejs-core/guards";
import { readAlpineStore, resolvePluginKeys } from "@ailura/alpinejs-core/registration";
import type { Alpine } from "alpinejs";

import { SidebarController } from "./controller";
import {
  DEFAULT_SIDEBAR_MAGIC_KEY,
  DEFAULT_SIDEBAR_STORE_KEY,
  type CreateSidebarOptions,
  type SidebarPluginCallback,
  type SidebarAlpineStore,
} from "./types";

const packageName = "@ailura/alpinejs-sidebar";

export function sidebarPlugin(options: CreateSidebarOptions = {}): SidebarPluginCallback {
  const { storeKey, magicKey } = resolvePluginKeys(
    options,
    DEFAULT_SIDEBAR_STORE_KEY,
    DEFAULT_SIDEBAR_MAGIC_KEY
  );

  return function registerSidebar(alpine: Alpine): void {
    const controller = new SidebarController(options);
    const store: SidebarAlpineStore = {
      visible: controller.visible,
      matchesBreakpoint: controller.matchesBreakpoint,
      isVisible: controller.isVisible,
      hasOverlay: controller.hasOverlay,
      show: () => controller.show(),
      hide: () => controller.hide(),
      toggle: () => controller.toggle(),
      reset: () => controller.reset(),
      handleKeydown: (event) => controller.handleKeydown(event),
      destroy: () => controller.destroy(),
    };

    // All four state fields, not just two. `isVisible` and `hasOverlay` were
    // snapshotted into the store literal at registration and never written
    // again, so a template reading them tracked a key that never changed and
    // they stayed frozen for the life of the page.
    const sync = (): void => {
      const proxy = readAlpineStore<SidebarAlpineStore>(alpine, storeKey);
      if (!proxy) return;
      const target = proxy as unknown as {
        visible: boolean;
        matchesBreakpoint: boolean;
        isVisible: boolean;
        hasOverlay: boolean;
      };
      target.visible = controller.visible;
      target.matchesBreakpoint = controller.matchesBreakpoint;
      target.isVisible = controller.isVisible;
      target.hasOverlay = controller.hasOverlay;
    };

    controller.mount();
    controller.on("change", sync);

    guardStore(alpine, storeKey, store, packageName);
    if (magicKey) {
      guardMagic(
        alpine,
        magicKey,
        () => readAlpineStore<SidebarAlpineStore>(alpine, storeKey),
        packageName
      );
    }
  };
}

export default sidebarPlugin;
