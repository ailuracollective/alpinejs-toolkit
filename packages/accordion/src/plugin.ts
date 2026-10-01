import { guardStore } from "@ailura/alpinejs-core/guards";
import { readAlpineStore, resolveStoreKey } from "@ailura/alpinejs-core/registration";
import { syncRecordFromSnapshot } from "@ailura/alpinejs-core/sync";
import type { Alpine } from "alpinejs";

import { AccordionController } from "./controller";
import { createAccordionStoreFromController } from "./store";
import {
  type AccordionPluginCallback,
  type AccordionStore,
  type CreateAccordionOptions,
  DEFAULT_ACCORDION_STORE_KEY,
} from "./types";

const packageName = "@ailura/alpinejs-accordion";

export function accordionPlugin(options: CreateAccordionOptions = {}): AccordionPluginCallback {
  // Resolved outside the callback so `Alpine.plugin()` sees the same name the
  // caller asked for, and a collision is reported against it.
  const storeKey = resolveStoreKey(options, DEFAULT_ACCORDION_STORE_KEY);

  return function registerAccordion(alpine: Alpine): void {
    const controller = new AccordionController(options.id);
    // The read-model projection lives in the store factory, not here: it has to
    // read `this.instances` so the reads go through Alpine's reactive proxy.
    const store = createAccordionStoreFromController(controller);

    const sync = (): void => {
      const snapshot = controller.snapshotInstances();
      syncRecordFromSnapshot(
        readAlpineStore<AccordionStore>(alpine, storeKey, store).instances,
        snapshot
      );
    };

    // `change` fires for registration and teardown too, so this is what carries
    // a `create()` into the store — there is no second path for it.
    controller.on("change", sync);

    guardStore(alpine, storeKey, store, packageName);
  };
}

export default accordionPlugin;
