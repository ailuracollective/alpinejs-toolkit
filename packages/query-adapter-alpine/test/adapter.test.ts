/**
 * Contract tests for `createAlpineStoreAdapter`.
 *
 * The adapter wraps one value in a single `Alpine.reactive` box, so the tests
 * here observe the adapter from the outside only: what `get()` returns, what
 * `set()` changes, and what `destroy()` releases. The mock Alpine keeps the
 * boxes it hands out, so a test can also look at the reactive object a
 * template would be bound to — but nothing here asserts on a private flag.
 */
import { describe, expect, test } from "vite-plus/test";

import { createAlpineStoreAdapter } from "../src/adapter";

function createMockAlpine() {
  const boxes: Array<{ value: unknown }> = [];
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
    reactive<T extends object>(target: T): T {
      const box = { ...target };
      boxes.push(box as { value: unknown });
      return box;
    },
  } as unknown as import("alpinejs").Alpine;
  return { alpine, boxes };
}

describe("createAlpineStoreAdapter", () => {
  test("get() returns the initial value Alpine was given", () => {
    const { alpine } = createMockAlpine();
    const handle = createAlpineStoreAdapter(alpine).create({ id: 1 });

    expect(handle.get()).toEqual({ id: 1 });
  });

  test("set() writes through the Alpine.reactive box, the single holder", () => {
    const { alpine, boxes } = createMockAlpine();
    const handle = createAlpineStoreAdapter(alpine).create(0);

    handle.set(42);

    // Observable, not introspective: the box Alpine owns is what a template
    // reading the value would be bound to, and it is the only place the value
    // lives. A second holder inside the adapter would be invisible to Alpine
    // and could drift.
    expect(boxes).toHaveLength(1);
    expect(boxes[0]?.value).toBe(42);
    expect(handle.get()).toBe(42);
  });

  test("destroy() releases the value held by the reactive box", () => {
    const { alpine, boxes } = createMockAlpine();
    const handle = createAlpineStoreAdapter(alpine).create("keep");
    handle.set("newer");

    handle.destroy();

    // RED-first: `destroy` used to be `() => {}`, so the handle kept
    // reporting its value after the caller believed it was released.
    expect(handle.get()).toBeUndefined();
    expect(boxes[0]?.value).toBeUndefined();
  });

  test("destroy() is final: set() cannot resurrect a released handle", () => {
    const { alpine } = createMockAlpine();
    const handle = createAlpineStoreAdapter(alpine).create("value");

    handle.destroy();
    handle.set("after destroy");

    expect(handle.get()).toBeUndefined();
  });

  test("destroy() is idempotent", () => {
    const { alpine } = createMockAlpine();
    const handle = createAlpineStoreAdapter(alpine).create("value");

    expect(() => {
      handle.destroy();
      handle.destroy();
    }).not.toThrow();
    expect(handle.get()).toBeUndefined();
  });

  test("handles are independent: destroying one leaves the other readable", () => {
    const { alpine, boxes } = createMockAlpine();
    const adapter = createAlpineStoreAdapter(alpine);
    const first = adapter.create("first");
    const second = adapter.create("second");

    first.destroy();

    expect(first.get()).toBeUndefined();
    expect(second.get()).toBe("second");
    expect(boxes[1]?.value).toBe("second");
  });
});
