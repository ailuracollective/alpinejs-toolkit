import { describe, expect, test } from "vite-plus/test";

import { AccordionController } from "../src/controller";
import { accordionPlugin } from "../src/plugin";
import { createAccordionStoreFromController } from "../src/store";
import type { AccordionStore } from "../src/types";

function createMockAlpine() {
  const stores = new Map<string, unknown>();
  const magics = new Map<string, unknown>();
  const alpine = {
    store(name: string, value?: unknown) {
      if (value !== undefined) {
        stores.set(name, value);
        return;
      }
      return stores.get(name);
    },
    magic(name: string, callback: unknown) {
      magics.set(name, callback);
    },
  } as unknown as import("alpinejs").Alpine;
  return { alpine, stores, magics };
}

describe("accordion store factory registry detachment", () => {
  test("the factory exposes a detached projection, never the private registry", () => {
    const controller = new AccordionController();
    // Register BEFORE the factory builds the record: the private registry is
    // already populated, so an aliased record would leak `a1` into the store.
    controller.create("a1");
    const store = createAccordionStoreFromController(controller);
    // The private registry is reachable only through the controller itself.
    expect(controller.hasInstance("a1")).toBe(true);
    // Detachment assertion: the record is fresh and empty, never the private
    // map. It stays empty until the next sync fills it.
    expect(store.instances.a1).toBeUndefined();
  });

  test("two factory calls hand out independent detached records", () => {
    const controller = new AccordionController();
    const first = createAccordionStoreFromController(controller);
    const second = createAccordionStoreFromController(controller);
    expect(first.instances).not.toBe(second.instances);
    expect(first.instances).toEqual({});
    expect(second.instances).toEqual({});
  });
});

describe("accordion public store factory projection", () => {
  // Refactor guard: this passed pre-fix only because the store leaked the
  // live private map. It must keep passing after the detach.
  test("createAccordionStoreFromController() still projects createed groups", () => {
    const controller = new AccordionController();
    const store = createAccordionStoreFromController(controller);
    controller.create("a1", { mode: "multiple" });
    expect(store.instances.a1?.mode).toBe("multiple");
    expect(store.instances.a1?.activeItemId).toBe(null);
  });

  test("the projected record keeps identity across sync runs", () => {
    const controller = new AccordionController();
    const store = createAccordionStoreFromController(controller);
    controller.create("a1");
    controller.createItem("a1", "i1");
    const record = store.instances;
    controller.create("a2");
    expect(store.instances).toBe(record);
    expect(store.instances.a2).toBeDefined();
    controller.open("a1", "i1");
    expect(store.instances).toBe(record);
    expect(store.instances.a1?.open).toMatchObject({ i1: true });
  });
});

describe("accordion plugin store projection", () => {
  test("sync fills the store record with public snapshots and keeps it stable", () => {
    const { alpine, stores } = createMockAlpine();
    accordionPlugin()(alpine);
    const store = stores.get("accordion") as AccordionStore;
    store.create("a1", { mode: "multiple", defaultOpen: "i1" });
    store.createItem("a1", "i1");
    store.createItem("a1", "i2");
    expect(store.instances.a1?.mode).toBe("multiple");
    expect(store.instances.a1?.defaultOpen).toEqual(["i1"]);
    expect(store.instances.a1?.open).toMatchObject({ i1: true });
    expect(store.instances.a1?.items.map((i) => i.id)).toEqual(["i1", "i2"]);
    const record = store.instances;
    store.toggle("a1", "i2");
    expect(store.instances).toBe(record);
    expect(store.instances.a1?.open).toMatchObject({ i1: true, i2: true });
  });

  test("controller state stays intact after the sync runs (liveness)", () => {
    const { alpine, stores } = createMockAlpine();
    accordionPlugin()(alpine);
    const store = stores.get("accordion") as AccordionStore;
    store.create("a1", { mode: "multiple" });
    store.createItem("a1", "i1");
    store.createItem("a1", "i2");
    // `toggle`/`open` are not re-implemented by the plugin: they must still
    // write the controller's internal state after the sync ran.
    store.toggle("a1", "i1");
    expect(store.openIds("a1")).toEqual(["i1"]);
    store.toggle("a1", "i2");
    expect(store.openIds("a1")).toEqual(["i1", "i2"]);
    expect(store.isOpen("a1", "i2")).toBe(true);
    expect(store.instances.a1?.open).toMatchObject({ i1: true, i2: true });
    store.close("a1", "i1");
    expect(store.isOpen("a1", "i1")).toBe(false);
    expect(store.openIds("a1")).toEqual(["i2"]);
    expect(store.triggerProps("a1", "i2")).toMatchObject({
      "aria-expanded": true,
      "aria-controls": "a1-panel-i2",
    });
    expect(store.panelProps("a1", "i1")).toMatchObject({ role: "region", "aria-hidden": true });
  });
});
