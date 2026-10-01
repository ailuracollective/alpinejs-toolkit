// @vitest-environment happy-dom
/**
 * Store mutators that were on the controller but never on the store.
 *
 * `create()` was the store's only mutator, so changing a query meant rebuilding
 * filtering, sorting, grouping and paging from scratch to change one string.
 * The playground carried a `rebuild()` that every interaction — `apply()`,
 * `sort()`, `setActive()`, `nextPage()`, `prevPage()`, `reset()` — called, and
 * none of that was the package's fault except that the store never surfaced
 * what the controller already had.
 *
 * Two instances are used so filtering and paging can be observed separately:
 * `view` is the *paginated* view, so a filter test on it needs no paging.
 */
import { createMockAlpine } from "@ailura/alpinejs-testing/mock";
import { describe, expect, test } from "vite-plus/test";

import { collectionPlugin } from "../src/plugin";
import type { CollectionStore } from "../src/types";

type Item = { name: string; family: string };

const FRUITS: Item[] = [
  { name: "Apple", family: "pome" },
  { name: "Banana", family: "berry" },
  { name: "Cherry", family: "stone" },
  { name: "Elderberry", family: "berry" },
];

function register(): CollectionStore<Item, string> {
  const { alpine, stores } = createMockAlpine();
  collectionPlugin()(alpine);
  return stores.get("collection") as unknown as CollectionStore<Item, string>;
}

/** An instance with a filter and no paging, for filter/sort assertions. */
function withFilter(store: CollectionStore<Item, string>, id = "fruits"): void {
  store.create<Item>(id, {
    items: FRUITS,
    getKey: (item) => item.name,
    filter: {
      match: (item, query) => item.name.toLowerCase().includes(query.toLowerCase()),
      initial: "",
    },
    sort: { compare: (a, b) => a.name.localeCompare(b.name), direction: "asc" },
  });
}

/** An instance with paging, for page assertions. */
function withPaging(store: CollectionStore<Item, string>, id = "paged"): void {
  store.create<Item>(id, {
    items: FRUITS,
    getKey: (item) => item.name,
    paginate: { pageSize: 2, initialPage: 1 },
  });
}

/** Names currently visible, which is the filtered *and* paginated set. */
function view(store: CollectionStore<Item, string>, id: string): unknown {
  return store.instances[id]?.view?.map((entry) => entry.item.name);
}

describe("collection store mutators", () => {
  test("setQuery filters without rebuilding the instance", () => {
    const store = register();
    withFilter(store);

    store.setQuery("fruits", "err");

    expect(view(store, "fruits")).toEqual(["Cherry", "Elderberry"]);
    expect(store.instances["fruits"]?.query).toBe("err");
  });

  test("setSort reorders without losing the query", () => {
    const store = register();
    withFilter(store);

    store.setQuery("fruits", "e");
    // `direction` negates the comparator's result, so an ascending comparator
    // with `desc` is the descending order — passing a reversed comparator as
    // well would cancel it back out.
    store.setSort("fruits", (a, b) => a.name.localeCompare(b.name), "desc");

    // Filter still applied (only names containing "e"), now descending.
    expect(view(store, "fruits")).toEqual(["Elderberry", "Cherry", "Apple"]);
  });

  test("setSort(null) clears sorting", () => {
    const store = register();
    withFilter(store);
    store.setSort("fruits", (a, b) => a.name.localeCompare(b.name), "desc");
    expect(view(store, "fruits")).toEqual(["Elderberry", "Cherry", "Banana", "Apple"]);

    store.setSort("fruits", null);

    // Back to source order: with no comparator the direction is irrelevant.
    expect(view(store, "fruits")).toEqual(["Apple", "Banana", "Cherry", "Elderberry"]);
  });

  test("setPage and nextPage/prevPage move within range", () => {
    const store = register();
    withPaging(store);

    expect(store.instances["paged"]?.page).toBe(1);
    expect(view(store, "paged")).toEqual(["Apple", "Banana"]);

    store.setPage("paged", 2);
    expect(store.instances["paged"]?.page).toBe(2);
    expect(view(store, "paged")).toEqual(["Cherry", "Elderberry"]);

    // Clamped, not overflowing: already on the last page.
    store.nextPage("paged");
    expect(store.instances["paged"]?.page).toBe(2);

    store.prevPage("paged");
    expect(store.instances["paged"]?.page).toBe(1);
  });

  test("setQuery resets to the first page", () => {
    const store = register();
    withFilter(store);
    withPaging(store, "both");
    store.create<Item>("both", {
      items: FRUITS,
      getKey: (item) => item.name,
      filter: {
        match: (item, query) => item.name.toLowerCase().includes(query.toLowerCase()),
        initial: "",
      },
      paginate: { pageSize: 2, initialPage: 1 },
    });
    store.setPage("both", 2);

    store.setQuery("both", "a");

    // Back to page 1 — otherwise a narrowed query would land the reader on a
    // page that no longer exists.
    expect(store.instances["both"]?.page).toBe(1);
  });

  test("setActiveKey moves the highlight", () => {
    const store = register();
    withFilter(store);

    store.setActiveKey("fruits", "Banana");

    expect(store.instances["fruits"]?.activeKey).toBe("Banana");
  });

  test("setItems replaces the data and keeps the filter", () => {
    const store = register();
    withFilter(store);
    store.setQuery("fruits", "err");

    store.setItems("fruits", [{ name: "Fig", family: "fig" }]);

    // The old query still applies, so the new item is filtered out — proof the
    // filter closure was not rebuilt.
    expect(view(store, "fruits")).toEqual([]);
    store.setQuery("fruits", "");
    expect(view(store, "fruits")).toEqual(["Fig"]);
  });

  test("mutating an unknown id is a no-op, not a throw", () => {
    const store = register();

    expect(() => store.setQuery("nope", "x")).not.toThrow();
    expect(() => store.setPage("nope", 3)).not.toThrow();
    expect(store.instances["nope"]).toBeUndefined();
  });

  test("create still replaces an id, so the store's original contract holds", () => {
    const store = register();
    withFilter(store);

    store.create<Item>("fruits", { items: [{ name: "Kiwi", family: "berry" }] });

    expect(view(store, "fruits")).toEqual(["Kiwi"]);
  });
});
