import { BaseController } from "@ailura/alpinejs-core/controller";
import { invariant } from "@ailura/alpinejs-core/invariant";

import type { PermissionsEvents } from "./events";
import type {
  PermissionAdapter,
  PermissionRegistry,
  PermissionSnapshot,
  PermissionsStore,
} from "./types";

const ERR_PERMISSIONS_DESTROYED = "Cannot register adapter after destroy()";
const ERR_PERMISSIONS_DUPLICATE = (name: string): string =>
  `Permission adapter "${name}" is already registered`;
const ERR_PERMISSION_NOT_REGISTERED = (name: string): string =>
  `Permission "${name}" is not registered`;

function createInitialSnapshot(
  availability: PermissionSnapshot["availability"]
): PermissionSnapshot {
  // `unknown` + `requiresUserGesture: true` is the honest pre-query state: the
  // capability is registered, and nobody has asked the browser about it yet.
  return {
    permission: "unknown",
    availability,
    requestState: "idle",
    canRequest: availability === "available",
    requiresUserGesture: true,
    error: null,
    result: null,
  };
}

export class PermissionsController extends BaseController<PermissionsEvents> {
  #entries = new Map<
    string,
    { adapter: PermissionAdapter; snapshot: PermissionSnapshot; unsubscribe: (() => void) | null }
  >();

  register(adapter: PermissionAdapter): () => void {
    invariant(this.lifecycle !== "destroyed", ERR_PERMISSIONS_DESTROYED);
    invariant(!this.#entries.has(adapter.name), ERR_PERMISSIONS_DUPLICATE(adapter.name));
    const availability = adapter.getAvailability();
    const snapshot = createInitialSnapshot(availability);
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
    // No `change` event: nothing announces a removal, so a template bound to
    // `registry[name]` keeps the last snapshot until the next change syncs the
    // key away. `register()` hands back this same disposer, which is the
    // intended way out.
    return true;
  }

  get(name: string): PermissionSnapshot | undefined {
    return this.#entries.get(name)?.snapshot;
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
      const snap: PermissionSnapshot = {
        ...entry.snapshot,
        availability,
        permission: "denied",
        requestState: "failed",
        error: new Error(`Permission "${name}" unavailable: ${availability}`),
        canRequest: false,
      };
      entry.snapshot = snap;
      this.emit("change", { name, snapshot: snap });
      return snap;
    }
    try {
      const perm = await entry.adapter.query();
      const snap: PermissionSnapshot = {
        ...entry.snapshot,
        permission: perm,
        availability,
        requestState: "idle",
        error: null,
        canRequest: perm !== "denied",
      };
      entry.snapshot = snap;
      this.emit("change", { name, snapshot: snap });
      return snap;
    } catch (e) {
      const snap: PermissionSnapshot = {
        ...entry.snapshot,
        permission: "unknown",
        requestState: "failed",
        error: e as Error,
        canRequest: false,
      };
      entry.snapshot = snap;
      this.emit("change", { name, snapshot: snap });
      return snap;
    }
  }

  async request(name: string, options?: unknown): Promise<PermissionSnapshot> {
    const entry = this.#entries.get(name);
    invariant(entry, ERR_PERMISSION_NOT_REGISTERED(name));
    // A `requesting` snapshot is published before the adapter is called so a
    // template can disable the button. `canRequest: false` is the point of it:
    // the flag means "not right now", and the request in flight is the reason.
    const requesting: PermissionSnapshot = {
      ...entry.snapshot,
      requestState: "requesting",
      canRequest: false,
      error: null,
    };
    entry.snapshot = requesting;
    this.emit("change", { name, snapshot: requesting });
    try {
      const result = await entry.adapter.request(options);
      const snap: PermissionSnapshot = {
        ...entry.snapshot,
        permission: result.permission,
        requestState: "idle",
        result: result.result ?? null,
        error: result.error ?? null,
        canRequest: result.permission !== "denied",
      };
      entry.snapshot = snap;
      this.emit("change", { name, snapshot: snap });
      return snap;
    } catch (e) {
      const snap: PermissionSnapshot = {
        ...entry.snapshot,
        permission: "denied",
        requestState: "failed",
        error: e as Error,
        canRequest: false,
      };
      entry.snapshot = snap;
      this.emit("change", { name, snapshot: snap });
      return snap;
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
    if (this.lifecycle === "destroyed") return () => {};
    const entry = this.#entries.get(name);
    invariant(entry, ERR_PERMISSION_NOT_REGISTERED(name));
    if (entry.unsubscribe) return entry.unsubscribe;
    if (!entry.adapter.subscribe) return () => {};
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
      query: (n: string) => this.query(n),
      request: (n: string, o?: unknown) => this.request(n, o),
      refresh: (n: string) => this.refresh(n),
      watch: (n: string) => this.watch(n),
      register: (a: PermissionAdapter) => this.register(a),
      // A fresh record, never the private entries map: the plugin's sync writes
      // plain snapshots here, so aliasing #entries would expose the adapters
      // themselves. A stable field, not a getter: a per-read getter would hand
      // out a throwaway record that sync fills and discards, leaving
      // `$store.permissions.registry` permanently empty.
      registry: {} as PermissionsStore["registry"] & Record<string, PermissionSnapshot>,
      destroy: () => this.destroy(),
    };
  }
}

export function createPermissionsController(): PermissionsController {
  return new PermissionsController();
}
