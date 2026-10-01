// @vitest-environment happy-dom
/**
 * The five booleans `GeoStore` declares — `hasPosition`, `isSupported`,
 * `isWatching`, `isLoading`, `hasError` — are read by templates
 * (`$store.geo.hasPosition`) and by the controller's own `toStore()` facade,
 * which computes them from the controller on every access. The plugin's
 * registered store is a flat snapshot, refreshed only by the controller events
 * the plugin subscribes to, so a flag that `sync` never writes stays frozen at
 * its registration-time value forever.
 *
 * Every assertion here is made against the store the plugin registered with
 * `guardStore`, not against a controller the test owns: that is the object
 * `$store.geo` resolves to at runtime, and the only way a projection gap is
 * observable. All five flags are asserted in each case so a future omission of
 * one of them is caught rather than inherited silently.
 *
 * The geolocation stub holds its callbacks instead of invoking them, so a test
 * decides exactly when a reading or a failure arrives. That keeps the sequence
 * deterministic without a sleep: every projection is observed synchronously
 * from the event that caused it.
 */
import { afterEach, beforeEach, describe, expect, test } from "vite-plus/test";

import { geoPlugin } from "../src/plugin";
import type { GeoStore } from "../src/types";

type SuccessCallback = (position: GeolocationPosition) => void;
type ErrorCallback = (error: GeolocationPositionError) => void;

let pendingSuccess: SuccessCallback | null = null;
let pendingError: ErrorCallback | null = null;
let watchSuccess: SuccessCallback | null = null;
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

function createGeolocationError(message: string, code: number): GeolocationPositionError {
  return {
    code,
    message,
    PERMISSION_DENIED: 1,
    POSITION_UNAVAILABLE: 2,
    TIMEOUT: 3,
  } as unknown as GeolocationPositionError;
}

function installGeolocationStub(): void {
  // `geolocation` is a getter-only accessor on happy-dom's navigator, so the
  // stub has to be defined rather than assigned.
  Object.defineProperty(navigator, "geolocation", {
    configurable: true,
    writable: true,
    value: {
      getCurrentPosition: (success: SuccessCallback, error?: ErrorCallback) => {
        pendingSuccess = success;
        pendingError = error ?? null;
      },
      watchPosition: (success: SuccessCallback) => {
        const id = nextWatchId;
        nextWatchId += 1;
        watchSuccess = success;
        return id;
      },
      clearWatch: (id: number) => {
        clearedWatchIds.push(id);
      },
    },
  });
}

function deliverPosition(latitude: number, longitude: number): void {
  if (!pendingSuccess) throw new Error("no getCurrentPosition call is pending");
  pendingSuccess(createPosition(latitude, longitude));
}

function deliverError(message: string, code: number): void {
  if (!pendingError) throw new Error("no getCurrentPosition error callback is pending");
  pendingError(createGeolocationError(message, code));
}

function deliverWatchPosition(latitude: number, longitude: number): void {
  if (!watchSuccess) throw new Error("no watchPosition call is active");
  watchSuccess(createPosition(latitude, longitude));
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

/** The five flags, as one assertion set, so a missing projection cannot hide. */
function expectFlags(
  store: GeoStore,
  expected: {
    hasPosition: boolean;
    isSupported: boolean;
    isWatching: boolean;
    isLoading: boolean;
    hasError: boolean;
  }
): void {
  expect({
    hasPosition: store.hasPosition,
    isSupported: store.isSupported,
    isWatching: store.isWatching,
    isLoading: store.isLoading,
    hasError: store.hasError,
  }).toEqual(expected);
}

beforeEach(() => {
  pendingSuccess = null;
  pendingError = null;
  watchSuccess = null;
  clearedWatchIds = [];
  nextWatchId = 1;
  installGeolocationStub();
});

afterEach(() => {
  Reflect.deleteProperty(navigator, "geolocation");
});

describe("geo store flag projection", () => {
  // RED-first: pre-fix `sync` wrote the twelve plain fields and none of the
  // five booleans, so a delivered fix left `store.hasPosition` at its
  // registration-time `false` while `store.latitude` was already correct.
  test("a delivered position makes the store report hasPosition", async () => {
    const store = mountPlugin();
    expectFlags(store, {
      hasPosition: false,
      isSupported: true,
      isWatching: false,
      isLoading: false,
      hasError: false,
    });

    const requested = store.request();
    deliverPosition(51.5, -0.12);
    await requested;

    // pre-fix: `hasPosition` stayed false, only `latitude`/`longitude` moved.
    expect(store.latitude).toBe(51.5);
    expect(store.longitude).toBe(-0.12);
    expectFlags(store, {
      hasPosition: true,
      isSupported: true,
      isWatching: false,
      isLoading: false,
      hasError: false,
    });
  });

  // RED-first: the error path is the mirror of the position path, and it
  // freezes the same way. `hasError` stayed `false` while `store.error` held
  // the message, so a template could not show a failure state at all.
  test("a denied fix makes the store report hasError", async () => {
    const store = mountPlugin();

    const requested = store.request();
    deliverError("User denied Geolocation", 1);
    await requested;

    expect(store.error).toBe("User denied Geolocation");
    expect(store.errorCode).toBe(1);
    // pre-fix: `hasError` stayed false.
    expectFlags(store, {
      hasPosition: false,
      isSupported: true,
      isWatching: false,
      isLoading: false,
      hasError: true,
    });
  });

  // RED-first: `watchStart`/`watchStop` are events `sync` already listened to,
  // but the flags they should refresh were never written, so `isWatching` was
  // frozen at `false` for the whole life of a watch.
  test("watch and unwatch move isWatching on the store", () => {
    const store = mountPlugin();

    expect(store.watch()).toBe(true);
    // pre-fix: `isWatching` stayed false while `watching` was already true.
    expect(store.watching).toBe(true);
    expectFlags(store, {
      hasPosition: false,
      isSupported: true,
      isWatching: true,
      isLoading: false,
      hasError: false,
    });

    deliverWatchPosition(-33.87, 151.21);
    expect(store.hasPosition).toBe(true);

    expect(store.unwatch()).toBe(true);
    expectFlags(store, {
      hasPosition: true,
      isSupported: true,
      isWatching: false,
      isLoading: false,
      hasError: false,
    });
    expect(clearedWatchIds).toHaveLength(1);
  });

  // RED-first: `isLoading` is only ever true between the start of `request()`
  // and its callback, and no event fires in that window, so the flag is
  // observable through a `watchStart` sync that happens to land inside it.
  // Pre-fix the store could not report the in-flight state at all.
  test("isLoading is projected while a request is in flight", async () => {
    const store = mountPlugin();

    const requested = store.request();
    // The request is pending: the controller holds `#loading === true` and no
    // position event has fired yet.
    store.watch();
    // pre-fix: `isLoading` stayed false.
    expect(store.isLoading).toBe(true);
    expectFlags(store, {
      hasPosition: false,
      isSupported: true,
      isWatching: true,
      isLoading: true,
      hasError: false,
    });

    deliverPosition(10, 20);
    await requested;

    expectFlags(store, {
      hasPosition: true,
      isSupported: true,
      isWatching: true,
      isLoading: false,
      hasError: false,
    });
  });

  // RED-first: `reset()` clears the coordinates and emits `update`, so it is
  // the one path that turns a projected `hasPosition: true` back to `false`.
  test("reset() clears hasPosition on the store", async () => {
    const store = mountPlugin();
    const requested = store.request();
    deliverPosition(51.5, -0.12);
    await requested;
    expect(store.hasPosition).toBe(true);

    store.reset();

    expect(store.latitude).toBeNull();
    // pre-fix: `hasPosition` stayed true after the coordinates were cleared.
    expectFlags(store, {
      hasPosition: false,
      isSupported: true,
      isWatching: false,
      isLoading: false,
      hasError: false,
    });
  });

  // RED-first: the unsupported path emits `error` from `request()`, so it is
  // the case where all five flags are decided at once: no support, no
  // position, and a live error.
  test("an unsupported browser reports isSupported: false and hasError: true", async () => {
    Reflect.deleteProperty(navigator, "geolocation");
    const store = mountPlugin();

    await expect(store.request()).resolves.toBe(false);

    expect(store.error).toBe("Geolocation is not supported");
    expectFlags(store, {
      hasPosition: false,
      isSupported: false,
      isWatching: false,
      isLoading: false,
      hasError: true,
    });
    // `watch()` stays guarded: no watch is started and none is left to release.
    expect(store.watch()).toBe(false);
  });
});
