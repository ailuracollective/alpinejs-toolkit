import { BaseController } from "@ailura/alpinejs-core/controller";
import { safeWindow } from "@ailura/alpinejs-core/env";
import { generateId } from "@ailura/alpinejs-core/ids";

import type { TooltipEvents } from "./events";
import type {
  TooltipControllerOptions,
  TooltipInstance,
  TooltipOptions,
  TooltipStore,
} from "./types";

function createInstance(options: TooltipOptions = {}): TooltipInstance {
  return {
    open: false,
    openDelay: options.openDelay ?? 0,
    closeDelay: options.closeDelay ?? 0,
    openTimer: null,
    closeTimer: null,
    // On by default: a tooltip stranded over a trigger that scrolled away has
    // no `mouseleave` coming, so the scroll has to be the cue.
    closeOnScrollAway: options.closeOnScrollAway !== false,
    onOpen: options.onOpen,
    onClose: options.onClose,
  };
}

function clearTimer(timer: ReturnType<typeof setTimeout> | null): void {
  if (timer) clearTimeout(timer);
}

/** A last-known pointer position, per instance. */
type Pointer = { x: number; y: number };

/** Everything one `bindTrigger` attached, so it can all be released again. */
type TriggerBinding = {
  el: HTMLElement;
  dispose: () => void;
};

export class TooltipController extends BaseController<TooltipEvents> {
  readonly id: string;
  #instances: Record<string, TooltipInstance> = {};
  #triggers: Record<string, TriggerBinding> = {};
  #pointers: Record<string, Pointer> = {};
  #scrollRelease: (() => void) | null = null;

  constructor(id?: string) {
    super();
    this.id = id ?? generateId("tooltip");
  }

  private get frozen(): boolean {
    return this.lifecycle === "destroyed";
  }

  /**
   * Is the last known pointer still within the trigger's box?
   *
   * `getBoundingClientRect` rather than `document.elementFromPoint`: the
   * rect is exact for "is the trigger under the pointer" and is immune to
   * whatever else happens to be painted on top — notably the tooltip itself,
   * which is teleported into a fixed portal and would otherwise swallow the
   * hit test while it is on screen.
   */
  #pointerStillOver(el: HTMLElement, p: Pointer): boolean {
    const r = el.getBoundingClientRect();
    return p.x >= r.left && p.x <= r.right && p.y >= r.top && p.y <= r.bottom;
  }

  /**
   * Close tooltips whose trigger scrolled out from under the pointer.
   *
   * Only ever closes. Scrolling back must not re-open: re-opening is a real
   * `mouseenter`'s job, and a scroll handler that could open would fire it
   * repeatedly for as long as the page moves.
   */
  #onScroll = (): void => {
    if (this.frozen) return;
    for (const id in this.#triggers) {
      const instance = this.#instances[id];
      // Not open, opted out, or opened without a pointer (keyboard focus) —
      // there is nothing to re-evaluate.
      //
      // `!instance?.open` is the load-bearing part of "only closes": the loop
      // never considers a closed tooltip, so no branch below can reopen one
      // however the geometry falls. Dropping that guard and letting the
      // in-bounds branch open fails three tests here.
      if (!instance?.open || !instance.closeOnScrollAway) continue;
      const pointer = this.#pointers[id];
      if (!pointer) continue;
      const { el } = this.#triggers[id] as TriggerBinding;
      if (!this.#pointerStillOver(el, pointer)) this.close(id);
    }
  };

  #ensureScrollWatch(): void {
    if (this.#scrollRelease) return;
    const win = safeWindow();
    if (!win) return;
    // `capture` so a scroll in any nested scroller counts, and `passive` so
    // this never shows up in a scroll-latency profile.
    win.addEventListener("scroll", this.#onScroll, { capture: true, passive: true });
    this.#scrollRelease = () =>
      win.removeEventListener("scroll", this.#onScroll, { capture: true });
  }

  #releaseScrollWatchIfIdle(): void {
    if (Object.keys(this.#triggers).length > 0) return;
    this.#scrollRelease?.();
    this.#scrollRelease = null;
  }

  /**
   * Attach the hover/focus behaviour to a trigger element, and start watching
   * for the trigger scrolling out from under a stationary pointer.
   *
   * Five listeners, and `mousemove` is the one that is easy to miss: it exists
   * only to keep the last known pointer position fresh for the scroll check.
   * A pair without it cannot tell that the element stopped being hovered,
   * because the browser dispatches no `mouseleave` when only the page moves.
   *
   * Creates the instance if none exists, and **replaces** any previous binding
   * for the same id — the first `unbindTrigger` is what makes that safe.
   */
  bindTrigger(id: string, el: HTMLElement): void {
    if (this.frozen) return;
    if (!this.#instances[id]) this.create(id);
    this.unbindTrigger(id);

    const onEnter = (e: MouseEvent): void => {
      this.#pointers[id] = { x: e.clientX, y: e.clientY };
      this.open(id);
    };
    const onMove = (e: MouseEvent): void => {
      this.#pointers[id] = { x: e.clientX, y: e.clientY };
    };
    const onLeave = (): void => {
      this.close(id);
    };
    const onFocus = (): void => {
      this.open(id);
    };
    const onBlur = (): void => {
      this.close(id);
    };

    el.addEventListener("mouseenter", onEnter);
    el.addEventListener("mousemove", onMove);
    el.addEventListener("mouseleave", onLeave);
    el.addEventListener("focus", onFocus);
    el.addEventListener("blur", onBlur);

    this.#triggers[id] = {
      el,
      dispose: () => {
        el.removeEventListener("mouseenter", onEnter);
        el.removeEventListener("mousemove", onMove);
        el.removeEventListener("mouseleave", onLeave);
        el.removeEventListener("focus", onFocus);
        el.removeEventListener("blur", onBlur);
      },
    };

    this.#ensureScrollWatch();
  }

  unbindTrigger(id: string): void {
    const binding = this.#triggers[id];
    if (!binding) return;
    binding.dispose();
    delete this.#triggers[id];
    delete this.#pointers[id];
    this.#releaseScrollWatchIfIdle();
  }

  hasInstance(id: string): boolean {
    return id in this.#instances;
  }

  snapshotInstances(): Record<string, TooltipInstance> {
    const out: Record<string, TooltipInstance> = {};
    for (const k in this.#instances) out[k] = { ...this.#instances[k] };
    return out;
  }

  /**
   * Create a tooltip, or replace the options of an existing one.
   *
   * Replacing rather than merging field by field: a second `create` on a live id
   * is what a component does when it re-evaluates its options, and an id that
   * kept its old delay would be a silently wrong tooltip.
   */
  create(id: string, options: TooltipOptions = {}): void {
    if (this.frozen) return;
    const existing = this.#instances[id];
    if (existing) {
      clearTimer(existing.openTimer);
      clearTimer(existing.closeTimer);
    }
    this.#instances[id] = createInstance(options);
    this.emit("change", { instanceId: id, open: false, source: "initialization" });
  }

  /** Destroy every tooltip, leaving the controller itself usable. */
  destroyAll(): void {
    if (this.frozen) return;
    for (const id of Object.keys(this.#instances)) this.#destroyInstance(id);
  }

  /**
   * Open after `openDelay` ms, cancelling any pending close first.
   *
   * The delay is a `setTimeout`, not a transition, and the controller never
   * inspects whether a trigger is still hovered when it fires — so a
   * `closeOnScrollAway: false` tooltip whose trigger scrolled away during its
   * open delay will still open, and stay. Call `close()` yourself from
   * `onOpen` if that matters.
   */
  open(id: string): void {
    if (this.frozen) return;
    const instance = (this.#instances[id] ??= createInstance());
    clearTimer(instance.closeTimer);
    instance.closeTimer = null;
    const openNow = (): void => {
      if (this.frozen || !this.#instances[id]) return;
      if (instance.open) return;
      instance.open = true;
      instance.onOpen?.();
      this.emit("change", { instanceId: id, open: true, source: "user" });
    };
    if (instance.openDelay > 0) {
      clearTimer(instance.openTimer);
      instance.openTimer = setTimeout(openNow, instance.openDelay);
      return;
    }
    openNow();
  }

  /** Close after `closeDelay` ms, cancelling any pending open first. */
  close(id: string): void {
    if (this.frozen) return;
    const instance = this.#instances[id];
    if (!instance) return;
    clearTimer(instance.openTimer);
    instance.openTimer = null;
    const closeNow = (): void => {
      if (this.frozen || !this.#instances[id]) return;
      if (!instance.open) return;
      instance.open = false;
      instance.onClose?.();
      this.emit("change", { instanceId: id, open: false, source: "user" });
    };
    if (instance.closeDelay > 0) {
      clearTimer(instance.closeTimer);
      instance.closeTimer = setTimeout(closeNow, instance.closeDelay);
      return;
    }
    closeNow();
  }

  toggle(id: string): void {
    if (this.isOpen(id)) this.close(id);
    else this.open(id);
  }

  isOpen(id: string): boolean {
    return this.#instances[id]?.open ?? false;
  }

  // Named for the handlers they replace. They carry no pointer position, so a
  // tooltip driven this way is never closed by a scroll — see `bindTrigger`.
  showOnHover(id: string): void {
    this.open(id);
  }

  hideOnHover(id: string): void {
    this.close(id);
  }

  showOnFocus(id: string): void {
    this.open(id);
  }

  hideOnFocus(id: string): void {
    this.close(id);
  }

  /** `Escape` dismisses. Nothing routes it for you — `x-tooltip` listens to no keys. */
  handleKeydown(id: string, event: KeyboardEvent): void {
    if (event.key === "Escape" && this.isOpen(id)) {
      event.preventDefault();
      this.close(id);
    }
  }

  /**
   * `destroy(id)` releases one tooltip; `destroy()` tears down the controller.
   *
   * The overload exists because `BaseController.destroy()` is the controller's
   * own teardown and cannot be renamed, and because the store exposes both: one
   * instance at a time (what the `x-tooltip` cleanup calls) and the whole thing
   * (what the host calls). Adding the parameter keeps `destroy()` with no
   * arguments meaning exactly what it meant on the base class.
   */
  override destroy(id?: string): void {
    if (this.frozen) return;
    if (id !== undefined) {
      this.#destroyInstance(id);
      return;
    }
    for (const triggerId in this.#triggers) this.unbindTrigger(triggerId);
    // Belt and braces: if a binding slipped through, the window listener goes
    // anyway. A leaked scroll handler would keep closing instances of a
    // destroyed controller for the life of the page.
    this.#scrollRelease?.();
    this.#scrollRelease = null;
    for (const instance of Object.values(this.#instances)) {
      clearTimer(instance.openTimer);
      clearTimer(instance.closeTimer);
    }
    for (const k in this.#instances) delete this.#instances[k];
    super.destroy();
  }

  /** Release one instance's listeners, timers and registry entry. */
  #destroyInstance(id: string): void {
    // Listeners first: a teardown that left a `mouseenter` attached would
    // re-open an instance that no longer exists.
    this.unbindTrigger(id);
    const instance = this.#instances[id];
    if (instance) {
      clearTimer(instance.openTimer);
      clearTimer(instance.closeTimer);
    }
    delete this.#instances[id];
    this.emit("change", { instanceId: id, open: false, source: "initialization" });
  }

  /**
   * The plain, non-reactive projection. Every arrow closes over `this`, so a
   * read inside an Alpine effect registers no dependency and the effect never
   * re-runs — `plugin.ts` replaces `isOpen` for exactly that reason.
   */
  toStore(): TooltipStore {
    return {
      // A fresh record, never the private registry: the plugin's sync writes
      // plain snapshots here, so aliasing the private map would destroy the
      // controller's internal instance state.
      instances: {} as TooltipStore["instances"],
      create: (id, opts) => this.create(id, opts),
      destroyAll: () => this.destroyAll(),
      open: (id) => this.open(id),
      close: (id) => this.close(id),
      toggle: (id) => this.toggle(id),
      isOpen: (id) => this.isOpen(id),
      bindTrigger: (id, el) => this.bindTrigger(id, el),
      unbindTrigger: (id) => this.unbindTrigger(id),
      showOnHover: (id) => this.showOnHover(id),
      hideOnHover: (id) => this.hideOnHover(id),
      showOnFocus: (id) => this.showOnFocus(id),
      hideOnFocus: (id) => this.hideOnFocus(id),
      handleKeydown: (id, e) => this.handleKeydown(id, e),
      // One key, both arities, and the argument is forwarded rather than
      // closed over. `TooltipStore` declares `destroy(id)` and `destroy()`, so
      // `destroy: () => this.destroy()` — which is what this used to be — would
      // make `store.destroy("x")` destroy the whole controller instead of one
      // instance: the id arrives, is dropped, and `destroy()` runs with no
      // argument. The overload does the opposite of what the name promises.
      // `destroy()` with no id already tears the whole controller down, so
      // forwarding an `undefined` id is not a bug — it is the documented
      // second arity. The parameter stays optional so this one arrow satisfies
      // both overloads of `TooltipStore.destroy`; typing it as a required `id`
      // left the zero-argument call the store promises unable to typecheck.
      destroy: (id?: string) => this.destroy(id),
    };
  }
}

/**
 * A mounted controller. Mounted here because every mutator is gated on
 * `lifecycle !== 'destroyed'`, so an unmounted controller would accept writes
 * the base class never authorised.
 */
export function createTooltipController(options: TooltipControllerOptions = {}): TooltipController {
  const controller = new TooltipController(options.id);
  controller.mount();
  return controller;
}
