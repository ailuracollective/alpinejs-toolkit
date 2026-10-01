import type { Alpine } from "alpinejs";

export type CollectionKey = string | number;

export type CollectionKeyFn<T, K extends CollectionKey> = (item: T) => K;

export type CollectionPredicate<T> = (item: T) => boolean;

export type CollectionCompareFn<T> = (a: T, b: T) => number;

export type CollectionMatchFn<T> = (item: T, query: string) => boolean;

export type CollectionGroupKey = string | number | null;

export type CollectionGroupKeyFn<T> = (item: T) => CollectionGroupKey;

export type CollectionSortDirection = "asc" | "desc";

export interface CollectionSortOptions<T> {
  readonly compare: CollectionCompareFn<T>;
  readonly direction?: CollectionSortDirection;
}

export interface CollectionFilterOptions<T> {
  readonly match: CollectionMatchFn<T>;
  readonly initial?: string;
  readonly enabled?: boolean;
}

export interface CollectionGroupOptions<T> {
  readonly by: CollectionGroupKeyFn<T>;
  readonly initialKey?: CollectionGroupKey;
  readonly enabled?: boolean;
}

export interface CollectionPaginateOptions {
  readonly pageSize: number;
  readonly initialPage?: number;
}

export interface CollectionOptions<T, K extends CollectionKey = string> {
  readonly items?: readonly T[];
  readonly getKey?: CollectionKeyFn<T, K>;
  readonly initialKey?: K | null;
  readonly isDisabled?: CollectionPredicate<T>;
  readonly isHidden?: CollectionPredicate<T>;
  readonly filter?: CollectionFilterOptions<T>;
  readonly sort?: CollectionSortOptions<T>;
  readonly group?: CollectionGroupOptions<T>;
  readonly paginate?: CollectionPaginateOptions;
  readonly wrap?: boolean;
  readonly id?: string;
  readonly storeKey?: string;
  readonly magicKey?: string;
}

export interface CollectionViewItem<T, K extends CollectionKey = string> {
  readonly item: T;
  readonly key: K;
  readonly index: number;
  readonly disabled: boolean;
  readonly hidden: boolean;
}

export interface CollectionGroup<T, K extends CollectionKey = string> {
  readonly key: CollectionGroupKey;
  readonly label: string;
  readonly items: readonly CollectionViewItem<T, K>[];
  readonly count: number;
}

export interface CollectionInstance<T, K extends CollectionKey = string> {
  readonly keys: readonly K[];
  readonly count: number;
  readonly source: readonly T[];
  readonly view: readonly CollectionViewItem<T, K>[];
  readonly groups: readonly CollectionGroup<T, K>[];
  readonly page: number;
  readonly pageCount: number;
  readonly activeKey: K | null;
  readonly query: string;
}

export interface CollectionStore<T = unknown, K extends CollectionKey = string> {
  readonly instances: Record<string, CollectionInstance<T, K>>;
  create<TItem>(id: string, options?: CollectionOptions<TItem, K>): void;
  /**
   * Destroy ONE collection, or the whole store with no argument.
   *
   * Both arities through one key so `destroy(id)` cannot be confused with
   * `destroy()`.
   */
  destroy(id: string): void;
  destroy(): void;
  /** Destroy every collection. */
  destroyAll(): void;
  /**
   * Set the text query of an instance, keeping its filter function.
   *
   * Exposed because the alternative is re-creating the whole collection on
   * every keystroke: `create()` is the only method the store had, so a caller
   * whose query changed had to rebuild filtering, sorting, grouping and paging
   * from scratch to change one string.
   */
  setQuery(id: string, query: string): void;
  /**
   * Set the sort of an instance, keeping its filter and paging.
   *
   * @param compare - The comparator, or `null` to clear sorting.
   */
  setSort(id: string, compare: CollectionCompareFn<T> | null, direction?: "asc" | "desc"): void;
  /** Set the current page of an instance. Clamped to `[1, pageCount]`. */
  setPage(id: string, page: number): void;
  /** Move to the next page, if there is one. */
  nextPage(id: string): void;
  /** Move to the previous page, if there is one. */
  prevPage(id: string): void;
  /** Set the active (highlighted) key. */
  setActiveKey(id: string, key: K | null): void;
  /** Replace an instance's items, keeping its filter, sort and paging. */
  setItems(id: string, items: readonly T[]): void;
}

export const DEFAULT_COLLECTION_STORE_KEY = "collection";
export const DEFAULT_COLLECTION_MAGIC_KEY = DEFAULT_COLLECTION_STORE_KEY;

export type CollectionAlpine = Alpine;
export type CollectionPluginCallback = (alpine: Alpine) => void;

export interface CollectionItem<T = unknown, K extends CollectionKey = string> {
  readonly key: K;
  readonly value: T;
  readonly disabled?: boolean;
  readonly hidden?: boolean;
}

export interface CollectionManager<T = unknown, K extends CollectionKey = string> {
  readonly items: readonly CollectionItem<T, K>[];
  register(item: CollectionItem<T, K>): void;
  unregister(key: K): void;
  filter(predicate: CollectionPredicate<T>): void;
  sort(compare: CollectionCompareFn<T>): void;
  paginate(page: number): void;
}

export interface CollectionSelectionLike<K extends CollectionKey = string> {
  readonly selectedKeys: ReadonlyArray<K>;
}
