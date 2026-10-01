import { describe, expect, test } from "vite-plus/test";

import { PermissionsController } from "../src/controller";
import { permissionsPlugin } from "../src/plugin";
import type {
  NormalizedPermissionState,
  PermissionAdapter,
  PermissionSnapshot,
  PermissionsStore,
} from "../src/types";

function createMockAlpine() {
  const stores = new Map<string, unknown>();
  const magics = new Map<string, unknown>();
  const alpine = {
    store(name: string, value?: unknown) {
      if (value !== undefined) {
        stores.set(name, value);
        return;
      }
      return stores.get(name);
    },
    magic(name: string, callback: unknown) {
      magics.set(name, callback);
    },
  } as unknown as import("alpinejs").Alpine;
  return { alpine, stores, magics };
}

function createFakeAdapter(
  name: string,
  options: { granted?: NormalizedPermissionState; throwOnRequest?: boolean } = {}
): PermissionAdapter {
  const granted = options.granted ?? "granted";
  return {
    name,
    isSupported: () => true,
    getAvailability: () => "available",
    query: () => Promise.resolve(granted),
    request: () =>
      options.throwOnRequest === true
        ? Promise.reject(new Error("denied by user"))
        : Promise.resolve({ permission: granted, result: { ok: true } }),
  };
}

/** Mirrors the plugin's `sync()` projection against a given store record. */
function projectRegistry(store: PermissionsStore, controller: PermissionsController): void {
  const snap = controller.getRegistry();
  const registry = store.registry as Record<string, PermissionSnapshot>;
  for (const k in snap) registry[k] = snap[k];
  for (const k in registry) if (!(k in snap)) delete registry[k];
}

describe("permissions controller toStore() registry stability", () => {
  test("the registry record is one stable object, not a per-read getter", () => {
    const controller = new PermissionsController();
    controller.register(createFakeAdapter("camera"));
    const store = controller.toStore() as unknown as PermissionsStore;
    // RED assertion: two reads must return the very same record.
    expect(store.registry).toBe(store.registry);
  });

  test("a projection written through one read survives the next read", () => {
    const controller = new PermissionsController();
    controller.register(createFakeAdapter("camera"));
    const store = controller.toStore() as unknown as PermissionsStore;
    // RED assertion: pre-fix the getter builds a throwaway object per read,
    // so the filled record is discarded and this stays empty.
    projectRegistry(store, controller);
    expect(store.registry.camera).toBeDefined();
  });

  test("the projection is a copy, never the controller's private entry state", () => {
    const controller = new PermissionsController();
    controller.register(createFakeAdapter("camera"));
    const store = controller.toStore() as unknown as PermissionsStore;
    projectRegistry(store, controller);
    const entry = store.registry.camera as unknown as Record<string, unknown>;
    // The controller's #entries map holds the adapter next to the snapshot;
    // the projected record must only ever carry the snapshot.
    expect(entry).toBeDefined();
    expect("adapter" in entry).toBe(false);
  });

  test("a stale key is dropped from the stable record", () => {
    const controller = new PermissionsController();
    controller.register(createFakeAdapter("camera"));
    controller.register(createFakeAdapter("microphone"));
    const store = controller.toStore() as unknown as PermissionsStore;
    projectRegistry(store, controller);
    expect(store.registry.camera).toBeDefined();
    expect(store.registry.microphone).toBeDefined();
    const record = store.registry;
    controller.unregister("microphone");
    projectRegistry(store, controller);
    expect(store.registry).toBe(record);
    expect(store.registry.microphone).toBeUndefined();
    expect(store.registry.camera).toBeDefined();
  });
});

describe("permissions store teardown", () => {
  /** An adapter whose browser permission subscription can be observed. */
  function createSubscribableAdapter(unsubscribe: () => void, name = "camera"): PermissionAdapter {
    return {
      ...createFakeAdapter(name),
      subscribe: () => Promise.resolve(unsubscribe),
    };
  }

  // RED-first: pre-fix neither the store type nor the object `toStore()`
  // returns carried a `destroy` member, so the host-owned teardown was
  // unreachable from `$store.permissions` and the browser permission
  // subscription outlived the plugin.
  test("store.destroy() releases the permission subscription", async () => {
    let unsubscribeCalls = 0;
    const unsubscribe = (): void => {
      unsubscribeCalls += 1;
    };
    const { alpine, stores } = createMockAlpine();
    permissionsPlugin({ adapters: [createSubscribableAdapter(unsubscribe)] })(alpine);
    const store = stores.get("permissions") as PermissionsStore;

    await store.watch("camera");
    expect(unsubscribeCalls).toBe(0);

    // pre-fix: TypeError, `destroy` is not a function
    store.destroy();

    // The resource itself: the browser-side listener the adapter handed out.
    // Exactly once: pre-fix the release ran twice — once through the explicit
    // `unsubscribe?.()` loop in `destroy()` and once when `super.destroy()`
    // drained the cleanup stack that `watch()` had pushed onto — and a
    // teardown that calls the adapter's `unsubscribe` a second time is a
    // teardown that does not do what its name implies.
    expect(unsubscribeCalls).toBe(1);
  });

  // Guard: the explicit release loop in `destroy()` used to be the only path
  // for entries whose subscription was still open. The fix keeps a single
  // mechanism (the cleanup stack `watch()` pushes), so an entry that was only
  // registered and never watched must still be gone from the registry without
  // ever releasing something that was never subscribed, and the watched entry
  // next to it must be released exactly once.
  test("a registered-but-never-watched entry is dropped without a release, and its watched sibling is released once", async () => {
    let watchedUnsubscribes = 0;
    let neverWatchedUnsubscribes = 0;
    const { alpine, stores } = createMockAlpine();
    permissionsPlugin({
      adapters: [
        createSubscribableAdapter(() => {
          watchedUnsubscribes += 1;
        }),
        createSubscribableAdapter(() => {
          neverWatchedUnsubscribes += 1;
        }, "microphone"),
      ],
    })(alpine);
    const store = stores.get("permissions") as PermissionsStore;

    await store.watch("camera");
    expect(store.get("microphone")).toBeDefined();

    store.destroy();

    // Never watched -> never subscribed -> nothing to release, and nothing
    // pending keeps the entry alive either.
    expect(neverWatchedUnsubscribes).toBe(0);
    // Watched -> exactly one release.
    expect(watchedUnsubscribes).toBe(1);
    expect(store.get("camera")).toBeUndefined();
    expect(store.get("microphone")).toBeUndefined();
  });

  // RED-first: the controller answers `register` with an invariant once its
  // lifecycle is `destroyed` (packages/permissions/src/controller.ts:45), so a
  // destroyed controller provably stops responding rather than merely holding
  // an empty registry.
  test("a destroyed store no longer accepts registrations", () => {
    const { alpine, stores } = createMockAlpine();
    permissionsPlugin({ adapters: [createFakeAdapter("camera")] })(alpine);
    const store = stores.get("permissions") as PermissionsStore;

    // pre-fix: TypeError, `destroy` is not a function
    store.destroy();

    expect(() => store.register(createFakeAdapter("microphone"))).toThrow();
    expect(store.get("microphone")).toBeUndefined();
  });

  // RED-first: `watch()` had no destroyed-phase guard, so calling it after
  // `destroy()` opened a NEW adapter subscription and then tried to register
  // its teardown with `onCleanup` — but `CleanupStack.push` is a no-op once the
  // stack is disposed, so the subscription was opened and never released.
  test("watch() after destroy() opens no subscription and does not throw", async () => {
    let subscribeCalls = 0;
    let unsubscribeCalls = 0;
    const controller = new PermissionsController();
    controller.register({
      ...createFakeAdapter("camera"),
      subscribe: () => {
        subscribeCalls += 1;
        return Promise.resolve(() => {
          unsubscribeCalls += 1;
        });
      },
    });

    controller.destroy();

    // pre-fix: no throw, but a NEW adapter subscription is opened and its
    // disposer is pushed onto an already-disposed CleanupStack, which drops it.
    let disposer: (() => void) | undefined;
    expect(() => {
      void controller.watch("camera").then((d) => {
        disposer = d;
      });
    }).not.toThrow();
    await Promise.resolve();
    await Promise.resolve();

    expect(subscribeCalls).toBe(0);
    expect(unsubscribeCalls).toBe(0);
    // The destroyed-phase answer is the same inert disposer `watch()` already
    // hands out for an adapter that cannot subscribe: a no-op release.
    expect(typeof disposer).toBe("function");
    expect(() => disposer?.()).not.toThrow();
    expect(unsubscribeCalls).toBe(0);
  });

  // Guard: `BaseController.destroy()` starts with
  // `if (this.phase === LIFECYCLE_DESTROYED) return;` and
  // `PermissionsController.destroy()` re-checks `this.lifecycle` before
  // touching its entries, so a repeated destroy is a no-op and the adapter
  // subscription is not torn down a second time.
  test("a second store.destroy() is a no-op rather than a throw", async () => {
    let unsubscribeCalls = 0;
    const unsubscribe = (): void => {
      unsubscribeCalls += 1;
    };
    const { alpine, stores } = createMockAlpine();
    permissionsPlugin({ adapters: [createSubscribableAdapter(unsubscribe)] })(alpine);
    const store = stores.get("permissions") as PermissionsStore;
    await store.watch("camera");

    store.destroy();
    // Exactly one release, and it must already have happened on the first call.
    expect(unsubscribeCalls).toBe(1);
    // pre-fix: TypeError, `destroy` is not a function
    store.destroy();

    expect(unsubscribeCalls).toBe(1);
  });
});

describe("permissions plugin store projection", () => {
  test("the registered adapters are projected into the store registry", () => {
    const { alpine, stores } = createMockAlpine();
    permissionsPlugin({ adapters: [createFakeAdapter("camera")] })(alpine);
    const store = stores.get("permissions") as PermissionsStore;
    // RED assertion: pre-fix the registry getter returned a throwaway object,
    // so nothing registered at plugin time ever reached the store.
    expect(store.registry.camera).toBeDefined();
  });

  test("the store registry record is stable across reads", () => {
    const { alpine, stores } = createMockAlpine();
    permissionsPlugin({ adapters: [createFakeAdapter("camera")] })(alpine);
    const store = stores.get("permissions") as PermissionsStore;
    const record = store.registry;
    expect(store.registry).toBe(record);
    expect(record.camera).toBeDefined();
  });

  test("the store registry entry is a snapshot without internal adapter state", () => {
    const { alpine, stores } = createMockAlpine();
    permissionsPlugin({ adapters: [createFakeAdapter("camera")] })(alpine);
    const store = stores.get("permissions") as PermissionsStore;
    const entry = store.registry.camera as unknown as Record<string, unknown>;
    expect("adapter" in entry).toBe(false);
    expect(entry.availability).toBe("available");
  });

  test("a request refreshes the entry in place, without duplicating it", async () => {
    const { alpine, stores } = createMockAlpine();
    permissionsPlugin({ adapters: [createFakeAdapter("camera")] })(alpine);
    const store = stores.get("permissions") as PermissionsStore;
    const record = store.registry;
    expect(Object.keys(record)).toEqual(["camera"]);

    const snapshot = await store.request("camera");
    expect(snapshot.permission).toBe("granted");
    expect(snapshot.requestState).toBe("idle");
    // Same record, same single key, refreshed values.
    expect(store.registry).toBe(record);
    expect(Object.keys(record)).toEqual(["camera"]);
    expect(record.camera?.permission).toBe("granted");
    expect(record.camera?.canRequest).toBe(true);
  });

  test("a failed request still projects through the same record", async () => {
    const { alpine, stores } = createMockAlpine();
    permissionsPlugin({ adapters: [createFakeAdapter("camera", { throwOnRequest: true })] })(
      alpine
    );
    const store = stores.get("permissions") as PermissionsStore;
    const record = store.registry;
    const snapshot = await store.request("camera");
    expect(snapshot.requestState).toBe("failed");
    expect(store.registry).toBe(record);
    expect(record.camera?.requestState).toBe("failed");
  });
});
