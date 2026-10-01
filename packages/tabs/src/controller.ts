import { BaseController } from "@ailura/alpinejs-core/controller";
import { generateId } from "@ailura/alpinejs-core/ids";

import type { TabsEvents } from "./events";
import { createTabsStoreFromController } from "./store";
import type { TabsControllerOptions, TabsInstance, TabsOptions, TabsStore } from "./types";

function createInstance(options: TabsOptions = {}): TabsInstance {
  return {
    activeTabId: options.defaultTab ?? null,
    orientation: options.orientation ?? "horizontal",
    items: [],
    onChange: options.onChange,
  };
}

function snapshotInstance(group: TabsInstance): TabsInstance {
  return {
    ...group,
    items: group.items.map((i) => ({ ...i })),
  };
}

function enabledItems(group: TabsInstance): string[] {
  return group.items.filter((i) => !i.disabled).map((i) => i.id);
}

export class TabsController extends BaseController<TabsEvents> {
  readonly id: string;
  #instances: Record<string, TabsInstance> = {};

  constructor(id?: string) {
    super();
    this.id = id ?? generateId("tabs");
  }

  private get frozen(): boolean {
    return this.lifecycle === "destroyed";
  }

  hasInstance(groupId: string): boolean {
    return groupId in this.#instances;
  }

  snapshotInstances(): Record<string, TabsInstance> {
    const out: Record<string, TabsInstance> = {};
    for (const k in this.#instances) out[k] = snapshotInstance(this.#instances[k]);
    return out;
  }

  /**
   * Create a tab list, replacing any existing one with the same id.
   *
   * `defaultTab` is taken verbatim: nothing checks that the id has been
   * registered, so a `defaultTab` that is never passed to `createItem()` leaves
   * the list with nothing selected until the user clicks.
   */
  create(groupId: string, options: TabsOptions = {}): void {
    if (this.frozen) return;
    const group = createInstance(options);
    this.#instances[groupId] = group;
    this.emit("change", {
      instanceId: groupId,
      activeTabId: group.activeTabId,
      source: "initialization",
    });
  }

  /**
   * `destroy(groupId)` drops ONE tab list; `destroy()` tears down the
   * controller.
   *
   * The overload exists because `BaseController.destroy()` is the controller's
   * own teardown and cannot be renamed. The argument is what separates them.
   */
  override destroy(groupId?: string): void {
    if (this.frozen) return;
    if (groupId === undefined) {
      for (const id of Object.keys(this.#instances)) this.#destroyInstance(id);
      super.destroy();
      return;
    }
    this.#destroyInstance(groupId);
  }

  /** Destroy every tab list, leaving the controller itself usable. */
  destroyAll(): void {
    if (this.frozen) return;
    for (const id of Object.keys(this.#instances)) this.#destroyInstance(id);
  }

  #destroyInstance(groupId: string): void {
    delete this.#instances[groupId];
    this.emit("change", { instanceId: groupId, activeTabId: null, source: "initialization" });
  }

  /**
   * Register a tab, creating its list on the way if none exists.
   *
   * The first enabled tab registered into a list with no active tab becomes the
   * active one, which is why registration order decides the initial selection
   * even when `defaultTab` is unset.
   */
  createItem(groupId: string, tabId: string, disabled = false): void {
    if (this.frozen) return;
    const group = (this.#instances[groupId] ??= createInstance());
    const existing = group.items.find((i) => i.id === tabId);
    if (existing) {
      existing.disabled = disabled;
      this.emit("change", { instanceId: groupId, activeTabId: group.activeTabId, source: "user" });
      return;
    }
    group.items.push({ id: tabId, disabled });
    if (!group.activeTabId && !disabled) {
      group.activeTabId = tabId;
      this.emit("change", { instanceId: groupId, activeTabId: tabId, source: "user" });
      group.onChange?.(tabId);
    } else {
      this.emit("change", { instanceId: groupId, activeTabId: group.activeTabId, source: "user" });
    }
  }

  destroyItem(groupId: string, tabId: string): void {
    if (this.frozen) return;
    const group = this.#instances[groupId];
    if (!group) return;
    const wasActive = group.activeTabId === tabId;
    group.items = group.items.filter((i) => i.id !== tabId);
    if (wasActive) {
      const next = group.items.find((i) => !i.disabled)?.id ?? null;
      group.activeTabId = next;
    }
    this.emit("change", { instanceId: groupId, activeTabId: group.activeTabId, source: "user" });
  }

  select(groupId: string, tabId: string): void {
    if (this.frozen) return;
    const group = this.#instances[groupId];
    const item = group?.items.find((i) => i.id === tabId);
    if (!(group && item) || item.disabled) return;
    group.activeTabId = tabId;
    this.emit("change", { instanceId: groupId, activeTabId: tabId, source: "user" });
    group.onChange?.(tabId);
  }

  active(groupId: string): string | null {
    return this.#instances[groupId]?.activeTabId ?? null;
  }

  isActive(groupId: string, tabId: string): boolean {
    return this.active(groupId) === tabId;
  }

  next(groupId: string): void {
    this.step(groupId, 1);
  }

  previous(groupId: string): void {
    this.step(groupId, -1);
  }

  private step(groupId: string, delta: number): void {
    if (this.frozen) return;
    const group = this.#instances[groupId];
    if (!group) return;
    const keys = enabledItems(group);
    if (keys.length === 0) return;
    const cur = group.activeTabId;
    const idx = cur ? keys.indexOf(cur) : -1;
    const nextIdx = (idx + delta + keys.length) % keys.length;
    const next = keys[nextIdx];
    if (next) this.select(groupId, next);
  }

  /**
   * Roving-tabindex keyboard support, gated on the list's own `orientation`.
   *
   * `ArrowRight`/`ArrowLeft` only act on a horizontal list and
   * `ArrowDown`/`ArrowUp` only on a vertical one, so the wrong pair falls
   * through untouched rather than stealing the key from the page.
   * `Home`/`End` work in both. Disabled tabs are skipped, and the movement
   * wraps. Nothing here calls `focus()`.
   */
  handleKeydown(groupId: string, event: KeyboardEvent): void {
    const group = this.#instances[groupId];
    if (!group) return;
    const horizontal = group.orientation === "horizontal";
    const vertical = group.orientation === "vertical";
    const keys = enabledItems(group);
    if (keys.length === 0) return;
    switch (event.key) {
      case "ArrowRight":
        if (!horizontal) break;
        event.preventDefault();
        this.step(groupId, 1);
        break;
      case "ArrowLeft":
        if (!horizontal) break;
        event.preventDefault();
        this.step(groupId, -1);
        break;
      case "ArrowDown":
        if (!vertical) break;
        event.preventDefault();
        this.step(groupId, 1);
        break;
      case "ArrowUp":
        if (!vertical) break;
        event.preventDefault();
        this.step(groupId, -1);
        break;
      case "Home":
        event.preventDefault();
        if (keys[0]) this.select(groupId, keys[0]);
        break;
      case "End": {
        event.preventDefault();
        const last = keys.at(-1);
        if (last) this.select(groupId, last);
        break;
      }
      default:
        break;
    }
  }

  /**
   * Tab attributes. `aria-controls` and the panel's `id` come from the same
   * `(groupId, tabId)` pair on purpose — a mismatched pair is a dangling
   * reference, not a cosmetic bug.
   *
   * `aria-selected` and `tabindex` change with selection, so they must be bound
   * per attribute: Alpine applies an object-form `x-bind` exactly once.
   */
  tabProps(groupId: string, tabId: string): Record<string, string | number | boolean | undefined> {
    const active = this.isActive(groupId, tabId);
    return {
      role: "tab",
      id: `${groupId}-tab-${tabId}`,
      "aria-selected": active,
      "aria-controls": `${groupId}-panel-${tabId}`,
      tabindex: active ? 0 : -1,
    };
  }

  panelProps(groupId: string, tabId: string): Record<string, string | boolean | undefined> {
    const active = this.isActive(groupId, tabId);
    return {
      role: "tabpanel",
      id: `${groupId}-panel-${tabId}`,
      "aria-labelledby": `${groupId}-tab-${tabId}`,
      hidden: !active,
    };
  }

  tablistProps(groupId: string): Record<string, string | undefined> {
    return { role: "tablist", "aria-orientation": this.#instances[groupId]?.orientation };
  }

  /**
   * The plain, non-reactive projection. Every arrow here closes over `this`, so
   * these reads do not register a dependency when called inside an Alpine
   * effect — `plugin.ts` replaces the five derived ones for exactly that
   * reason.
   */
  toStore(): TabsStore {
    return {
      // A fresh record, never the private registry: the plugin's sync writes
      // plain snapshots here, so aliasing the private map would destroy the
      // controller's internal instance state.
      instances: {} as TabsStore["instances"],
      create: (id, opts) => this.create(id, opts),
      // One key, both arities, argument forwarded: `destroy: () =>
      // this.destroy()` would make `store.destroy("settings")` tear the
      // controller down instead of one tab list.
      destroy: (id?: string) => this.destroy(id),
      destroyAll: () => this.destroyAll(),
      createItem: (id, tabId, disabled) => this.createItem(id, tabId, disabled),
      destroyItem: (id, tabId) => this.destroyItem(id, tabId),
      select: (id, tabId) => this.select(id, tabId),
      active: (id) => this.active(id),
      isActive: (id, tabId) => this.isActive(id, tabId),
      next: (id) => this.next(id),
      previous: (id) => this.previous(id),
      handleKeydown: (id, e) => this.handleKeydown(id, e),
      tabProps: (id, tabId) => this.tabProps(id, tabId),
      panelProps: (id, tabId) => this.panelProps(id, tabId),
      tablistProps: (id) => this.tablistProps(id),
    };
  }
}

export function createTabsController(options: TabsControllerOptions = {}): TabsController {
  const controller = new TabsController(options.id);
  controller.mount();
  return controller;
}

/**
 * A standalone `TabsStore`, for a consumer that wants the projection without
 * registering a plugin.
 *
 * Goes through {@link createTabsController}, so the controller behind it is
 * mounted. Note this is NOT the reactive store the plugin builds: its derived
 * reads close over the controller rather than reading `store.instances`, so
 * inside an Alpine effect they will not re-run. Prefer `tabsPlugin()` for
 * anything bound in a template.
 */
export function createTabsStore(options: TabsControllerOptions = {}): TabsStore {
  return createTabsStoreFromController(createTabsController(options));
}
