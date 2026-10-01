import { safeWindow } from "@ailura/alpinejs-core/env";
import type { ToastDuration, ToastItem, ToastPosition, ToastStore } from "@ailura/alpinejs-toast";

import type { AlpineInstance } from "../types/alpine.js";

type DemoToastItem = ToastItem;
type DemoToastStore = ToastStore;
type DemoToastPosition = ToastPosition;

/** A toast with `duration: false` (or `0`) never auto-dismisses. */
function isPersistentDuration(duration: ToastDuration): boolean {
  return duration === false || duration === 0;
}

/** Demo toast plugin variants — this module only needs the typed `toast` store. */
type DemoAlpineStores = {
  toast: DemoToastStore;
};

type SwipeMeta = {
  out: boolean;
  direction: string | null;
};

export type ToastSonnerConfig = {
  richColors?: boolean;
};

type HeightEntry = {
  id: string;
  height: number;
  position: DemoToastPosition;
  stack: "timed" | "persistent";
};

type ToastSonnerData = {
  richColors: boolean;
  /**
   * Mirror of `$store.toast.items`. The store exposes `items` as a getter over
   * a plain array, so Alpine never sees a change; the renderer polls the store
   * and keeps its own reactive copy.
   */
  queue: DemoToastItem[];
  ticker: ReturnType<typeof setInterval> | null;
  expanded: Record<string, boolean>;
  heights: Record<string, number>;
  heightsList: HeightEntry[];
  mounted: Record<string, boolean>;
  offsetBeforeRemove: Record<string, number>;
  swipeMeta: Record<string, SwipeMeta>;
  swipingId: string | null;
  pointerStart: { x: number; y: number } | null;
  swipeDirection: "x" | "y" | null;
  readonly store: DemoToastStore;
  readonly visibleToasts: number;
  init(): void;
  destroy(): void;
  syncQueue(): void;
  itemsAt(position: DemoToastPosition): DemoToastItem[];
  yPosition(position: DemoToastPosition): string;
  xPosition(position: DemoToastPosition): string;
  setExpanded(position: DemoToastPosition, value: boolean): void;
  isExpanded(position: DemoToastPosition): boolean;
  activePositions(): DemoToastPosition[];
  timedToastsAt(position: DemoToastPosition): DemoToastItem[];
  stackAt(position: DemoToastPosition): DemoToastItem[];
  liveAt(position: DemoToastPosition): DemoToastItem[];
  frontHeight(position: DemoToastPosition): number;
  paintedHeight(toast: DemoToastItem, position: DemoToastPosition): number;
  isPersistentToast(toast: DemoToastItem): boolean;
  toastExpanded(toast: DemoToastItem, position: DemoToastPosition): boolean;
  toastFront(toast: DemoToastItem, position: DemoToastPosition): boolean;
  toastVisible(toast: DemoToastItem, position: DemoToastPosition): boolean;
  isPersistentToast(toast: DemoToastItem): boolean;
  toastStack(toast: DemoToastItem): "timed" | "persistent";
  swipeDirectionsFor(position: DemoToastPosition): string[];
  toastsAt(position: DemoToastPosition): DemoToastItem[];
  findToast(id: string): DemoToastItem | undefined;
  isToastRemoved(id: string): boolean;
  isFront(index: number | string): boolean;
  setHeight(toast: DemoToastItem, height: number): void;
  removeHeight(id: string): void;
  pruneToastState(id: string): void;
  timedToastStyle(
    toast: DemoToastItem,
    index: number | string,
    position: DemoToastPosition
  ): Record<string, string>;
  persistentToastStyle(toast: DemoToastItem, position: DemoToastPosition): Record<string, string>;
  stackOffset(toast: DemoToastItem, position: DemoToastPosition): number;
  toastStyle(toast: DemoToastItem, position: DemoToastPosition): Record<string, string>;
  hasAnyToasts(position: DemoToastPosition): boolean;
  toasterStyle(position: DemoToastPosition): Record<string, string>;
  measureToast(element: HTMLElement, toast: DemoToastItem, attempt?: number): void;
  markMounted(id: string): void;
  isMounted(toast: DemoToastItem): boolean;
  initToast(
    element: HTMLElement,
    toast: DemoToastItem,
    index: number,
    position: DemoToastPosition
  ): void;
  toastType(toast: DemoToastItem): string;
  showIcon(toast: DemoToastItem): boolean;
  isVisible(position: DemoToastPosition, index: number | string): boolean;
  getSwipeOut(toast: ToastItem): boolean;
  getSwipeDirection(toast: DemoToastItem): string | null;
  dismiss(id: string, options?: { swipe?: boolean; swipeDirection?: string }): void;
  runAction(toast: DemoToastItem): void;
  showAction(toast: DemoToastItem): boolean;
  startSwipe(event: PointerEvent, toast: DemoToastItem): void;
  moveSwipe(event: PointerEvent, toast: DemoToastItem, position: DemoToastPosition): void;
  endSwipe(event: PointerEvent, toast: DemoToastItem, position: DemoToastPosition): void;
};

type ToastSonnerComponent = ToastSonnerData & {
  $store: DemoAlpineStores;
  $watch<T>(getter: string | (() => T), callback: (value: T) => void): void;
};

function toastStoreFromAlpine($store: DemoAlpineStores): DemoToastStore {
  return $store.toast;
}

function swipeDeltaWithResistance(
  delta: number,
  allowedPositive: boolean,
  allowedNegative: boolean
): number {
  if ((delta > 0 && allowedPositive) || (delta < 0 && allowedNegative)) {
    return delta;
  }

  return delta * (1 / (1 + Math.abs(delta) / 20));
}

function resolvePrimarySwipeAxis(xDelta: number, yDelta: number): "x" | "y" {
  return Math.abs(xDelta) > Math.abs(yDelta) ? "x" : "y";
}

function computeMoveSwipeOffsets(
  swipeDirection: "x" | "y",
  xDelta: number,
  yDelta: number,
  allowed: string[]
): { swipeX: number; swipeY: number } {
  if (swipeDirection === "x") {
    return {
      swipeX: swipeDeltaWithResistance(xDelta, allowed.includes("right"), allowed.includes("left")),
      swipeY: 0,
    };
  }

  return {
    swipeX: 0,
    swipeY: swipeDeltaWithResistance(yDelta, allowed.includes("bottom"), allowed.includes("top")),
  };
}

function resolveSwipeDismissDirection(
  swipeDirection: "x" | "y" | null,
  xDelta: number,
  yDelta: number,
  threshold: number,
  allowed: string[]
): string | null {
  if (swipeDirection === "x" && Math.abs(xDelta) >= threshold) {
    const direction = xDelta > 0 ? "right" : "left";
    return allowed.includes(direction) ? direction : null;
  }

  if (swipeDirection === "y" && Math.abs(yDelta) >= threshold) {
    const direction = yDelta > 0 ? "bottom" : "top";
    return allowed.includes(direction) ? direction : null;
  }

  return null;
}

function applySwipeAmount(element: HTMLElement, swipeX: number, swipeY: number): void {
  element.style.setProperty("--swipe-amount-x", `${swipeX}px`);
  element.style.setProperty("--swipe-amount-y", `${swipeY}px`);
}

function resetSwipeAmount(element: HTMLElement): void {
  applySwipeAmount(element, 0, 0);
}

export function registerToastSonner(Alpine: AlpineInstance): void {
  Alpine.data("toastSonner", (config: ToastSonnerConfig = {}): ToastSonnerData => ({
    richColors: config.richColors ?? true,
    expanded: {} as Record<string, boolean>,
    heights: {} as Record<string, number>,
    heightsList: [] as HeightEntry[],
    mounted: {} as Record<string, boolean>,
    offsetBeforeRemove: {} as Record<string, number>,
    swipeMeta: {} as Record<string, SwipeMeta>,
    swipingId: null as string | null,
    ticker: null as ReturnType<typeof setInterval> | null,
    pointerStart: null as { x: number; y: number } | null,
    swipeDirection: null as "x" | "y" | null,

    queue: [] as DemoToastItem[],

    init(this: ToastSonnerComponent): void {
      this.syncQueue();
      this.ticker = setInterval(() => this.syncQueue(), 200);
    },

    destroy(): void {
      if (this.ticker) {
        clearInterval(this.ticker);
        this.ticker = null;
      }
    },

    /** Copy the store queue into local state and drop the layout of gone toasts. */
    syncQueue(this: ToastSonnerComponent): void {
      const next = [...toastStoreFromAlpine(this.$store).items];
      const ids = next.map((item) => item.id).join(",");
      if (ids === this.queue.map((item) => item.id).join(",")) {
        return;
      }

      this.queue = next;

      const activeIds = new Set(next.map((item) => item.id));
      for (const entry of this.heightsList) {
        if (!activeIds.has(entry.id)) {
          this.pruneToastState(entry.id);
        }
      }
    },

    itemsAt(this: ToastSonnerComponent, position: DemoToastPosition): DemoToastItem[] {
      return this.queue.filter((item) => item.position === position);
    },

    get store(): DemoToastStore {
      const { $store } = this as ToastSonnerComponent;
      return toastStoreFromAlpine($store);
    },

    get visibleToasts(): number {
      return this.store.maxVisible;
    },

    yPosition(position: DemoToastPosition): string {
      return position.split("-")[0] ?? "bottom";
    },

    xPosition(position: DemoToastPosition): string {
      return position.split("-")[1] ?? "right";
    },

    setExpanded(position: DemoToastPosition, value: boolean): void {
      this.expanded = { ...this.expanded, [position]: value };
    },

    isExpanded(position: DemoToastPosition): boolean {
      return Boolean(this.expanded[position]);
    },

    activePositions(): DemoToastPosition[] {
      return this.store.stackPositions.filter((position: DemoToastPosition) =>
        this.itemsAt(position).some((item: DemoToastItem) => !item.removed)
      );
    },

    /**
     * The timed subset of the render list, INCLUDING dismissed ones that are
     * still animating out.
     *
     * It used to drop removed toasts, which was fine when a dismissed toast also
     * left the DOM immediately. Now it does not: the store keeps a removed toast
     * for 300ms so it can animate, and that toast needs to hold its index for the
     * whole exit — otherwise `--toasts-before`, `--z-index` and the frozen offset
     * it slides out from all shift under it mid-animation.
     */
    timedToastsAt(position: DemoToastPosition): DemoToastItem[] {
      return this.itemsAt(position).filter(
        (item: DemoToastItem) => !isPersistentDuration(item.duration)
      );
    },

    /**
     * Every toast at a position, in arrival order. This is what the renderer
     * iterates, and it deliberately KEEPS dismissed toasts.
     *
     * The store holds a removed toast for 300ms before purging it, purely so it
     * can animate out. Filtering them out here threw that away: the toast left
     * the DOM the instant it was dismissed, so it vanished instead of sliding,
     * and no exit transition in the stylesheet could ever be seen.
     *
     * One list in arrival order is also what fixed the original stacking bug:
     * persistent (loading) and timed toasts used to be two sibling <ol>s in the
     * same flex column, so they never interleaved.
     */
    stackAt(position: DemoToastPosition): DemoToastItem[] {
      return this.itemsAt(position);
    },

    /** The same list minus the ones on their way out — what drives the layout. */
    liveAt(position: DemoToastPosition): DemoToastItem[] {
      return this.stackAt(position).filter((item: DemoToastItem) => !item.removed);
    },

    /** A loading toast has no duration, so it never auto-dismisses. */
    isPersistentToast(toast: DemoToastItem): boolean {
      return isPersistentDuration(toast.duration);
    },

    /**
     * A persistent toast stays expanded and always occupies the front; a timed
     * one follows the existing collapse rules by its index among the timed.
     */
    toastExpanded(toast: DemoToastItem, position: DemoToastPosition): boolean {
      return this.isPersistentToast(toast) ? true : this.isExpanded(position);
    },

    toastFront(toast: DemoToastItem, position: DemoToastPosition): boolean {
      if (this.isPersistentToast(toast)) return true;
      return this.isFront(this.timedToastsAt(position).indexOf(toast));
    },

    /**
     * A dismissed toast stays visible until it is gone.
     *
     * `data-visible="false"` sets `opacity: 0`, so marking a departing toast
     * invisible cancelled the exit in the same tick it was dismissed — the toast
     * faded from fully opaque to nothing without sliding, which reads as "no
     * animation". The `[data-removed="true"]` rules own the exit instead.
     */
    toastVisible(toast: DemoToastItem, position: DemoToastPosition): boolean {
      if (this.isPersistentToast(toast)) return true;
      if (this.isToastRemoved(toast.id)) return true;
      return this.isVisible(position, this.timedToastsAt(position).indexOf(toast));
    },

    toastStack(toast: DemoToastItem): "timed" | "persistent" {
      return this.isPersistentToast(toast) ? "persistent" : "timed";
    },

    swipeDirectionsFor(position: DemoToastPosition): string[] {
      const [y, x] = position.split("-");
      const directions: string[] = [];

      if (y === "top" || y === "bottom") {
        directions.push(y);
      }

      if (x === "left" || x === "right") {
        directions.push(x);
      }

      return directions;
    },

    toastsAt(position: DemoToastPosition): DemoToastItem[] {
      return this.itemsAt(position);
    },

    findToast(this: ToastSonnerComponent, id: string): DemoToastItem | undefined {
      return this.queue.find((item: DemoToastItem) => item.id === id);
    },

    isToastRemoved(id: string): boolean {
      return Boolean(this.findToast(id)?.removed);
    },

    isFront(index: number | string): boolean {
      return Number(index) === 0;
    },

    setHeight(toast: DemoToastItem, height: number): void {
      if (height <= 0) {
        return;
      }

      const stack = this.toastStack(toast);
      const existing = this.heightsList.find((entry: HeightEntry) => entry.id === toast.id);

      if (existing) {
        if (existing.height === height) {
          return;
        }

        this.heightsList = this.heightsList.map((entry: HeightEntry) =>
          entry.id === toast.id ? { ...entry, height, stack } : entry
        );
      } else {
        this.heightsList = [
          { id: toast.id, height, position: toast.position, stack },
          ...this.heightsList,
        ];
      }

      this.heights = { ...this.heights, [toast.id]: height };
    },

    removeHeight(id: string): void {
      if (!this.heightsList.some((entry: HeightEntry) => entry.id === id)) {
        return;
      }

      this.heightsList = this.heightsList.filter((entry: HeightEntry) => entry.id !== id);
      const nextHeights = { ...this.heights };
      delete nextHeights[id];
      this.heights = nextHeights;
    },

    pruneToastState(id: string): void {
      this.removeHeight(id);

      if (this.mounted[id]) {
        const nextMounted = { ...this.mounted };
        delete nextMounted[id];
        this.mounted = nextMounted;
      }

      if (this.offsetBeforeRemove[id] !== undefined) {
        const nextOffset = { ...this.offsetBeforeRemove };
        delete nextOffset[id];
        this.offsetBeforeRemove = nextOffset;
      }

      if (this.swipeMeta[id]) {
        const nextSwipe = { ...this.swipeMeta };
        delete nextSwipe[id];
        this.swipeMeta = nextSwipe;
      }
    },

    /**
     * The height of the toast at the front of a position, which is what every
     * collapsed toast behind it is painted at. 0 while nothing is measured yet.
     */
    frontHeight(position: DemoToastPosition): number {
      const live = this.liveAt(position);
      const front = live.find((item: DemoToastItem) => !isPersistentDuration(item.duration));
      const candidate = front ?? live[0];
      return candidate ? (this.heights[candidate.id] ?? 0) : 0;
    },

    /**
     * The height a toast is ACTUALLY painted at, which is what an offset has to
     * clear. One source of truth for both, because they cannot be allowed to
     * disagree: a sum of one thing positioning another is how toasts end up on
     * top of each other.
     *
     * Two cases make the painted height differ from the measured one:
     *
     * A collapsed toast that is not at the front is forced by the stylesheet to
     * `height: var(--front-toast-height)`. Summing its own measured height put
     * it a different distance from the front than the one it is drawn at, so a
     * two-line toast in a stack of one-liners shifted everything above it and the
     * stack overlapped.
     *
     * An unmeasured toast falls back to the front's height rather than to 0. The
     * old `heights[id] ?? 0` contributed only the 14px gap for it, which piled
     * every toast behind an unmeasured one on top of it — including loadings,
     * whose height never gets read if the element is measured while hidden.
     */
    paintedHeight(toast: DemoToastItem, position: DemoToastPosition): number {
      const measured = this.heights[toast.id] ?? 0;
      if (measured > 0) {
        return measured;
      }

      return this.frontHeight(position);
    },

    /**
     * How far up the stack a toast sits, in px, counted from the front.
     *
     * This counts *every* live toast that arrived before this one, loadings
     * included. Counting only the timed ones was correct while loadings lived in
     * their own <ol> with no offsets at all; fused into one list they share a
     * coordinate line, and a toast that ignored a loading ahead of it would land
     * on top of it.
     */
    stackOffset(toast: DemoToastItem, position: DemoToastPosition): number {
      let offset = 0;

      // A dismissed toast that is still animating out is skipped: it is on its
      // way off the stack, so it must not keep the ones behind it pushed down.
      // The departing toast itself does not come through here — its offset was
      // frozen in `offsetBeforeRemove` when `removed` flipped, so it slides out
      // from where it actually sat instead of jumping first.
      for (const item of this.liveAt(position)) {
        if (item.id === toast.id) break;

        // Not `paintedHeight` only for this one: a collapsed toast behind the
        // front is drawn at the front's height, so that is the space it occupies.
        const height =
          !isPersistentDuration(item.duration) &&
          !this.isExpanded(position) &&
          !this.isFront(this.timedToastsAt(position).indexOf(item))
            ? this.frontHeight(position)
            : this.paintedHeight(item, position);

        offset += height + 14;
      }

      return offset;
    },

    timedToastStyle(
      toast: DemoToastItem,
      index: number | string,
      position: DemoToastPosition
    ): Record<string, string> {
      const stack = this.timedToastsAt(position);
      const stackIndex = Number(index);
      const removed = this.isToastRemoved(toast.id);
      const offset = removed
        ? (this.offsetBeforeRemove[toast.id] ?? this.stackOffset(toast, position))
        : this.stackOffset(toast, position);

      return {
        "--index": String(stackIndex),
        "--toasts-before": String(stackIndex),
        "--z-index": String(stack.length - stackIndex),
        "--offset": `${offset}px`,
        "--initial-height": `${this.paintedHeight(toast, position)}px`,
        "--swipe-amount-x": "0px",
        "--swipe-amount-y": "0px",
      };
    },

    /**
     * A loading toast uses the same positioning model as the timed ones: it
     * stays absolutely placed at `--offset`, with `data-expanded="true"`
     * pinning its height. The only differences are that its offset has to clear
     * the toasts that arrived before it, and that it paints above them.
     */
    persistentToastStyle(
      toast: DemoToastItem,
      position: DemoToastPosition
    ): Record<string, string> {
      return {
        "--index": "0",
        "--toasts-before": "0",
        "--z-index": String(this.liveAt(position).length),
        "--offset": `${this.stackOffset(toast, position)}px`,
        "--initial-height": `${this.paintedHeight(toast, position)}px`,
        "--swipe-amount-x": "0px",
        "--swipe-amount-y": "0px",
      };
    },

    /**
     * One style for the unified stack. A loading toast keeps the persistent
     * treatment (in flow, no collapse offsets); a timed one keeps the offsets
     * the collapse rules read, indexed among the timed so the loading ones do not
     * push them around.
     */
    toastStyle(toast: DemoToastItem, position: DemoToastPosition): Record<string, string> {
      if (this.isPersistentToast(toast)) return this.persistentToastStyle(toast, position);
      return this.timedToastStyle(toast, this.timedToastsAt(position).indexOf(toast), position);
    },

    /**
     * Any live toast at a position, persistent or timed.
     *
     * Counts the live ones only: the renderer keeps a dismissed toast mounted for
     * its exit animation, and if this followed `stackAt` the <ol> would stay
     * `x-show`-visible holding nothing but a toast that is already leaving.
     */
    hasAnyToasts(position: DemoToastPosition): boolean {
      return this.liveAt(position).length > 0;
    },

    /**
     * The toaster height for the unified list: the front timed toast's height
     * drives `--front-toast-height`, and the min height accounts for every live
     * toast in arrival order.
     */
    toasterStyle(position: DemoToastPosition): Record<string, string> {
      // Live only. `timedToastsAt` now keeps dismissed toasts so they hold their
      // index while they leave; letting one of them be measured as the front
      // would size the toaster to a toast that is already on its way out. The
      // front itself is `frontHeight`'s business, which also knows what to fall
      // back to when nothing has been measured yet.
      const stack = this.liveAt(position);
      const frontHeight = this.frontHeight(position);
      let minHeight = frontHeight;

      if (this.isExpanded(position)) {
        minHeight = stack
          .slice(0, this.visibleToasts)
          .reduce((total: number, toast: DemoToastItem, index: number) => {
            return total + this.paintedHeight(toast, position) + (index > 0 ? 14 : 0);
          }, 0);
      }

      return {
        "--width": "356px",
        "--gap": "14px",
        "--front-toast-height": `${frontHeight}px`,
        minHeight: `${minHeight}px`,
      };
    },

    /**
     * Measure a toast's natural height by relaxing its inline height, reading the
     * box, then restoring it.
     *
     * A collapsed toast is painted at `--front-toast-height`, not at its natural
     * height, so the relaxation is what makes the number mean anything.
     *
     * A relaxed element can still have no box — a toast inside an `x-show`-hidden
     * <ol>, or one measured before its first layout — and `getBoundingClientRect`
     * then returns 0. `setHeight` drops a 0, and the ResizeObserver does not
     * necessarily fire afterwards, so that toast stayed unmeasured for the rest of
     * its life and contributed nothing but a gap to every offset behind it. A
     * bounded retry closes the hole while the element is still on screen.
     */
    measureToast(element: HTMLElement, toast: DemoToastItem, attempt = 0): void {
      const originalHeight = element.style.height;

      element.style.height = "auto";
      const height = Math.round(element.getBoundingClientRect().height);
      element.style.height = originalHeight;

      if (height <= 0 && attempt < 5) {
        const view = safeWindow();
        if (view?.requestAnimationFrame) {
          view.requestAnimationFrame(() => this.measureToast(element, toast, attempt + 1));
        }
        return;
      }

      this.setHeight(toast, height);
    },

    markMounted(id: string): void {
      if (this.mounted[id]) {
        return;
      }

      this.mounted = { ...this.mounted, [id]: true };
    },

    isMounted(toast: DemoToastItem): boolean {
      return Boolean(this.mounted[toast.id]);
    },

    initToast(
      this: ToastSonnerComponent,
      element: HTMLElement,
      toast: DemoToastItem,
      _index: number,
      _position: DemoToastPosition
    ): void {
      const id = toast.id;
      const measure = () => {
        const current = this.findToast(id) ?? toast;
        this.measureToast(element, current);
      };

      measure();

      const observer = new ResizeObserver(measure);
      observer.observe(element);

      this.$watch(
        () => this.findToast(id)?.removed,
        (removed: boolean | undefined) => {
          if (!removed) {
            return;
          }

          const current = this.findToast(id) ?? toast;
          this.offsetBeforeRemove = {
            ...this.offsetBeforeRemove,
            // Freezing the offset at removal is what lets the exit animation start
            // from where the toast actually sat. A loading was pinned at 0 here,
            // because it lived in its own <ol> and had no offset of its own; with
            // one list it does, so freezing a lie would make it slide to the front
            // as it left.
            [id]: this.stackOffset(current, current.position),
          };
        }
      );

      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          this.markMounted(toast.id);
          measure();
        });
      });
    },

    toastType(toast: DemoToastItem): string {
      if (toast.variant === "error") {
        return "error";
      }

      if (toast.variant === "loading") {
        return "loading";
      }

      return toast.variant ?? "default";
    },

    showIcon(toast: DemoToastItem): boolean {
      return ["success", "info", "warning", "error", "loading"].includes(toast.variant);
    },

    isVisible(position: DemoToastPosition, index: number | string): boolean {
      // `maxVisible` caps how many toasts a position shows at once.
      void position;
      return Number(index) < this.store.maxVisible;
    },

    getSwipeOut(toast: ToastItem): boolean {
      return Boolean(this.swipeMeta[toast.id]?.out);
    },

    getSwipeDirection(toast: DemoToastItem): string | null {
      return this.swipeMeta[toast.id]?.direction ?? null;
    },

    dismiss(id: string, options: { swipe?: boolean; swipeDirection?: string } = {}): void {
      if (options.swipe) {
        this.swipeMeta = {
          ...this.swipeMeta,
          [id]: { out: true, direction: options.swipeDirection ?? null },
        };
      }

      this.store.dismiss(id);
    },

    runAction(toast: DemoToastItem): void {
      const content = toast.content as { kind?: string } | null;

      if (content?.kind === "undo-demo") {
        window.undoToastDemo(toast.id);
        return;
      }

      toast.action?.onClick?.();
      this.dismiss(toast.id);
    },

    showAction(toast: DemoToastItem): boolean {
      if (!toast.action?.label) {
        return false;
      }

      const content = toast.content as { kind?: string } | null;
      if (content?.kind === "undo-demo" && toast.variant === "loading") {
        return false;
      }

      return true;
    },

    startSwipe(event: PointerEvent, toast: DemoToastItem): void {
      if (event.button === 2) {
        return;
      }

      const target = event.target as Element | null;

      if (target?.closest("[data-close-button],[data-button]")) {
        return;
      }

      this.swipingId = toast.id;
      this.swipeDirection = null;
      this.pointerStart = { x: event.clientX, y: event.clientY };
      (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
    },

    moveSwipe(event: PointerEvent, toast: DemoToastItem, position: DemoToastPosition): void {
      if (this.swipingId !== toast.id || !this.pointerStart) {
        return;
      }

      const allowed = this.swipeDirectionsFor(position);
      const xDelta = event.clientX - this.pointerStart.x;
      const yDelta = event.clientY - this.pointerStart.y;

      if (!this.swipeDirection && (Math.abs(xDelta) > 1 || Math.abs(yDelta) > 1)) {
        this.swipeDirection = resolvePrimarySwipeAxis(xDelta, yDelta);
      }

      if (!this.swipeDirection) {
        return;
      }

      const { swipeX, swipeY } = computeMoveSwipeOffsets(
        this.swipeDirection,
        xDelta,
        yDelta,
        allowed
      );

      applySwipeAmount(event.currentTarget as HTMLElement, swipeX, swipeY);
    },

    endSwipe(event: PointerEvent, toast: DemoToastItem, position: DemoToastPosition): void {
      if (this.swipingId !== toast.id) {
        return;
      }

      const allowed = this.swipeDirectionsFor(position);
      const xDelta = event.clientX - (this.pointerStart?.x ?? 0);
      const yDelta = event.clientY - (this.pointerStart?.y ?? 0);
      const element = event.currentTarget as HTMLElement;
      const dismissDirection = resolveSwipeDismissDirection(
        this.swipeDirection,
        xDelta,
        yDelta,
        45,
        allowed
      );

      if (dismissDirection) {
        this.dismiss(toast.id, { swipe: true, swipeDirection: dismissDirection });
      } else {
        resetSwipeAmount(element);
      }

      this.swipingId = null;
      this.pointerStart = null;
      this.swipeDirection = null;
    },
  }));
}
