import { BaseController } from "@ailura/alpinejs-core/controller";
import { generateId } from "@ailura/alpinejs-core/ids";

import type { CollectionChangeDetail, CollectionEvents } from "./events";
import type {
  CollectionCompareFn,
  CollectionGroup,
  CollectionGroupKey,
  CollectionInstance,
  CollectionKey,
  CollectionKeyFn,
  CollectionMatchFn,
  CollectionOptions,
  CollectionPredicate,
  CollectionViewItem,
} from "./types";

/**
 * Key derivation when the caller supplies no `getKey`.
 *
 * `id` then `key`, then the item stringified — so a list of primitives works
 * with no options at all. Keys must be unique and stable: they are the identity
 * `activeKey` and `setActiveKey()` speak in, and a duplicated key makes
 * `findIndex` resolve to the first occurrence.
 */
function defaultGetKey<T, K extends CollectionKey>(item: T): K {
  return (
    (item as unknown as { id?: K; key?: K })?.id ??
    (item as unknown as { key?: K })?.key ??
    (String(item) as unknown as K)
  );
}

export class CollectionController<T, K extends CollectionKey = string> extends BaseController<
  CollectionEvents<T, K>
> {
  readonly id: string;
  #source: T[] = [];
  #getKey: CollectionKeyFn<T, K>;
  #isDisabled: CollectionPredicate<T>;
  #isHidden: CollectionPredicate<T>;
  #query = "";
  #match: CollectionMatchFn<T> | null = null;
  #compare: CollectionCompareFn<T> | null = null;
  #groupBy: ((item: T) => CollectionGroupKey) | null = null;
  #pageSize: number | null = null;
  #page = 1;
  #activeKey: K | null = null;
  #wrap: boolean;
  #direction: "asc" | "desc" = "asc";

  constructor(options: CollectionOptions<T, K> = {}) {
    super();
    this.id = options.id ?? generateId("collection");
    this.#getKey = options.getKey ?? defaultGetKey;
    this.#isDisabled = options.isDisabled ?? (() => false);
    this.#isHidden = options.isHidden ?? (() => false);
    this.#source = [...(options.items ?? [])];
    this.#activeKey = options.initialKey ?? null;
    this.#wrap = options.wrap ?? true;
    if (options.filter?.match) {
      this.#match = options.filter.match;
      this.#query = options.filter.initial ?? "";
    }
    if (options.sort?.compare) {
      this.#compare = options.sort.compare;
      this.#direction = options.sort.direction ?? "asc";
    }
    if (options.group?.by) {
      this.#groupBy = options.group.by;
    }
    if (options.paginate?.pageSize) {
      this.#pageSize = options.paginate.pageSize;
      // Clamped, like `setPage` is. Assigning `initialPage` verbatim let a stale
      // page survive a rebuild: the playground passes the page it was already on
      // back into `create()`, and a filter or sort that shrinks the list left
      // the controller pointing past the end — "page 4 / 3" over an empty view.
      this.#page = this.clampPage(options.paginate.initialPage ?? 1);
    }
  }

  get source(): readonly T[] {
    return this.#source;
  }

  get keys(): readonly K[] {
    return this.#source.map((item) => this.#getKey(item));
  }

  get query(): string {
    return this.#query;
  }

  get page(): number {
    return this.#page;
  }

  get pageCount(): number {
    if (!this.#pageSize) return 1;
    const total = this.#filteredSorted().length;
    return Math.max(1, Math.ceil(total / this.#pageSize));
  }

  get activeKey(): K | null {
    return this.#activeKey;
  }

  get view(): readonly CollectionViewItem<T, K>[] {
    return this.#paginatedView();
  }

  get groups(): readonly CollectionGroup<T, K>[] {
    const flat = this.#flatView();
    if (!this.#groupBy) return [];
    const map = new Map<CollectionGroupKey, CollectionViewItem<T, K>[]>();
    for (const v of flat) {
      const gk = this.#groupBy(v.item);
      const arr = map.get(gk) ?? [];
      arr.push(v);
      map.set(gk, arr);
    }
    return [...map.entries()].map(([key, items]) => ({
      key,
      label: String(key ?? ""),
      items,
      count: items.length,
    }));
  }

  /**
   * The whole instance in one object — what the plugin writes into
   * `$store.collection.instances[id]` on every `change`.
   *
   * Each field re-derives the pipeline rather than sharing one pass: `keys`,
   * `view`, `groups`, `pageCount` and `count` each walk the filtered-and-sorted
   * list separately. That is five passes per event instead of one, and it is the
   * right trade at this size — the alternative is a cache that has to be
   * invalidated on every mutator, which is where the staleness bugs would live.
   */
  snapshot(): CollectionInstance<T, K> {
    return {
      keys: this.keys as readonly K[],
      count: this.view.length,
      source: this.source,
      view: this.view,
      groups: this.groups,
      page: this.page,
      pageCount: this.pageCount,
      activeKey: this.#activeKey,
      query: this.#query,
    };
  }

  setItems(items: readonly T[]): void {
    if (this.lifecycle === "destroyed") return;
    const prevActive = this.#activeKey;
    this.#source = [...items];
    this.#reconcileActive(prevActive);
    this.#emit("items");
  }

  insert(item: T): void {
    if (this.lifecycle === "destroyed") return;
    this.#source = [...this.#source, item];
    this.#emit("items");
  }

  remove(key: K): void {
    if (this.lifecycle === "destroyed") return;
    this.#source = this.#source.filter((it) => this.#getKey(it) !== key);
    if (this.#activeKey === key) this.#activeKey = null;
    this.#emit("items");
  }

  setQuery(query: string): void {
    if (this.lifecycle === "destroyed") return;
    this.#query = query;
    this.#page = 1;
    this.#emit("filter");
  }

  setFilter(match: CollectionMatchFn<T> | null, query = ""): void {
    if (this.lifecycle === "destroyed") return;
    this.#match = match;
    this.#query = query;
    this.#page = 1;
    this.#emit("filter");
  }

  setSort(compare: CollectionCompareFn<T> | null, direction: "asc" | "desc" = "asc"): void {
    if (this.lifecycle === "destroyed") return;
    this.#compare = compare;
    this.#direction = direction;
    this.#emit("sort");
  }

  /** Confine a `[1, pageCount]`. Both `initialPage` and `setPage` go through it. */
  private clampPage(page: number): number {
    return Math.max(1, Math.min(page, this.pageCount));
  }

  setPage(page: number): void {
    if (this.lifecycle === "destroyed") return;
    this.#page = this.clampPage(page);
    this.#emit("paginate");
  }

  nextPage(): void {
    this.setPage(this.#page + 1);
  }

  prevPage(): void {
    this.setPage(this.#page - 1);
  }

  setActiveKey(key: K | null): void {
    if (this.lifecycle === "destroyed") return;
    this.#activeKey = key;
    this.#emit("active");
  }

  /**
   * Move the active key one row down the **filtered, sorted, unpaginated** list.
   *
   * Walking `#flatView()` rather than `view` is deliberate: arrow-key navigation
   * has to cross a page boundary, otherwise holding ArrowDown stops at the last
   * row on screen while there are still rows on page 2.
   */
  nextActive(): void {
    const view = this.#flatView();
    if (view.length === 0) return;
    const idx = this.#activeKey ? view.findIndex((v) => v.key === this.#activeKey) : -1;
    const next = idx + 1;
    const nextItem = next < view.length ? view[next] : this.#wrap ? view[0] : undefined;
    if (nextItem) this.setActiveKey(nextItem.key);
  }

  prevActive(): void {
    const view = this.#flatView();
    if (view.length === 0) return;
    const idx = this.#activeKey ? view.findIndex((v) => v.key === this.#activeKey) : view.length;
    const prev = idx - 1;
    const prevItem = prev >= 0 ? view[prev] : this.#wrap ? view[view.length - 1] : undefined;
    if (prevItem) this.setActiveKey(prevItem.key);
  }

  /**
   * Whether the active row is also selected, given anything with
   * `selectedKeys` — a `SelectionInstance` from `@ailura/alpinejs-selection`
   * qualifies structurally. Lets a template style the highlighted-and-selected
   * row without importing the selection package.
   *
   * Not on the store: the store's only receiver is the collection itself, and
   * this needs a second object's snapshot.
   */
  isSelected(selection: { readonly selectedKeys: ReadonlyArray<K> } | undefined): boolean {
    if (!selection || this.#activeKey === null) return false;
    return selection.selectedKeys.includes(this.#activeKey);
  }

  #filteredSorted(): T[] {
    let arr = [...this.#source];
    const match = this.#match;
    const query = this.#query;
    // Both halves are opt-in and independent: a `match` with an empty query is
    // a no-op rather than "match everything", so clearing the box restores the
    // full list without touching the filter function.
    if (match && query) {
      arr = arr.filter((item) => match(item, query));
    }
    const compare = this.#compare;
    if (compare) {
      arr = [...arr].sort((a, b) => {
        const r = compare(a, b);
        return this.#direction === "desc" ? -r : r;
      });
    }
    return arr;
  }

  /**
   * Every item that survives the filter and the sort, in that order, each tagged
   * with its post-filter index.
   *
   * This is the pipeline's single middle stage: `view` slices it for pagination,
   * `groups` buckets it whole, and `nextActive`/`prevActive` walk it. The index
   * is the filtered position, not the original one, which is what a rendered
   * row number wants.
   */
  #flatView(): CollectionViewItem<T, K>[] {
    const filtered = this.#filteredSorted();
    return filtered.map((item, index) => ({
      item,
      key: this.#getKey(item),
      index,
      disabled: this.#isDisabled(item),
      hidden: this.#isHidden(item),
    }));
  }

  #paginatedView(): CollectionViewItem<T, K>[] {
    const flat = this.#flatView();
    if (!this.#pageSize) return flat;
    const start = (this.#page - 1) * this.#pageSize;
    return flat.slice(start, start + this.#pageSize);
  }

  #reconcileActive(prev: K | null): void {
    if (
      this.#activeKey !== null &&
      !this.#source.some((it) => this.#getKey(it) === this.#activeKey)
    ) {
      this.#activeKey = prev && this.#source.some((it) => this.#getKey(it) === prev) ? prev : null;
    }
  }

  #emit(reason: CollectionChangeDetail<T, K>["reason"]): void {
    const detail: CollectionChangeDetail<T, K> = {
      id: this.id,
      reason,
      keys: this.keys as readonly K[],
      viewCount: this.view.length,
    };
    this.emit("change", detail);
  }
}

export function createCollectionController<T, K extends CollectionKey = string>(
  options?: CollectionOptions<T, K>
): CollectionController<T, K> {
  const c = new CollectionController<T, K>(options);
  c.mount();
  return c;
}
