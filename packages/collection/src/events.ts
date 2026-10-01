import type { CollectionKey } from "./types";

export type CollectionChangeReason =
  | "items"
  | "filter"
  | "sort"
  | "group"
  | "paginate"
  | "active"
  | "reset";

export interface CollectionChangeDetail<_T = unknown, K extends CollectionKey = string> {
  readonly id: string;
  readonly reason: CollectionChangeReason;
  readonly keys: readonly K[];
  readonly viewCount: number;
}

export interface CollectionViewDetail<T, K extends CollectionKey> {
  readonly items: readonly T[];
  readonly keys: readonly K[];
}

export interface CollectionEvents<T = unknown, K extends CollectionKey = string> extends Record<
  string,
  unknown[]
> {
  change: [detail: CollectionChangeDetail<T, K>];
}
