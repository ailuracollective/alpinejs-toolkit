import type { Alpine } from "alpinejs";

import type { SelectionChangeDetail } from "./events";

/** Stable identity for a selectable item. */
export type SelectionKey = string | number;

/** Selection behavior mode. */
export type SelectionMode = "single" | "multiple" | "range";

/** Range selection endpoints. */
export type SelectionRange = {
  readonly from: SelectionKey;
  readonly to?: SelectionKey;
};

/** Mode-specific selection value. */
export type SelectionValue = SelectionKey | null | readonly SelectionKey[] | SelectionRange;

/** Semantic command behavior for pointer and keyboard interactions. */
export type SelectionBehavior = "replace" | "toggle" | "extend";

/** Options when issuing a select command. */
export type SelectionSelectOptions = {
  readonly behavior?: SelectionBehavior;
};

/** Options passed when creating a selection instance. */
export type SelectionOptions = {
  readonly mode?: SelectionMode;
  readonly keys?: readonly SelectionKey[];
  readonly disabledKeys?: readonly SelectionKey[];
  readonly allowDisabledSelection?: boolean;
  readonly value?: SelectionValue;
  readonly defaultValue?: SelectionValue;
  readonly onChange?: (detail: SelectionChangeDetail) => void;
};

/**
 * The `x-selection` directive's expression.
 *
 * Either a bare id, or the {@link SelectionOptions} bag plus an optional `id`.
 * `id` is part of the directive's contract rather than the controller's, so it
 * is declared here instead of widening {@link SelectionOptions} for everyone.
 */
export type SelectionDirectiveOptions = SelectionOptions & {
  readonly id?: string;
};

/** Readonly snapshot of one selection instance. */
export type SelectionInstance = {
  readonly mode: SelectionMode;
  readonly value: SelectionValue;
  readonly keys: readonly SelectionKey[];
  readonly disabledKeys: readonly SelectionKey[];
  readonly anchorKey: SelectionKey | null;
  readonly activeKey: SelectionKey | null;
  readonly selectedKeys: readonly SelectionKey[];
  readonly allowDisabledSelection: boolean;
};

/** Alpine-facing store surface. */
export type SelectionStore = {
  readonly instances: Record<string, SelectionInstance>;
  create(id: string, options?: SelectionOptions): void;
  destroy(id: string): void;
  destroyAll(): void;
  setKeys(id: string, keys: readonly SelectionKey[]): void;
  setDisabledKeys(id: string, keys: readonly SelectionKey[]): void;
  setMode(id: string, mode: SelectionMode): void;
  setValue(id: string, value: SelectionValue): void;
  select(id: string, key: SelectionKey, options?: SelectionSelectOptions): void;
  replace(id: string, key: SelectionKey): void;
  toggle(id: string, key: SelectionKey): void;
  extend(id: string, key: SelectionKey): void;
  clear(id: string): void;
  selectAll(id: string): void;
  setActive(id: string, key: SelectionKey | null): void;
  setAnchor(id: string, key: SelectionKey | null): void;
  isSelected(id: string, key: SelectionKey): boolean;
  isSelectable(id: string, key: SelectionKey): boolean;
  isActive(id: string, key: SelectionKey): boolean;
  isAnchor(id: string, key: SelectionKey): boolean;
  getSnapshot(id: string): SelectionInstance;
};

/** Options accepted by the selection plugin factory. */
export interface CreateSelectionOptions {
  readonly id?: string;
  readonly storeKey?: string;
  readonly magicKey?: string;
  /**
   * Alpine directive name, without the `x-` prefix, that creates a selection
   * instance when its element initializes and destroys it when Alpine removes
   * that element. Defaults to {@link DEFAULT_SELECTION_DIRECTIVE_KEY}.
   *
   * The expression is either an explicit id (`x-selection="files"`) or a
   * {@link SelectionDirectiveOptions} bag. Without an `id`, one is generated and
   * written to `data-selection-id` on the element, so sibling expressions can
   * reach it as `$store.selection.isSelected($el.dataset.selectionId, key)`.
   *
   * The hand-written `$store.selection.create(id, …)` remains available and
   * unchanged.
   */
  readonly directiveKey?: string;
}

/** Default `$store.selection` key registered by {@link selectionPlugin}. */
export const DEFAULT_SELECTION_STORE_KEY = "selection";
export const DEFAULT_SELECTION_MAGIC_KEY = DEFAULT_SELECTION_STORE_KEY;

/** Default `x-selection` directive key registered by {@link selectionPlugin}. */
export const DEFAULT_SELECTION_DIRECTIVE_KEY = "selection";

/** Typed view of `Alpine` the selection plugin uses internally. */
export type SelectionAlpine = Alpine;

/** `Alpine.plugin()` callback signature. */
export type SelectionPluginCallback = (alpine: Alpine) => void;

export type SelectionControllerOptions = {
  /** Instance id. Generated when absent. */
  readonly id?: string;
};
