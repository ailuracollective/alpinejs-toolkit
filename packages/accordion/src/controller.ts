/**
 * Two registries, not one, and that is the whole design here.
 *
 * `#instances` holds the record the store projects — items, `activeItemId`, the
 * `open` map. `#selection` holds which ids are open in a form that can express
 * both modes at once (`value` for `single`, `selectedKeys` for `multiple`).
 * Every mutation writes the selection first and then re-derives `#instances`
 * from it, so the two can never disagree. `#selection` replaced a
 * `@ailura/alpinejs-selection` instance per group: the dependency cost more
 * than the ~40 lines it saved, for a feature this package only needs two modes
 * of.
 */

import { BaseController } from "@ailura/alpinejs-core/controller";
import { generateId } from "@ailura/alpinejs-core/ids";
import { syncRecordFromSnapshot } from "@ailura/alpinejs-core/sync";

import type { AccordionEvents } from "./events";
import type {
  AccordionChangeSource,
  AccordionControllerOptions,
  AccordionInstance,
  AccordionItem,
  AccordionMode,
  AccordionOptions,
} from "./types";

interface AccordionSelectionState {
  mode: AccordionMode;
  value: string | null;
  selectedKeys: readonly string[];
  keys: readonly string[];
  disabledKeys: ReadonlySet<string>;
}

function makeSelection(
  mode: AccordionMode,
  value: string | string[] | null
): AccordionSelectionState {
  if (mode === "single") {
    const v = Array.isArray(value) ? (value[0] ?? null) : typeof value === "string" ? value : null;
    return {
      mode,
      value: v,
      selectedKeys: [],
      keys: [],
      disabledKeys: new Set<string>(),
    };
  }
  return {
    mode,
    value: null,
    selectedKeys: Array.isArray(value) ? [...value] : [],
    keys: [],
    disabledKeys: new Set<string>(),
  };
}

function syncSelectionKeys(
  state: AccordionSelectionState,
  keys: readonly string[],
  disabled: readonly string[]
): void {
  state.keys = keys;
  state.disabledKeys = new Set(disabled);
  if (
    state.value !== null &&
    (!state.keys.includes(state.value) || state.disabledKeys.has(state.value))
  ) {
    state.value = null;
  }
  if (state.selectedKeys.some((k) => !state.keys.includes(k) || state.disabledKeys.has(k))) {
    state.selectedKeys = state.selectedKeys.filter(
      (k) => state.keys.includes(k) && !state.disabledKeys.has(k)
    );
  }
}

function enabledItems(group: AccordionInstance): AccordionItem[] {
  return group.items.filter((item) => !item.disabled);
}

function itemIndex(items: AccordionItem[], itemId: string): number {
  return items.findIndex((item) => item.id === itemId);
}

function createInstance(options: AccordionOptions = {}): AccordionInstance {
  const mode = options.mode ?? "single";
  const value = options.defaultOpen;
  const defaultOpen = !value
    ? []
    : Array.isArray(value)
      ? mode === "single" && value.length
        ? [value[0]]
        : value
      : [value];
  return {
    mode,
    open: {},
    activeItemId: null,
    items: [],
    defaultOpen,
    onChange: options.onChange,
  };
}

function snapshotInstance(group: AccordionInstance): AccordionInstance {
  return {
    ...group,
    open: { ...group.open },
    items: group.items.map((item) => ({ ...item })),
    defaultOpen: [...group.defaultOpen],
  };
}

function selectionKeys(state: AccordionSelectionState): readonly string[] {
  return state.mode === "single" ? (state.value === null ? [] : [state.value]) : state.selectedKeys;
}

function setOpenRecord(group: AccordionInstance, state: AccordionSelectionState): void {
  const selected = new Set(selectionKeys(state));
  const nextOpen: Record<string, boolean> = {};
  for (const item of group.items) nextOpen[item.id] = selected.has(item.id);
  syncRecordFromSnapshot(
    group.open as Record<string, unknown>,
    nextOpen as Record<string, unknown>
  );
}

export class AccordionController extends BaseController<AccordionEvents> {
  readonly id: string;

  #instances: Record<string, AccordionInstance> = {};
  #selection: Record<string, AccordionSelectionState> = {};

  constructor(id?: string) {
    super();
    this.id = id ?? generateId("accordion");
  }

  private get frozen(): boolean {
    return this.lifecycle === "destroyed";
  }

  hasInstance(accordionId: string): boolean {
    return accordionId in this.#instances;
  }

  /**
   * Returns shallow snapshots of every instance for adapter sync.
   * Mutating the returned objects does not affect controller state.
   */
  snapshotInstances(): Record<string, AccordionInstance> {
    const result: Record<string, AccordionInstance> = {};
    for (const id in this.#instances) result[id] = snapshotInstance(this.#instances[id]);
    return result;
  }

  /**
   * Create an accordion, replacing any existing one with the same id.
   *
   * `defaultOpen` is recorded, not applied: the ids are only opened as their
   * items are registered by `createItem`, because an item id cannot be open
   * before it exists.
   */
  create(accordionId: string, options: AccordionOptions = {}): void {
    if (this.frozen) {
      return;
    }
    const group = createInstance(options);
    this.#instances[accordionId] = group;
    const selection = makeSelection(group.mode, group.defaultOpen);
    this.#selection[accordionId] = selection;
    this.#syncKeys(accordionId);
    setOpenRecord(group, selection);
    this.#emitChange(accordionId, "initialization");
  }

  /**
   * `destroy(accordionId)` drops ONE accordion; `destroy()` tears down the
   * controller.
   *
   * The overload exists because `BaseController.destroy()` is the controller's
   * own teardown and cannot be renamed, and because the store exposes both. The
   * argument is what separates them: no argument still means the base class's
   * meaning, which is what a host calling `store.destroy()` expects.
   */
  override destroy(accordionId?: string): void {
    if (this.frozen) {
      return;
    }
    if (accordionId === undefined) {
      for (const id of Object.keys(this.#instances)) this.#destroyInstance(id);
      super.destroy();
      return;
    }
    this.#destroyInstance(accordionId);
  }

  /** Destroy every accordion, leaving the controller itself usable. */
  destroyAll(): void {
    if (this.frozen) return;
    for (const id of Object.keys(this.#instances)) this.#destroyInstance(id);
  }

  #destroyInstance(accordionId: string): void {
    delete this.#selection[accordionId];
    delete this.#instances[accordionId];
    // Emit after the deletes: the projection in `store.ts` re-syncs from
    // `snapshotInstances()` on this event, so a pre-delete emit would keep a
    // ghost entry for the accordion that is being removed.
    this.#emitChange(accordionId, "initialization");
  }

  /**
   * Register an item, creating its accordion on the way if none exists.
   *
   * The only entry point that works without a `create()` first, which is what
   * makes it safe to drive a whole group from a list of ids.
   */
  createItem(accordionId: string, itemId: string, disabled = false): void {
    if (this.frozen) {
      return;
    }
    const group = this.#getOrCreate(accordionId);
    const existing = group.items.find((item) => item.id === itemId);
    if (existing) {
      existing.disabled = disabled;
      this.#emitChange(accordionId, "user");
      return;
    }
    group.items.push({ id: itemId, disabled });
    this.#syncKeys(accordionId);

    if (group.defaultOpen.includes(itemId) && !disabled) {
      this.open(accordionId, itemId);
      group.activeItemId ??= itemId;
      return;
    }

    this.#emitChange(accordionId, "user");
  }

  destroyItem(accordionId: string, itemId: string): void {
    if (this.frozen) {
      return;
    }
    const group = this.#instances[accordionId];
    const selection = this.#selection[accordionId];
    if (!(group && selection)) {
      return;
    }
    group.items = group.items.filter((item) => item.id !== itemId);
    this.#syncKeys(accordionId);
    setOpenRecord(group, selection);
    this.#emitChange(accordionId, "user");
  }

  open(accordionId: string, itemId: string): void {
    if (this.frozen) {
      return;
    }
    const group = this.#instances[accordionId];
    const selection = this.#selection[accordionId];
    const item = group?.items.find((entry) => entry.id === itemId);
    if (!(group && selection && item) || item.disabled) {
      return;
    }

    if (group.mode === "single") {
      selection.mode = "single";
      selection.value = itemId;
      selection.selectedKeys = [];
    } else if (!selectionKeys(selection).includes(itemId)) {
      selection.mode = "multiple";
      selection.value = null;
      selection.selectedKeys = [...selectionKeys(selection), itemId];
    }

    setOpenRecord(group, selection);
    this.#emitChange(accordionId, "user");
    group.onChange?.(this.openIds(accordionId));
  }

  close(accordionId: string, itemId: string): void {
    if (this.frozen) {
      return;
    }
    const group = this.#instances[accordionId];
    const selection = this.#selection[accordionId];
    if (!(group && selection && group.open[itemId])) {
      return;
    }

    if (group.mode === "single") {
      selection.value = null;
      selection.selectedKeys = [];
    } else {
      selection.selectedKeys = selectionKeys(selection).filter((key) => key !== itemId);
    }

    setOpenRecord(group, selection);
    this.#emitChange(accordionId, "user");
    group.onChange?.(this.openIds(accordionId));
  }

  /**
   * Open or close an item.
   *
   * Silently does nothing when the accordion was never created — unlike
   * `open()` and `close()`, which no-op on an unknown item, this one checks
   * the group first so a typo'd accordion id cannot fall through into a
   * half-open state.
   */
  toggle(accordionId: string, itemId: string): void {
    if (this.frozen) {
      return;
    }
    if (!this.#instances[accordionId]) {
      return;
    }
    if (this.isOpen(accordionId, itemId)) {
      this.close(accordionId, itemId);
    } else {
      this.open(accordionId, itemId);
    }
  }

  isOpen(accordionId: string, itemId: string): boolean {
    const selection = this.#selection[accordionId];
    if (!selection) {
      return false;
    }
    return selection.mode === "single"
      ? selection.value === itemId
      : selection.selectedKeys.includes(itemId);
  }

  openIds(accordionId: string): string[] {
    const selection = this.#selection[accordionId];
    return selection ? [...selectionKeys(selection)] : [];
  }

  activeItem(accordionId: string): string | null {
    return this.#instances[accordionId]?.activeItemId ?? null;
  }

  setActiveItem(accordionId: string, itemId: string | null): void {
    if (this.frozen) {
      return;
    }
    const group = this.#instances[accordionId];
    if (!group) {
      return;
    }
    if (itemId === null) {
      group.activeItemId = null;
      this.#emitChange(accordionId, "user");
      return;
    }
    const item = group.items.find((entry) => entry.id === itemId);
    if (item && !item.disabled) {
      group.activeItemId = itemId;
      this.#emitChange(accordionId, "user");
    }
  }

  /**
   * Move the group's active item on the four navigation keys.
   *
   * Moves `activeItemId` and nothing else: it never calls `focus()`, because a
   * controller with no element reference cannot, and because the roving
   * `tabindex` it drives is what makes the group reachable in the first place.
   * Disabled items are skipped. The first key press of any kind also seeds
   * `activeItemId` to the first enabled item, so a group that has never been
   * focused still has a `0` tabindex somewhere.
   */
  handleKeydown(accordionId: string, event: KeyboardEvent): void {
    const group = this.#instances[accordionId];
    if (!group) {
      return;
    }
    const items = enabledItems(group);
    if (items.length === 0) {
      return;
    }
    if (!group.activeItemId) {
      group.activeItemId = items[0]?.id ?? null;
    }
    const currentIndex = group.activeItemId ? itemIndex(items, group.activeItemId) : 0;
    switch (event.key) {
      case "ArrowDown":
        event.preventDefault();
        group.activeItemId = items[(currentIndex + 1) % items.length]?.id ?? null;
        break;
      case "ArrowUp":
        event.preventDefault();
        group.activeItemId = items[(currentIndex - 1 + items.length) % items.length]?.id ?? null;
        break;
      case "Home":
        event.preventDefault();
        group.activeItemId = items[0]?.id ?? null;
        break;
      case "End":
        event.preventDefault();
        group.activeItemId = items[items.length - 1]?.id ?? null;
        break;
      default:
        break;
    }
    this.#emitChange(accordionId, "user");
  }

  /**
   * Trigger attributes: `aria-expanded`, `aria-controls`, the trigger `id`, and
   * the roving `tabindex`.
   *
   * The `id` pair is load-bearing rather than cosmetic — `aria-controls` here
   * is the `id` `panelProps()` puts on the panel, so the two must come from
   * the same `(accordionId, itemId)` pair or the reference dangles.
   */
  triggerProps(
    accordionId: string,
    itemId: string
  ): Record<string, string | number | boolean | undefined> {
    const open = this.isOpen(accordionId, itemId);
    const active = this.activeItem(accordionId) === itemId;
    return {
      "aria-expanded": open,
      "aria-controls": `${accordionId}-panel-${itemId}`,
      id: `${accordionId}-trigger-${itemId}`,
      tabindex: active ? 0 : -1,
    };
  }

  /**
   * Panel attributes: `role="region"`, the panel `id`, `aria-labelledby` and
   * `aria-hidden`. No `hidden` — visibility is the caller's `x-show`, and a
   * `hidden` here would fight it.
   */
  panelProps(accordionId: string, itemId: string): Record<string, string | boolean | undefined> {
    const open = this.isOpen(accordionId, itemId);
    return {
      id: `${accordionId}-panel-${itemId}`,
      role: "region",
      "aria-labelledby": `${accordionId}-trigger-${itemId}`,
      "aria-hidden": open ? undefined : true,
    };
  }

  #getOrCreate(accordionId: string): AccordionInstance {
    this.#instances[accordionId] ??= createInstance();
    return this.#instances[accordionId];
  }

  #emitChange(accordionId: string, source: AccordionChangeSource): void {
    this.emit("change", {
      instanceId: accordionId,
      openIds: this.openIds(accordionId),
      source,
    });
  }

  #syncKeys(accordionId: string): void {
    const group = this.#instances[accordionId];
    const selection = this.#selection[accordionId];
    if (!(group && selection)) {
      return;
    }
    const keys = group.items.map((item) => item.id);
    const disabled = group.items.filter((item) => item.disabled).map((item) => item.id);
    syncSelectionKeys(selection, keys, disabled);
  }
}

/**
 * A mounted controller, for a consumer that wants the state without Alpine.
 *
 * Mounted here rather than left to the caller: every mutator is gated on
 * `lifecycle !== 'destroyed'`, so a controller that was never mounted would
 * accept writes the base class never authorised.
 */
export function createAccordionController(
  options: AccordionControllerOptions = {}
): AccordionController {
  const controller = new AccordionController(options.id);
  controller.mount();
  return controller;
}
