import { describe, expect, test } from "vite-plus/test";

import { virtualPlugin } from "../src/plugin";
import type { VirtualStore } from "../src/types";

function createMockAlpine() {
  const stores = new Map<string, unknown>();
  const magics = new Map<string, unknown>();
  const directives = new Map<string, unknown>();
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
    directive(name: string, callback: unknown) {
      directives.set(name, callback);
    },
  } as unknown as import("alpinejs").Alpine;
  return { alpine, stores, magics, directives };
}

function register() {
  const { alpine, stores } = createMockAlpine();
  virtualPlugin()(alpine);
  return {
    store: (stores.get("virtual") ?? {}) as VirtualStore,
    rawInstances: (): Record<string, Record<string, unknown>> =>
      (stores.get("virtual") as { instances: Record<string, Record<string, unknown>> }).instances,
  };
}

describe("virtual store instances registry is detached from the controller", () => {
  test("setCount after the first change sync does not throw and readers stay correct", () => {
    const { store } = register();
    store.create("list", { count: 5 });
    expect(() => store.setCount("list", 50)).not.toThrow();
    const items = store.getVirtualItems("list");
    expect(items.length).toBeGreaterThan(0);
    expect(store.getTotalSize("list")).toBe(50 * 50);
    expect(store.instances["list"].count).toBe(50);
  });

  test("a second create on another id works after the first sync", () => {
    const { store } = register();
    store.create("a", { count: 5 });
    store.create("b", { count: 3 });
    expect(() => store.setCount("b", 20)).not.toThrow();
    expect(store.getVirtualItems("a").length).toBeGreaterThan(0);
    expect(store.getVirtualItems("b").length).toBeGreaterThan(0);
    expect(store.getTotalSize("a")).toBe(250);
    expect(store.getTotalSize("b")).toBe(1000);
  });

  test("measureItem still works after a sync", () => {
    const { store } = register();
    store.create("list", { count: 10 });
    expect(() => store.measureItem("list", 0, 120)).not.toThrow();
    expect(() => store.measureItem("list", 3, 30)).not.toThrow();
    const item0 = store.getVirtualItems("list").find((v) => v.index === 0);
    expect(item0?.size).toBe(120);
    expect(store.getTotalSize("list")).toBe(120 + 30 + 8 * 50);
  });

  test("store projection is a plain snapshot without internal-only fields", () => {
    const { store } = register();
    store.create("list", { count: 5 });
    const projection = store.instances["list"] as unknown as Record<string, unknown>;
    for (const internal of [
      "keys",
      "sizes",
      "offsets",
      "scrollElement",
      "scrollCleanup",
      "_lastScroll",
      "_lastViewport",
    ]) {
      expect(projection[internal]).toBeUndefined();
    }
    expect(projection.count).toBe(5);
  });

  test("mutating the store projection never reaches the controller", () => {
    const { store, rawInstances } = register();
    store.create("list", { count: 5 });
    const projection = rawInstances()["list"];
    // A consumer writing into the public projection must not mutate controller state.
    projection.scrollOffset = 12345;
    expect(() => store.setCount("list", 10)).not.toThrow();
    expect(store.getTotalSize("list")).toBe(500);
    expect(rawInstances()["list"].scrollOffset).toBe(0);
  });
});
