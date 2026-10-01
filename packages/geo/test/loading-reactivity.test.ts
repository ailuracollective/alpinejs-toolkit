// @vitest-environment happy-dom
/**
 * `$store.geo.isLoading` must be observable while a request is in flight.
 *
 * The defect this pins: the controller set its `loading` flag to `true` and
 * back to `false` without ever announcing it, and the plugin's `sync` only ran
 * on `position` / `error` / `watchStart` / `watchStop` / `update` — all of which
 * report the *end* of a request. So the store reported `isLoading: false` for
 * the whole round trip, and the demo's "Locating…" label and disabled state
 * were unreachable.
 */

import { clearAllSingletons } from "@ailura/alpinejs-core/singletons";
import { html, mount, reset, resume, settled, start } from "@ailura/alpinejs-testing";
import Alpine from "alpinejs";
import { afterEach, beforeAll, beforeEach, describe, expect, test } from "vite-plus/test";

import { geoPlugin } from "../src/plugin";
import type { GeoStore } from "../src/types";

interface PositionStub {
  resolve: ((position: unknown) => void) | null;
  reject: ((error: unknown) => void) | null;
}

let stub: PositionStub;
let originalGeolocation: PropertyDescriptor | undefined;

function store(): GeoStore {
  return (Alpine as unknown as { store(name: string): GeoStore }).store("geo");
}

function text(testid: string): string {
  return document.querySelector(`[data-testid="${testid}"]`)?.textContent ?? "";
}

function installGeolocation(): void {
  originalGeolocation = Object.getOwnPropertyDescriptor(window.navigator, "geolocation");
  Object.defineProperty(window.navigator, "geolocation", {
    configurable: true,
    value: {
      getCurrentPosition: (
        onSuccess: (position: unknown) => void,
        onError?: (error: unknown) => void
      ): void => {
        // Held pending: nothing resolves until the test says so, which is the
        // only way to observe the in-flight state at all.
        stub.resolve = onSuccess;
        stub.reject = onError ?? null;
      },
      watchPosition: (): number => 1,
      clearWatch: (): void => undefined,
    },
  });
}

beforeAll(() => start(() => {}));

beforeEach(() => {
  stub = { resolve: null, reject: null };
  installGeolocation();
  geoPlugin()(Alpine as unknown as import("alpinejs").Alpine);
  resume();
});

afterEach(() => {
  reset();
  clearAllSingletons();
  Reflect.deleteProperty(window.navigator, "geolocation");
  if (originalGeolocation) {
    Object.defineProperty(window.navigator, "geolocation", originalGeolocation);
  }
});

describe("$store.geo isLoading", () => {
  test("is true while the request is in flight", async () => {
    mount(
      html(`<div>
        <span data-testid="l" x-text="String($store.geo.isLoading)"></span>
      </div>`)
    );
    await settled();
    expect(text("l")).toBe("false");

    void store().request();

    // No await: the request is still pending at this point.
    await settled();
    expect(text("l")).toBe("true");

    stub.resolve?.({ coords: { latitude: 1, longitude: 2, accuracy: 3 } });
    await settled();
    expect(text("l")).toBe("false");
  });

  test("returns to false when the request is denied", async () => {
    mount(
      html(`<div>
        <span data-testid="l" x-text="String($store.geo.isLoading)"></span>
      </div>`)
    );
    await settled();

    void store().request();
    await settled();
    expect(text("l")).toBe("true");

    stub.reject?.({ code: 1, message: "denied" });
    await settled();
    expect(text("l")).toBe("false");
  });
});
