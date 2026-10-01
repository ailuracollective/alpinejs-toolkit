import { BaseController } from "@ailura/alpinejs-core/controller";
import { generateId } from "@ailura/alpinejs-core/ids";
import { invariant } from "@ailura/alpinejs-core/invariant";
import { createPortalRoot, removePortalRoot } from "@ailura/alpinejs-ui";

import type { OverlayEvents } from "./events";

const ERR_OVERLAY_RECONFIGURE = (
  prevBase: number,
  nextBase: number,
  prevStep: number,
  nextStep: number
): string =>
  `Cannot re-configure overlay baseZIndex (${prevBase} -> ${nextBase}) or step (${prevStep} -> ${nextStep}) while the stack is non-empty.`;
const ERR_OVERLAY_DESTROYED = "Cannot claim a slot on destroyed overlay controller.";
const ERR_OVERLAY_PLUGIN_NAME = (plugin: string): string =>
  `Overlay requires non-empty plugin name. Got ${JSON.stringify(plugin)}`;
const ERR_OVERLAY_ID = (id: string): string =>
  `Overlay requires non-empty id. Got ${JSON.stringify(id)}`;
import type { OverlayOptions, OverlayStackEntry, OverlayState, OverlayStore } from "./types";

function normalizeOptions(options: OverlayOptions = {}): {
  baseZIndex: number;
  step: number;
  root: HTMLElement | string | null;
} {
  return {
    baseZIndex: options.baseZIndex ?? 1000,
    step: options.step ?? 10,
    root: options.root ?? null,
  };
}

/**
 * The slot map is keyed by a string, so a package's name and an id have to stay
 * separable: `dialog::d1` and a single id that happens to be `dialog::d1` are
 * the same key. `::` is the separator because neither half is expected to
 * contain it — nothing enforces that.
 */
function slotKey(plugin: string, id: string): string {
  return `${plugin}::${id}`;
}

export class OverlayController extends BaseController<OverlayEvents> {
  readonly id: string;
  #stack: OverlayStackEntry[] = [];
  #slots = new Map<string, number>();
  #baseZIndex: number;
  #step: number;
  #root: HTMLElement | null = null;
  /**
   * Whether `#root` is a node THIS controller created, as opposed to one it
   * adopted (a caller-supplied element, a `querySelector` hit, or a
   * `createPortalRoot` call that found the id already present). Only an owned
   * root is detached in `destroy()`: an adopted node belongs to whoever put it
   * in the document and may still be in use.
   */
  #ownsRoot = false;
  #rootSelector: HTMLElement | string | null;

  constructor(options: OverlayOptions = {}) {
    super();
    this.id = generateId("overlay");
    const norm = normalizeOptions(options);
    this.#baseZIndex = norm.baseZIndex;
    this.#step = norm.step;
    this.#rootSelector = norm.root;
    // A root given up front is resolved here; with no root the node is created
    // lazily on the first `claim()`. `createPortalRoot` returns null without a
    // document, so constructing on the server is safe and leaves `#root` null
    // until a client claims a slot.
    if (norm.root !== null) {
      this.#resolveRoot(norm.root);
    }
  }

  get state(): OverlayState {
    return {
      root: this.#root,
      stack: [...this.#stack],
      count: this.#stack.length,
      baseZIndex: this.#baseZIndex,
      step: this.#step,
    };
  }

  configure(options: OverlayOptions): void {
    if (this.lifecycle === "destroyed") return;
    const norm = normalizeOptions(options);
    if (this.#stack.length > 0) {
      // Re-basing a live stack would renumber the layers under the overlays that
      // already hold them, so a change to either number is refused outright. The
      // guard is a comparison, not a flag: passing the SAME baseZIndex and step
      // back with the stack non-empty is allowed, because nothing moves.
      invariant(
        this.#baseZIndex === norm.baseZIndex && this.#step === norm.step,
        ERR_OVERLAY_RECONFIGURE(this.#baseZIndex, norm.baseZIndex, this.#step, norm.step)
      );
      return;
    }
    this.#baseZIndex = norm.baseZIndex;
    this.#step = norm.step;
    this.#rootSelector = norm.root;
    // `null` root means "keep whatever is resolved": the condition re-resolves
    // only when a root was named, or when there is nothing to keep.
    if (norm.root !== null || !this.#root) {
      this.#resolveRoot(norm.root);
    }
  }

  claim(plugin: string, id: string): number {
    invariant(this.lifecycle !== "destroyed", ERR_OVERLAY_DESTROYED);
    assertNonEmpty(plugin, id);
    if (!this.#root && this.#rootSelector !== undefined) {
      this.#resolveRoot(this.#rootSelector);
    }
    // Still nothing: the selector did not match, or there never was one and there
    // is no document. Creating the default portal is the last resort, and it is
    // idempotent — a `#overlay-root` already in the body is adopted, not
    // duplicated.
    if (!this.#root) {
      this.#createOwnedRoot("overlay-root");
    }
    // Idempotent by slot key: a second claim for the same pair returns the
    // z-index already allocated rather than pushing a duplicate entry.
    const key = slotKey(plugin, id);
    const existing = this.#slots.get(key);
    if (existing !== undefined) return existing;
    // The z-index ladder is dense: it is derived from the position in the stack,
    // not stored and incremented. A released slot's layer is therefore reused by
    // whatever claims next, which is what keeps a long session from climbing into
    // the browser's maximum.
    const zIndex = this.#baseZIndex + this.#stack.length * this.#step;
    const entry: OverlayStackEntry = { plugin, id, zIndex, openedAt: Date.now() };
    this.#slots.set(key, zIndex);
    this.#stack.push(entry);
    this.emit("change", { action: "claim", stack: [...this.#stack], added: entry });
    return zIndex;
  }

  unregister(plugin: string, id: string): void {
    if (this.lifecycle === "destroyed") return;
    assertNonEmpty(plugin, id);
    const key = slotKey(plugin, id);
    const z = this.#slots.get(key);
    if (z === undefined) return;
    this.#slots.delete(key);
    const removed = this.#stack.find((e) => e.plugin === plugin && e.id === id);
    this.#stack = this.#stack.filter((e) => !(e.plugin === plugin && e.id === id));
    // Everything above the released entry drops one step, because the ladder is
    // positional. A z-index read before the release is therefore stale until it
    // is read again — bind `:style` to `zIndexOf()` rather than caching it.
    for (const [idx, entry] of this.#stack.entries()) {
      const k = slotKey(entry.plugin, entry.id);
      const newZ = this.#baseZIndex + idx * this.#step;
      this.#slots.set(k, newZ);
      (entry as { zIndex: number }).zIndex = newZ;
    }
    this.emit("change", { action: "unregister", stack: [...this.#stack], removed });
  }

  zIndexOf(plugin: string, id: string): number {
    if (this.lifecycle === "destroyed") return 0;
    // A pure read: it allocates nothing and never takes a slot, so it is safe to
    // call from a `:style` binding. An unclaimed pair reports the base, which is
    // the layer a first claim would get — claim it, or the number is a fiction.
    const key = slotKey(plugin, id);
    const existing = this.#slots.get(key);
    if (existing !== undefined) return existing;
    return this.#baseZIndex;
  }

  isOpen(plugin: string, id: string): boolean {
    if (this.lifecycle === "destroyed") return false;
    return this.#slots.has(slotKey(plugin, id));
  }

  override destroy(): void {
    if (this.lifecycle === "destroyed") return;
    this.#slots.clear();
    this.#stack.length = 0;
    // Only a node this controller created is ours to detach. An adopted root
    // stays in the document: the caller owns it.
    if (this.#ownsRoot && this.#root) {
      removePortalRoot(this.#root);
    }
    this.#ownsRoot = false;
    this.#root = null;
    // Emit before super.destroy(): the plugin's sync listener is only still
    // subscribed at this point, and the emitted stack is already empty, so the
    // store projection is refilled with the correct value.
    this.emit("change", { action: "destroy", stack: [] });
    super.destroy();
  }

  toStore(): OverlayStore {
    return {
      // Projection, not the private array: the plugin's `change` sync fills this
      // in place, so the store never observes controller internals directly.
      stack: [] as OverlayStore["stack"],
      root: this.#root,
      count: this.#stack.length,
      baseZIndex: this.#baseZIndex,
      step: this.#step,
      configure: (opts) => this.configure(opts),
      claim: (p, id) => this.claim(p, id),
      unregister: (p, id) => this.unregister(p, id),
      zIndexOf: (p, id) => this.zIndexOf(p, id),
      isOpen: (p, id) => this.isOpen(p, id),
      on: (event, listener) => this.on(event, listener),
      destroy: () => this.destroy(),
    };
  }

  #resolveRoot(root: HTMLElement | string | null): void {
    if (root instanceof HTMLElement) {
      this.#adoptRoot(root);
      return;
    }
    if (typeof root === "string") {
      if (typeof document !== "undefined") {
        const el = document.querySelector<HTMLElement>(root);
        if (el) {
          this.#adoptRoot(el);
          return;
        }
        // A selector that looks like an id gets a portal created for it, because
        // that is what a caller naming `#overlay-root` means. Any other selector
        // that matched nothing is a mistake, and falls through to `#clearRoot()`
        // rather than inventing a node for it.
        if (root.startsWith("#")) {
          this.#createOwnedRoot(root.slice(1));
          return;
        }
      }
      this.#clearRoot();
      return;
    }
    // `null` asks for the default portal. It is created here rather than in the
    // constructor so that constructing with no root stays DOM-free until someone
    // actually claims a slot.
    if (typeof document !== "undefined") {
      this.#createOwnedRoot("overlay-root");
    }
  }

  /** Points `#root` at a node somebody else put in the document. */
  #adoptRoot(root: HTMLElement): void {
    this.#root = root;
    this.#ownsRoot = false;
  }

  /** Drops the current root and the ownership claim with it. */
  #clearRoot(): void {
    this.#root = null;
    this.#ownsRoot = false;
  }

  /**
   * Resolves a portal root by id and records whether we are the ones who made
   * it. `createPortalRoot` is idempotent and reports no ownership, so the
   * decision is made here: a node already carrying the id existed before this
   * call and is adopted, and only a node this controller had already created
   * keeps the ownership flag across a re-resolve.
   */
  #createOwnedRoot(id: string): void {
    const previous = this.#root;
    const wasOwned = this.#ownsRoot;
    const preexisting = typeof document !== "undefined" ? document.getElementById(id) : null;
    this.#root = createPortalRoot({ id });
    this.#ownsRoot = !preexisting || (wasOwned && previous !== null && this.#root === previous);
  }
}

/**
 * A slot is addressed by a (package, id) pair, and an empty half would make
 * every such call share one key — so both are refused at the boundary rather
 * than silently colliding in the slot map.
 */
function assertNonEmpty(plugin: string, id: string): void {
  invariant(!!plugin && typeof plugin === "string", ERR_OVERLAY_PLUGIN_NAME(plugin));
  invariant(!!id && typeof id === "string", ERR_OVERLAY_ID(id));
}

/**
 * The controller is mounted here, unlike the plugin, which constructs it
 * directly: a standalone caller has no lifecycle hook of its own to mount from.
 * It makes no observable difference here — this controller wires nothing in
 * `setup()` — so both paths behave the same.
 */
export function createOverlayController(options: OverlayOptions = {}): OverlayController {
  const c = new OverlayController(options);
  c.mount();
  return c;
}
