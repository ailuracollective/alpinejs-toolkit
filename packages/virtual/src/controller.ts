import { EVENT_CHANGE, LIFECYCLE_DESTROYED } from "@ailura/alpinejs-core/constants";
import { BaseController } from "@ailura/alpinejs-core/controller";
import { generateId } from "@ailura/alpinejs-core/ids";
import { invariant } from "@ailura/alpinejs-core/invariant";

import type { VirtualEvents } from "./events";
import type {
  VirtualControllerOptions,
  VirtualInstance,
  VirtualItem,
  VirtualKey,
  VirtualOptions,
  VirtualScrollDirection,
  VirtualScrollToIndexOptions,
  VirtualStore,
} from "./types";

const ERR_VIRTUAL_SETKEYS_LENGTH = (len: number, count: number): string =>
  `setKeys length (${len}) must match count (${count})`;
const ERR_VIRTUAL_INDEX_RANGE = (index: number): string => `index ${index} out of range`;

type Internal = {
  options: Required<VirtualOptions>;
  keys: VirtualKey[];
  sizes: Map<VirtualKey, number>;
  totalSize: number;
  scrollOffset: number;
  scrollDirection: VirtualScrollDirection;
  isScrolling: boolean;
  viewportSize: number;
  startIndex: number;
  endIndex: number;
  virtualItems: VirtualItem[];
  scrollElement: HTMLElement | Window | null;
  scrollCleanup: (() => void) | null;
  offsets: number[] | null;
  _lastScroll: number;
  _lastViewport: number;
};

function normalize(o: VirtualOptions): Required<VirtualOptions> {
  return {
    count: o.count ?? 0,
    horizontal: o.horizontal ?? false,
    estimateSize: o.estimateSize ?? 50,
    overscan: o.overscan ?? 1,
    paddingStart: o.paddingStart ?? 0,
    paddingEnd: o.paddingEnd ?? 0,
    gap: o.gap ?? 0,
    scrollMode: o.scrollMode ?? "element",
    getItemKey: o.getItemKey ?? ((i: number) => i),
  };
}

function ensureOffsets(inst: Internal): number[] {
  if (inst.offsets !== null) return inst.offsets;
  const { options, keys, sizes } = inst;
  const offsets: number[] = new Array(keys.length);
  let off = options.paddingStart;
  for (let i = 0; i < keys.length; i++) {
    offsets[i] = off;
    const k = keys[i];
    if (k === undefined) continue;
    off += (sizes.get(k) ?? options.estimateSize) + options.gap;
  }
  inst.offsets = offsets;
  let total = off - options.gap + options.paddingEnd;
  if (total < 0) total = 0;
  inst.totalSize = total;
  return offsets;
}
function findFirstVisible(
  offsets: number[],
  sizes: Map<VirtualKey, number>,
  keys: VirtualKey[],
  estimateSize: number,
  scroll: number
): number {
  let lo = 0;
  let hi = keys.length - 1;
  let ans = 0;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const start = offsets[mid] ?? 0;
    const key = keys[mid];
    const end = start + ((key === undefined ? undefined : sizes.get(key)) ?? estimateSize);
    if (end >= scroll) {
      ans = mid;
      hi = mid - 1;
    } else lo = mid + 1;
  }
  return ans;
}
function findLastVisible(offsets: number[], scrollEnd: number): number {
  let lo = 0;
  let hi = offsets.length - 1;
  let ans = hi;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if ((offsets[mid] ?? 0) <= scrollEnd) {
      ans = mid;
      lo = mid + 1;
    } else hi = mid - 1;
  }
  return ans;
}
function buildVirtualItems(inst: Internal): void {
  const { options, keys, sizes } = inst;
  if (keys.length === 0) {
    inst.startIndex = 0;
    inst.endIndex = -1;
    inst.virtualItems = [];
    if (inst.offsets === null) {
      const t = options.paddingStart - options.gap + options.paddingEnd;
      inst.totalSize = t < 0 ? 0 : t;
      inst.offsets = [];
    }
    inst._lastScroll = inst.scrollOffset;
    inst._lastViewport = inst.viewportSize;
    return;
  }
  // Recomputing the window is the hot path: every scroll event lands here. When
  // the offset cache is still valid and neither the scroll offset nor the
  // viewport has moved, the stored range is already the answer.
  if (
    inst.offsets !== null &&
    inst._lastScroll === inst.scrollOffset &&
    inst._lastViewport === inst.viewportSize &&
    inst.virtualItems.length !== 0
  ) {
    return;
  }
  const offsets = ensureOffsets(inst);
  const viewport = inst.viewportSize || 300;
  const scroll = inst.scrollOffset;
  const overscan = options.overscan;
  let startIdx = findFirstVisible(offsets, sizes, keys, options.estimateSize, scroll);
  startIdx = Math.max(0, startIdx - overscan);
  let endIdx = findLastVisible(offsets, scroll + viewport);
  endIdx = Math.min(keys.length - 1, endIdx + overscan);
  inst.startIndex = startIdx;
  inst.endIndex = endIdx;
  const items: VirtualItem[] = [];
  for (let i = startIdx; i <= endIdx; i++) {
    const key = keys[i];
    if (key === undefined) continue;
    const size = sizes.get(key) ?? options.estimateSize;
    const start = offsets[i] ?? 0;
    items.push({ key, index: i, start, end: start + size, size });
  }
  inst.virtualItems = items;
  inst._lastScroll = scroll;
  inst._lastViewport = inst.viewportSize;
}

function snapshot(inst: Internal): VirtualInstance {
  return {
    count: inst.options.count,
    scrollOffset: inst.scrollOffset,
    scrollDirection: inst.scrollDirection,
    isScrolling: inst.isScrolling,
    totalSize: inst.totalSize,
    viewportSize: inst.viewportSize,
    startIndex: inst.startIndex,
    endIndex: inst.endIndex,
    virtualItems: inst.virtualItems.map((v) => ({ ...v })),
    options: { ...inst.options },
  };
}

export class VirtualController extends BaseController<VirtualEvents> {
  readonly id: string;
  #instances: Record<string, Internal> = {};

  constructor(id?: string) {
    super();
    this.id = id ?? generateId("virtual");
  }

  private get frozen(): boolean {
    return this.lifecycle === LIFECYCLE_DESTROYED;
  }
  hasInstance(id: string): boolean {
    return id in this.#instances;
  }
  snapshotInstances(): Record<string, VirtualInstance> {
    const out: Record<string, VirtualInstance> = {};
    for (const k in this.#instances) out[k] = snapshot(this.#instances[k]);
    return out;
  }

  create(id: string, options: VirtualOptions = {}): void {
    if (this.frozen) return;
    const norm = normalize(options);
    const keys: VirtualKey[] = [];
    for (let i = 0; i < norm.count; i++) keys.push(norm.getItemKey(i));
    const inst: Internal = {
      options: norm,
      keys,
      sizes: new Map(),
      totalSize: 0,
      scrollOffset: 0,
      scrollDirection: "none",
      isScrolling: false,
      viewportSize: 0,
      startIndex: 0,
      endIndex: -1,
      virtualItems: [],
      scrollElement: null,
      scrollCleanup: null,
      offsets: null,
      _lastScroll: -1,
      _lastViewport: -1,
    };
    this.#instances[id] = inst;
    buildVirtualItems(inst);
    this.emit(EVENT_CHANGE, { id });
    this.emit("rangeChange", {
      id,
      startIndex: inst.startIndex,
      endIndex: inst.endIndex,
      virtualItems: inst.virtualItems,
    });
  }

  destroy(id?: string): void {
    if (id !== undefined) {
      if (this.frozen) return;
      const inst = this.#instances[id];
      if (!inst) return;
      inst.scrollCleanup?.();
      delete this.#instances[id];
      this.emit(EVENT_CHANGE, { id });
      return;
    }
    for (const k of Object.keys(this.#instances)) this.destroy(k);
    super.destroy();
  }

  destroyAll(): void {
    for (const k of Object.keys(this.#instances)) this.destroy(k);
  }

  bindScrollElement(id: string, element: HTMLElement | null): void {
    if (this.frozen) return;
    const inst = this.#instances[id];
    if (!inst) return;
    inst.scrollCleanup?.();
    inst.scrollCleanup = null;
    if (!element || typeof window === "undefined") {
      inst.scrollElement = null;
      this.emit(EVENT_CHANGE, { id });
      return;
    }
    const target: HTMLElement | Window = inst.options.scrollMode === "window" ? window : element;
    inst.scrollElement = target;
    const onScroll = () => {
      const offset = target === window ? window.scrollY : (target as HTMLElement).scrollTop;
      const dir: VirtualScrollDirection =
        offset > inst.scrollOffset ? "forward" : offset < inst.scrollOffset ? "backward" : "none";
      inst.scrollOffset = offset;
      inst.scrollDirection = dir;
      inst.isScrolling = true;
      buildVirtualItems(inst);
      this.emit("scroll", { id, scrollOffset: offset, scrollDirection: dir, isScrolling: true });
      this.emit(EVENT_CHANGE, { id });
      setTimeout(() => {
        inst.isScrolling = false;
        this.emit("scroll", { id, scrollOffset: offset, scrollDirection: dir, isScrolling: false });
      }, 150);
    };
    const el = target as HTMLElement & {
      addEventListener: (a: string, b: () => void) => void;
      removeEventListener: (a: string, b: () => void) => void;
    };
    if (target === window) window.addEventListener("scroll", onScroll, { passive: true });
    else
      el.addEventListener("scroll", onScroll, {
        passive: true,
      } as unknown as AddEventListenerOptions);
    inst.scrollCleanup = () => {
      if (target === window) window.removeEventListener("scroll", onScroll);
      else el.removeEventListener("scroll", onScroll);
    };
    inst.viewportSize = inst.options.horizontal
      ? element.clientWidth || 300
      : element.clientHeight || 300;
    buildVirtualItems(inst);
    this.emit(EVENT_CHANGE, { id });
  }

  setCount(id: string, count: number): void {
    if (this.frozen) return;
    const inst = this.#instances[id];
    if (!inst) return;
    inst.options = { ...inst.options, count };
    inst.keys = [];
    for (let i = 0; i < count; i++) inst.keys.push(inst.options.getItemKey(i));
    inst.offsets = null;
    buildVirtualItems(inst);
    this.emit(EVENT_CHANGE, { id });
  }

  setKeys(id: string, keys: readonly VirtualKey[]): void {
    if (this.frozen) return;
    const inst = this.#instances[id];
    if (!inst) return;
    invariant(
      keys.length === inst.options.count,
      ERR_VIRTUAL_SETKEYS_LENGTH(keys.length, inst.options.count)
    );
    inst.keys = [...keys];
    inst.offsets = null;
    buildVirtualItems(inst);
    this.emit(EVENT_CHANGE, { id });
  }

  measureItem(id: string, index: number, size: number): void {
    if (this.frozen) return;
    const inst = this.#instances[id];
    if (!inst) return;
    invariant(index >= 0 && index < inst.options.count, ERR_VIRTUAL_INDEX_RANGE(index));
    if (size <= 0) throw new RangeError(`measureItem size must be >0`);
    const key = inst.keys[index] ?? inst.options.getItemKey(index);
    if (inst.sizes.get(key) === size) return;
    inst.sizes.set(key, size);
    inst.offsets = null;
    buildVirtualItems(inst);
    this.emit(EVENT_CHANGE, { id });
  }

  scrollToIndex(id: string, index: number, options: VirtualScrollToIndexOptions = {}): void {
    if (this.frozen) return;
    const inst = this.#instances[id];
    if (!inst) return;
    const clamped = Math.max(0, Math.min(index, inst.options.count - 1));
    const offs = ensureOffsets(inst);
    let offset = offs[clamped] ?? inst.options.paddingStart;
    if (options.align === "center") offset -= inst.viewportSize / 2;
    else if (options.align === "end") {
      // `offset` is the item's TOP edge. Subtracting the viewport from it aligns
      // the top to the viewport's bottom edge, which leaves the entire row below
      // the fold — the demo's "Bottom" button scrolled the last row just out of
      // sight. Align the item's BOTTOM edge instead, gap included.
      const key = inst.keys[clamped];
      const size =
        (key === undefined
          ? inst.options.estimateSize
          : (inst.sizes.get(key) ?? inst.options.estimateSize)) + inst.options.gap;
      offset += size - inst.viewportSize;
    }
    const max = Math.max(0, inst.totalSize - inst.viewportSize);
    const next = Math.max(0, Math.min(offset, max));
    this.scrollToOffset(id, next, options);
  }

  scrollToOffset(
    id: string,
    offset: number,
    _options: Pick<VirtualScrollToIndexOptions, "behavior"> = {}
  ): void {
    if (this.frozen) return;
    const inst = this.#instances[id];
    if (!inst) return;
    const max = Math.max(0, inst.totalSize - inst.viewportSize);
    const next = Math.max(0, Math.min(offset, max));
    inst.scrollOffset = next;
    if (inst.scrollElement) {
      if (inst.scrollElement === window)
        window.scrollTo({
          top: inst.options.horizontal ? window.scrollX : next,
          left: inst.options.horizontal ? next : window.scrollX,
          behavior: _options.behavior ?? "auto",
        });
      else (inst.scrollElement as HTMLElement).scrollTop = next;
    }
    buildVirtualItems(inst);
    this.emit("scroll", { id, scrollOffset: next, scrollDirection: "none", isScrolling: false });
    this.emit(EVENT_CHANGE, { id });
  }

  getVirtualItems(id: string): readonly VirtualItem[] {
    return this.#instances[id]?.virtualItems ?? [];
  }
  getTotalSize(id: string): number {
    return this.#instances[id]?.totalSize ?? 0;
  }

  listProps(
    _id: string,
    options: { label?: string } = {}
  ): Record<string, string | boolean | undefined> {
    const inst = this.#instances[_id];
    return {
      role: "list",
      "aria-label": options.label,
      "aria-orientation": inst?.options.horizontal ? "horizontal" : "vertical",
    };
  }
  itemProps(id: string, index: number): Record<string, string | number | boolean | undefined> {
    const inst = this.#instances[id];
    const item = inst?.virtualItems.find((v) => v.index === index);
    if (!item)
      return { role: "listitem", "aria-setsize": inst?.options.count, "aria-posinset": index + 1 };
    return {
      role: "listitem",
      "aria-setsize": inst?.options.count,
      "aria-posinset": index + 1,
      "data-virtual-index": index,
      "data-virtual-start": item.start,
      "data-virtual-size": item.size,
    };
  }
  contentProps(id: string): Record<string, string | number | undefined> {
    return { "data-virtual-total-size": this.#instances[id]?.totalSize };
  }

  toStore(): import("./types").VirtualStore {
    return {
      // A fresh record, never the private registry: the plugin's sync writes
      // plain snapshots here, so aliasing the private map would destroy the
      // controller's internal instance state.
      instances: {} as VirtualStore["instances"],
      create: this.create.bind(this),
      destroy: this.destroy.bind(this),
      destroyAll: this.destroyAll.bind(this),
      bindScrollElement: this.bindScrollElement.bind(this),
      setCount: this.setCount.bind(this),
      setKeys: this.setKeys.bind(this),
      measureItem: this.measureItem.bind(this),
      scrollToIndex: this.scrollToIndex.bind(this),
      scrollToOffset: this.scrollToOffset.bind(this),
      getVirtualItems: this.getVirtualItems.bind(this),
      getTotalSize: this.getTotalSize.bind(this),
      listProps: this.listProps.bind(this),
      itemProps: this.itemProps.bind(this),
      contentProps: this.contentProps.bind(this),
    };
  }
}

export function createVirtualController(options: VirtualControllerOptions = {}): VirtualController {
  const controller = new VirtualController(options.id);
  controller.mount();
  return controller;
}
