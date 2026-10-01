import { syncRecordFromSnapshot } from "@ailura/alpinejs-core/sync";

import type { AccordionController } from "./controller";
import type { AccordionInstance, AccordionStore } from "./types";

export function createAccordionStoreFromController(
  controller: AccordionController
): AccordionStore {
  const store: AccordionStore = {
    // A fresh record, never the private registry: the plugin's sync writes
    // plain snapshots here, so aliasing the private map would destroy the
    // controller's internal instance state.
    instances: {} as AccordionStore["instances"],
    create: controller.create.bind(controller),
    // One key, both arities, argument forwarded. `destroy: () =>
    // controller.destroy()` would make `store.destroy("faq")` tear down the
    // controller instead of one accordion — the id would arrive and be dropped.
    // The parameter is optional in the implementation because the type declares
    // two overloads and an arrow literal has to satisfy both.
    destroy: (id?: string) => controller.destroy(id),
    destroyAll: controller.destroyAll.bind(controller),
    createItem: controller.createItem.bind(controller),
    destroyItem: controller.destroyItem.bind(controller),
    open: controller.open.bind(controller),
    close: controller.close.bind(controller),
    toggle: controller.toggle.bind(controller),
    setActiveItem: controller.setActiveItem.bind(controller),
    handleKeydown: controller.handleKeydown.bind(controller),
    // The five derived reads below are projections, not delegations: they
    // read `this.instances` so the read goes through Alpine's reactive store
    // proxy (a closure over the controller's raw registry would never
    // re-render, and `this` is the proxy only when Alpine calls the method
    // on it). They therefore live here, where the projection is assembled,
    // and not in `plugin.ts`.
    isOpen: function (id, itemId) {
      return (this as AccordionStore).instances?.[id]?.open[itemId] ?? false;
    },
    openIds: function (id) {
      const open = (this as AccordionStore).instances?.[id]?.open;
      const out: string[] = [];
      if (open) for (const k in open) if (open[k]) out.push(k);
      return out;
    },
    activeItem: function (id) {
      return (this as AccordionStore).instances?.[id]?.activeItemId ?? null;
    },
    triggerProps: function (id, itemId) {
      const open = (this as AccordionStore).instances?.[id]?.open[itemId] ?? false;
      const active = (this as AccordionStore).instances?.[id]?.activeItemId === itemId;
      return {
        "aria-expanded": open,
        "aria-controls": `${id}-panel-${itemId}`,
        id: `${id}-trigger-${itemId}`,
        tabindex: active ? 0 : -1,
      };
    },
    panelProps: function (id, itemId) {
      const open = (this as AccordionStore).instances?.[id]?.open[itemId] ?? false;
      return {
        id: `${id}-panel-${itemId}`,
        role: "region",
        "aria-labelledby": `${id}-trigger-${itemId}`,
        "aria-hidden": open ? undefined : true,
      };
    },
  };
  const instances: Record<string, AccordionInstance> = store.instances;
  controller.on("change", () => {
    syncRecordFromSnapshot(instances, controller.snapshotInstances());
  });
  return store;
}
