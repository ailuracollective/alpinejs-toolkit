/**
 * Store-vs-controller semantics for the three predicates the plugin
 * re-implements against the reactive projection: isSelected, isActive, isAnchor.
 */

import { createMockAlpine } from "@ailura/alpinejs-testing/mock";
import { describe, expect, test } from "vite-plus/test";

import { SelectionController } from "../src/controller";
import { selectionPlugin } from "../src/plugin";
import type { SelectionKey, SelectionStore } from "../src/types";

/**
 * Register the plugin on a fresh mock Alpine and return both the reactive
 * store and a controller driven with the same state, so the two public
 * answers to the same question can be compared.
 */
function setup(options: { mode: "single" | "multiple" | "range"; keys: readonly SelectionKey[] }) {
  const { alpine, stores } = createMockAlpine();
  const storeKey = `selection${Math.random().toString(36).slice(2, 8)}`;
  selectionPlugin({ storeKey, magicKey: storeKey })(alpine);
  const store = stores.get(storeKey) as SelectionStore;

  const controller = new SelectionController(storeKey);
  controller.mount();

  const id = "s";
  store.create(id, options);
  controller.create(id, options);

  return { store, controller, id, alpine, storeKey };
}

describe("selection store predicates match the controller", () => {
  // 1 + 2 — isActive: numeric key is the RED-first assertion, the string form
  // is the regression guard for the form that already worked.
  test("isActive agrees for numeric and string keys", () => {
    const { store, controller, id } = setup({ mode: "single", keys: [1, 2, 3] });

    store.setActive(id, 2);
    controller.setActive(id, 2);

    expect(store.isActive(id, 2)).toBe(true);
    expect(controller.isActive(id, 2)).toBe(true);
    expect(store.isActive(id, "2")).toBe(true);
    expect(controller.isActive(id, "2")).toBe(true);
    expect(store.isActive(id, 3)).toBe(false);
  });

  // 3 — isSelected: numeric true, string true, genuinely unselected false.
  test("isSelected agrees for numeric, string, and unselected keys", () => {
    const { store, controller, id } = setup({ mode: "single", keys: [1, 2, 3] });

    store.select(id, 2);
    controller.select(id, 2);

    expect(store.isSelected(id, 2)).toBe(true);
    expect(controller.isSelected(id, 2)).toBe(true);
    expect(store.isSelected(id, "2")).toBe(true);
    expect(controller.isSelected(id, "2")).toBe(true);
    expect(store.isSelected(id, 3)).toBe(false);
    expect(controller.isSelected(id, 3)).toBe(false);
  });

  // 4 — isAnchor.
  test("isAnchor agrees for numeric, string, and unrelated keys", () => {
    const { store, controller, id } = setup({ mode: "single", keys: [1, 2, 3] });

    store.setAnchor(id, 2);
    controller.setAnchor(id, 2);

    expect(store.isAnchor(id, 2)).toBe(true);
    expect(controller.isAnchor(id, 2)).toBe(true);
    expect(store.isAnchor(id, "2")).toBe(true);
    expect(controller.isAnchor(id, "2")).toBe(true);
    expect(store.isAnchor(id, 1)).toBe(false);
    expect(controller.isAnchor(id, 1)).toBe(false);
  });

  // 5 — the property that must hold forever, not just for numbers.
  test("store and controller never disagree across key types", () => {
    const { store, controller, id } = setup({ mode: "single", keys: [1, 2, 3] });

    store.select(id, 2);
    controller.select(id, 2);

    const matrix = [1, "1", true, false, 99, "absent"] as unknown as SelectionKey[];

    for (const key of matrix) {
      expect(store.isSelected(id, key)).toBe(controller.isSelected(id, key));
      expect(store.isActive(id, key)).toBe(controller.isActive(id, key));
      expect(store.isAnchor(id, key)).toBe(controller.isAnchor(id, key));
    }
  });

  // 6 — the overrides exist to read `this.instances`; the projection must stay
  // the answer source after a controller change.
  test("predicates answer from the projected record after a controller change", () => {
    const { store, controller, id, alpine, storeKey } = setup({ mode: "single", keys: [1, 2, 3] });

    expect(store.instances[id].activeKey).toBeNull();

    const before = store.instances[id];
    store.setActive(id, 2);
    controller.setActive(id, 2);

    // Registry entry replaced by a refreshed snapshot.
    expect(store.instances[id]).not.toBe(before);
    expect(store.instances[id].activeKey).toBe("2");
    expect(store.isActive(id, 2)).toBe(true);

    // A second object reading the same id sees the same projected answer.
    const again = (alpine.store as (k: string) => SelectionStore)(storeKey);
    expect(again.instances[id].activeKey).toBe("2");
    expect(again.isActive(id, 2)).toBe(true);
  });
});
