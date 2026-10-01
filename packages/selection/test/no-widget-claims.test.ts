/**
 * Selection is a state primitive, not a widget — it must not claim an ARIA role.
 *
 * This is a regression guard, not a style preference. Two failures motivated it:
 *
 * 1. The package shipped `listProps()`, which returned `role: "listbox"`. That is
 *    a widget claim, and the same primitive also backs grids of checkboxes, file
 *    tables and shift-click range selection — none of which is a listbox. It
 *    also put `range` in `aria-multiselectable`, and no ARIA pattern describes
 *    range selection at all.
 *
 * 2. `itemProps()` returned `aria-selected` inside an object meant for
 *    `x-bind="$store.selection.itemProps(id, key)"`. Alpine applies an
 *    object-form `x-bind` exactly once, so the attribute froze at whatever the
 *    selection was during init and never moved again. The demo had to work
 *    around it with a second per-attribute binding.
 *
 * The test asserts the property rather than the two removed methods, so a future
 * `itemProps`-style helper cannot reintroduce either failure under a new name.
 */

import { describe, expect, test } from "vite-plus/test";

import { SelectionController } from "../src/controller";

const ARIA_OR_ROLE = /^(aria-|role$)/;

describe("selection claims no widget role", () => {
  test("no controller method returns an object carrying role or aria-*", () => {
    const controller = new SelectionController("test");
    controller.mount();
    controller.create("s", { mode: "multiple", keys: ["a", "b"], value: ["a"] });

    const offenders: string[] = [];
    for (const key of ["itemProps", "listProps", "props", "itemAttributes"] as const) {
      const fn = (controller as unknown as Record<string, unknown>)[key];
      if (typeof fn !== "function") continue;
      // The receiver travels as an explicit first argument here, so the cast
      // declares three parameters: the method itself plus the `(id, key)` pair
      // it is called with. Reading it as a bare `this` would hide that the
      // call passes the controller at all.
      const result = (fn as (controller: unknown, id: string, k: string) => unknown)(
        controller,
        "s",
        "a"
      );
      if (typeof result !== "object" || result === null) continue;
      for (const attr of Object.keys(result)) {
        if (ARIA_OR_ROLE.test(attr)) offenders.push(`${key}().${attr}`);
      }
    }

    expect(offenders).toEqual([]);
  });

  test("the props helpers are gone from the store surface", async () => {
    const { createMockAlpine } = await import("@ailura/alpinejs-testing/mock");
    const { alpine, stores } = createMockAlpine();
    const { selectionPlugin } = await import("../src/plugin");
    selectionPlugin({ storeKey: "sel", magicKey: "sel" })(alpine);
    const store = stores.get("sel") as Record<string, unknown>;

    expect(store.itemProps).toBeUndefined();
    expect(store.listProps).toBeUndefined();
  });

  test("the predicates a host needs to bind aria themselves are still there", () => {
    const controller = new SelectionController("test");
    controller.mount();
    controller.create("s", { mode: "multiple", keys: ["a", "b"], value: ["a"] });

    // The reason the ARIA helpers were removed without taking the read helpers
    // with them: a host binding `:aria-selected` needs these, not a frozen object.
    expect(controller.isSelected("s", "a")).toBe(true);
    expect(controller.isSelected("s", "b")).toBe(false);
    expect(controller.isSelectable("s", "a")).toBe(true);
    expect(controller.isActive("s", "a")).toBe(false);
  });
});
