/** Barrel only — nothing in this file may do anything but re-export. */

export { CollectionController, createCollectionController } from "./controller";
export type { CollectionChangeDetail, CollectionChangeReason, CollectionEvents } from "./events";
export { collectionPlugin, collectionPlugin as default } from "./plugin";
export type {
  CollectionAlpine,
  CollectionCompareFn,
  CollectionFilterOptions,
  CollectionGroup,
  CollectionGroupKey,
  CollectionGroupKeyFn,
  CollectionGroupOptions,
  CollectionInstance,
  CollectionItem,
  CollectionKey,
  CollectionKeyFn,
  CollectionManager,
  CollectionMatchFn,
  CollectionOptions,
  CollectionPaginateOptions,
  CollectionPluginCallback,
  CollectionPredicate,
  CollectionSelectionLike,
  CollectionSortDirection,
  CollectionSortOptions,
  CollectionStore,
  CollectionViewItem,
} from "./types";
export { DEFAULT_COLLECTION_MAGIC_KEY, DEFAULT_COLLECTION_STORE_KEY } from "./types";
