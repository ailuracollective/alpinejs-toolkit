import { EVENT_CHANGE, LIFECYCLE_DESTROYED } from "@ailura/alpinejs-core/constants";
import { BaseController } from "@ailura/alpinejs-core/controller";
import { generateId } from "@ailura/alpinejs-core/ids";
import { invariant } from "@ailura/alpinejs-core/invariant";

import type { CommandEvents } from "./events";

const ERR_COMMAND_DESTROYED = "Cannot register after destroy";
const ERR_COMMAND_DUPLICATE_ID = (id: string): string => `Duplicate command id "${id}"`;
import type {
  CommandControllerOptions,
  CommandExecutionState,
  CommandItem,
  CommandItemState,
  CommandPage,
  CommandStore,
  CommandStoreConfig,
} from "./types";

function isHidden(item: CommandItem): boolean {
  const v = item.hidden;
  return typeof v === "function" ? (v as () => boolean)() : !!v;
}
function isDisabled(item: CommandItem): boolean {
  if (isHidden(item)) return true;
  if (item.enabled !== undefined) {
    const v = item.enabled;
    const enabled = typeof v === "function" ? (v as () => boolean)() : !!v;
    return !enabled;
  }
  const v = item.disabled;
  return typeof v === "function" ? (v as () => boolean)() : !!v;
}

function defaultRank(item: CommandItem, search: string): number | null {
  if (!search) return 1;
  const s = search.toLowerCase();
  const label = item.label.toLowerCase();
  if (label.includes(s)) return 2;
  const kw = (item.keywords ?? []).some((k) => k.toLowerCase().includes(s));
  if (kw) return 1;
  return null;
}

export class CommandController extends BaseController<CommandEvents> {
  readonly id: string;
  #items: Record<string, CommandItem> = {};
  #pages: Record<string, CommandPage> = { root: { id: "root", title: "Commands" } };
  #pageStack: string[] = ["root"];
  #search = "";
  #activeIndex = 0;
  #visible = false;
  #executionState: CommandExecutionState = "idle";
  /** In-flight runs, in start order. Concurrent `run()` calls are allowed. */
  #runningIds = new Set<string>();
  #pinnedIds = new Set<string>();
  #recentIds: string[] = [];
  #config: CommandStoreConfig;
  private _vis: CommandItemState[] | null = null;
  private _visKey = "";

  constructor(id?: string, config: CommandStoreConfig = {}) {
    super();
    this.id = id ?? generateId("command");
    this.#config = config;
  }

  get search(): string {
    return this.#search;
  }
  set search(v: string) {
    if (this.#search !== v) {
      this.#search = v;
      this.#activeIndex = 0;
      this._vis = null;
      this.emit(EVENT_CHANGE, undefined);
    }
  }
  get activeIndex(): number {
    return this.#activeIndex;
  }
  set activeIndex(v: number) {
    this.#activeIndex = Math.max(0, v);
    this.emit(EVENT_CHANGE, undefined);
  }
  get visible(): boolean {
    return this.#visible;
  }
  get isOpen(): boolean {
    return this.#visible;
  }
  get executionState(): CommandExecutionState {
    return this.#executionState;
  }
  /** The most recently started run that is still in flight, or `null`. */
  get runningId(): string | null {
    const ids = [...this.#runningIds];
    return ids.length === 0 ? null : ids[ids.length - 1];
  }
  get currentPageId(): string {
    return this.#pageStack[this.#pageStack.length - 1] ?? "root";
  }
  get pageStack(): string[] {
    return [...this.#pageStack];
  }
  get items(): Readonly<Record<string, CommandItem>> {
    return { ...this.#items };
  }
  get pages(): Record<string, CommandPage> {
    return { ...this.#pages };
  }
  get loadingIds(): string[] {
    return [...this.#runningIds];
  }
  get pinnedIds(): string[] {
    return [...this.#pinnedIds];
  }
  get recentIds(): string[] {
    return [...this.#recentIds];
  }

  private _visCacheKey(): string {
    return `${this.currentPageId}\x00${this.#search}\x00${Object.keys(this.#items).length}\x00${this.#pinnedIds.size}\x00${this.#recentIds.length}\x00${[...this.#runningIds].join("\x00")}`;
  }
  get visibleItems(): CommandItemState[] {
    const k = this._visCacheKey();
    if (this._vis !== null && this._visKey === k) return this._vis;
    const pageId = this.currentPageId;
    const search = this.#search;
    const rankFn = this.#config.rank ?? defaultRank;
    const out: CommandItemState[] = [];
    for (const item of Object.values(this.#items)) {
      if ((item.page ?? "root") !== pageId) continue;
      const hidden = isHidden(item);
      if (hidden) continue;
      const disabled = isDisabled(item);
      const rank = rankFn(item, search);
      if (rank === null && search) continue;
      out.push({
        id: item.id,
        item,
        disabled,
        loading: this.#runningIds.has(item.id),
        pinned: this.#pinnedIds.has(item.id),
        recent: this.#recentIds.includes(item.id),
        rank: rank ?? 0,
        selectable: !disabled,
      });
    }
    out.sort((a, b) => b.rank - a.rank);
    this._vis = out;
    this._visKey = k;
    return out;
  }

  get filteredItems() {
    return this.visibleItems.map((v) => v.item);
  }
  get groupedItems(): Record<string, CommandItem[]> {
    const g: Record<string, CommandItem[]> = {};
    for (const v of this.visibleItems) {
      const key = v.item.group ?? "General";
      g[key] ??= [];
      g[key].push(v.item);
    }
    return g;
  }

  open(): void {
    if (this.lifecycle === LIFECYCLE_DESTROYED || this.#visible) return;
    this.#visible = true;
    this.#search = "";
    this.#activeIndex = 0;
    this._vis = null;
    this.#config.onOpen?.();
    this.emit("open", undefined);
    this.emit(EVENT_CHANGE, undefined);
  }
  close(): void {
    if (this.lifecycle === LIFECYCLE_DESTROYED || !this.#visible) return;
    this.#visible = false;
    this.#search = "";
    this.#activeIndex = 0;
    this.#pageStack = ["root"];
    this._vis = null;
    this.#config.onClose?.();
    this.emit("close", undefined);
    this.emit(EVENT_CHANGE, undefined);
  }
  toggle(): void {
    if (this.#visible) this.close();
    else this.open();
  }

  register(item: CommandItem): () => void {
    invariant(this.lifecycle !== LIFECYCLE_DESTROYED, ERR_COMMAND_DESTROYED);
    invariant(!this.#items[item.id], ERR_COMMAND_DUPLICATE_ID(item.id));
    this.#items[item.id] = item;
    if (item.pinned) this.#pinnedIds.add(item.id);
    this._vis = null;
    this.emit(EVENT_CHANGE, undefined);
    return () => this.unregister(item.id);
  }
  unregister(id: string): void {
    if (this.lifecycle === LIFECYCLE_DESTROYED) return;
    delete this.#items[id];
    this.#pinnedIds.delete(id);
    const idx = this.#recentIds.indexOf(id);
    if (idx !== -1) this.#recentIds.splice(idx, 1);
    this._vis = null;
    this.emit(EVENT_CHANGE, undefined);
  }

  async pushPage(page: CommandPage): Promise<void> {
    if (this.lifecycle === LIFECYCLE_DESTROYED) return;
    this.#pages[page.id] = page;
    this.#pageStack.push(page.id);
    this.#search = "";
    this.#activeIndex = 0;
    this._vis = null;
    if (page.load) await page.load();
    this.emit(EVENT_CHANGE, undefined);
  }
  popPage(): void {
    if (this.lifecycle === LIFECYCLE_DESTROYED || this.#pageStack.length <= 1) return;
    this.#pageStack.pop();
    this.#search = "";
    this.#activeIndex = 0;
    this._vis = null;
    this.emit(EVENT_CHANGE, undefined);
  }
  goBack(): void {
    this.popPage();
  }

  itemState(id: string): CommandItemState | null {
    return this.visibleItems.find((v) => v.id === id) ?? null;
  }

  inputProps(): Record<string, string | boolean | undefined> {
    const active = this.visibleItems[this.#activeIndex];
    return {
      role: "combobox",
      "aria-expanded": this.#visible,
      "aria-controls": "command-listbox",
      "aria-activedescendant": active ? `command-option-${active.id}` : undefined,
      "aria-autocomplete": "list",
    };
  }
  listboxProps(): Record<string, string | boolean | undefined> {
    return {
      role: "listbox",
      id: "command-listbox",
      "aria-label": this.#pages[this.currentPageId]?.title ?? "Commands",
    };
  }
  optionProps(id: string): Record<string, string | number | boolean | undefined> {
    const state = this.itemState(id);
    const idx = this.visibleItems.findIndex((v) => v.id === id);
    return {
      role: "option",
      id: `command-option-${id}`,
      "aria-selected": idx === this.#activeIndex,
      "aria-disabled": state?.disabled ?? false,
    };
  }

  cancelRun(): void {
    this.#runningIds.clear();
    this.#executionState = "idle";
    this.emit(EVENT_CHANGE, undefined);
  }

  async run(id: string): Promise<void> {
    if (this.lifecycle === LIFECYCLE_DESTROYED) return;
    const state = this.itemState(id);
    if (!state || state.disabled) return;
    this.#runningIds.add(id);
    this.#executionState = "running";
    this.emit(EVENT_CHANGE, undefined);
    try {
      await state.item.action();
      this.#config.onRun?.(state.item);
      this.emit("run", state.item);
      const max = this.#config.persistence?.maxRecent ?? 10;
      this.#recentIds = [id, ...this.#recentIds.filter((x) => x !== id)].slice(0, max);
      this._vis = null;
      if (this.#config.closeOnRun !== false) this.close();
    } finally {
      // Only this run's own id: a concurrent run's bookkeeping is untouched.
      this.#runningIds.delete(id);
      if (this.#runningIds.size === 0) this.#executionState = "idle";
      this.emit(EVENT_CHANGE, undefined);
    }
  }

  handleKeydown(event: KeyboardEvent): void {
    if (this.lifecycle === LIFECYCLE_DESTROYED || !this.#visible) return;
    const selectable = this.visibleItems.map((v) => v.selectable);
    if (event.key === "ArrowDown") {
      event.preventDefault();
      let idx = this.#activeIndex;
      for (const _attempt of selectable) {
        idx = (idx + 1) % selectable.length;
        if (selectable[idx]) {
          this.#activeIndex = idx;
          break;
        }
      }
      this.emit(EVENT_CHANGE, undefined);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      let idx = this.#activeIndex;
      for (const _attempt of selectable) {
        idx = (idx - 1 + selectable.length) % selectable.length;
        if (selectable[idx]) {
          this.#activeIndex = idx;
          break;
        }
      }
      this.emit(EVENT_CHANGE, undefined);
    } else if (event.key === "Enter") {
      const active = this.visibleItems[this.#activeIndex];
      if (active) {
        event.preventDefault();
        void this.run(active.id);
      }
    } else if (event.key === "Escape") {
      event.preventDefault();
      this.close();
    } else if (
      event.key === "Backspace" &&
      this.#pageStack.length > 1 &&
      this.#search.length === 0
    ) {
      event.preventDefault();
      this.popPage();
    }
  }

  toStore(): CommandStore {
    return this as unknown as CommandStore;
  }
}

export function createCommandController(options: CommandControllerOptions = {}): CommandController {
  const { id, ...config } = options;
  return new CommandController(id, config);
}
