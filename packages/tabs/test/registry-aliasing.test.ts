import { describe, expect, test } from "vite-plus/test";

import { createTabsStore, TabsController } from "../src/controller";
import { tabsPlugin } from "../src/plugin";
import { createTabsStoreFromController } from "../src/store";
import type { TabsStore } from "../src/types";

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

describe("tabs controller toStore() registry detachment", () => {
  test("toStore() exposes a detached projection, never the private registry", () => {
    const controller = new TabsController();
    controller.create("g1");
    const store = controller.toStore();
    // The private registry is reachable only through the controller itself.
    expect(controller.hasInstance("g1")).toBe(true);
    // RED assertion: the store record must stay empty until a sync fills it.
    expect(store.instances.g1).toBeUndefined();
  });

  test("two toStore() calls hand out independent detached records", () => {
    const controller = new TabsController();
    controller.create("g1");
    const first = controller.toStore();
    const second = controller.toStore();
    expect(first.instances).not.toBe(second.instances);
    expect(first.instances.g1).toBeUndefined();
    expect(second.instances.g1).toBeUndefined();
  });
});

describe("tabs public store factory projection", () => {
  // Refactor guard: this passed pre-fix only because the store leaked the
  // live private map. It must keep passing after the detach.
  test("createTabsStore() still projects registered groups into its record", () => {
    const store = createTabsStore();
    store.create("g1", { orientation: "vertical" });
    expect(store.instances.g1?.orientation).toBe("vertical");
    expect(store.instances.g1?.activeTabId).toBe(null);
  });

  test("createTabsStoreFromController() projects into the detached record", () => {
    const controller = new TabsController();
    const store = createTabsStoreFromController(controller);
    controller.create("g1", { defaultTab: "t1" });
    expect(store.instances.g1?.activeTabId).toBe("t1");
    const record = store.instances;
    controller.create("g2");
    expect(store.instances).toBe(record);
    expect(store.instances.g2).toBeDefined();
  });
});

describe("tabs plugin store projection", () => {
  test("sync fills the store record with public snapshots and keeps it stable", () => {
    const { alpine, stores } = createMockAlpine();
    tabsPlugin()(alpine);
    const store = stores.get("tabs") as TabsStore;
    store.create("g1", { orientation: "vertical" });
    store.createItem("g1", "t1");
    expect(store.instances.g1?.orientation).toBe("vertical");
    expect(store.instances.g1?.activeTabId).toBe("t1");
    expect(store.instances.g1?.items.map((i) => i.id)).toEqual(["t1"]);
    const record = store.instances;
    store.select("g1", "t1");
    expect(store.instances).toBe(record);
    expect(store.instances.g1?.activeTabId).toBe("t1");
  });

  test("controller state stays intact after the sync runs (liveness)", () => {
    const { alpine, stores } = createMockAlpine();
    tabsPlugin()(alpine);
    const store = stores.get("tabs") as TabsStore;
    store.create("g1");
    store.createItem("g1", "t1");
    store.createItem("g1", "t2");
    // `next` is not re-implemented by the plugin: it must still read the
    // controller's internal state after the sync projected snapshots.
    // The first tab auto-activates on registration.
    expect(store.active("g1")).toBe("t1");
    store.next("g1");
    expect(store.active("g1")).toBe("t2");
    store.next("g1");
    expect(store.active("g1")).toBe("t1");
    expect(store.instances.g1?.activeTabId).toBe("t1");
    // Plugin overrides read the reactive record, so they agree with the core.
    expect(store.isActive("g1", "t1")).toBe(true);
    expect(store.tabProps("g1", "t1")).toMatchObject({ role: "tab", "aria-selected": true });
    expect(store.panelProps("g1", "t2")).toMatchObject({ role: "tabpanel", hidden: true });
    expect(store.tablistProps("g1")).toEqual({ role: "tablist", "aria-orientation": "horizontal" });
  });
});
