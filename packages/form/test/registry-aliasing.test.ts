import { describe, expect, test } from "vite-plus/test";

import { FormController } from "../src/controller";
import { formPlugin } from "../src/plugin";
import type { FormStore } from "../src/types";

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

/** Mirrors the plugin's `sync()` projection against a given store record. */
function projectInstances(store: FormStore, controller: FormController): void {
  const snap = controller.snapshotInstances();
  const registry = store.instances as FormStore["instances"];
  for (const k in snap) {
    const value = snap[k];
    if (value !== undefined) registry[k] = value;
  }
  for (const k in registry) if (!(k in snap)) delete registry[k];
}

describe("form controller toStore() instances stability", () => {
  test("the instances record is one stable object, not a per-read getter", () => {
    const controller = new FormController();
    controller.create("f1");
    const store = controller.toStore();
    // RED assertion: two reads must return the very same record.
    expect(store.instances).toBe(store.instances);
  });

  test("a projection written through one read survives the next read", () => {
    const controller = new FormController();
    controller.create("f1", { initialValues: { email: "a@b.c" } });
    controller.createField("f1", "email");
    const store = controller.toStore();
    // RED assertion: pre-fix the getter builds a throwaway object per read,
    // so the filled record is discarded and this stays empty.
    projectInstances(store, controller);
    expect(store.instances.f1).toBeDefined();
    expect(store.instances.f1?.values).toEqual({ email: "a@b.c" });
    expect(store.instances.f1?.fields.email?.touched).toBe(false);
  });

  test("a read method still derives values from the internal instance", () => {
    const controller = new FormController();
    const store = controller.toStore();
    store.create("f1", { initialValues: { email: "a@b.c" } });
    store.createField("f1", "email");
    store.setValue("f1", "email", "x@y.z");
    expect(store.getValue("f1", "email")).toBe("x@y.z");
  });
});

describe("form plugin store projection", () => {
  test("sync fills the store instances record and keeps it stable", () => {
    const { alpine, stores } = createMockAlpine();
    formPlugin()(alpine);
    const store = stores.get("form") as FormStore;
    store.create("f1", { initialValues: { email: "a@b.c" } });
    store.createField("f1", "email");
    const record = store.instances;
    expect(store.instances).toBe(record);
    expect(record.f1).toBeDefined();
    expect(record.f1?.values).toEqual({ email: "a@b.c" });
    store.setValue("f1", "email", "x@y.z");
    expect(store.instances).toBe(record);
    expect(store.instances.f1?.values).toEqual({ email: "x@y.z" });
    expect(store.getValue("f1", "email")).toBe("x@y.z");
  });
});
