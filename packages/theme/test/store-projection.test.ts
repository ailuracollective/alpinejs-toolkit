// @vitest-environment happy-dom
/**
 * The `theme` plugin's `change` handler wrote `current`, `system` and `resolved`
 * to the store the plugin registered and then wrote the same three fields to
 * the object `alpine.store(storeKey)` returned. This file pins what
 * `$store.theme` reports across controller changes, so the second write can be
 * removed (or kept) without changing an observable.
 *
 * `set()` drives the machine synchronously, so every assertion runs after the
 * `change` event that caused it — no sleep involved.
 */
import { clearAllSingletons } from "@ailura/alpinejs-core/singletons";
import Alpine from "alpinejs";
import { afterEach, describe, expect, test } from "vite-plus/test";

import { themePlugin } from "../src/plugin";
import { createMemoryThemeStorage } from "../src/storage/memory-storage";
import type { ThemeStore } from "../src/types";

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

function mountPlugin(): ThemeStore {
  const scope = {};
  scopes.push(scope);
  const { alpine, stores } = createMockAlpine();
  themePlugin({
    storage: createMemoryThemeStorage(),
    watchSystem: false,
    strategy: "none",
    scope,
  })(alpine);
  return stores.get("theme") as ThemeStore;
}

afterEach(() => {
  for (const scope of scopes.splice(0)) clearAllSingletons(scope);
  document.documentElement.removeAttribute("data-theme");
  document.documentElement.classList.remove("dark", "light");
});

describe("theme store projection", () => {
  // All three projected fields, in one assertion, after a controller change.
  test("every projected field follows a controller change", () => {
    const store = mountPlugin();
    expect({ current: store.current, resolved: store.resolved, system: store.system }).toEqual({
      current: "system",
      resolved: "light",
      system: "light",
    });

    store.set("dark");

    expect({ current: store.current, resolved: store.resolved, system: store.system }).toEqual({
      current: "dark",
      resolved: "dark",
      system: "light",
    });
  });

  // The projection has to follow the controller back, not latch on the first
  // write, and the system preference is a separate field: it does not move when
  // the user picks an explicit theme.
  test("the projection follows the controller in both directions", () => {
    const store = mountPlugin();

    store.set("dark");
    store.toggle();
    expect({ current: store.current, resolved: store.resolved, system: store.system }).toEqual({
      current: "light",
      resolved: "light",
      system: "light",
    });

    store.set("system");
    expect({ current: store.current, resolved: store.resolved, system: store.system }).toEqual({
      current: "system",
      resolved: "light",
      system: "light",
    });

    store.reset();
    expect({ current: store.current, resolved: store.resolved, system: store.system }).toEqual({
      current: "system",
      resolved: "light",
      system: "light",
    });
  });

  // A change that arrives from outside the store — a cross-tab write through
  // the storage adapter — must reach the projection too.
  test("a storage write from another tab moves the projection", () => {
    const scope = {};
    scopes.push(scope);
    const storage = createMemoryThemeStorage();
    const { alpine, stores } = createMockAlpine();
    themePlugin({ storage, watchSystem: false, strategy: "none", scope })(alpine);
    const store = stores.get("theme") as ThemeStore;
    expect(store.current).toBe("system");

    storage.set("dark");

    expect({ current: store.current, resolved: store.resolved, system: store.system }).toEqual({
      current: "dark",
      resolved: "dark",
      system: "light",
    });
  });
});

describe("Alpine store proxy vs the registered object", () => {
  // The question the second write depends on: `guardStore` hands the raw
  // object to `alpine.store(name, value)`, and `alpine.store(name)` reads it
  // back through Alpine's reactive `stores` map, so the value returned is a
  // proxy of the SAME object. A write through the proxy lands on the object the
  // plugin holds, which makes the second write a duplicate.
  test("a proxy write lands on the object that was registered", () => {
    const key = `theme-alias-probe-${Math.random().toString(36).slice(2, 8)}`;
    const base: Record<string, unknown> = { current: "system", resolved: "light" };

    Alpine.store(key, base);
    const proxy = Alpine.store(key) as Record<string, unknown>;

    expect(proxy).not.toBe(base);

    proxy["current"] = "dark";

    expect(base["current"]).toBe("dark");
  });

  // Same store, read through real Alpine: `$store.theme` is the proxy, and it
  // tracks the controller.
  test("the store registered with real Alpine tracks a controller change", () => {
    const key = `theme-alpine-${Math.random().toString(36).slice(2, 8)}`;
    const scope = {};
    scopes.push(scope);
    themePlugin({
      storage: createMemoryThemeStorage(),
      watchSystem: false,
      strategy: "none",
      storeKey: key,
      scope,
    })(Alpine as unknown as import("alpinejs").Alpine);
    const store = Alpine.store(key) as unknown as ThemeStore;

    store.set("dark");

    expect(store.current).toBe("dark");
    expect(store.resolved).toBe("dark");
    expect(store.system).toBe("light");
  });
});
