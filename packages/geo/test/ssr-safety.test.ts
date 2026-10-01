/**
 * SSR safety for the `geo` controller.
 *
 * This file deliberately runs in the default (node) environment: no
 * `// @vitest-environment happy-dom` pragma, so there is no `window`, no
 * `document` and no DOM at all. That is the environment the project's SSR
 * invariant talks about — "SSR is safe by default. No `window`/`document` at
 * import time" — and the one in which the geolocation capability flag used to
 * be computed with a bare `navigator` reference.
 *
 * Two shapes of "no geolocation" are covered, because they are different
 * environments, not the same one:
 *
 * 1. No `navigator` binding at all — a classic server render. Node 21+ ships a
 *    global `navigator`, so the absence is reproduced with
 *    `vi.stubGlobal("navigator", undefined)`: the identifier then resolves to
 *    `undefined` instead of throwing on lookup, which is exactly what the
 *    `typeof navigator` guard tests.
 * 2. A `navigator` with no `geolocation` — the real Node 24 global, and the
 *    same shape as a browser with geolocation turned off. The controller must
 *    read the optional property rather than assume it.
 *
 * The controller is constructed, not merely imported: a capability flag read in
 * the constructor is the thing that can throw before a single method is called.
 */
import { afterEach, describe, expect, test, vi } from "vite-plus/test";

import { createGeoController, GeoController } from "../src/controller";
import { geoPlugin } from "../src/plugin";

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
  return { alpine, stores };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("geo controller in a DOM-free environment", () => {
  // RED-first intent: pre-fix the constructor read `navigator.geolocation`
  // unguarded, so `new GeoController()` threw a `ReferenceError` here, before
  // any method was reached.
  test("constructing the controller without a navigator does not throw", () => {
    vi.stubGlobal("navigator", undefined);

    const controller = new GeoController();

    expect(controller.isSupported).toBe(false);
  });

  // Guard on the same construction path through the public factory, which is
  // what a non-plugin consumer (an SSR adapter, a direct user) calls.
  test("createGeoController() does not throw without a navigator", () => {
    vi.stubGlobal("navigator", undefined);

    expect(() => createGeoController({ id: "geo-ssr" })).not.toThrow();
  });

  // RED-first intent: `request()` is the unguarded sibling of `watch()`. The
  // fix is a guard identical to `watch()`'s, and the guard has to reject
  // BEFORE the state reset `request()` otherwise performs — a rejected request
  // must not announce itself as loading, and must not clear an error a previous
  // call recorded. It also has to report the unsupported condition the way
  // `watch()` reports failure: a `false` result plus a recorded error, not a
  // throw.
  test("request() resolves false instead of throwing when geolocation is absent", async () => {
    vi.stubGlobal("navigator", undefined);
    const controller = new GeoController();
    const positions: unknown[] = [];
    const errors: Array<{ message: string; code: number | null }> = [];
    controller.on("position", (detail) => positions.push(detail));
    controller.on("error", (detail) => errors.push({ message: detail.message, code: detail.code }));

    await expect(controller.request()).resolves.toBe(false);

    expect(positions).toEqual([]);
    expect(errors).toEqual([{ message: "Geolocation is not supported", code: 0 }]);
    // The guard rejects before the reset: a rejected request never claims to be
    // loading.
    expect(controller.loading).toBe(false);
    expect(controller.hasError).toBe(true);
  });

  // Same shape through the store surface a template would use.
  test("the registered store's request() resolves false in a DOM-free environment", async () => {
    vi.stubGlobal("navigator", undefined);
    const { alpine, stores } = createMockAlpine();
    geoPlugin({})(alpine);
    const store = stores.get("geo") as {
      request: () => Promise<boolean>;
      watch: () => boolean;
      isSupported: boolean;
    };

    expect(store.isSupported).toBe(false);
    await expect(store.request()).resolves.toBe(false);
    expect(store.watch()).toBe(false);
  });

  // The second shape of "no geolocation": the binding exists, the API does not.
  // This is the real Node 24 global and a browser with geolocation disabled.
  test("a navigator without geolocation is reported as unsupported", async () => {
    const controller = new GeoController();

    expect(controller.isSupported).toBe(false);
    await expect(controller.request()).resolves.toBe(false);
    expect(controller.watch()).toBe(false);
    expect(controller.hasPosition).toBe(false);
  });

  // Guard: the guard is the same one `watch()` uses, so an unsupported
  // controller must not start a watch and must not leave a watch id behind for
  // a teardown that has nothing to release.
  test("watch() on an unsupported controller leaves no watch to release", () => {
    vi.stubGlobal("navigator", undefined);
    const controller = new GeoController();

    expect(controller.watch()).toBe(false);
    expect(controller.isWatching).toBe(false);
    expect(() => controller.destroy()).not.toThrow();
  });
});
