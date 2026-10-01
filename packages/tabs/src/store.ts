import { syncRecordFromSnapshot } from "@ailura/alpinejs-core/sync";

import type { TabsController } from "./controller";
import type { TabsInstance, TabsStore } from "./types";

/**
 * `TabsController.toStore()` plus a subscription that keeps `store.instances`
 * mirroring the controller.
 *
 * The five derived reads (`active`, `isActive`, `tabProps`, `panelProps`,
 * `tablistProps`) are NOT overridden here the way `plugin.ts` overrides them —
 * see the comment there. A standalone store from this factory is therefore not
 * reactive, which is fine: nothing in it is running inside an effect.
 */
export function createTabsStoreFromController(controller: TabsController): TabsStore {
  const store = controller.toStore();
  const instances: Record<string, TabsInstance> = store.instances;
  controller.on("change", () => {
    syncRecordFromSnapshot(instances, controller.snapshotInstances());
  });
  return store;
}
