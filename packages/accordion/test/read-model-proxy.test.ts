// @vitest-environment happy-dom
/**
 * Read-model reactivity contract for the store projection.
 *
 * `isOpen`/`openIds`/`activeItem`/`triggerProps`/`panelProps` live in
 * `createAccordionStoreFromController` (store.ts), but they are only
 * reactive because they dereference `this.instances`: called on Alpine's
 * reactive store proxy, the read is tracked and re-runs on the next
 * sync. A version closed over the controller's raw registry would answer
 * the same question but never invalidate. These tests pin the
 * receiver-based read, so a future "tidy-up" cannot silently swap it for
 * a bound controller method.
 */
import Alpine from "alpinejs";
import { describe, expect, test } from "vite-plus/test";

import { accordionPlugin } from "../src/plugin";
import type { AccordionStore } from "../src/types";

/** Register the plugin on a mock Alpine and return the store it createed. */
function createStore(): AccordionStore {
  const stores = new Map<string, unknown>();
  const alpine = {
    store(name: string, value?: unknown) {
      if (value === undefined) return stores.get(name);
      stores.set(name, value);
      return undefined;
    },
    magic() {},
  } as unknown as import("alpinejs").Alpine;
  accordionPlugin()(alpine);
  return stores.get("accordion") as AccordionStore;
}

/** Seed one group with two items so every read-model method has data. */
function seed(store: AccordionStore): void {
  store.create("a1", { mode: "multiple" });
  store.createItem("a1", "i1");
  store.createItem("a1", "i2");
}

describe("accordion read-model reads through the reactive receiver", () => {
  test("every read method dereferences `instances` on its receiver", () => {
    const store = createStore();
    seed(store);
    const proxy = Alpine.reactive(store) as AccordionStore;

    // Recording proxy in front of Alpine's reactive proxy: any property
    // the read model touches on `this` shows up here.
    const reads: string[] = [];
    const tracked = new Proxy(proxy, {
      get(target, key, receiver) {
        if (typeof key === "string") reads.push(key);
        return Reflect.get(target, key, receiver) as unknown;
      },
    }) as AccordionStore;

    tracked.isOpen("a1", "i1");
    tracked.openIds("a1");
    tracked.activeItem("a1");
    tracked.triggerProps("a1", "i1");
    tracked.panelProps("a1", "i1");

    expect(reads.filter((key) => key === "instances").length).toBeGreaterThanOrEqual(5);
  });

  test("reads reflect writes made through the reactive proxy", () => {
    const store = createStore();
    seed(store);
    const proxy = Alpine.reactive(store) as AccordionStore;

    expect(proxy.isOpen("a1", "i1")).toBe(false);
    expect(proxy.openIds("a1")).toEqual([]);

    // Reads through the proxy, so `group` is Alpine's reactive sub-proxy:
    // writing to it is the tracked mutation the read model must observe.
    const group = proxy.instances.a1;
    if (group === undefined) throw new Error("[accordion] group a1 not projected");
    group.open.i1 = true;
    group.activeItemId = "i2";

    expect(proxy.isOpen("a1", "i1")).toBe(true);
    expect(proxy.openIds("a1")).toEqual(["i1"]);
    expect(proxy.activeItem("a1")).toBe("i2");
    expect(proxy.triggerProps("a1", "i1")).toMatchObject({ "aria-expanded": true, tabindex: -1 });
    expect(proxy.panelProps("a1", "i1")).toMatchObject({
      role: "region",
      "aria-hidden": undefined,
    });
  });

  test("an effect re-runs when the projection changes (reactive read, not a snapshot)", async () => {
    const store = createStore();
    seed(store);
    const proxy = Alpine.reactive(store) as AccordionStore;

    const observed: string[][] = [];
    const release = Alpine.effect(() => {
      observed.push(proxy.openIds("a1"));
    });
    try {
      expect(observed).toEqual([[]]);
      const group = proxy.instances.a1;
      if (group === undefined) throw new Error("[accordion] group a1 not projected");
      group.open.i2 = true;
      // Alpine flushes effect re-runs on the microtask queue.
      await new Promise((resolve) => setTimeout(resolve, 0));
      expect(observed.length).toBe(2);
      expect(observed.at(-1)).toEqual(["i2"]);
    } finally {
      release();
    }
  });
});
