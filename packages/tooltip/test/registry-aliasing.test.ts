import { createMockAlpine } from "@ailura/alpinejs-testing/mock";
import { describe, expect, test } from "vite-plus/test";

import { TooltipController } from "../src/controller";
import { tooltipPlugin } from "../src/plugin";
import type { TooltipStore } from "../src/types";

describe("tooltip controller toStore() registry detachment", () => {
  test("toStore() exposes a detached projection, never the private registry", () => {
    const controller = new TooltipController();
    controller.create("t1");
    const store = controller.toStore();
    expect(controller.hasInstance("t1")).toBe(true);
    // RED assertion: the store record must stay empty until a sync fills it.
    expect(store.instances.t1).toBeUndefined();
  });

  test("the detached record keeps identity across reads and stays isolated", () => {
    const controller = new TooltipController();
    controller.create("t1");
    const first = controller.toStore();
    const second = controller.toStore();
    expect(first.instances).not.toBe(second.instances);
    controller.open("t1");
    expect(controller.isOpen("t1")).toBe(true);
    expect(first.instances.t1).toBeUndefined();
  });
});

describe("tooltip plugin store projection", () => {
  test("sync fills the store record with public snapshots and keeps it stable", () => {
    const { alpine, stores } = createMockAlpine();
    tooltipPlugin()(alpine);
    const store = stores.get("tooltip") as TooltipStore;
    store.create("t1");
    expect(store.instances.t1?.open).toBe(false);
    const record = store.instances;
    store.open("t1");
    expect(store.instances.t1?.open).toBe(true);
    expect(store.instances).toBe(record);
  });

  test("controller state stays intact after the sync runs (no virtual-style breakage)", () => {
    const { alpine, stores } = createMockAlpine();
    tooltipPlugin()(alpine);
    const store = stores.get("tooltip") as TooltipStore;
    store.create("t1");
    store.open("t1");
    // `showOnFocus` is not re-implemented by the plugin: it must still reach the
    // controller's internal instance after the sync projected snapshots.
    store.showOnFocus("t1");
    expect(store.isOpen("t1")).toBe(true);
    store.hideOnFocus("t1");
    expect(store.isOpen("t1")).toBe(false);
    // A second mutating call must not throw.
    store.open("t1");
    store.close("t1");
    expect(store.isOpen("t1")).toBe(false);
    expect(store.instances.t1?.open).toBe(false);
  });
});
