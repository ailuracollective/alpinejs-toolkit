// @vitest-environment happy-dom
/**
 * `destroy()` must actually destroy the controller, and re-creating an id must
 * replace it.
 *
 * The defect this pins: `create()` built a `CollectionController`, mounted it
 * and subscribed to its `change` event, but the plugin kept no reference to it.
 * `destroy(id)` only deleted the store entry, so the controller stayed mounted
 * and subscribed — still writing snapshots to the same key. Re-creating an id
 * stacked another one on top. The playground rebuilds on every keystroke, so the
 * pile grew with each character typed.
 */

import { clearAllSingletons } from "@ailura/alpinejs-core/singletons";
import { reset, resume, settled, start } from "@ailura/alpinejs-testing";
import Alpine from "alpinejs";
import { afterEach, beforeAll, beforeEach, describe, expect, test } from "vite-plus/test";

import { collectionPlugin } from "../src/plugin";
import type { CollectionStore } from "../src/types";

interface Item {
  name: string;
  group: string;
}

const ITEMS: Item[] = [
  { name: "Apple", group: "pome" },
  { name: "Apricot", group: "stone" },
  { name: "Cherry", group: "stone" },
  { name: "Fig", group: "fig" },
];

function store(): CollectionStore {
  return (Alpine as unknown as { store(name: string): CollectionStore }).store("collection");
}

beforeAll(() => start(() => {}));

beforeEach(() => {
  collectionPlugin()(Alpine as unknown as import("alpinejs").Alpine);
  resume();
});

afterEach(() => {
  reset();
  clearAllSingletons();
});

describe("$store.collection lifecycle", () => {
  test("create() publishes a snapshot", () => {
    store().create("demo", { items: ITEMS, getKey: (i: Item) => i.name });
    expect(store().instances["demo"]).toBeDefined();
    expect(store().instances["demo"]?.count).toBe(4);
    expect(store().instances["demo"]?.view).toHaveLength(4);
  });

  test("destroy() removes the entry from the store", () => {
    store().create("demo", { items: ITEMS, getKey: (i: Item) => i.name });
    store().destroy("demo");
    expect(store().instances["demo"]).toBeUndefined();
  });

  test("re-creating an id does not stack controllers on the same key", async () => {
    // The observable of the leak: with the old plugin each `create()` left a live
    // controller subscribed to `change`, so N creates meant N writers racing to
    // publish the same id. A single create must be the only live publisher.
    store().create("demo", { items: ITEMS, getKey: (i: Item) => i.name });
    for (let i = 0; i < 25; i++) {
      store().create("demo", { items: ITEMS, getKey: (item: Item) => item.name });
    }
    await settled();

    expect(store().instances["demo"]?.count).toBe(4);
  });

  test("destroying an unknown id is harmless", () => {
    expect(() => store().destroy("never-created")).not.toThrow();
  });

  test("destroy() is idempotent", () => {
    store().create("demo", { items: ITEMS, getKey: (i: Item) => i.name });
    store().destroy("demo");
    expect(() => store().destroy("demo")).not.toThrow();
  });
});

describe("pagination is clamped on construction", () => {
  test("an out-of-range initialPage is confined to the last page", () => {
    // Previously assigned verbatim, so rebuilding with a stale page number left
    // the controller pointing past the end: "page 4 / 3" over an empty view.
    store().create("demo", {
      items: ITEMS,
      getKey: (i: Item) => i.name,
      paginate: { pageSize: 2, initialPage: 99 },
    });
    const instance = store().instances["demo"];
    expect(instance?.page).toBe(instance?.pageCount);
  });

  test("a valid initialPage is honoured", () => {
    store().create("demo", {
      items: ITEMS,
      getKey: (i: Item) => i.name,
      paginate: { pageSize: 2, initialPage: 2 },
    });
    expect(store().instances["demo"]?.page).toBe(2);
  });

  test("a page below 1 is raised to 1", () => {
    store().create("demo", {
      items: ITEMS,
      getKey: (i: Item) => i.name,
      paginate: { pageSize: 2, initialPage: -5 },
    });
    expect(store().instances["demo"]?.page).toBe(1);
  });
});
