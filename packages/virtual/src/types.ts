import type { Alpine } from "alpinejs";

export type VirtualKey = string | number;
export type VirtualScrollAlign = "start" | "center" | "end" | "auto";
export type VirtualScrollBehavior = "auto" | "smooth";
export type VirtualScrollMode = "element" | "window";
export type VirtualScrollDirection = "forward" | "backward" | "none";

export type VirtualItem = {
  readonly key: VirtualKey;
  readonly index: number;
  readonly start: number;
  readonly end: number;
  readonly size: number;
};

export type VirtualOptions = {
  readonly count?: number;
  readonly horizontal?: boolean;
  readonly estimateSize?: number;
  readonly overscan?: number;
  readonly paddingStart?: number;
  readonly paddingEnd?: number;
  readonly gap?: number;
  readonly scrollMode?: VirtualScrollMode;
  readonly getItemKey?: (index: number) => VirtualKey;
};

export type VirtualInstance = {
  readonly count: number;
  readonly scrollOffset: number;
  readonly scrollDirection: VirtualScrollDirection;
  readonly isScrolling: boolean;
  readonly totalSize: number;
  readonly viewportSize: number;
  readonly startIndex: number;
  readonly endIndex: number;
  readonly virtualItems: readonly VirtualItem[];
  readonly options: VirtualOptions;
};

export type VirtualScrollToIndexOptions = {
  readonly align?: VirtualScrollAlign;
  readonly behavior?: VirtualScrollBehavior;
};

export type VirtualStore = {
  readonly instances: Record<string, VirtualInstance>;
  create(id: string, options?: VirtualOptions): void;
  destroy(id: string): void;
  destroyAll(): void;
  bindScrollElement(id: string, element: HTMLElement | null): void;
  setCount(id: string, count: number): void;
  setKeys(id: string, keys: readonly VirtualKey[]): void;
  measureItem(id: string, index: number, size: number): void;
  scrollToIndex(id: string, index: number, options?: VirtualScrollToIndexOptions): void;
  scrollToOffset(
    id: string,
    offset: number,
    options?: Pick<VirtualScrollToIndexOptions, "behavior">
  ): void;
  getVirtualItems(id: string): readonly VirtualItem[];
  getTotalSize(id: string): number;
  listProps(
    id: string,
    options?: { label?: string }
  ): Record<string, string | number | boolean | undefined>;
  itemProps(id: string, index: number): Record<string, string | number | boolean | undefined>;
  contentProps(id: string): Record<string, string | number | undefined>;
};

export interface CreateVirtualOptions {
  readonly id?: string;
  readonly storeKey?: string;
  readonly magicKey?: string;
  /**
   * Alpine directive name, without the `x-` prefix, that binds a scroll
   * container element to an instance from its expression and unbinds it when
   * Alpine removes that element. Defaults to
   * {@link DEFAULT_VIRTUAL_DIRECTIVE_KEY}, i.e. `x-virtual-scroll="rows"`.
   *
   * Add `.create` to also create the instance from the expression's options,
   * which retires the separate `x-init="$store.virtual.create(id, { … })"` every
   * virtualized list otherwise has to open with:
   *
   * ```html
   * <div x-virtual-scroll.create="{ id: 'rows', count: 10000, estimateSize: 32 }">
   * ```
   *
   * The hand-written `$store.virtual.create` / `bindScrollElement` remain
   * available and unchanged.
   */
  readonly directiveKey?: string;
}

export const DEFAULT_VIRTUAL_STORE_KEY = "virtual";
export const DEFAULT_VIRTUAL_MAGIC_KEY = DEFAULT_VIRTUAL_STORE_KEY;
export const DEFAULT_VIRTUAL_DIRECTIVE_KEY = "virtual-scroll";

export type VirtualAlpine = Alpine;
export type VirtualPluginCallback = (alpine: Alpine) => void;

export type VirtualControllerOptions = {
  /** Instance id. Generated when absent. */
  readonly id?: string;
};
