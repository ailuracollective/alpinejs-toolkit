import type { CollectionStore } from "@ailura/alpinejs-collection";

import type { AlpineInstance } from "../types/alpine.js";

type Fruit = { name: string; family: string; stock: number };

const FRUITS: readonly Fruit[] = [
  { name: "Apple", family: "pome", stock: 12 },
  { name: "Apricot", family: "stone", stock: 4 },
  { name: "Cherry", family: "stone", stock: 30 },
  { name: "Fig", family: "fig", stock: 7 },
  { name: "Kiwi", family: "berry", stock: 18 },
  { name: "Mango", family: "drupe", stock: 15 },
  { name: "Peach", family: "stone", stock: 9 },
  { name: "Plum", family: "stone", stock: 2 },
  { name: "Strawberry", family: "berry", stock: 25 },
];

const INSTANCE_ID = "playground-collection";
const PAGE_SIZE = 4;

const byName = (a: Fruit, b: Fruit): number => a.name.localeCompare(b.name);

type CollectionDemoData = {
  query: string;
  direction: "asc" | "desc";
  grouped: boolean;
  init(): void;
  apply(): void;
  sort(): void;
  toggleGroup(): void;
  setActive(key: string): void;
  nextPage(): void;
  prevPage(): void;
  reset(): void;
};

export function registerCollectionDemo(Alpine: AlpineInstance): void {
  /** The registered store, typed as this demo's own item and key. */
  const collection = (): CollectionStore<Fruit, string> =>
    Alpine.store("collection") as CollectionStore<Fruit, string>;

  Alpine.data("collectionDemo", (): CollectionDemoData => ({
    query: "",
    direction: "asc",
    grouped: false,

    init() {
      // Created ONCE. Every interaction below mutates this live instance
      // through the store's own commands.
      //
      // This used to call `create()` again on every keystroke, because the
      // store's only mutator used to be `create()`. It has ten now — the
      // package exposes `setQuery`, `setSort`, `setPage`, `nextPage`,
      // `prevPage` and `setActiveKey` — so rebuilding was re-specifying
      // filtering, sorting, grouping and paging to change one string, and
      // silently re-creating the controller behind the id each time.
      collection().create<Fruit>(INSTANCE_ID, {
        items: FRUITS,
        getKey: (item) => item.name,
        filter: {
          match: (item, query) => item.name.toLowerCase().includes(query.toLowerCase()),
          initial: "",
        },
        sort: { compare: byName, direction: "asc" },
        group: { by: (item) => item.family },
        paginate: { pageSize: PAGE_SIZE, initialPage: 1 },
        wrap: true,
      });
    },

    apply() {
      // `setQuery` keeps the filter function, the sort, the group and the page
      // size; it resets to page 1 itself, so there is no page to clamp here.
      collection().setQuery(INSTANCE_ID, this.query);
    },

    sort() {
      this.direction = this.direction === "asc" ? "desc" : "asc";
      collection().setSort(INSTANCE_ID, byName, this.direction);
    },

    // Grouping is not a switch on the controller: `group.by` was supplied at
    // `create()`, so `groups` is always computed and always reflects the current
    // filter and sort. This only picks which of the two views the template
    // renders, which is the honest description of what it does.
    toggleGroup() {
      this.grouped = !this.grouped;
    },

    setActive(key: string) {
      collection().setActiveKey(INSTANCE_ID, key);
    },

    nextPage() {
      // The controller confines the page to `[1, pageCount]` itself, so paging
      // past the end lands on the last page instead of showing "page 4 / 3"
      // over an empty view.
      collection().nextPage(INSTANCE_ID);
    },

    prevPage() {
      collection().prevPage(INSTANCE_ID);
    },

    reset() {
      this.query = "";
      this.direction = "asc";
      this.grouped = false;
      const store = collection();
      store.setQuery(INSTANCE_ID, "");
      store.setSort(INSTANCE_ID, byName, "asc");
      store.setActiveKey(INSTANCE_ID, null);
      store.setPage(INSTANCE_ID, 1);
    },
  }));
}
