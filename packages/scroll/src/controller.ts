import {
  EVENT_CHANGE,
  LIFECYCLE_DESTROYED,
  LIFECYCLE_IDLE,
  LIFECYCLE_MOUNTED,
} from "@ailura/alpinejs-core/constants";
import { BaseController } from "@ailura/alpinejs-core/controller";
import { safeDocument, safeMatchMedia, safeWindow } from "@ailura/alpinejs-core/env";
import { generateId } from "@ailura/alpinejs-core/ids";

import type { ScrollEvents } from "./events";
import type {
  ScrollChangeDetail,
  ScrollChangeSource,
  ScrollDirection,
  ScrollIntoViewOptions,
  ScrollOptions,
  ScrollSectionOptions,
  ScrollState,
} from "./types";

function emptyState(): ScrollState {
  return {
    x: 0,
    y: 0,
    direction: "none",
    atTop: true,
    atBottom: false,
    progress: 0,
    locked: false,
    lockCount: 0,
    activeSection: null,
    visibleSections: [],
  };
}

/**
 * Written to the root element while locked, so a consumer that reserves space
 * for a scrollbar elsewhere (a custom scroll container) can read the same
 * measurement the lock used instead of recomputing it and drifting.
 */
const CSS_GAP = "--ailura-scrollbar-gap";

function readMetrics(
  prevY: number
): Pick<ScrollState, "x" | "y" | "direction" | "atTop" | "atBottom" | "progress"> {
  const win = safeWindow();
  if (!win) return { x: 0, y: 0, direction: "none", atTop: true, atBottom: false, progress: 0 };
  const x = win.scrollX ?? win.pageXOffset ?? 0;
  const y = win.scrollY ?? win.pageYOffset ?? 0;
  const direction: ScrollDirection = y > prevY ? "down" : y < prevY ? "up" : "none";
  const doc = safeDocument();
  const max = doc ? Math.max(0, doc.documentElement.scrollHeight - win.innerHeight) : 0;
  const atTop = y <= 0;
  const atBottom = max > 0 ? y >= max - 1 : false;
  const progress = max > 0 ? Math.min(1, Math.max(0, y / max)) : 0;
  return { x, y, direction, atTop, atBottom, progress };
}

// Cached across controllers: a module-level singleton means one MediaQueryList
// for the page rather than one per plugin registration, and `matches` is read
// live on every call so the cache cannot go stale on a preference change.
let reducedMql: MediaQueryList | undefined;
const prefersReduced = () =>
  (reducedMql ??= safeMatchMedia("(prefers-reduced-motion: reduce)"))?.matches ?? false;

export class ScrollController extends BaseController<ScrollEvents> {
  readonly id: string;
  readonly #options: ScrollOptions;
  #state: ScrollState = emptyState();
  #prev: ScrollState = emptyState();
  #lockHandles: string[] = [];
  #sections = new Map<string, { element: Element; options?: ScrollSectionOptions }>();
  #observer: IntersectionObserver | null = null;
  #scrollHandler: (() => void) | null = null;

  constructor(options: ScrollOptions = {}) {
    super();
    this.id = options.id ?? generateId("scroll");
    this.#options = options;
  }

  get state(): ScrollState {
    return { ...this.#state, visibleSections: [...this.#state.visibleSections] };
  }

  get isLocked(): boolean {
    return this.#lockHandles.length > 0;
  }

  get lockHandles(): readonly string[] {
    return [...this.#lockHandles];
  }

  get activeSection(): string | null {
    return this.#state.activeSection;
  }

  get visibleSections(): readonly string[] {
    return this.#state.visibleSections;
  }

  override mount(): void {
    if (this.lifecycle !== LIFECYCLE_IDLE) return;
    super.mount();
    const win = safeWindow();
    if (win) {
      const onScroll = (): void => {
        const prev = { ...this.#state };
        const m = readMetrics(this.#state.y);
        this.#state.x = m.x;
        this.#state.y = m.y;
        this.#state.direction = m.direction;
        this.#state.atTop = m.atTop;
        this.#state.atBottom = m.atBottom;
        this.#state.progress = m.progress;
        this.#emit("user", prev);
        this.emit("scroll", { x: m.x, y: m.y, direction: m.direction, progress: m.progress });
        if (m.atTop && !prev.atTop) this.emit("reach", { edge: "top", y: m.y });
        if (m.atBottom && !prev.atBottom) this.emit("reach", { edge: "bottom", y: m.y });
      };
      // Direct listener, not rAF-batched: `passive` already keeps it off the
      // scroll-blocking path, and metrics are read once per event rather than
      // forcing layout twice through a separate scheduled read.
      win.addEventListener("scroll", onScroll, { passive: true });
      this.#scrollHandler = onScroll;
      this.onCleanup(() => win.removeEventListener("scroll", onScroll));
      // Initial snapshot, so a page that renders `$store.scroll.y` before the
      // first scroll event shows the real position rather than a frame of 0.
      const m = readMetrics(0);
      this.#state.x = m.x;
      this.#state.y = m.y;
      this.#state.direction = m.direction;
      this.#state.atTop = m.atTop;
      this.#state.atBottom = m.atBottom;
      this.#state.progress = m.progress;
    }
    this.#setupSections();
    // queueMicrotask is required: Alpine store registration via guardStore wraps the
    // store reactively after mount(); emitting synchronously would fire 'change'
    // before Alpine has the store identity, missing the initial reactive sync.
    queueMicrotask(() => {
      if (this.lifecycle === LIFECYCLE_DESTROYED) return;
      this.#emit("initialization", null);
    });
  }

  override destroy(): void {
    if (this.lifecycle === LIFECYCLE_DESTROYED) return;
    this.#observer?.disconnect();
    this.#observer = null;
    this.unlockAll();
    this.#sections.clear();
    super.destroy();
  }

  reset(): void {
    const prev = { ...this.#state };
    const snap = readMetrics(this.#state.y);
    Object.assign(this.#state, snap);
    this.unlockAll();
    this.#state.activeSection = null;
    this.#state.visibleSections = [];
    this.#emit("reset", prev);
  }

  lockWithHandle(reason = "lock"): string {
    const handle = generateId("lock");
    this.#lockHandles.push(handle);
    this.#applyLock();
    const prev = { ...this.#prev };
    this.#emit("lock", prev, reason);
    this.emit("lock", { locked: true, count: this.#lockHandles.length, reason, handle });
    return handle;
  }

  // compat alias
  lock(reason = "lock"): string {
    return this.lockWithHandle(reason);
  }

  unlock(handle: string): void {
    const idx = this.#lockHandles.indexOf(handle);
    if (idx === -1) return;
    const prev = { ...this.#state };
    this.#lockHandles.splice(idx, 1);
    this.#applyLock();
    this.#emit("lock", prev, handle);
    this.emit("lock", {
      locked: this.isLocked,
      count: this.#lockHandles.length,
      reason: handle,
      handle: null,
    });
  }

  unlockAll(): void {
    if (this.#lockHandles.length === 0) return;
    const prev = { ...this.#state };
    this.#lockHandles = [];
    this.#applyLock();
    this.#emit("lock", prev, "unlockAll");
    this.emit("lock", { locked: false, count: 0, reason: "unlockAll", handle: null });
  }

  /**
   * Watch an element as a named section.
   *
   * `options` is recorded but not consulted: the observer in `#setupSections`
   * hardcodes its `rootMargin` and always picks the first visible section, so
   * `mode` and `rootMargin` have no effect today. The lookup is document-wide
   * by attribute first, then by id, so an id that also names a DOM element
   * resolves to the section markup when one exists.
   */
  registerSection(id: string, options?: ScrollSectionOptions): void {
    const win = safeWindow();
    if (!win || !id) return;
    const el =
      win.document.querySelector(`[data-scroll-section="${id}"]`) ??
      win.document.getElementById(id);
    if (!el || !(el as Element).isConnected) return;
    this.#sections.set(id, { element: el as Element, options });
    if (this.lifecycle === LIFECYCLE_MOUNTED) this.#setupSections();
  }

  unregisterSection(id: string): void {
    const removed = this.#sections.delete(id);
    if (!removed) return;
    if (this.#state.activeSection === id) {
      const prev = this.#state.activeSection;
      const prevState = { ...this.#state };
      this.#state.activeSection = null;
      this.emit("section", { active: null, previous: prev, visible: this.#state.visibleSections });
      this.#emit("section", prevState);
    }
    if (this.lifecycle === LIFECYCLE_MOUNTED) this.#setupSections();
  }

  scrollIntoView(
    target: Element | { x: number; y: number },
    options?: ScrollIntoViewOptions
  ): void {
    const behavior = options?.behavior ?? this.#options.defaultBehavior ?? "smooth";
    if (typeof Element !== "undefined" && target instanceof Element) {
      const win = safeWindow();
      if (win && typeof target.scrollIntoView === "function") {
        const b =
          this.#options.respectReducedMotion !== false && prefersReduced() ? "instant" : behavior;
        target.scrollIntoView({ behavior: b as ScrollBehavior });
        if (options?.focus && typeof (target as HTMLElement).focus === "function")
          (target as HTMLElement).focus();
      }
      this.#emit("navigation", { ...this.#state }, "scrollIntoView");
      return;
    }
    const t = target as { x: number; y: number };
    this.#scrollTo(t.x ?? this.#state.x, t.y ?? this.#state.y, behavior);
  }

  by(delta: { x?: number; y?: number }, options?: ScrollIntoViewOptions): void {
    const win = safeWindow();
    if (!win) return;
    const nx = this.#state.x + (delta.x ?? 0);
    const ny = this.#state.y + (delta.y ?? 0);
    win.scrollBy({
      left: delta.x ?? 0,
      top: delta.y ?? 0,
      behavior: (options?.behavior ?? this.#options.defaultBehavior ?? "smooth") as ScrollBehavior,
    });
    const prev = { ...this.#state };
    const m = readMetrics(this.#state.y);
    Object.assign(this.#state, m, { x: nx, y: ny });
    this.#emit("user", prev);
  }

  toTop(options?: ScrollIntoViewOptions): void {
    this.#scrollTo(0, 0, options?.behavior);
  }

  toBottom(options?: ScrollIntoViewOptions): void {
    const win = safeWindow();
    const doc = safeDocument();
    if (!win || !doc) return;
    const max = doc.documentElement.scrollHeight - win.innerHeight;
    this.#scrollTo(0, Math.max(0, max), options?.behavior);
  }

  toElement(id: string, options?: ScrollIntoViewOptions): void {
    const entry = this.#sections.get(id);
    if (!entry) return;
    this.scrollIntoView(entry.element, options);
  }

  #scrollTo(x: number, y: number, behavior?: string): void {
    const win = safeWindow();
    if (!win) return;
    const b = (behavior ?? this.#options.defaultBehavior ?? "smooth") as ScrollBehavior;
    const finalB = this.#options.respectReducedMotion !== false && prefersReduced() ? "instant" : b;
    win.scrollTo({ left: x, top: y, behavior: finalB as ScrollBehavior });
    const prev = { ...this.#state };
    // update optimistic
    this.#state.x = x;
    this.#state.y = y;
    this.#emit("navigation", prev);
  }

  #applyLock(): void {
    const doc = safeDocument();
    const win = safeWindow();
    if (!doc || !win) {
      this.#state.locked = this.isLocked;
      this.#state.lockCount = this.#lockHandles.length;
      return;
    }
    const html = doc.documentElement;
    const body = doc.body;
    if (this.isLocked) {
      const sbw = win.innerWidth - html.clientWidth;
      html.style.setProperty(CSS_GAP, `${Math.max(0, sbw)}px`);
      body.style.overflow = "hidden";
      if (this.#options.reserveScrollbarGap !== false && sbw > 0) {
        const target =
          this.#options.target instanceof Element
            ? this.#options.target
            : typeof this.#options.target === "string"
              ? doc.querySelector(this.#options.target)
              : null;
        if (target instanceof HTMLElement) {
          target.style.paddingRight = `${sbw}px`;
        }
      }
    } else {
      html.style.removeProperty(CSS_GAP);
      body.style.removeProperty("overflow");
      if (this.#options.target) {
        const target =
          this.#options.target instanceof Element
            ? this.#options.target
            : typeof this.#options.target === "string"
              ? doc.querySelector(this.#options.target)
              : null;
        if (target instanceof HTMLElement) target.style.removeProperty("padding-right");
      }
    }
    this.#state.locked = this.isLocked;
    this.#state.lockCount = this.#lockHandles.length;
  }

  #setupSections(): void {
    this.#observer?.disconnect();
    this.#observer = null;
    if (this.#sections.size === 0) return;
    const win = safeWindow();
    if (!win || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(
      (entries) => {
        const visible: string[] = [];
        for (const e of entries) {
          if (e.isIntersecting) {
            for (const [id, v] of this.#sections) if (v.element === e.target) visible.push(id);
          }
        }
        const prevActive = this.#state.activeSection;
        const prevState = { ...this.#state };
        this.#state.visibleSections = visible;
        // First-visible wins. `visible` is built by iterating the sections map,
        // so it is in registration order — the oldest registered section that is
        // on screen becomes active, which is the behaviour a nav expects.
        this.#state.activeSection = visible[0] ?? null;
        if (prevActive !== this.#state.activeSection) {
          this.emit("section", {
            active: this.#state.activeSection,
            previous: prevActive,
            visible,
          });
          this.#emit("section", prevState);
        }
      },
      // A section counts as active while it occupies the top half of the
      // viewport, so a heading that has just scrolled past the midpoint has
      // already handed the nav over. Fixed, not read from `ScrollSectionOptions`.
      { rootMargin: "0px 0px -50% 0px", threshold: 0 }
    );
    for (const v of this.#sections.values()) observer.observe(v.element);
    this.#observer = observer;
    this.onCleanup(() => observer.disconnect());
  }

  /**
   * The one place `change` is emitted from, so every source lands with a
   * consistent `previous`.
   *
   * `previous` is passed by the caller when it already holds a copy; otherwise
   * the snapshot stashed by the last emit stands in, which is what the mount
   * path relies on. Callers must have already applied their mutation — the
   * stash is taken after the fact, so passing `this.#state` would make
   * `previous` identical to `state`.
   */
  #emit(source: ScrollChangeSource, previous: ScrollState | null, reason?: string): void {
    const prev = previous ?? this.#prev;
    this.#prev = { ...this.#state };
    const detail: ScrollChangeDetail = {
      state: { ...this.#state },
      previous: prev as ScrollState | null,
      source,
      ...(reason !== undefined ? { reason } : {}),
    };
    this.emit(EVENT_CHANGE, detail);
  }
}

export function createScrollController(options: ScrollOptions = {}): ScrollController {
  const c = new ScrollController(options);
  c.mount();
  return c;
}
