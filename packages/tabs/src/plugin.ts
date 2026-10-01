import { guardMagic, guardStore } from "@ailura/alpinejs-core/guards";
import { readAlpineStore, resolvePluginKeys } from "@ailura/alpinejs-core/registration";
import { syncRecordFromSnapshot } from "@ailura/alpinejs-core/sync";
import type { Alpine } from "alpinejs";

import { TabsController } from "./controller";
import { createTabsStoreFromController } from "./store";
import {
  type CreateTabsOptions,
  DEFAULT_TABS_MAGIC_KEY,
  DEFAULT_TABS_STORE_KEY,
  type TabsPluginCallback,
  type TabsStore,
} from "./types";

const packageName = "@ailura/alpinejs-tabs";

export function tabsPlugin(options: CreateTabsOptions = {}): TabsPluginCallback {
  const { storeKey, magicKey } = resolvePluginKeys(
    options,
    DEFAULT_TABS_STORE_KEY,
    DEFAULT_TABS_MAGIC_KEY
  );

  return function registerTabs(alpine: Alpine): void {
    const controller = new TabsController(options.id);
    const base = createTabsStoreFromController(controller);

    // These five replace the versions `toStore()` built, which are arrow
    // functions closing over the controller. That is correct for a standalone
    // store and wrong for this one: the controller's registry is private and
    // untracked, so a read from it inside an Alpine effect registers no
    // dependency and the effect never re-runs. `x-bind:aria-selected` would
    // freeze at its init value and the panels would never swap. `this` is
    // Alpine's reactive proxy (and only Alpine's — hence `function`, not an
    // arrow), so reading `this.instances` is what makes the surrounding effect
    // re-evaluate.
    //
    // KNOWN DUPLICATION: these five bodies are near-verbatim copies of
    // `TabsController`'s own `active`/`isActive`/`tabProps`/`panelProps`/
    // `tablistProps`. They belong in `store.ts`, next to the projection they
    // read from — the way `accordion` does it — rather than being patched onto
    // the store by the plugin that happens to register it. Until they move,
    // changing an attribute name in the controller has to be made here too.
    base.active = function (id) {
      return (this as TabsStore).instances?.[id]?.activeTabId ?? null;
    };
    base.isActive = function (id, tabId) {
      return (this as TabsStore).instances?.[id]?.activeTabId === tabId;
    };
    base.tabProps = function (id, tabId) {
      const active = (this as TabsStore).instances?.[id]?.activeTabId === tabId;
      return {
        role: "tab",
        id: `${id}-tab-${tabId}`,
        "aria-selected": active,
        "aria-controls": `${id}-panel-${tabId}`,
        tabindex: active ? 0 : -1,
      };
    };
    base.panelProps = function (id, tabId) {
      const active = (this as TabsStore).instances?.[id]?.activeTabId === tabId;
      return {
        role: "tabpanel",
        id: `${id}-panel-${tabId}`,
        "aria-labelledby": `${id}-tab-${tabId}`,
        hidden: !active,
      };
    };
    base.tablistProps = function (id) {
      return {
        role: "tablist",
        "aria-orientation": (this as TabsStore).instances?.[id]?.orientation,
      };
    };
    // Alias kept so the type is asserted once, at the shape the five overrides
    // above assume.
    const store: TabsStore = base;

    const sync = (): void => {
      const proxy = readAlpineStore<TabsStore>(alpine, storeKey, store);
      // Mutate through the reactive proxy so Alpine triggers re-renders.
      syncRecordFromSnapshot(proxy.instances, controller.snapshotInstances());
    };

    controller.on("change", sync);

    guardStore(alpine, storeKey, store, packageName);
    if (magicKey) {
      guardMagic(alpine, magicKey, () => readAlpineStore<TabsStore>(alpine, storeKey), packageName);
    }
  };
}

export default tabsPlugin;
