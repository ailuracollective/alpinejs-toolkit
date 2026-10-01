import type { Alpine } from "alpinejs";
import { beforeEach, describe, expect, test } from "vite-plus/test";

import {
  BaseController,
  CleanupStack,
  EventEmitter,
  ToolkitError,
  RegistrationError,
  bridgeControllerDirective,
  clearAllSingletons,
  createSingleton,
  generateId,
  guardDirective,
  guardMagic,
  guardStore,
  isBrowser,
  releaseSingleton,
  resetIdCounter,
  resetRegistrationTracking,
  safeDocument,
  safeMatchMedia,
  safeWindow,
  syncRecordFromSnapshot,
} from "../src/index";

/** Minimal Alpine double recording store/magic/directive registrations. */
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
  } as unknown as Alpine;
  return { alpine, stores, magics, directives };
}

beforeEach(() => {
  resetRegistrationTracking();
  resetIdCounter();
});

describe("ids", () => {
  test("generates prefixed ids", () => {
    expect(generateId()).toBe("id-1");
    expect(generateId("counter")).toBe("counter-2");
  });

  test("is monotonic base-36", () => {
    const ids = Array.from({ length: 12 }, () => generateId("t"));
    expect(ids[0]).toBe("t-1");
    expect(ids[9]).toBe("t-a");
    expect(ids[11]).toBe("t-c");
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("errors", () => {
  test("ToolkitError carries a stable code and cause", () => {
    const cause = new Error("root");
    const error = new ToolkitError("SOME_CODE", "broken", { cause });
    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe("ToolkitError");
    expect(error.code).toBe("SOME_CODE");
    expect(error.message).toBe("broken");
    expect(error.cause).toBe(cause);
  });

  test("RegistrationError carries collision details", () => {
    const error = new RegistrationError("store", "counter", "pkg-b", "pkg-a");
    expect(error).toBeInstanceOf(ToolkitError);
    expect(error.name).toBe("RegistrationError");
    expect(error.code).toBe("REGISTRATION_COLLISION");
    expect(error.kind).toBe("store");
    expect(error.registrationName).toBe("counter");
    expect(error.packageName).toBe("pkg-b");
    expect(error.existingPackageName).toBe("pkg-a");
    expect(error.message).toContain('"counter"');
  });
});

describe("sync", () => {
  test("assigns snapshot keys and deletes missing keys in place", () => {
    const target = { a: 1, stale: true };
    const result = syncRecordFromSnapshot(target, { a: 2, b: "new" });
    expect(result).toBe(target);
    expect(target).toEqual({ a: 2, b: "new" });
  });

  test("leaves matching values untouched", () => {
    const target: Record<string, unknown> = { a: 1 };
    syncRecordFromSnapshot(target, { a: 1 });
    expect(target).toEqual({ a: 1 });
  });
});

describe("events and cleanup", () => {
  test("EventEmitter is strongly typed and unsubscribable", () => {
    const emitter = new EventEmitter<{ tick: [count: number]; done: [] }>();
    const seen: number[] = [];
    const unsubscribe = emitter.on("tick", (count) => {
      seen.push(count);
    });
    emitter.emit("tick", 1);
    emitter.emit("tick", 2);
    unsubscribe();
    emitter.emit("tick", 3);
    expect(seen).toEqual([1, 2]);
    expect(emitter.listenerCount("tick")).toBe(0);
  });

  test("once fires a single time", () => {
    const emitter = new EventEmitter<{ done: [] }>();
    let calls = 0;
    emitter.once("done", () => {
      calls += 1;
    });
    emitter.emit("done");
    emitter.emit("done");
    expect(calls).toBe(1);
  });

  test("CleanupStack disposes LIFO and is idempotent", () => {
    const stack = new CleanupStack();
    const order: string[] = [];
    stack.push(() => {
      order.push("first");
    });
    stack.add(() => {
      order.push("second");
    });
    expect(stack.size).toBe(2);
    stack.dispose();
    stack.dispose();
    expect(order).toEqual(["second", "first"]);
    expect(stack.disposed).toBe(true);
    expect(stack.size).toBe(0);
  });

  test("CleanupStack drains remaining cleanups when one throws", () => {
    const stack = new CleanupStack();
    const order: string[] = [];
    stack.push(() => {
      order.push("first");
    });
    stack.push(() => {
      throw new Error("boom");
    });
    expect(() => stack.dispose()).toThrow("boom");
    expect(order).toEqual(["first"]);
  });

  test("BaseController runs idle -> mounted -> destroyed once", () => {
    let setups = 0;
    let teardowns = 0;
    class TestController extends BaseController<{ changed: [value: number] }> {
      readonly seen: number[] = [];
      protected override setup(): void {
        setups += 1;
        this.on("changed", (value) => {
          this.seen.push(value);
        });
      }
      protected override teardown(): void {
        teardowns += 1;
      }
      fire(value: number): void {
        this.emit("changed", value);
      }
    }
    const controller = new TestController();
    expect(controller.lifecycle).toBe("idle");
    controller.mount();
    controller.mount();
    controller.fire(7);
    expect(setups).toBe(1);
    expect(controller.seen).toEqual([7]);
    controller.destroy();
    controller.destroy();
    controller.fire(8);
    expect(controller.lifecycle).toBe("destroyed");
    expect(teardowns).toBe(1);
    expect(controller.seen).toEqual([7]);
  });
});

describe("singletons", () => {
  test("caches per key within a scope and builds once", () => {
    const scope = {};
    let builds = 0;
    const first = createSingleton("a", () => ((builds += 1), { n: 1 }), { scope });
    const second = createSingleton("a", () => ({ n: 2 }), { scope });
    expect(first).toBe(second);
    expect(builds).toBe(1);
  });

  test("isolates scopes and releases entries", () => {
    const first = createSingleton("k", () => ({ tag: "one" }), { scope: {} });
    const second = createSingleton("k", () => ({ tag: "two" }), { scope: {} });
    expect(first).not.toBe(second);

    const scope = {};
    const cached = createSingleton("k", () => ({ v: 1 }), { scope });
    expect(releaseSingleton("k", scope)).toBe(true);
    expect(releaseSingleton("k", scope)).toBe(false);
    expect(createSingleton("k", () => ({ v: 2 }), { scope })).not.toBe(cached);

    const other = {};
    createSingleton("k", () => 1, { scope: other });
    clearAllSingletons(other);
    let rebuilt = 0;
    createSingleton("k", () => ((rebuilt += 1), 1), { scope: other });
    expect(rebuilt).toBe(1);
  });

  test("uses a fresh scope per call without a document (SSR-safe)", () => {
    expect(safeDocument()).toBeUndefined();
    let builds = 0;
    const first = createSingleton("ssr", () => ((builds += 1), {}));
    const second = createSingleton("ssr", () => ((builds += 1), {}));
    expect(first).not.toBe(second);
    expect(builds).toBe(2);
  });
});

describe("guards", () => {
  test("guardStore registers and returns the store proxy", () => {
    const { alpine, stores } = createMockAlpine();
    const returned = guardStore(alpine, "counter", { count: 0 }, "pkg-a");
    expect(stores.get("counter")).toEqual({ count: 0 });
    expect(returned).toEqual({ count: 0 });
  });

  test("same package may re-register; other packages collide", () => {
    const { alpine, stores } = createMockAlpine();
    guardStore(alpine, "counter", { count: 1 }, "pkg-a");
    guardStore(alpine, "counter", { count: 2 }, "pkg-a");
    expect(stores.get("counter")).toEqual({ count: 2 });

    let thrown: unknown;
    try {
      guardStore(alpine, "counter", { count: 3 }, "pkg-b");
    } catch (error) {
      thrown = error;
    }
    expect(thrown).toBeInstanceOf(RegistrationError);
    const collision = thrown as RegistrationError;
    expect(collision.code).toBe("REGISTRATION_COLLISION");
    expect(collision.kind).toBe("store");
    expect(collision.registrationName).toBe("counter");
    expect(collision.packageName).toBe("pkg-b");
    // Failed registration must not overwrite the owned store.
    expect(stores.get("counter")).toEqual({ count: 2 });
  });

  test("override takes over and reset clears tracking", () => {
    const { alpine, stores } = createMockAlpine();
    guardStore(alpine, "counter", { count: 1 }, "pkg-a");
    guardStore(alpine, "counter", { count: 9 }, "pkg-b", { override: true });
    expect(stores.get("counter")).toEqual({ count: 9 });

    resetRegistrationTracking();
    guardStore(alpine, "counter", { count: 0 }, "pkg-c");
    expect(stores.get("counter")).toEqual({ count: 0 });
  });

  test("guardDirective normalizes camelCase registrations to kebab-case", () => {
    const { alpine, directives } = createMockAlpine();
    const callback = () => {};
    guardDirective(alpine, "myDirective", callback, "pkg-a");
    expect(directives.get("my-directive")).toBe(callback);
    expect(directives.has("myDirective")).toBe(false);
    // Collision tracking uses the normalized key: the kebab spelling
    // from another package collides with the earlier camelCase claim.
    expect(() => guardDirective(alpine, "my-directive", callback, "pkg-b")).toThrow(
      RegistrationError
    );
  });

  test("guardMagic and guardDirective collide per kind", () => {
    const { alpine, magics, directives } = createMockAlpine();
    const magic = () => "hi";
    const directive = () => {};
    guardMagic(alpine, "greet", magic, "pkg-a");
    guardDirective(alpine, "upper", directive, "pkg-a");
    expect(magics.get("greet")).toBe(magic);
    expect(directives.get("upper")).toBe(directive);
    expect(() => guardMagic(alpine, "greet", magic, "pkg-b")).toThrow(RegistrationError);
    expect(() => guardDirective(alpine, "upper", directive, "pkg-b")).toThrow(RegistrationError);
    // Same name in a different kind does not collide.
    guardDirective(alpine, "greet", directive, "pkg-b");
    expect(directives.get("greet")).toBe(directive);
  });
});

describe("bridge", () => {
  test("bridgeControllerDirective works without a controller", () => {
    const { alpine, directives } = createMockAlpine();
    const order: string[] = [];
    const dispose = bridgeControllerDirective({
      alpine,
      directiveKey: "upper",
      directive: () => {},
      packageName: "pkg-a",
      eventCleanups: [
        () => {
          order.push("event");
        },
      ],
    });
    expect(directives.has("upper")).toBe(true);
    dispose();
    expect(order).toEqual(["event"]);
  });
});

describe("env (node)", () => {
  test("reports a non-browser environment without throwing", () => {
    expect(isBrowser()).toBe(false);
    expect(safeWindow()).toBeUndefined();
    expect(safeDocument()).toBeUndefined();
    expect(safeMatchMedia("(prefers-reduced-motion: reduce)")).toBeUndefined();
  });
});
