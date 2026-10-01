import { BaseController } from "@ailura/alpinejs-core/controller";
import { generateId } from "@ailura/alpinejs-core/ids";

import type { MenuEvents } from "./events";
import type {
  MenuControllerOptions,
  MenuInstance,
  MenuOptions,
  MenuItemOptions,
  MenuItemState,
  MenuStore,
} from "./types";

function enabledItems(instance: MenuInstance): MenuItemState[] {
  return instance.items.filter((i) => !i.disabled);
}

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * The element to return focus to when a menu closes.
 *
 * `bindTrigger` is often given a WRAPPER around the button — the demo binds the
 * `<div>` that holds it — and a plain `<div>` cannot take focus, so focusing it
 * directly would silently do nothing and leave focus stranded. Prefer the
 * first focusable descendant, falling back to the element itself.
 */
function focusableWithin(root: HTMLElement | null): HTMLElement | null {
  if (!root) return null;
  if (root.matches(FOCUSABLE)) return root;
  return root.querySelector<HTMLElement>(FOCUSABLE);
}

function createInstance(options: MenuOptions = {}): MenuInstance {
  return {
    open: false,
    activeItemId: null,
    orientation: options.orientation ?? "vertical",
    closeOnSelect: options.closeOnSelect ?? true,
    items: [],
    container: null,
    trigger: null,
    onOpen: options.onOpen,
    onClose: options.onClose,
    onSelect: options.onSelect,
  };
}

export class MenuController extends BaseController<MenuEvents> {
  readonly id: string;
  #instances: Record<string, MenuInstance> = {};
  #exclusive: boolean;

  constructor(config: MenuControllerOptions = {}) {
    super();
    this.id = config.id ?? generateId("menu");
    this.#exclusive = config.exclusive ?? true;
  }

  private get frozen(): boolean {
    return this.lifecycle === "destroyed";
  }

  hasInstance(id: string): boolean {
    return id in this.#instances;
  }

  snapshotInstances(): Record<string, MenuInstance> {
    const out: Record<string, MenuInstance> = {};
    for (const k in this.#instances)
      out[k] = { ...this.#instances[k], items: [...this.#instances[k].items] };
    return out;
  }

  /**
   * Create a menu, replacing any existing one with the same id. An open menu
   * being replaced is closed first, so its `onClose` still runs.
   */
  create(id: string, options: MenuOptions = {}): void {
    if (this.frozen) return;
    if (this.isOpen(id)) this.close(id);
    this.#instances[id] = createInstance(options);
    this.emit("change", { menuId: id });
  }

  /**
   * `destroy(menuId)` drops ONE menu; `destroy()` tears down the controller.
   *
   * The overload exists because `BaseController.destroy()` is the controller's
   * own teardown and cannot be renamed. The argument is what separates them.
   */
  override destroy(menuId?: string): void {
    if (this.frozen) return;
    if (menuId === undefined) {
      for (const id of Object.keys(this.#instances)) this.#destroyInstance(id);
      super.destroy();
      return;
    }
    this.#destroyInstance(menuId);
  }

  /** Destroy every menu, leaving the controller itself usable. */
  destroyAll(): void {
    if (this.frozen) return;
    for (const id of Object.keys(this.#instances)) this.#destroyInstance(id);
  }

  #destroyInstance(menuId: string): void {
    if (this.isOpen(menuId)) this.close(menuId);
    delete this.#instances[menuId];
    this.emit("change", { menuId });
  }

  createItem(menuId: string, itemId: string, options: MenuItemOptions = {}): void {
    if (this.frozen) return;
    const instance = (this.#instances[menuId] ??= createInstance());
    const existing = instance.items.find((i) => i.id === itemId);
    if (existing) {
      existing.disabled = options.disabled ?? existing.disabled;
      existing.parentId = options.parentId ?? existing.parentId;
      this.emit("change", { menuId });
      return;
    }
    instance.items.push({
      id: itemId,
      disabled: options.disabled ?? false,
      parentId: options.parentId ?? null,
    });
    this.emit("change", { menuId });
  }

  destroyItem(menuId: string, itemId: string): void {
    if (this.frozen) return;
    const instance = this.#instances[menuId];
    if (!instance) return;
    instance.items = instance.items.filter((i) => i.id !== itemId);
    if (instance.activeItemId === itemId)
      instance.activeItemId = enabledItems(instance)[0]?.id ?? null;
    this.emit("change", { menuId });
  }

  /**
   * Open a menu, creating the instance if none exists.
   *
   * With `exclusive` on (the default) every other open menu is closed first, so
   * a page of dropdowns can never have two of them down at once. The first
   * enabled item becomes the active one, which is what gives the roving tabindex
   * a `0` to sit on the moment the menu appears.
   */
  open(id: string): void {
    if (this.frozen) return;
    const instance = (this.#instances[id] ??= createInstance());
    if (instance.open) return;
    if (this.#exclusive) {
      for (const k in this.#instances) {
        if (k !== id && this.#instances[k].open) this.close(k);
      }
    }
    instance.open = true;
    if (!instance.activeItemId) instance.activeItemId = enabledItems(instance)[0]?.id ?? null;
    instance.onOpen?.();
    this.emit("open", { menuId: id });
    this.emit("change", { menuId: id });
  }

  close(id: string, options: { restoreFocus?: boolean } = {}): void {
    if (this.frozen) return;
    const instance = this.#instances[id];
    if (!instance?.open) return;
    instance.open = false;

    // A closed menu is hidden from assistive tech, so focus must not be left
    // inside it. The browser blocks `aria-hidden` on a subtree that still holds
    // focus and warns that the focus is stranded; worse, the item stays the
    // active element of a `display: none` menu, so the next Tab continues from
    // a node the user cannot see. Returning focus to the trigger is what the
    // WAI-ARIA menu button pattern requires anyway.
    //
    // Only when focus is actually inside: a menu closed by an outside click has
    // focus somewhere else, and stealing it there would be a regression.
    const active = typeof document !== "undefined" ? document.activeElement : null;
    const focusWasInside =
      options.restoreFocus !== false &&
      active instanceof Node &&
      (instance.container?.contains(active) ?? false);
    if (focusWasInside) {
      const trigger = instance.trigger;
      const target = focusableWithin(trigger);
      if (target) target.focus();
    }

    instance.onClose?.();
    this.emit("close", { menuId: id });
    this.emit("change", { menuId: id });
  }

  toggle(id: string): void {
    if (this.isOpen(id)) this.close(id);
    else this.open(id);
  }

  isOpen(id: string): boolean {
    return this.#instances[id]?.open ?? false;
  }

  activeItem(id: string): string | null {
    return this.#instances[id]?.activeItemId ?? null;
  }

  setActiveItem(menuId: string, itemId: string | null): void {
    if (this.frozen) return;
    const instance = (this.#instances[menuId] ??= createInstance());
    if (itemId === null) {
      instance.activeItemId = null;
      this.emit("change", { menuId });
      return;
    }
    const item = instance.items.find((i) => i.id === itemId);
    if (item && !item.disabled) {
      instance.activeItemId = itemId;
      this.emit("change", { menuId });
    }
  }

  bindMenu(menuId: string, container: HTMLElement | null): void {
    if (this.frozen) return;
    const instance = (this.#instances[menuId] ??= createInstance());
    instance.container = container;
    this.emit("change", { menuId });
  }

  bindTrigger(menuId: string, trigger: HTMLElement | null): void {
    if (this.frozen) return;
    const instance = (this.#instances[menuId] ??= createInstance());
    instance.trigger = trigger;
    this.emit("change", { menuId });
  }

  handleOutsideClick(menuId: string, event: MouseEvent): void {
    const instance = this.#instances[menuId];
    if (!instance?.open) return;
    const target = event.target;
    if (!(target instanceof Node)) return;
    if (instance.trigger?.contains(target) || instance.container?.contains(target)) return;
    this.close(menuId);
  }

  handleWindowOutsideClick(event: MouseEvent, menuIds?: readonly string[]): void {
    const ids = menuIds ?? Object.keys(this.#instances);
    for (const id of ids) this.handleOutsideClick(id, event);
  }

  handleWindowKeydown(event: KeyboardEvent, menuIds?: readonly string[]): void {
    const ids = menuIds ?? Object.keys(this.#instances);
    for (const id of ids) {
      if (this.isOpen(id)) {
        this.handleKeydown(id, event);
        if (event.defaultPrevented) break;
      }
    }
  }

  /**
   * Select an item. No-op for an unknown menu, an unknown item or a disabled
   * one.
   *
   * The `change` emit in the `else` branch is the only place `select` does not
   * close: with `closeOnSelect: false` the menu stays open and the caller still
   * has to be told something moved.
   */
  selectItem(menuId: string, itemId: string): void {
    if (this.frozen) return;
    const instance = this.#instances[menuId];
    const item = instance?.items.find((i) => i.id === itemId);
    if (!(instance && item) || item.disabled) return;
    instance.activeItemId = itemId;
    instance.onSelect?.(itemId);
    this.emit("select", { menuId, itemId });
    if (instance.closeOnSelect) this.close(menuId);
    else this.emit("change", { menuId });
  }

  /**
   * Menu-keyboard support, gated on the menu's own `orientation`:
   * `ArrowDown`/`ArrowUp` on a vertical menu, `ArrowRight`/`ArrowLeft` on a
   * horizontal one, and `Home`/`End`/`Enter`/`Space`/`Escape` in both. The
   * mismatched pair is left to the page. Movement wraps and skips disabled
   * items.
   *
   * Moves `activeItemId` and never calls `focus()` — the roving `tabindex` is
   * what moves real focus, and only if the browser is already inside the menu.
   */
  handleKeydown(menuId: string, event: KeyboardEvent): void {
    if (this.frozen) return;
    const instance = this.#instances[menuId];
    if (!instance?.open) return;
    const vertical = instance.orientation === "vertical";
    const horizontal = instance.orientation === "horizontal";
    const move = (delta: number): void => {
      const items = enabledItems(instance);
      if (items.length === 0) return;
      const idx = instance.activeItemId
        ? items.findIndex((i) => i.id === instance.activeItemId)
        : -1;
      const next = items[(idx + delta + items.length) % items.length];
      if (next) instance.activeItemId = next.id;
    };
    switch (event.key) {
      case "ArrowDown":
        if (!vertical) break;
        event.preventDefault();
        move(1);
        this.emit("change", { menuId });
        break;
      case "ArrowUp":
        if (!vertical) break;
        event.preventDefault();
        move(-1);
        this.emit("change", { menuId });
        break;
      case "ArrowRight":
        if (!horizontal) break;
        event.preventDefault();
        move(1);
        this.emit("change", { menuId });
        break;
      case "ArrowLeft":
        if (!horizontal) break;
        event.preventDefault();
        move(-1);
        this.emit("change", { menuId });
        break;
      case "Home":
        event.preventDefault();
        instance.activeItemId = enabledItems(instance)[0]?.id ?? null;
        this.emit("change", { menuId });
        break;
      case "End": {
        event.preventDefault();
        const items = enabledItems(instance);
        instance.activeItemId = items[items.length - 1]?.id ?? null;
        this.emit("change", { menuId });
        break;
      }
      case "Enter":
      case " ":
        if (instance.activeItemId) {
          event.preventDefault();
          this.selectItem(menuId, instance.activeItemId);
        }
        break;
      case "Escape":
        event.preventDefault();
        this.close(menuId);
        break;
      default:
        break;
    }
  }

  /**
   * Static attributes of a menu item.
   *
   * `tabindex` and `aria-disabled` are omitted for the same reason
   * `aria-hidden` is omitted from {@link menuProps}: an object-form `x-bind` is
   * applied once, so a roving tabindex in here never moved and every item stayed
   * at `tabindex="-1"` — the menu could not be reached by keyboard at all. Use
   * {@link itemTabIndex} and {@link itemDisabled} per attribute.
   */
  itemProps(menuId: string, itemId: string): Record<string, string> {
    return {
      role: "menuitem",
      id: `${menuId}-item-${itemId}`,
    };
  }

  /**
   * The roving tabindex for an item: `0` for the active one, `-1` for the rest.
   *
   * Bind per attribute — `x-bind:tabindex="$store.menu.itemTabIndex(id, item)"`.
   */
  itemTabIndex(menuId: string, itemId: string): number {
    return this.#instances[menuId]?.activeItemId === itemId ? 0 : -1;
  }

  /** Whether an item is locked. Bind as `x-bind:aria-disabled`. */
  itemDisabled(menuId: string, itemId: string): boolean {
    return this.#instances[menuId]?.items.find((i) => i.id === itemId)?.disabled ?? false;
  }

  /**
   * Static attributes of the menu element.
   *
   * Every value here is fixed for the life of the element, which is what makes
   * this safe to spread with `x-bind`. The one attribute that CHANGES —
   * `aria-hidden` — is deliberately absent: Alpine applies an object-form
   * `x-bind` a single time, so an `aria-hidden` in this object was frozen at
   * whatever the state was during init and never updated again. Use
   * {@link menuHidden} with `x-bind:aria-hidden` for that.
   */
  menuProps(menuId: string): Record<string, string | undefined> {
    const instance = this.#instances[menuId];
    return {
      role: "menu",
      id: `${menuId}`,
      "aria-orientation": instance?.orientation ?? "vertical",
    };
  }

  /**
   * Whether the menu is hidden from assistive technology.
   *
   * Bind per attribute — `x-bind:aria-hidden="$store.menu.menuHidden(id)"` —
   * which re-evaluates. An unregistered menu counts as hidden.
   */
  menuHidden(menuId: string): boolean {
    return !(this.#instances[menuId]?.open ?? false);
  }

  toStore(): MenuStore {
    return {
      // A fresh record, never the private registry: the plugin's sync writes
      // plain snapshots here, so aliasing the private map would destroy the
      // controller's internal instance state.
      instances: {} as MenuStore["instances"],
      open: (id) => this.open(id),
      close: (id) => this.close(id),
      toggle: (id) => this.toggle(id),
      isOpen: (id) => this.isOpen(id),
      activeItem: (id) => this.activeItem(id),
      create: (id, opts) => this.create(id, opts),
      // One key, both arities, argument forwarded: `destroy: () =>
      // this.destroy()` would make `store.destroy("nav")` tear the controller
      // down instead of one menu.
      destroy: (id?: string) => this.destroy(id),
      destroyAll: () => this.destroyAll(),
      createItem: (id, itemId, opts) => this.createItem(id, itemId, opts),
      destroyItem: (id, itemId) => this.destroyItem(id, itemId),
      bindMenu: (id, c) => this.bindMenu(id, c),
      bindTrigger: (id, t) => this.bindTrigger(id, t),
      handleOutsideClick: (id, e) => this.handleOutsideClick(id, e),
      setActiveItem: (id, itemId) => this.setActiveItem(id, itemId),
      selectItem: (id, itemId) => this.selectItem(id, itemId),
      handleKeydown: (id, e) => this.handleKeydown(id, e),
      handleWindowOutsideClick: (e, ids) => this.handleWindowOutsideClick(e, ids),
      handleWindowKeydown: (e, ids) => this.handleWindowKeydown(e, ids),
      itemProps: (id, itemId) => this.itemProps(id, itemId),
      itemTabIndex: (id, itemId) => this.itemTabIndex(id, itemId),
      itemDisabled: (id, itemId) => this.itemDisabled(id, itemId),
      menuHidden: (id) => this.menuHidden(id),
      menuProps: (id) => this.menuProps(id),
    };
  }
}

/**
 * A mounted controller. Mounted here because every mutator is gated on
 * `lifecycle !== 'destroyed'`, so an unmounted controller would accept writes
 * the base class never authorised.
 */
export function createMenuController(config: MenuControllerOptions = {}): MenuController {
  const controller = new MenuController(config);
  controller.mount();
  return controller;
}
