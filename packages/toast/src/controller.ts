import { BaseController } from "@ailura/alpinejs-core/controller";
import { generateId } from "@ailura/alpinejs-core/ids";

import type { ToastEvents } from "./events";
import type {
  CreateToastOptions,
  ToastChangeSource,
  ToastItem,
  ToastOptions,
  ToastPosition,
  ToastStore,
} from "./types";

export class ToastController extends BaseController<ToastEvents> {
  readonly id: string;
  readonly defaultPosition: ToastPosition;
  readonly defaultDuration: number;
  readonly maxToasts: number;
  readonly maxVisible: number;
  readonly stackPositions: readonly ToastPosition[];

  #items: ToastItem[] = [];
  #timers = new Map<string, ReturnType<typeof setTimeout>>();

  constructor(options: CreateToastOptions = {}) {
    super();
    this.id = options.id ?? generateId("toast");
    this.defaultPosition = options.defaultPosition ?? "bottom-right";
    this.defaultDuration = options.defaultDuration ?? 4000;
    this.maxToasts = options.maxToasts ?? 5;
    this.maxVisible = options.maxVisible ?? this.maxToasts;
    this.stackPositions = [this.defaultPosition];
  }

  private get frozen(): boolean {
    return this.lifecycle === "destroyed";
  }

  get items(): ToastItem[] {
    return this.#items;
  }

  push(payload: ToastOptions = {}): string {
    if (this.frozen) return "";
    const id = generateId("toast");
    const item: ToastItem = {
      id,
      key: payload.key ?? null,
      content: payload.content ?? null,
      title: payload.title ?? null,
      description: payload.description ?? null,
      variant: payload.variant ?? "default",
      position: payload.position ?? this.defaultPosition,
      duration: payload.duration ?? this.defaultDuration,
      action: payload.action ?? null,
      removed: false,
    };
    this.#items = [item, ...this.#items];
    this.#enforceLimit(item.position);
    this.#scheduleDismiss(id, item.duration);
    this.#emit("push");
    return id;
  }

  pushUnique(key: string, payload: ToastOptions = {}): string {
    if (this.frozen) return "";
    const ids = this.#items.filter((i) => !i.removed && i.key === key).map((i) => i.id);
    this.#markRemoved(ids);
    return this.push({ ...payload, key });
  }

  update(id: string, payload: Partial<ToastOptions> = {}): void {
    if (this.frozen) return;
    const idx = this.#items.findIndex((i) => i.id === id);
    if (idx === -1) return;
    const current = this.#items.at(idx);
    if (!current) return;
    const next: ToastItem = {
      ...current,
      ...(payload.title !== undefined ? { title: payload.title } : {}),
      ...(payload.description !== undefined ? { description: payload.description } : {}),
      ...(payload.content !== undefined ? { content: payload.content } : {}),
      ...(payload.variant !== undefined ? { variant: payload.variant } : {}),
      ...(payload.position !== undefined ? { position: payload.position } : {}),
      ...(payload.duration !== undefined ? { duration: payload.duration } : {}),
      ...(payload.action !== undefined ? { action: payload.action } : {}),
      ...(payload.key !== undefined ? { key: payload.key } : {}),
    };
    this.#items = this.#items.map((i) => (i.id === id ? next : i));
    if (payload.duration !== undefined) this.#scheduleDismiss(id, next.duration);
    this.#emit("update");
  }

  dismiss(id: string): void {
    if (this.frozen) return;
    this.#markRemoved([id]);
    this.#emit("dismiss");
  }

  dismissAt(position: ToastPosition): void {
    if (this.frozen) return;
    const ids = this.#items.filter((i) => i.position === position && !i.removed).map((i) => i.id);
    this.#markRemoved(ids);
    this.#emit("dismissAt");
  }

  dismissAll(): void {
    if (this.frozen) return;
    const ids = this.#items.filter((i) => !i.removed).map((i) => i.id);
    this.#markRemoved(ids);
    this.#emit("dismissAll");
  }

  itemsAt(position: ToastPosition): ToastItem[] {
    return this.#items.filter((i) => i.position === position);
  }

  toStore(): ToastStore {
    return {
      // The controller owns a plain array with no reactive wrapper, so this
      // getter has no live list to hand a standalone consumer and reads empty.
      // The plugin overrides it with a getter over `controller.items`; outside
      // Alpine, read `controller.items` directly.
      get items(): ToastItem[] {
        return [];
      },
      defaultPosition: this.defaultPosition,
      stackPositions: this.stackPositions,
      maxToasts: this.maxToasts,
      maxVisible: this.maxVisible,
      push: (p: ToastOptions) => this.push(p),
      pushUnique: (k: string, p: ToastOptions) => this.pushUnique(k, p),
      update: (id: string, p: Partial<ToastOptions>) => this.update(id, p),
      dismiss: (id: string) => this.dismiss(id),
      dismissAt: (pos: ToastPosition) => this.dismissAt(pos),
      dismissAll: () => this.dismissAll(),
      itemsAt: (pos: ToastPosition) => this.itemsAt(pos),
      destroy: () => this.destroy(),
    } as unknown as ToastStore;
  }

  #emit(source: ToastChangeSource): void {
    this.emit("change", { source, items: this.#items });
  }

  #scheduleDismiss(id: string, duration: ToastOptions["duration"]): void {
    this.#clearTimer(id);
    if (duration === false || duration === 0 || duration === null || duration === undefined) return;
    const ms = typeof duration === "number" ? duration : this.defaultDuration;
    if (ms <= 0) return;
    const t = setTimeout(() => {
      this.#timers.delete(id);
      if (this.frozen) return;
      this.dismiss(id);
    }, ms);
    this.#timers.set(id, t);
  }

  #clearTimer(id: string): void {
    const t = this.#timers.get(id);
    if (t) {
      clearTimeout(t);
      this.#timers.delete(id);
    }
  }

  #markRemoved(ids: string[]): void {
    if (ids.length === 0) return;
    const set = new Set(ids);
    for (const id of ids) this.#clearTimer(id);
    this.#items = this.#items.map((i) => (set.has(i.id) ? { ...i, removed: true } : i));
    // A dismissed item stays in the list for 300 ms with `removed: true` so a
    // renderer can animate it out before it disappears. That window is a promise
    // to renderers, and it costs anyone who is not animating: `items`
    // over-counts for that long.
    setTimeout(() => {
      if (this.frozen) return;
      this.#items = this.#items.filter((i) => !set.has(i.id));
      this.#emit("dismiss");
    }, 300);
  }

  #enforceLimit(position: ToastPosition): void {
    if (this.maxToasts <= 0) return;
    const active = this.#items.filter((i) => i.position === position && !i.removed);
    if (active.length <= this.maxToasts) return;
    const overflow = active.slice(this.maxToasts).map((i) => i.id);
    this.#markRemoved(overflow);
  }

  override destroy(): void {
    if (this.lifecycle === "destroyed") return;
    for (const t of this.#timers.values()) clearTimeout(t);
    this.#timers.clear();
    super.destroy();
  }
}

export function createToastController(options?: CreateToastOptions): ToastController {
  return new ToastController(options);
}
