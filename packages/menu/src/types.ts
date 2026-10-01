/**
 * Type-only module: it imports nothing at runtime, so a consumer can reach for
 * `MenuStore` or `MenuOptions` without pulling in the controller.
 */

import type { Alpine } from "alpinejs";

export type MenuOrientation = "vertical" | "horizontal";

export type MenuItemState = {
  id: string;
  disabled: boolean;
  parentId: string | null;
};

/** One menu's state, including the two elements the host bound. */
export type MenuInstance = {
  open: boolean;
  activeItemId: string | null;
  orientation: MenuOrientation;
  closeOnSelect: boolean;
  items: MenuItemState[];
  container: HTMLElement | null;
  trigger: HTMLElement | null;
  onOpen?: () => void;
  onClose?: () => void;
  onSelect?: (itemId: string) => void;
};

export type MenuItemOptions = {
  disabled?: boolean;
  parentId?: string | null;
};

export type MenuOptions = {
  orientation?: MenuOrientation;
  closeOnSelect?: boolean;
  onOpen?: () => void;
  onClose?: () => void;
  onSelect?: (itemId: string) => void;
};

/**
 * The Alpine-facing surface, i.e. everything reachable as `$store.menu.*` (or
 * `$menu.*`, the magic returns the same object).
 *
 * Split deliberately: `menuProps`/`itemProps` return the attributes that never
 * change and are safe in one `x-bind`; `menuHidden`/`itemTabIndex`/
 * `itemDisabled` are the ones that change, and each needs its own
 * `x-bind:attr` because Alpine applies object-form `x-bind` exactly once.
 */
export interface MenuStore {
  readonly instances: Record<string, MenuInstance>;
  open(id: string): void;
  close(id: string): void;
  toggle(id: string): void;
  isOpen(id: string): boolean;
  activeItem(id: string): string | null;
  /** Create a menu. Re-creating an id replaces it. */
  create(id: string, options?: MenuOptions): void;
  /**
   * Destroy ONE menu, or the whole controller with no argument.
   *
   * Both arities through one key so `destroy(id)` cannot be confused with
   * `destroy()`.
   */
  destroy(id: string): void;
  destroy(): void;
  /** Destroy every menu. */
  destroyAll(): void;
  createItem(menuId: string, itemId: string, options?: MenuItemOptions): void;
  destroyItem(menuId: string, itemId: string): void;
  /**
   * Record the panel element so `handleOutsideClick()` has something to test the
   * click target against, and so `close()` knows what "focus was inside" means.
   * `null` releases it. The `x-menu` directive does this for you.
   */
  bindMenu(menuId: string, container: HTMLElement | null): void;
  /**
   * Record the trigger element. `close()` returns focus here — and only when
   * focus was actually inside the menu, so an outside-click close does not
   * steal it from wherever the user has since moved it.
   */
  bindTrigger(menuId: string, trigger: HTMLElement | null): void;
  /** Closes unless the click landed on the trigger or inside the panel. */
  handleOutsideClick(menuId: string, event: MouseEvent): void;
  setActiveItem(menuId: string, itemId: string | null): void;
  /** Fires `onSelect` and `select`, then closes unless `closeOnSelect` is off. */
  selectItem(menuId: string, itemId: string): void;
  handleKeydown(menuId: string, event: KeyboardEvent): void;
  /**
   * Fan out to `handleOutsideClick` for every menu, or just the ids given. The
   * `x-menu` panel installs its own `document` listener, so this is only for
   * hand-wired menus.
   */
  handleWindowOutsideClick(event: MouseEvent, menuIds?: readonly string[]): void;
  /**
   * Fan out to `handleKeydown` for every **open** menu, stopping at the first
   * that calls `preventDefault()`. Skipping closed menus is what keeps one
   * menu's `Escape` from closing another that is not on screen.
   */
  handleWindowKeydown(event: KeyboardEvent, menuIds?: readonly string[]): void;
  /** `role="menuitem"` and the item `id`. Nothing that changes — see above. */
  itemProps(menuId: string, itemId: string): Record<string, string>;
  /** `role="menu"`, the menu `id` and `aria-orientation`. Nothing that changes. */
  menuProps(menuId: string): Record<string, string | undefined>;
  /**
   * Roving tabindex for an item, `0` when active and `-1` otherwise.
   *
   * Bound per attribute: an object-form `x-bind` is applied once by Alpine, so
   * anything that changes has to be its own reactive binding.
   */
  itemTabIndex(menuId: string, itemId: string): number;
  /** Whether an item is locked, for `x-bind:aria-disabled`. */
  itemDisabled(menuId: string, itemId: string): boolean;
  /** Whether a menu is hidden from assistive tech, for `x-bind:aria-hidden`. */
  menuHidden(menuId: string): boolean;
}

export interface CreateMenuOptions {
  readonly id?: string;
  /**
   * Controller-wide default — default `true`. When on, `open()` and `toggle()`
   * close every other menu first. Set `exclusive: false` to let several menus be
   * open at once.
   */
  readonly exclusive?: boolean;
  /**
   * Typed `unknown` and currently **inert**: the plugin forwards it to the
   * controller and nothing reads it. It is declared for API stability, not
   * because the package implements scrolling.
   */
  readonly scroll?: unknown;
  /** `$store` key — default {@link DEFAULT_MENU_STORE_KEY} (`"menu"`). */
  readonly storeKey?: string;
  /** `$menu` magic key — default {@link DEFAULT_MENU_MAGIC_KEY} (`"menu"`). */
  readonly magicKey?: string;
  /**
   * Alpine directive name, without the `x-` prefix, that binds its own element
   * to a menu instance and releases the binding when Alpine removes that
   * element. Defaults to {@link DEFAULT_MENU_DIRECTIVE_KEY}.
   *
   * The element's role is a modifier, because Alpine parses the dot into
   * modifiers rather than a separate directive name:
   *
   * ```html
   * <button x-menu.trigger="'row-actions'">Actions</button>
   * <div x-menu="'row-actions'">…</div>
   * <button x-menu.item="'row-actions:rename'">Rename</button>
   * ```
   *
   * `x-menu.item` writes `tabindex` and `aria-disabled` imperatively, which is
   * what makes the roving tabindex live — the store's `itemProps` omits them on
   * purpose because an object-form `x-bind` is applied exactly once.
   *
   * The hand-written `$store.menu.bindMenu` / `bindTrigger` remain available
   * and unchanged.
   */
  readonly directiveKey?: string;
}

export const DEFAULT_MENU_STORE_KEY = "menu";

export const DEFAULT_MENU_DIRECTIVE_KEY = "menu";

export const DEFAULT_MENU_MAGIC_KEY = "menu";

/**
 * Options for the controller itself, as opposed to an instance.
 *
 * Renamed from `MenuControllerConfig`: the old name read as "configure the
 * controller" while describing exactly the opposite — `exclusive` and `scroll`
 * are behaviours every instance inherits.
 */
export type MenuControllerOptions = {
  readonly id?: string;
  readonly exclusive?: boolean;
  readonly scroll?: unknown;
};

export type MenuAlpine = Alpine;

export type MenuPluginCallback = (alpine: Alpine) => void;
