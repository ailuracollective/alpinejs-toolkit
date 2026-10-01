// @vitest-environment happy-dom
/**
 * The `media` plugin's `change` handler writes the snapshot onto `target` —
 * the object `alpine.store(storeKey)` returned, falling back to the object the
 * plugin registered when there is no proxy — and then wrote `width` a second
 * time onto the base `store`. This file pins what `$store.media` actually
 * reports, so the base-store write can be removed (or kept) without changing an
 * observable.
 *
 * The viewport and the system preferences are driven from a stub, and the
 * change is provoked with `refresh()`, which reads the snapshot and emits
 * synchronously. No sleep is involved: the assertion runs after the event that
 * caused it.
 */
import { clearAllSingletons } from "@ailura/alpinejs-core/singletons";
import Alpine from "alpinejs";
import { afterEach, beforeEach, describe, expect, test } from "vite-plus/test";

import { mediaPlugin } from "../src/plugin";
import type { MediaStore } from "../src/types";

interface Viewport {
  width: number;
  height: number;
  reducedMotion: boolean;
  dark: boolean;
}

const originalMatchMedia = window.matchMedia;
const originalInnerWidth = window.innerWidth;
const originalInnerHeight = window.innerHeight;

function setViewport(viewport: Viewport): void {
  Object.defineProperty(window, "innerWidth", {
    configurable: true,
    writable: true,
    value: viewport.width,
  });
  Object.defineProperty(window, "innerHeight", {
    configurable: true,
    writable: true,
    value: viewport.height,
  });
  window.matchMedia = ((query: string) => {
    const matches = query.includes("reduced-motion") ? viewport.reducedMotion : viewport.dark;
    return {
      addEventListener: () => {},
      addListener: () => {},
      dispatchEvent: () => false,
      matches,
      media: query,
      onchange: null,
      removeEventListener: () => {},
      removeListener: () => {},
    } as unknown as MediaQueryList;
  }) as typeof window.matchMedia;
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

const scopes: Array<object> = [];

function mountPlugin(storeKey = "media"): MediaStore {
  const scope = {};
  scopes.push(scope);
  const { alpine, stores } = createMockAlpine();
  mediaPlugin({ storeKey, scope })(alpine);
  return stores.get(storeKey) as MediaStore;
}

beforeEach(() => {
  setViewport({ width: 1024, height: 768, reducedMotion: false, dark: false });
});

afterEach(() => {
  for (const scope of scopes.splice(0)) clearAllSingletons(scope);
  window.matchMedia = originalMatchMedia;
  Object.defineProperty(window, "innerWidth", {
    configurable: true,
    writable: true,
    value: originalInnerWidth,
  });
  Object.defineProperty(window, "innerHeight", {
    configurable: true,
    writable: true,
    value: originalInnerHeight,
  });
});

describe("media store projection", () => {
  // All six fields, in one assertion: the point of the case is that the store
  // agrees with the controller snapshot as a whole, not field by field.
  test("every projected field follows a controller change", () => {
    const store = mountPlugin();
    expect(store.width).toBe(1024);
    expect(store.breakpoint).toBe("lg");

    setViewport({ width: 500, height: 900, reducedMotion: true, dark: true });
    store.refresh();

    expect({
      breakpoint: store.breakpoint,
      height: store.height,
      isDark: store.isDark,
      prefersColorScheme: store.prefersColorScheme,
      prefersReducedMotion: store.prefersReducedMotion,
      width: store.width,
    }).toEqual({
      breakpoint: "base",
      height: 900,
      isDark: true,
      prefersColorScheme: "dark",
      prefersReducedMotion: true,
      width: 500,
    });
  });

  // A second change in the opposite direction: the projection has to follow
  // the controller back, not latch on the first write.
  test("the projection follows a change in both directions", () => {
    const store = mountPlugin();

    setViewport({ width: 500, height: 900, reducedMotion: false, dark: false });
    store.refresh();
    expect(store.width).toBe(500);
    expect(store.breakpoint).toBe("base");

    setViewport({ width: 1300, height: 600, reducedMotion: false, dark: false });
    store.refresh();
    expect(store.width).toBe(1300);
    expect(store.height).toBe(600);
    expect(store.breakpoint).toBe("xl");
  });
});

describe("Alpine store proxy vs the registered object", () => {
  // The question the base-store write depends on: `guardStore` hands the raw
  // object to `alpine.store(name, value)`, and `alpine.store(name)` reads it
  // back through Alpine's reactive `stores` map, so the value returned is a
  // proxy of the SAME object. A write through the proxy therefore lands on the
  // object the plugin holds, and a second write to that object is a duplicate.
  test("a proxy write lands on the object that was registered", () => {
    const key = `media-alias-probe-${Math.random().toString(36).slice(2, 8)}`;
    const base: Record<string, unknown> = { width: 1, height: 2 };

    Alpine.store(key, base);
    const proxy = Alpine.store(key) as Record<string, unknown>;

    expect(proxy).not.toBe(base);

    proxy["width"] = 640;

    expect(base["width"]).toBe(640);
  });

  // Same store object, read through real Alpine: `$store.media` is the proxy,
  // and it tracks the controller.
  test("the store registered with real Alpine tracks a controller change", () => {
    const key = `media-alpine-${Math.random().toString(36).slice(2, 8)}`;
    const scope = {};
    scopes.push(scope);
    mediaPlugin({ storeKey: key, scope })(Alpine as unknown as import("alpinejs").Alpine);
    const store = Alpine.store(key) as unknown as MediaStore;

    setViewport({ width: 500, height: 900, reducedMotion: false, dark: false });
    store.refresh();

    expect(store.width).toBe(500);
    expect(store.height).toBe(900);
    expect(store.breakpoint).toBe("base");
    expect(store.isDark).toBe(false);
    expect(store.prefersColorScheme).toBe("light");
  });
});
