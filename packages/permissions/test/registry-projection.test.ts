import { describe, expect, test } from "vite-plus/test";

import { PermissionsController } from "../src/controller";
import { permissionsPlugin } from "../src/plugin";
import type {
  NormalizedPermissionState,
  PermissionAdapter,
  PermissionAvailability,
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
  options: {
    granted?: NormalizedPermissionState;
    throwOnRequest?: boolean;
    requiresUserGesture?: boolean;
    availability?: PermissionAvailability;
  } = {}
): PermissionAdapter {
  const granted = options.granted ?? "granted";
  return {
    name,
    isSupported: () => true,
    getAvailability: () => options.availability ?? "available",
    query: () => Promise.resolve(granted),
    request: () =>
      options.throwOnRequest === true
        ? Promise.reject(new Error("denied by user"))
        : Promise.resolve({ permission: granted, result: { ok: true } }),
    // Spread, not assignment: `requiresUserGesture` is readonly on the
    // contract, and leaving it off entirely is what the default path needs.
    ...(options.requiresUserGesture === undefined
      ? {}
      : { requiresUserGesture: options.requiresUserGesture }),
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
    expect(snapshot.requestState).toBe("succeeded");
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

// RED-first, all four: the controller published `requestState: "idle"` on a
// successful request, hardcoded `requiresUserGesture: true`, and removed an
// adapter silently, leaving the key in `$store.permissions.registry`.
describe("a successful request reports the state the type already declares", () => {
  test('requestState is "succeeded", not a reset to "idle"', async () => {
    const controller = new PermissionsController();
    controller.register(createFakeAdapter("camera"));

    const snapshot = await controller.request("camera");

    // pre-fix: "idle" — the public `PermissionRequestState` had a "succeeded"
    // member that no code path could ever set.
    expect(snapshot.requestState).toBe("succeeded");
  });

  test("the succeeded snapshot keeps the adapter's own permission, result and canRequest", async () => {
    const controller = new PermissionsController();
    controller.register(createFakeAdapter("camera", { granted: "granted" }));

    const snapshot = await controller.request("camera");

    expect(snapshot.permission).toBe("granted");
    expect(snapshot.result).toEqual({ ok: true });
    expect(snapshot.error).toBeNull();
    expect(snapshot.canRequest).toBe(true);
  });

  test('a rejected request still reports "failed"', async () => {
    const controller = new PermissionsController();
    controller.register(createFakeAdapter("camera", { throwOnRequest: true }));

    const snapshot = await controller.request("camera");

    expect(snapshot.requestState).toBe("failed");
    expect(snapshot.permission).toBe("denied");
  });
});

describe("the initial snapshot carries the adapter's own gesture requirement", () => {
  test("an adapter declaring requiresUserGesture: false is reflected", () => {
    const controller = new PermissionsController();
    controller.register(createFakeAdapter("camera", { requiresUserGesture: false }));

    // pre-fix: hardcoded true, so the adapter's flag never reached the snapshot.
    expect(controller.get("camera")?.requiresUserGesture).toBe(false);
  });

  test("an adapter that omits it defaults to true", () => {
    const controller = new PermissionsController();
    controller.register(createFakeAdapter("camera"));

    expect(controller.get("camera")?.requiresUserGesture).toBe(true);
  });

  test("a later transition preserves the registered value", async () => {
    const controller = new PermissionsController();
    controller.register(createFakeAdapter("camera", { requiresUserGesture: false }));

    expect((await controller.query("camera")).requiresUserGesture).toBe(false);
    expect((await controller.request("camera")).requiresUserGesture).toBe(false);
  });
});

describe("unregister removes an adapter and announces it", () => {
  test("the adapter is gone from the controller registry", () => {
    const controller = new PermissionsController();
    controller.register(createFakeAdapter("camera"));

    expect(controller.unregister("camera")).toBe(true);

    expect(controller.get("camera")).toBeUndefined();
    expect(controller.getRegistry()).not.toHaveProperty("camera");
    // An unknown name is still a plain false, not a throw.
    expect(controller.unregister("camera")).toBe(false);
  });

  test("the removal is announced on the existing change event, with no snapshot", () => {
    const controller = new PermissionsController();
    controller.register(createFakeAdapter("camera"));
    const seen: { name: string; snapshot: PermissionSnapshot | null }[] = [];
    controller.on("change", (detail) => seen.push(detail));

    controller.unregister("camera");

    // pre-fix: zero events, so nothing told the store to drop the key.
    expect(seen).toHaveLength(1);
    expect(seen[0]?.name).toBe("camera");
    // Nothing is left to publish: the permission no longer exists.
    expect(seen[0]?.snapshot).toBeNull();
  });

  test("the store projection drops the key immediately, keeping the same record", () => {
    const { alpine, stores } = createMockAlpine();
    permissionsPlugin({
      adapters: [createFakeAdapter("camera"), createFakeAdapter("microphone")],
    })(alpine);
    const store = stores.get("permissions") as PermissionsStore;
    const record = store.registry;
    expect(Object.keys(record)).toEqual(["camera", "microphone"]);

    store.unregister("camera");

    // pre-fix: no change event fired, so `camera` stayed in the projection and
    // the stale key survived until some unrelated event happened to run the sync.
    expect(store.registry).toBe(record);
    expect(Object.keys(record)).toEqual(["microphone"]);
  });

  test("the store's unregister delegates to the controller", () => {
    const { alpine, stores } = createMockAlpine();
    permissionsPlugin({ adapters: [createFakeAdapter("camera")] })(alpine);
    const store = stores.get("permissions") as PermissionsStore;

    // pre-fix: TypeError, `unregister` is not on the store at all.
    expect(store.unregister("camera")).toBe(true);
    expect(store.get("camera")).toBeUndefined();
    expect(store.unregister("nope")).toBe(false);
  });

  test("the disposer register() hands back still removes the adapter", async () => {
    const { alpine, stores } = createMockAlpine();
    permissionsPlugin({ adapters: [createFakeAdapter("camera")] })(alpine);
    const store = stores.get("permissions") as PermissionsStore;
    const release = store.register(createFakeAdapter("microphone"));
    // `register()` still announces nothing — that behaviour is unchanged in
    // 0.2.0 — so one unrelated event is what puts `microphone` into the
    // reactive projection before the disposer has anything to remove.
    await store.query("camera");
    expect(store.registry.microphone).toBeDefined();

    release();

    // pre-fix: the disposer removed the entry but nothing synced the store, so
    // the stale snapshot stayed visible to every template binding.
    expect(store.get("microphone")).toBeUndefined();
    expect(store.registry.microphone).toBeUndefined();
  });

  test("unregistering a watched adapter releases its subscription", async () => {
    let unsubscribes = 0;
    const unsubscribe = (): void => {
      unsubscribes += 1;
    };
    const { alpine, stores } = createMockAlpine();
    permissionsPlugin({
      adapters: [
        {
          ...createFakeAdapter("camera"),
          subscribe: () => Promise.resolve(unsubscribe),
        },
      ],
    })(alpine);
    const store = stores.get("permissions") as PermissionsStore;
    await store.watch("camera");

    store.unregister("camera");

    expect(unsubscribes).toBe(1);
    expect(store.registry.camera).toBeUndefined();
  });
});

// RED-first: none of the four convenience reads existed. Each is a projection of
// the snapshot the controller already holds — none is a new permission model.
describe("can() answers whether a permission is granted", () => {
  test("a granted permission is true", async () => {
    const controller = new PermissionsController();
    controller.register(createFakeAdapter("camera", { granted: "granted" }));
    await controller.query("camera");

    expect(controller.can("camera")).toBe(true);
  });

  test("a denied permission is false", async () => {
    const controller = new PermissionsController();
    controller.register(createFakeAdapter("camera", { granted: "denied" }));
    await controller.query("camera");

    expect(controller.can("camera")).toBe(false);
  });

  test("a permission that was never queried is false", () => {
    const controller = new PermissionsController();
    controller.register(createFakeAdapter("camera"));

    // `unknown` is not granted. The brief is explicit that can() must never
    // mean canRequest, and a requestable-but-unasked permission is not granted.
    expect(controller.get("camera")?.canRequest).toBe(true);
    expect(controller.can("camera")).toBe(false);
  });

  test("an unregistered permission is false", () => {
    const controller = new PermissionsController();

    expect(controller.can("nope")).toBe(false);
  });

  test("an unavailable permission is false", async () => {
    const controller = new PermissionsController();
    controller.register(createFakeAdapter("camera", { availability: "insecure-context" }));
    await controller.query("camera");

    expect(controller.get("camera")?.availability).toBe("insecure-context");
    expect(controller.can("camera")).toBe(false);
  });
});

describe("when() dispatches on the current state only", () => {
  test("the granted handler runs for a granted permission", async () => {
    const controller = new PermissionsController();
    controller.register(createFakeAdapter("camera", { granted: "granted" }));
    await controller.query("camera");
    const calls: string[] = [];

    controller.when("camera", {
      granted: () => calls.push("granted"),
      denied: () => calls.push("denied"),
      unknown: () => calls.push("unknown"),
    });

    expect(calls).toEqual(["granted"]);
  });

  test("the denied handler runs for a denied permission", async () => {
    const controller = new PermissionsController();
    controller.register(createFakeAdapter("camera", { granted: "denied" }));
    await controller.query("camera");
    const calls: string[] = [];

    controller.when("camera", {
      granted: () => calls.push("granted"),
      denied: () => calls.push("denied"),
    });

    expect(calls).toEqual(["denied"]);
  });

  test("the unknown handler runs for a registered but unqueried permission", () => {
    const controller = new PermissionsController();
    controller.register(createFakeAdapter("camera"));
    const calls: string[] = [];

    controller.when("camera", {
      granted: () => calls.push("granted"),
      unknown: () => calls.push("unknown"),
    });

    expect(calls).toEqual(["unknown"]);
  });

  test("an unregistered permission runs nothing and does not throw", () => {
    const controller = new PermissionsController();
    const calls: string[] = [];

    expect(() =>
      controller.when("nope", {
        granted: () => calls.push("granted"),
        unknown: () => calls.push("unknown"),
      })
    ).not.toThrow();

    // There is no state to dispatch on, so no handler is the honest answer —
    // defaulting to `unknown` would report a permission that does not exist.
    expect(calls).toEqual([]);
  });

  test("a handler omitted for the current state is simply not called", async () => {
    const controller = new PermissionsController();
    controller.register(createFakeAdapter("camera", { granted: "granted" }));
    await controller.query("camera");

    expect(() => controller.when("camera", { denied: () => undefined })).not.toThrow();
  });
});

describe("all() and any() aggregate several permissions", () => {
  /** Both granted, one denied, one never registered. */
  function createMixedController(): PermissionsController {
    const controller = new PermissionsController();
    controller.register(createFakeAdapter("camera", { granted: "granted" }));
    controller.register(createFakeAdapter("microphone", { granted: "denied" }));
    return controller;
  }

  test("all() is true only when every requested permission is granted", async () => {
    const controller = new PermissionsController();
    controller.register(createFakeAdapter("camera", { granted: "granted" }));
    controller.register(createFakeAdapter("microphone", { granted: "granted" }));
    await controller.query("camera");
    await controller.query("microphone");

    expect(controller.all(["camera", "microphone"])).toBe(true);
  });

  test("all() is false when one of them is denied", async () => {
    const controller = createMixedController();
    await controller.query("camera");
    await controller.query("microphone");

    expect(controller.all(["camera", "microphone"])).toBe(false);
  });

  test("all() is false for an unknown permission", async () => {
    const controller = createMixedController();
    await controller.query("camera");

    expect(controller.all(["camera", "nope"])).toBe(false);
  });

  test("all([]) is vacuously true", () => {
    const controller = new PermissionsController();

    expect(controller.all([])).toBe(true);
  });

  test("any() is true when at least one is granted", async () => {
    const controller = createMixedController();
    await controller.query("camera");
    await controller.query("microphone");

    expect(controller.any(["camera", "microphone"])).toBe(true);
  });

  test("any() is false when all of them are denied", async () => {
    const controller = new PermissionsController();
    controller.register(createFakeAdapter("camera", { granted: "denied" }));
    await controller.query("camera");

    expect(controller.any(["camera"])).toBe(false);
  });

  test("any() is false when the only permission is unknown", () => {
    const controller = new PermissionsController();
    controller.register(createFakeAdapter("camera"));

    expect(controller.any(["camera", "nope"])).toBe(false);
  });

  test("any([]) is vacuously false", () => {
    const controller = new PermissionsController();

    expect(controller.any([])).toBe(false);
  });
});

describe("the convenience reads reach every public surface", () => {
  test("the store exposes all four and delegates to the controller", async () => {
    const { alpine, stores } = createMockAlpine();
    permissionsPlugin({
      adapters: [createFakeAdapter("camera", { granted: "granted" })],
    })(alpine);
    const store = stores.get("permissions") as PermissionsStore;
    await store.query("camera");

    // pre-fix: all four are undefined on the store.
    expect(store.can("camera")).toBe(true);
    expect(store.all(["camera"])).toBe(true);
    expect(store.any(["camera"])).toBe(true);
    expect(store.can("nope")).toBe(false);

    const calls: string[] = [];
    store.when("camera", { granted: () => calls.push("granted") });
    expect(calls).toEqual(["granted"]);
  });

  test("the magic resolves to the same surface", async () => {
    const { alpine, magics } = createMockAlpine();
    permissionsPlugin({
      adapters: [createFakeAdapter("camera", { granted: "granted" })],
    })(alpine);
    const magic = magics.get("permissions") as () => PermissionsStore;
    await magic().query("camera");

    // The magic hands back the store record, so `$permissions.can(...)` is the
    // same function as `$store.permissions.can(...)`.
    expect(magic().can("camera")).toBe(true);
    expect(typeof magic().when).toBe("function");
    expect(typeof magic().all).toBe("function");
    expect(typeof magic().any).toBe("function");
  });
});
