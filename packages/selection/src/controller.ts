import { BaseController } from "@ailura/alpinejs-core/controller";
import { generateId } from "@ailura/alpinejs-core/ids";
import { invariant } from "@ailura/alpinejs-core/invariant";

import type { SelectionChangeDetail, SelectionEvents } from "./events";
import type {
  SelectionControllerOptions,
  SelectionInstance,
  SelectionKey,
  SelectionMode,
  SelectionOptions,
  SelectionSelectOptions,
  SelectionValue,
} from "./types";

const ERR_SELECTION_NOT_FOUND = (id: string): string => `selection instance "${id}" not found`;

export function toKeyString(key: SelectionKey): string {
  return String(key);
}

function normalizeValue(mode: SelectionMode, value: SelectionValue): SelectionValue {
  if (value === null || value === undefined) return mode === "multiple" ? [] : null;
  if (mode === "single") {
    if (typeof value === "string" || typeof value === "number") return value;
    if (Array.isArray(value)) return (value[0] ?? null) as SelectionKey | null;
    if (typeof value === "object" && "from" in value)
      return (value as { from: SelectionKey }).from ?? null;
    return null;
  }
  if (mode === "multiple") {
    if (Array.isArray(value)) return [...value];
    if (typeof value === "string" || typeof value === "number") return [value];
    if (value && typeof value === "object" && "from" in value) {
      const r = value as { from: SelectionKey; to?: SelectionKey };
      return r.to !== undefined ? [r.from, r.to] : [r.from];
    }
    return [];
  }
  // range
  if (value && typeof value === "object" && "from" in value) return value as SelectionValue;
  if (typeof value === "string" || typeof value === "number") return { from: value };
  if (Array.isArray(value) && value.length > 0) {
    return value.length === 1
      ? { from: value[0] }
      : { from: value[0], to: value[value.length - 1] };
  }
  return null;
}

function selectedKeysFor(mode: SelectionMode, value: SelectionValue, keys: string[]): string[] {
  if (mode === "single") {
    return value !== null &&
      value !== undefined &&
      typeof value !== "object" &&
      !Array.isArray(value) &&
      keys.includes(String(value))
      ? [String(value)]
      : [];
  }
  if (mode === "multiple") {
    const arr = Array.isArray(value) ? value.map((v) => String(v)) : [];
    return arr.filter((k) => keys.includes(k));
  }
  // range
  if (value && typeof value === "object" && "from" in value) {
    const from = String((value as { from: SelectionKey }).from);
    const to =
      (value as { to?: SelectionKey }).to !== undefined
        ? String((value as { to?: SelectionKey }).to)
        : from;
    const fromIdx = keys.indexOf(from);
    const toIdx = keys.indexOf(to);
    if (fromIdx === -1 || toIdx === -1) return [];
    const lo = Math.min(fromIdx, toIdx);
    const hi = Math.max(fromIdx, toIdx);
    return keys.slice(lo, hi + 1);
  }
  return [];
}

type Internal = {
  mode: SelectionMode;
  keys: string[];
  disabledKeys: Set<string>;
  value: SelectionValue;
  anchorKey: string | null;
  activeKey: string | null;
  allowDisabledSelection: boolean;
  onChange?: (d: SelectionChangeDetail) => void;
};

function snapshot(id: string, inst: Internal): SelectionInstance {
  return {
    mode: inst.mode,
    value: inst.value,
    keys: [...inst.keys],
    disabledKeys: [...inst.disabledKeys],
    anchorKey: inst.anchorKey,
    activeKey: inst.activeKey,
    selectedKeys: selectedKeysFor(inst.mode, inst.value, inst.keys),
    allowDisabledSelection: inst.allowDisabledSelection,
  };
}

export class SelectionController extends BaseController<SelectionEvents> {
  readonly id: string;
  #instances: Record<string, Internal> = {};

  constructor(id?: string) {
    super();
    this.id = id ?? generateId("selection");
  }

  hasInstance(id: string): boolean {
    return id in this.#instances;
  }

  snapshotInstances(): Record<string, SelectionInstance> {
    const out: Record<string, SelectionInstance> = {};
    for (const k in this.#instances) out[k] = snapshot(k, this.#instances[k]);
    return out;
  }

  getSnapshot(id: string): SelectionInstance {
    const inst = this.#instances[id];
    invariant(inst, ERR_SELECTION_NOT_FOUND(id));
    return snapshot(id, inst);
  }

  create(id: string, options: SelectionOptions = {}): void {
    if (this.lifecycle === "destroyed") return;
    const mode = options.mode ?? "single";
    const keys = (options.keys ?? []).map(toKeyString);
    const disabledKeys = new Set((options.disabledKeys ?? []).map(toKeyString));
    const src = options.value ?? options.defaultValue ?? (mode === "multiple" ? [] : null);
    const value = normalizeValue(mode, src as SelectionValue);
    this.#instances[id] = {
      mode,
      keys,
      disabledKeys,
      value,
      anchorKey: null,
      activeKey: null,
      allowDisabledSelection: options.allowDisabledSelection ?? false,
      onChange: options.onChange,
    };
    this.#emit(id, null);
  }

  destroy(id?: string): void {
    if (id !== undefined) {
      if (this.lifecycle === "destroyed") return;
      if (!(id in this.#instances)) return;
      delete this.#instances[id];
      // Announce the removal. The store's registry is a reactive projection of
      // this map, so without an event the deleted instance stayed in the store
      // forever — which is the leak the docs warn about ("create on mount and
      // destroy on teardown, or the memory grows one instance per
      // navigation"), reachable through `$store.selection.destroy(id)`.
      this.emit("destroy", { id });
      return;
    }
    this.destroyAll();
    super.destroy();
  }

  destroyAll(): void {
    const ids = Object.keys(this.#instances);
    for (const k of ids) delete this.#instances[k];
    for (const id of ids) this.emit("destroy", { id });
    if (this.lifecycle !== "destroyed") super.destroy();
  }

  setKeys(id: string, keys: readonly SelectionKey[]): void {
    const inst = this.#require(id);
    const prev = inst.value;
    inst.keys = keys.map(toKeyString);
    // A shrunk key set would otherwise leave the value pointing at items that no
    // longer exist: `isSelected` filters against `keys`, so a stale `value` reads
    // as "nothing selected" while the snapshot still reports the old id.
    const sel = selectedKeysFor(inst.mode, inst.value, inst.keys);
    if (inst.mode === "multiple") inst.value = sel;
    else if (inst.mode === "single") inst.value = (sel[0] ?? null) as SelectionValue;
    else if (sel.length === 0) inst.value = null;
    else if (sel.length === 1) inst.value = { from: sel[0] };
    else inst.value = { from: sel[0], to: sel[sel.length - 1] };
    if (inst.anchorKey && !inst.keys.includes(inst.anchorKey)) inst.anchorKey = null;
    if (inst.activeKey && !inst.keys.includes(inst.activeKey)) inst.activeKey = null;
    this.#emit(id, prev);
  }

  setDisabledKeys(id: string, keys: readonly SelectionKey[]): void {
    const inst = this.#require(id);
    const prev = inst.value;
    inst.disabledKeys = new Set(keys.map(toKeyString));
    this.#emit(id, prev);
  }

  setMode(id: string, mode: SelectionMode): void {
    const inst = this.#require(id);
    if (inst.mode === mode) return;
    const prev = inst.value;
    const sel = selectedKeysFor(inst.mode, inst.value, inst.keys);
    inst.mode = mode;
    if (mode === "single") inst.value = (sel[0] ?? null) as SelectionValue;
    else if (mode === "multiple") inst.value = sel;
    else
      inst.value =
        sel.length === 0
          ? null
          : sel.length === 1
            ? { from: sel[0] }
            : { from: sel[0], to: sel[sel.length - 1] };
    this.#emit(id, prev);
  }

  setValue(id: string, value: SelectionValue): void {
    const inst = this.#require(id);
    const prev = inst.value;
    inst.value = normalizeValue(inst.mode, value);
    this.#emit(id, prev);
  }

  select(id: string, key: SelectionKey, options: SelectionSelectOptions = {}): void {
    const b = options.behavior ?? "replace";
    if (b === "toggle") return this.toggle(id, key);
    if (b === "extend") return this.extend(id, key);
    return this.replace(id, key);
  }

  replace(id: string, key: SelectionKey): void {
    const inst = this.#require(id);
    const k = toKeyString(key);
    if (!inst.keys.includes(k)) return;
    if (!inst.allowDisabledSelection && inst.disabledKeys.has(k)) return;
    const prev = inst.value;
    if (inst.mode === "single") inst.value = k as SelectionValue;
    else if (inst.mode === "multiple") inst.value = [k] as unknown as SelectionValue;
    else inst.value = { from: k };
    inst.anchorKey = k;
    inst.activeKey = k;
    this.#emit(id, prev);
  }

  toggle(id: string, key: SelectionKey): void {
    const inst = this.#require(id);
    const k = toKeyString(key);
    if (!inst.keys.includes(k)) return;
    const sel = selectedKeysFor(inst.mode, inst.value, inst.keys);
    const prev = inst.value;
    if (inst.mode === "single") {
      inst.value = sel.includes(k) ? null : (k as SelectionValue);
    } else if (inst.mode === "multiple") {
      const arr = sel as string[];
      inst.value = arr.includes(k) ? arr.filter((x) => x !== k) : [...arr, k];
      // Project the selection onto `keys` order rather than keeping insertion
      // order: a multi-select bound to a rendered list reads as the list, so
      // deselecting the first item and reselecting it must not move it to the end.
      const next = (inst.value as string[]).filter((x) => inst.keys.includes(x));
      inst.value = inst.keys.filter((x) => (next as string[]).includes(x));
    } else {
      // A range has no per-key toggle to honour — `selectedKeys` is the closed
      // span between the endpoints, so a key in the middle of it cannot be
      // removed without also removing the rest. Collapsing to `{ from: key }`
      // when the key is already selected, and to `null` when it is not, is the
      // honest version: it restarts the range at the clicked row. A host wanting
      // single-row toggling inside a range should use `multiple` mode.
      if (sel.includes(k)) {
        inst.value = null;
      } else {
        inst.value = { from: k };
      }
    }
    inst.anchorKey = k;
    inst.activeKey = k;
    this.#emit(id, prev);
  }

  extend(id: string, key: SelectionKey): void {
    const inst = this.#require(id);
    const k = toKeyString(key);
    if (!inst.keys.includes(k)) return;
    if (!inst.allowDisabledSelection && inst.disabledKeys.has(k)) return;
    const prev = inst.value;
    // With no anchor yet the span degenerates to the clicked key — that is what
    // makes the first shift-click of a shift-click selection land on one row
    // instead of extending from nothing.
    const anchor = inst.anchorKey ?? k;
    if (inst.mode === "range") {
      inst.value = { from: anchor, to: k };
    } else if (inst.mode === "multiple") {
      const anchorIdx = inst.keys.indexOf(anchor);
      const kIdx = inst.keys.indexOf(k);
      if (anchorIdx === -1 || kIdx === -1) {
        inst.value = [k] as unknown as SelectionValue;
      } else {
        const lo = Math.min(anchorIdx, kIdx);
        const hi = Math.max(anchorIdx, kIdx);
        inst.value = inst.keys.slice(lo, hi + 1) as unknown as SelectionValue;
      }
    } else {
      inst.value = k as SelectionValue;
    }
    inst.activeKey = k;
    this.#emit(id, prev);
  }

  clear(id: string): void {
    const inst = this.#require(id);
    const prev = inst.value;
    inst.value = inst.mode === "multiple" ? [] : null;
    inst.anchorKey = null;
    this.#emit(id, prev);
  }

  selectAll(id: string): void {
    const inst = this.#require(id);
    const prev = inst.value;
    const enabled = inst.keys.filter(
      (k) => inst.allowDisabledSelection || !inst.disabledKeys.has(k)
    );
    if (inst.mode === "single") inst.value = (enabled[0] ?? null) as SelectionValue;
    else if (inst.mode === "multiple") inst.value = enabled as unknown as SelectionValue;
    else
      inst.value =
        enabled.length === 0
          ? null
          : enabled.length === 1
            ? { from: enabled[0] }
            : { from: enabled[0], to: enabled[enabled.length - 1] };
    this.#emit(id, prev);
  }

  setActive(id: string, key: SelectionKey | null): void {
    const inst = this.#require(id);
    const prev = inst.value;
    inst.activeKey = key === null || key === undefined ? null : toKeyString(key);
    this.#emit(id, prev);
  }

  setAnchor(id: string, key: SelectionKey | null): void {
    const inst = this.#require(id);
    const prev = inst.value;
    inst.anchorKey = key === null || key === undefined ? null : toKeyString(key);
    this.#emit(id, prev);
  }

  isSelected(id: string, key: SelectionKey): boolean {
    const inst = this.#require(id);
    return selectedKeysFor(inst.mode, inst.value, inst.keys).includes(toKeyString(key));
  }

  isSelectable(id: string, key: SelectionKey): boolean {
    const inst = this.#require(id);
    const k = toKeyString(key);
    if (inst.keys.length > 0 && !inst.keys.includes(k)) return false;
    return inst.allowDisabledSelection || !inst.disabledKeys.has(k);
  }

  isActive(id: string, key: SelectionKey): boolean {
    return this.#require(id).activeKey === toKeyString(key);
  }

  isAnchor(id: string, key: SelectionKey): boolean {
    return this.#require(id).anchorKey === toKeyString(key);
  }

  snapshot(id: string): SelectionInstance {
    return this.getSnapshot(id);
  }

  /** Compat: generic snapshot for tabs/menu bridge */
  toStoreInstances(): Record<string, SelectionInstance> {
    return this.snapshotInstances();
  }

  #require(id: string): Internal {
    const inst = this.#instances[id];
    invariant(inst, ERR_SELECTION_NOT_FOUND(id));
    return inst;
  }

  #emit(id: string, previous: SelectionValue | null): void {
    const inst = this.#instances[id];
    if (!inst) return;
    const detail: SelectionChangeDetail = {
      id,
      mode: inst.mode,
      value: inst.value,
      selectedKeys: selectedKeysFor(inst.mode, inst.value, inst.keys),
      previous: previous as SelectionValue,
    };
    this.emit("change", detail);
    inst.onChange?.(detail);
  }
}

export function createSelectionController(
  options: SelectionControllerOptions = {}
): SelectionController {
  const c = new SelectionController(options.id);
  c.mount();
  return c;
}
