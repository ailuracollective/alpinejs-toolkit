import { createMockAlpine } from "@ailura/alpinejs-testing/mock";
import { describe, expect, test } from "vite-plus/test";

import { MenuController } from "../src/controller";
import { menuPlugin } from "../src/plugin";
import type { MenuStore } from "../src/types";

describe("menu controller toStore() registry detachment", () => {
  test("toStore() exposes a detached projection, never the private registry", () => {
    const controller = new MenuController();
    controller.create("m1");
    const store = controller.toStore();
    expect(controller.hasInstance("m1")).toBe(true);
    // RED assertion: the store record must stay empty until a sync fills it.
    expect(store.instances.m1).toBeUndefined();
  });

  test("the detached record keeps identity across reads and stays isolated", () => {
    const controller = new MenuController();
    controller.create("m1");
    const first = controller.toStore();
    const second = controller.toStore();
    expect(first.instances).not.toBe(second.instances);
    controller.createItem("m1", "item-1");
    expect(controller.activeItem("m1")).toBe(null);
    expect(first.instances.m1?.items).toBeUndefined();
  });
});

describe("menu plugin store projection", () => {
  test("sync fills the store record with public snapshots and keeps it stable", () => {
    const { alpine, stores } = createMockAlpine();
    menuPlugin()(alpine);
    const store = stores.get("menu") as MenuStore;
    store.create("m1");
    expect(store.instances.m1?.open).toBe(false);
    const record = store.instances;
    store.open("m1");
    expect(store.instances.m1?.open).toBe(true);
    expect(store.instances).toBe(record);
  });

  test("controller state stays intact after the sync runs (no virtual-style breakage)", () => {
    const { alpine, stores } = createMockAlpine();
    menuPlugin()(alpine);
    const store = stores.get("menu") as MenuStore;
    store.create("m1", { orientation: "horizontal" });
    store.createItem("m1", "item-1");
    store.open("m1");
    // `itemProps`/`menuProps` are not re-implemented by the plugin: they must
    // still read the controller's internal instance after the sync ran.
    expect(store.menuProps("m1")).toMatchObject({
      role: "menu",
      id: "m1",
      "aria-orientation": "horizontal",
    });
    expect(store.itemProps("m1", "item-1")).toMatchObject({
      role: "menuitem",
      id: "m1-item-item-1",
    });
    expect(store.activeItem("m1")).toBe("item-1");
    // A second mutating call must not throw.
    store.createItem("m1", "item-2");
    store.setActiveItem("m1", "item-2");
    expect(store.activeItem("m1")).toBe("item-2");
    expect(store.instances.m1?.items).toHaveLength(2);
  });
});
