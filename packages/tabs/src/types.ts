/**
 * Type-only module: it imports nothing at runtime, so a consumer can reach for
 * `TabsStore` or `TabsOptions` without pulling in the controller.
 */

import type { Alpine } from "alpinejs";

export type TabsOrientation = "horizontal" | "vertical";

export type TabItem = {
  id: string;
  disabled: boolean;
};

export type TabsOptions = {
  readonly orientation?: TabsOrientation;
  readonly defaultTab?: string;
  readonly onChange?: (tabId: string) => void;
};

/** One tab list's state as the store exposes it. */
export type TabsInstance = {
  activeTabId: string | null;
  orientation: TabsOrientation;
  items: TabItem[];
  onChange?: (tabId: string) => void;
};

export type TabsChangeSource = "user" | "initialization";

export interface TabsChangeDetail {
  readonly instanceId: string;
  readonly activeTabId: string | null;
  readonly source: TabsChangeSource;
}

/**
 * The Alpine-facing surface, i.e. everything reachable as `$store.tabs.*` (or
 * `$tabs.*`, the magic returns the same object).
 *
 * Every method is safe on a tab list that was never `create()`d: the reads
 * return `null`/`false`, the writes no-op.
 */
export interface TabsStore {
  readonly instances: Record<string, TabsInstance>;
  /** Create a tab list. Re-creating an id replaces it. */
  create(groupId: string, options?: TabsOptions): void;
  /**
   * Destroy ONE tab list, or the whole controller with no argument.
   *
   * Both arities through one key so `destroy(id)` cannot be confused with
   * `destroy()`.
   */
  destroy(groupId: string): void;
  destroy(): void;
  /** Destroy every tab list. */
  destroyAll(): void;
  createItem(groupId: string, tabId: string, disabled?: boolean): void;
  destroyItem(groupId: string, tabId: string): void;
  /** No-ops on an unknown tab list, an unknown tab or a disabled one. */
  select(groupId: string, tabId: string): void;
  active(groupId: string): string | null;
  isActive(groupId: string, tabId: string): boolean;
  next(groupId: string): void;
  previous(groupId: string): void;
  handleKeydown(groupId: string, event: KeyboardEvent): void;
  /**
   * `role="tab"`, the tab `id`, `aria-selected`, `aria-controls` and the roving
   * `tabindex`. Alpine applies an object-form `x-bind` exactly once, so
   * `aria-selected` and `tabindex` in here freeze at their initial value — bind
   * those two per attribute.
   */
  tabProps(groupId: string, tabId: string): Record<string, string | number | boolean | undefined>;
  /**
   * `role="tabpanel"`, the panel `id`, `aria-labelledby` and `hidden`. `hidden`
   * changes with selection, so it too needs its own binding.
   */
  panelProps(groupId: string, tabId: string): Record<string, string | boolean | undefined>;
  /** `role="tablist"` and `aria-orientation` — both fixed for the element's life, so safe in one `x-bind`. */
  tablistProps(groupId: string): Record<string, string | undefined>;
}

/**
 * Options for `createTabsController` and `createTabsStore`.
 *
 * `id` lives here rather than in a positional first argument, so both factories
 * take the same shape and `createTabsStore({ id })` is readable.
 */
export type TabsControllerOptions = {
  /** Controller id. Generated when absent. */
  readonly id?: string;
};

export interface CreateTabsOptions extends TabsControllerOptions {
  /** `$store` key — default {@link DEFAULT_TABS_STORE_KEY} (`"tabs"`). */
  readonly storeKey?: string;
  /**
   * `$tabs` magic key — default {@link DEFAULT_TABS_MAGIC_KEY} (`"tabs"`).
   *
   * Renaming `storeKey` renames this too, so `storeKey` alone is enough to move
   * the plugin out of a collided name. There is no way to register the store
   * without the magic: `resolvePluginKeys` treats any non-`undefined` value as
   * a name, and the plugin's own `if (magicKey)` guard is therefore always
   * true.
   */
  readonly magicKey?: string;
}

export const DEFAULT_TABS_STORE_KEY = "tabs";

export const DEFAULT_TABS_MAGIC_KEY = "tabs";

export type TabsAlpine = Alpine;

export type TabsPluginCallback = (alpine: Alpine) => void;
