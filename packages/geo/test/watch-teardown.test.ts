// @vitest-environment happy-dom
/**
 * Host-owned teardown for the `geo` watch.
 *
 * The resource under test is the live `navigator.geolocation.watchPosition`
 * subscription, so the stub keeps a registry of active watch ids: `clearWatch`
 * removes one, and a delivered position only reaches the callbacks that are
 * still registered. That is how the browser behaves, and it is what makes
 * "the listener is really gone" observable rather than inferred from a flag.
 */
import { afterEach, beforeEach, describe, expect, test } from "vite-plus/test";

import { geoPlugin } from "../src/plugin";
import type { GeoStore } from "../src/types";

type PositionCallback = (position: GeolocationPosition) => void;

/** Watch ids the browser still has registered, in registration order. */
let activeWatches = new Map<number, PositionCallback>();
/** Every id handed to `clearWatch`, in call order. */
let clearedWatchIds: number[] = [];
let nextWatchId = 1;

function createPosition(latitude: number, longitude: number): GeolocationPosition {
  return {
    coords: {
      accuracy: 5,
      altitude: null,
      altitudeAccuracy: null,
      heading: null,
      latitude,
      longitude,
      speed: null,
    } as GeolocationPosition["coords"],
    timestamp: 1_700_000_000_000,
  } as GeolocationPosition;
}

function installGeolocationStub(): void {
  // `geolocation` is a getter-only accessor on happy-dom's navigator, so the
  // stub has to be defined rather than assigned.
  Object.defineProperty(navigator, "geolocation", {
    configurable: true,
    writable: true,
    value: {
      getCurrentPosition: (success: PositionCallback) => {
        success(createPosition(0, 0));
      },
      watchPosition: (success: PositionCallback) => {
        const id = nextWatchId;
        nextWatchId += 1;
        activeWatches.set(id, success);
        return id;
      },
      clearWatch: (id: number) => {
        clearedWatchIds.push(id);
        activeWatches.delete(id);
      },
    },
  });
}

/** Deliver a reading to every watch the browser still has registered. */
function deliverPosition(latitude: number, longitude: number): void {
  const position = createPosition(latitude, longitude);
  for (const callback of [...activeWatches.values()]) callback(position);
}

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

function mountPlugin(): GeoStore {
  const { alpine, stores } = createMockAlpine();
  geoPlugin({})(alpine);
  return stores.get("geo") as GeoStore;
}

beforeEach(() => {
  activeWatches = new Map();
  clearedWatchIds = [];
  nextWatchId = 1;
  installGeolocationStub();
});

afterEach(() => {
  Reflect.deleteProperty(navigator, "geolocation");
});

describe("geo store teardown", () => {
  // RED-first: pre-fix neither `GeoStore` nor the object the plugin registers
  // carried a `destroy` member, so the watch the plugin started could only be
  // released with `unwatch()`, and nothing released it for the host.
  test("destroy() releases the geolocation watch with clearWatch", () => {
    const store = mountPlugin();

    expect(store.watch()).toBe(true);
    expect(store.watching).toBe(true);
    expect(activeWatches.size).toBe(1);
    const watchId = [...activeWatches.keys()][0] ?? -1;

    // pre-fix: TypeError, `destroy` is not a function
    store.destroy();

    expect(clearedWatchIds).toEqual([watchId]);
    expect(activeWatches.size).toBe(0);
  });

  // RED-first: the assertion that was removed once and is back here. The plugin
  // store is a flat snapshot refreshed only by controller events, and
  // `destroy()` used to release the watch through the cleanup stack without
  // emitting `watchStop`, so the projection kept claiming `watching: true`
  // after the controller had stopped watching. The teardown must leave the
  // projection agreeing with the controller.
  test("destroy() leaves the store projection reporting watching: false", () => {
    const store = mountPlugin();

    store.watch();
    deliverPosition(51.5, -0.12);
    expect(store.watching).toBe(true);

    store.destroy();

    expect(store.watching).toBe(false);
  });

  // RED-first: this is the half that proves the listener is really gone — a
  // position arriving after destroy must reach nobody, so no projected member
  // can move.
  test("a position delivered after destroy changes no projected state", () => {
    const store = mountPlugin();
    store.watch();
    deliverPosition(51.5, -0.12);
    expect(store.latitude).toBe(51.5);
    expect(store.watching).toBe(true);

    // pre-fix: TypeError, `destroy` is not a function
    store.destroy();

    deliverPosition(-33.87, 151.21);

    expect(store.latitude).toBe(51.5);
    expect(store.longitude).toBe(-0.12);
    expect(store.timestamp).toBe(1_700_000_000_000);
    // The browser still holds no watch, and delivering a reading did not put
    // one back.
    expect(activeWatches.size).toBe(0);
  });

  // Guard: `BaseController.destroy()` starts with
  // `if (this.phase === LIFECYCLE_DESTROYED) return;`, and the cleanup pushed
  // by `watch()` nulls `#watchId` as it runs, so a repeated destroy neither
  // throws nor calls `clearWatch` a second time.
  test("a second destroy() is a no-op rather than a throw", () => {
    const store = mountPlugin();
    store.watch();

    store.destroy();
    // pre-fix: TypeError, `destroy` is not a function
    store.destroy();

    expect(clearedWatchIds).toHaveLength(1);
  });

  // Guard: `destroy()` with no running watch is harmless.
  test("destroy() without a watch is harmless", () => {
    const store = mountPlugin();

    // pre-fix: TypeError, `destroy` is not a function
    store.destroy();

    expect(clearedWatchIds).toEqual([]);
    expect(store.watching).toBe(false);
  });

  // Guard: `unwatch()` is unchanged by this task — still a public, independent
  // operation that stops the watch and returns whether one was running.
  test("unwatch() still stops the watch on its own", () => {
    const store = mountPlugin();
    store.watch();
    const watchId = [...activeWatches.keys()][0] ?? -1;

    expect(store.unwatch()).toBe(true);

    expect(clearedWatchIds).toEqual([watchId]);
    expect(store.watching).toBe(false);
    expect(store.unwatch()).toBe(false);
  });
});
