import { describe, expect, test } from "vite-plus/test";

import { AccordionController } from "../src/controller";
import { createAccordionStoreFromController } from "../src/store";
import type { AccordionStore } from "../src/types";

describe("accordion destroy() projection", () => {
  // RED: pre-fix `destroy()` emitted `change` BEFORE deleting the group, so
  // the store projection re-synced from a snapshot that still carried it and
  // the ghost entry survived.
  test("an open group is dropped from the projected registry", () => {
    const controller = new AccordionController();
    const store: AccordionStore = createAccordionStoreFromController(controller);
    controller.create("a1", { mode: "multiple" });
    controller.createItem("a1", "i1");
    controller.open("a1", "i1");
    expect(store.instances.a1).toBeDefined();
    expect(store.openIds("a1")).toEqual(["i1"]);

    controller.destroy("a1");

    expect(store.instances.a1).toBeUndefined();
    expect("a1" in store.instances).toBe(false);
  });

  test("a never-opened group is dropped from the projected registry", () => {
    const controller = new AccordionController();
    const store = createAccordionStoreFromController(controller);
    controller.create("a1");
    controller.createItem("a1", "i1");
    expect(store.instances.a1).toBeDefined();

    controller.destroy("a1");

    // Independent of `openIds` being non-empty at emit time.
    expect(store.openIds("a1")).toEqual([]);
    expect("a1" in store.instances).toBe(false);
  });

  test("destroying an unknown group is a no-op", () => {
    const controller = new AccordionController();
    const store = createAccordionStoreFromController(controller);
    controller.create("a1");

    expect(() => controller.destroy("nope")).not.toThrow();
    expect(store.instances.a1).toBeDefined();
    expect("nope" in store.instances).toBe(false);
  });

  test("destroying one group leaves the others projected and usable", () => {
    const controller = new AccordionController();
    const store = createAccordionStoreFromController(controller);
    controller.create("a1", { mode: "multiple" });
    controller.createItem("a1", "i1");
    controller.create("a2", { mode: "multiple" });
    controller.createItem("a2", "i2");
    const record = store.instances;

    controller.destroy("a1");

    expect(store.instances).toBe(record);
    expect(store.instances.a1).toBeUndefined();
    expect(store.instances.a2).toBeDefined();

    // A later mutation on a surviving group still projects correctly.
    controller.open("a2", "i2");
    expect(store.instances.a2?.open).toMatchObject({ i2: true });

    controller.create("a3");
    expect(store.instances.a3).toBeDefined();
    expect(store.instances.a1).toBeUndefined();
  });

  test("destroy emits exactly one change event", () => {
    const controller = new AccordionController();
    createAccordionStoreFromController(controller);
    const seen: string[] = [];
    controller.on("change", (detail) => {
      seen.push(detail.instanceId);
    });

    controller.create("a1", { mode: "multiple" });
    controller.createItem("a1", "i1");
    seen.length = 0;

    controller.destroy("a1");

    expect(seen).toEqual(["a1"]);
  });
});
