import { createMockAlpine } from "@ailura/alpinejs-testing/mock";
import { describe, expect, test } from "vite-plus/test";

import { DialogController } from "../src/controller";
import { dialogPlugin } from "../src/plugin";
import type { DialogStore } from "../src/types";

describe("dialog controller toStore() registry detachment", () => {
  test("toStore() exposes a detached projection, never the private registry", () => {
    const controller = new DialogController();
    controller.create("d1");
    const store = controller.toStore();
    // The private registry is reachable only through the controller itself.
    expect(controller.hasInstance("d1")).toBe(true);
    // RED assertion: the store record must stay empty until a sync fills it.
    expect(store.instances.d1).toBeUndefined();
  });

  test("the detached record keeps identity across reads and stays isolated", () => {
    const controller = new DialogController();
    controller.create("d1");
    const first = controller.toStore();
    const second = controller.toStore();
    expect(first.instances).not.toBe(second.instances);
    controller.open("d1");
    expect(controller.isOpen("d1")).toBe(true);
    expect(first.instances.d1).toBeUndefined();
  });
});

describe("dialog plugin store projection", () => {
  test("sync fills the store record with public snapshots and keeps it stable", () => {
    const { alpine, stores } = createMockAlpine();
    dialogPlugin()(alpine);
    const store = stores.get("dialog") as DialogStore;
    store.create("d1", { labelledBy: "title" });
    expect(store.instances.d1?.open).toBe(false);
    expect(store.instances.d1?.labelledBy).toBe("title");
    const record = store.instances;
    store.open("d1");
    expect(store.instances).toBe(record);
  });

  test("controller state stays intact after the sync runs (no virtual-style breakage)", () => {
    const { alpine, stores } = createMockAlpine();
    dialogPlugin()(alpine);
    const store = stores.get("dialog") as DialogStore;
    store.create("d1", { labelledBy: "title", describedBy: "desc" });
    store.open("d1");
    // `dialogProps` is not re-implemented by the plugin: it must still read
    // the controller's internal instance after the sync projected snapshots.
    expect(store.dialogProps("d1")).toMatchObject({
      role: "dialog",
      "aria-modal": true,
      "aria-labelledby": "title",
      "aria-describedby": "desc",
    });
    expect(store.isOpen("d1")).toBe(true);
    // A second mutating call must not throw.
    store.close("d1");
    store.open("d1");
    expect(store.isOpen("d1")).toBe(true);
    expect(store.instances.d1?.open).toBe(true);
  });
});
