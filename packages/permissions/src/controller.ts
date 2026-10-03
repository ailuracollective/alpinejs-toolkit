import { BaseController } from "@ailura/alpinejs-core/controller";
import { invariant } from "@ailura/alpinejs-core/invariant";

import type { PermissionsEvents } from "./events";
import type {
  PermissionAdapter,
  PermissionRegistry,
  PermissionSnapshot,
  PermissionWhenHandlers,
  PermissionsStore,
} from "./types";

const ERR_PERMISSIONS_DESTROYED = "Cannot register adapter after destroy()";
const ERR_PERMISSIONS_DUPLICATE = (name: string): string =>
  `Permission adapter "${name}" is already registered`;
const ERR_PERMISSION_NOT_REGISTERED = (name: string): string =>
  `Permission "${name}" is not registered`;

/** One registered capability and the state the registry tracks for it. */
interface PermissionEntry {
  adapter: PermissionAdapter;
  snapshot: PermissionSnapshot;
  unsubscribe: (() => void) | null;
}

/**
 * The disposer a refused watch hands back: an inert release.
 *
 * Two paths answer that way — a controller already destroyed, and an adapter
 * with no `subscribe` — and they mean the same thing, so they say it the same
 * way, once.
 */
const INERT_DISPOSER = (): void => {};

function createInitialSnapshot(
  availability: PermissionSnapshot["availability"],
  requiresUserGesture: boolean
): PermissionSnapshot {
  // `unknown` is the honest pre-query state: the capability is registered, and
  // nobody has asked the browser about it yet. `requiresUserGesture` comes
  // from the adapter rather than being assumed — a capability that needs no
  // gesture (a wake lock already held, say) must not report that it does, and
  // a template decides whether to demand a click from that flag.
  return {
    permission: "unknown",
    availability,
    requestState: "idle",
    canRequest: availability === "available",
    requiresUserGesture,
    error: null,
    result: null,
  };
}

export class PermissionsController extends BaseController<PermissionsEvents> {
  #entries = new Map<string, PermissionEntry>();

  #commit(
    entry: PermissionEntry,
    name: string,
    patch: Partial<PermissionSnapshot>
  ): PermissionSnapshot {
    const snapshot = { ...entry.snapshot, ...patch } as PermissionSnapshot;
    entry.snapshot = snapshot;
    this.emit("change", { name, snapshot });
    return snapshot;
  }

  register(adapter: PermissionAdapter): () => void {
    invariant(this.lifecycle !== "destroyed", ERR_PERMISSIONS_DESTROYED);
    invariant(!this.#entries.has(adapter.name), ERR_PERMISSIONS_DUPLICATE(adapter.name));
    const availability = adapter.getAvailability();
    const snapshot = createInitialSnapshot(availability, adapter.requiresUserGesture ?? true);
    this.#entries.set(adapter.name, { adapter, snapshot, unsubscribe: null });
    return () => {
      this.unregister(adapter.name);
    };
  }

  unregister(name: string): boolean {
    const entry = this.#entries.get(name);
    if (!entry) return false;
    entry.unsubscribe?.();
    this.#entries.delete(name);
    // The removal is announced on the existing `change` event, with no
    // snapshot: the permission is gone, so there is no state left to publish.
    // That is what makes the key disappear from `$store.permissions.registry`
    // immediately instead of lingering until some unrelated change happened to
    // re-run the projection. `register()` hands back this same method as its
    // disposer, so the disposer and the store's `unregister` cannot drift.
    this.emit("change", { name, snapshot: null });
    return true;
  }

  get(name: string): PermissionSnapshot | undefined {
    return this.#entries.get(name)?.snapshot;
  }

  /**
   * Is this permission granted right now?
   *
   * Deliberately not `canRequest`: that flag answers "can I ask", this one
   * answers "do I have it". A permission nobody queried yet sits at `unknown`
   * and an unregistered name has no state at all — both are false here, which
   * is what makes this safe to gate a feature behind.
   */
  can(name: string): boolean {
    return this.get(name)?.permission === "granted";
  }

  /**
   * Runs the one handler matching the permission's current state.
   *
   * Not reactive and not a watcher: it reads the state as it stands and
   * returns. An unregistered name has no state to dispatch on, so it runs
   * nothing — defaulting to `unknown` would report a permission that does not
   * exist as one whose state nobody has established.
   */
  when(name: string, handlers: PermissionWhenHandlers): void {
    const state = this.get(name)?.permission;
    if (state) handlers[state]?.();
  }

  /** Every named permission granted. An empty list is vacuously true. */
  all(names: readonly string[]): boolean {
    return names.every((n) => this.can(n));
  }

  /** At least one named permission granted. An empty list is false. */
  any(names: readonly string[]): boolean {
    return names.some((n) => this.can(n));
  }

  getRegistry(): PermissionRegistry {
    const out: Record<string, PermissionSnapshot> = {};
    for (const [k, v] of this.#entries) out[k] = v.snapshot;
    return out;
  }

  async query(name: string): Promise<PermissionSnapshot> {
    const entry = this.#entries.get(name);
    invariant(entry, ERR_PERMISSION_NOT_REGISTERED(name));
    const availability = entry.adapter.getAvailability();
    // Availability is re-read on every call rather than cached, because it is a
    // property of the environment, not of the permission: serving the page over
    // plain HTTP and a user granting access both change the answer without any
    // registry event to announce it. An unavailable capability resolves to
    // `denied` with the reason in `error` — never a thrown error, so a
    // template binding the snapshot shows the advice instead of failing.
    if (availability !== "available") {
      return this.#commit(entry, name, {
        availability,
        permission: "denied",
        requestState: "failed",
        error: new Error(`Permission "${name}" unavailable: ${availability}`),
        canRequest: false,
      });
    }
    try {
      const perm = await entry.adapter.query();
      return this.#commit(entry, name, {
        permission: perm,
        availability,
        requestState: "idle",
        error: null,
        canRequest: perm !== "denied",
      });
    } catch (e) {
      return this.#commit(entry, name, {
        permission: "unknown",
        requestState: "failed",
        error: e as Error,
        canRequest: false,
      });
    }
  }

  async request(name: string, options?: unknown): Promise<PermissionSnapshot> {
    const entry = this.#entries.get(name);
    invariant(entry, ERR_PERMISSION_NOT_REGISTERED(name));
    // A `requesting` snapshot is published before the adapter is called so a
    // template can disable the button. `canRequest: false` is the point of it:
    // the flag means "not right now", and the request in flight is the reason.
    this.#commit(entry, name, { requestState: "requesting", canRequest: false, error: null });
    try {
      const result = await entry.adapter.request(options);
      return this.#commit(entry, name, {
        permission: result.permission,
        requestState: "succeeded",
        result: result.result ?? null,
        error: result.error ?? null,
        canRequest: result.permission !== "denied",
      });
    } catch (e) {
      return this.#commit(entry, name, {
        permission: "denied",
        requestState: "failed",
        error: e as Error,
        canRequest: false,
      });
    }
  }

  refresh(name: string): Promise<PermissionSnapshot> {
    return this.query(name);
  }

  async watch(name: string): Promise<() => void> {
    // Destroyed phase: the cleanup stack is disposed, so `onCleanup` below would
    // be a silent no-op and the freshly opened subscription would never be
    // released. Refuse the watch instead of leaking it. The answer stays the
    // same inert disposer `watch()` hands out for an adapter that cannot
    // subscribe: calling it releases nothing and throws nothing.
    if (this.lifecycle === "destroyed") return INERT_DISPOSER;
    const entry = this.#entries.get(name);
    invariant(entry, ERR_PERMISSION_NOT_REGISTERED(name));
    if (entry.unsubscribe) return entry.unsubscribe;
    if (!entry.adapter.subscribe) return INERT_DISPOSER;
    const listener = (snap: PermissionSnapshot): void => {
      entry.snapshot = snap;
      this.emit("change", { name, snapshot: snap });
    };
    const unsub = await entry.adapter.subscribe(listener as never);
    const dispose = (): void => {
      unsub();
      if (entry.unsubscribe === dispose) entry.unsubscribe = null;
    };
    entry.unsubscribe = dispose;
    this.onCleanup(dispose);
    return dispose;
  }

  override destroy(): void {
    if (this.lifecycle === "destroyed") return;
    // One release mechanism, not two. `watch()` is the only place an adapter
    // `unsubscribe` is ever created and it registers `dispose` with
    // `onCleanup`, so `super.destroy()` draining the cleanup stack already
    // releases every live subscription exactly once. An extra `unsubscribe?.()`
    // loop here called the same `dispose` a second time — a teardown that
    // releases a browser permission listener twice is not a teardown.
    // Entries that were only registered and never watched hold
    // `unsubscribe === null`: nothing was subscribed, so there is nothing to
    // release, and clearing the map drops them.
    this.#entries.clear();
    super.destroy();
  }

  toStore(): Record<string, unknown> {
    return {
      get: (n: string) => this.get(n),
      // The same four reads, bound to this controller. Delegation, never a
      // second implementation: `can` is the one place the granted comparison
      // happens, and `all`/`any`/`when` are defined in terms of it.
      can: (n: string) => this.can(n),
      when: (n: string, h: PermissionWhenHandlers) => this.when(n, h),
      all: (ns: readonly string[]) => this.all(ns),
      any: (ns: readonly string[]) => this.any(ns),
      query: (n: string) => this.query(n),
      request: (n: string, o?: unknown) => this.request(n, o),
      refresh: (n: string) => this.refresh(n),
      watch: (n: string) => this.watch(n),
      register: (a: PermissionAdapter) => this.register(a),
      unregister: (n: string) => this.unregister(n),
      registry: {} as PermissionsStore["registry"] & Record<string, PermissionSnapshot>,
      destroy: () => this.destroy(),
    };
  }
}

export function createPermissionsController(): PermissionsController {
  return new PermissionsController();
}
