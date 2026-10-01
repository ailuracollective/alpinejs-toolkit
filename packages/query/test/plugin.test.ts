/**
 * Guard tests for the `query` plugin's registration.
 *
 * Two facts are pinned here, and only these two:
 *
 * 1. `$store.query` is a COMMAND surface. The store returned by
 *    `QueryController.toStore()` carries no query data of its own — only a
 *    `devtools` getter and methods — so the plugin hands the store to
 *    `guardStore()` unchanged. Observable state comes from the entry returned
 *    by `get()`/`observe()`.
 * 2. The plugin registers NO listener on the controller. It used to subscribe
 *    a literal no-op (`const sync = () => {}`) under a "sync on change"
 *    comment, which left a dead subscription behind on every registration.
 */
import { BaseController } from "@ailura/alpinejs-core/controller";
import { guardMagic, guardStore, resetRegistrationTracking } from "@ailura/alpinejs-core/guards";
import { afterEach, describe, expect, test, vi } from "vite-plus/test";

import { queryPlugin } from "../src/plugin";
import { DEFAULT_QUERY_MAGIC_KEY, DEFAULT_QUERY_STORE_KEY, type QueryStore } from "../src/types";

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

const COMMANDS = [
  "observe",
  "fetch",
  "get",
  "prefetch",
  "invalidate",
  "remove",
  "setData",
  "cancel",
  "reset",
  "resetQueries",
  "clearMutations",
  "destroy",
  "mutate",
] as const;

afterEach(() => {
  vi.restoreAllMocks();
  resetRegistrationTracking();
});

describe("queryPlugin registration", () => {
  test("registers a store exposing the command surface", () => {
    const { alpine, stores } = createMockAlpine();

    queryPlugin()(alpine);

    const store = stores.get("query") as QueryStore;
    expect(store).toBeDefined();
    for (const command of COMMANDS) {
      expect(typeof store[command]).toBe("function");
    }
    // The store is a command surface: nothing on it is a data member the
    // plugin would have to keep in sync.
    expect(Object.keys(store)).not.toContain("data");
    expect(Object.keys(store)).not.toContain("queries");
  });

  test("registers the magic and the store under the default keys", () => {
    const { alpine, stores, magics } = createMockAlpine();

    queryPlugin()(alpine);

    expect(stores.has("query")).toBe(true);
    expect(magics.has("query")).toBe(true);
  });

  test("leaves no dead subscription on the controller", () => {
    // RED-first: the plugin used to call `controller.on("change", () => {})`,
    // so this recorded a `change` listener that never did anything.
    const on = vi.spyOn(BaseController.prototype, "on");
    const { alpine, stores } = createMockAlpine();

    queryPlugin()(alpine);

    expect(stores.has("query")).toBe(true);
    const changeSubscriptions = on.mock.calls.filter(([event]) => event === "change");
    expect(changeSubscriptions).toHaveLength(0);
  });

  test("honours a custom storeKey and magicKey", () => {
    const { alpine, stores, magics } = createMockAlpine();

    queryPlugin({ storeKey: "cache", magicKey: "$cacheQuery" })(alpine);

    expect(stores.has("cache")).toBe(true);
    expect(stores.has(DEFAULT_QUERY_STORE_KEY)).toBe(false);
    expect(magics.has("$cacheQuery")).toBe(true);
    expect(magics.has(DEFAULT_QUERY_MAGIC_KEY)).toBe(false);
  });

  test("falls back to storeKey for the magic when only storeKey is given", () => {
    const { alpine, stores, magics } = createMockAlpine();

    queryPlugin({ storeKey: "cache" })(alpine);

    expect(stores.has("cache")).toBe(true);
    expect(magics.has("cache")).toBe(true);
    expect(magics.has(DEFAULT_QUERY_MAGIC_KEY)).toBe(false);
  });

  test("applies the default keys when neither option is given", () => {
    const { alpine, stores, magics } = createMockAlpine();

    queryPlugin()(alpine);

    expect(stores.has(DEFAULT_QUERY_STORE_KEY)).toBe(true);
    expect(magics.has(DEFAULT_QUERY_MAGIC_KEY)).toBe(true);
  });

  test("the custom keys stay guarded against cross-package collisions", () => {
    const first = createMockAlpine();
    queryPlugin({ storeKey: "cache", magicKey: "$cacheQuery" })(first.alpine);

    // A foreign package claiming the same custom names must be rejected by
    // the guards rather than silently overwriting the query registration.
    const second = createMockAlpine();
    expect(() => foreignPlugin("cache", "$cacheQuery")(second.alpine)).toThrow();

    // Same for the default names.
    const third = createMockAlpine();
    queryPlugin()(third.alpine);
    expect(() =>
      foreignPlugin(DEFAULT_QUERY_STORE_KEY, DEFAULT_QUERY_MAGIC_KEY)(third.alpine)
    ).toThrow();
  });
});

/** A foreign package registering under the same names through the same guards. */
function foreignPlugin(storeKey: string, magicKey: string) {
  return function register(alpine: import("alpinejs").Alpine): void {
    guardStore(alpine, storeKey, {}, "@ailura/alpinejs-foreign");
    guardMagic(alpine, magicKey, () => undefined, "@ailura/alpinejs-foreign");
  };
}
