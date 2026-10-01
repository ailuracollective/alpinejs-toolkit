import { readFileSync } from "node:fs";

import type { Alpine } from "alpinejs";
import { describe, expect, test } from "vite-plus/test";

import { readAlpineStore, resolvePluginKeys, resolveStoreKey } from "../src/index";
import * as registration from "../src/registration";

interface DemoStore {
  count: number;
}

/** Minimal Alpine double: `store(name)` reads, `store(name, value)` writes. */
function createMockAlpine() {
  const stores = new Map<string, unknown>();
  const alpine = {
    store(name: string, value?: unknown) {
      if (value !== undefined) {
        stores.set(name, value);
        return;
      }
      return stores.get(name);
    },
  } as unknown as Alpine;
  return { alpine, stores };
}

describe("resolvePluginKeys", () => {
  test("falls back to the package defaults when no option is given", () => {
    expect(resolvePluginKeys({}, "demo", "$demo")).toEqual({
      storeKey: "demo",
      magicKey: "$demo",
    });
  });

  test("explicit options win over both defaults", () => {
    expect(resolvePluginKeys({ storeKey: "custom", magicKey: "$custom" }, "demo", "$demo")).toEqual(
      {
        storeKey: "custom",
        magicKey: "$custom",
      }
    );
  });

  test("magicKey falls back to an explicit storeKey, not the default", () => {
    expect(resolvePluginKeys({ storeKey: "custom" }, "demo", "$demo")).toEqual({
      storeKey: "custom",
      magicKey: "custom",
    });
  });

  test("an explicit empty storeKey is kept and becomes the magic key", () => {
    expect(resolvePluginKeys({ storeKey: "" }, "demo", "$demo")).toEqual({
      storeKey: "",
      magicKey: "",
    });
  });

  test("resolution is pure and never touches a browser global", () => {
    expect(() => resolvePluginKeys({}, "demo", "$demo")).not.toThrow();
    expect(typeof window).toBe("undefined");
  });
});

describe("resolveStoreKey", () => {
  test("falls back to the package default when no option is given", () => {
    expect(resolveStoreKey({}, "demo")).toBe("demo");
  });

  test("an explicit option wins over the default", () => {
    expect(resolveStoreKey({ storeKey: "custom" }, "demo")).toBe("custom");
  });

  test("keeps an explicit empty storeKey, matching resolvePluginKeys", () => {
    expect(resolveStoreKey({ storeKey: "" }, "demo")).toBe(
      resolvePluginKeys({ storeKey: "" }, "demo", "$demo").storeKey
    );
    expect(resolveStoreKey({ storeKey: "" }, "demo")).toBe("");
  });

  test("resolution is pure and never touches a browser global", () => {
    expect(() => resolveStoreKey({}, "demo")).not.toThrow();
    expect(typeof window).toBe("undefined");
  });
});

describe("registration entry point", () => {
  test("is reachable through the @ailura/alpinejs-core/registration subpath", () => {
    const manifest = JSON.parse(
      readFileSync(new URL("../package.json", import.meta.url), "utf8")
    ) as { exports: Record<string, { types: string; import: string }> };

    expect(manifest.exports["./registration"]).toEqual({
      types: "./dist/registration.d.mts",
      import: "./dist/registration.mjs",
    });
  });

  test("exposes the same helpers as the barrel", () => {
    expect(registration.resolvePluginKeys).toBe(resolvePluginKeys);
    expect(registration.resolveStoreKey).toBe(resolveStoreKey);
    expect(registration.readAlpineStore).toBe(readAlpineStore);
  });
});

describe("readAlpineStore", () => {
  test("returns the registered store typed as TStore", () => {
    const { alpine } = createMockAlpine();
    const store: DemoStore = { count: 0 };
    alpine.store("demo" as never, store);
    const read = readAlpineStore<DemoStore>(alpine, "demo");
    expect(read).toBe(store);
    // Typed access: the compiler resolves `count` without a local cast.
    expect(read?.count).toBe(0);
  });

  test("returns undefined for an unregistered key", () => {
    const { alpine } = createMockAlpine();
    expect(readAlpineStore<DemoStore>(alpine, "missing")).toBeUndefined();
  });

  test("uses the fallback only when the store is not registered yet", () => {
    const { alpine } = createMockAlpine();
    const base: DemoStore = { count: 0 };
    expect(readAlpineStore<DemoStore>(alpine, "demo", base)).toBe(base);

    const proxy: DemoStore = { count: 7 };
    alpine.store("demo" as never, proxy);
    expect(readAlpineStore<DemoStore>(alpine, "demo", base)).toBe(proxy);
  });

  test("reads without a document (SSR-safe)", () => {
    const { alpine } = createMockAlpine();
    const base: DemoStore = { count: 0 };
    expect(readAlpineStore<DemoStore>(alpine, "demo", base)).toBe(base);
  });
});
