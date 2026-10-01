import type { VirtualItem, VirtualScrollDirection } from "./types";

export type VirtualChangeDetail = { readonly id: string };
export type VirtualRangeChangeDetail = {
  readonly id: string;
  readonly startIndex: number;
  readonly endIndex: number;
  readonly virtualItems: readonly VirtualItem[];
};
export type VirtualScrollDetail = {
  readonly id: string;
  readonly scrollOffset: number;
  readonly scrollDirection: VirtualScrollDirection;
  readonly isScrolling: boolean;
};

export interface VirtualEvents extends Record<string, unknown[]> {
  change: [VirtualChangeDetail];
  rangeChange: [VirtualRangeChangeDetail];
  scroll: [VirtualScrollDetail];
}
