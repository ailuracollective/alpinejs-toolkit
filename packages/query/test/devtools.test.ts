/**
 * Behaviour tests for `store.devtools`.
 *
 * The contract has two halves and both are load-bearing for a panel:
 *
 * 1. `getSnapshot()` returns a PLAIN value — plain objects, plain arrays, no
 *    class instance, no function, no DOM — so a panel can stringify it, diff it
 *    or ship it. Errors are flattened on purpose: `JSON.stringify(new Error())`
 *    is `{}`, which would drop the very failure a panel exists to show.
 * 2. `subscribe()` fires on every meaningful change, hands back a working
 *    unsubscribe, keeps subscribers independent, and goes silent for good once
 *    the controller is destroyed.
 */
import { describe, expect, test } from "vite-plus/test";

import { QueryController } from "../src/controller";
import type { QueryDevtoolsSnapshot } from "../src/types";

/** Walks a value and returns every function it finds, so "plain" is testable. */
function findFunctions(value: unknown, path = "$", found: string[] = []): string[] {
  if (typeof value === "function") found.push(path);
  else if (Array.isArray(value))
    for (const [i, v] of value.entries()) findFunctions(v, `${path}[${i}]`, found);
  else if (value && typeof value === "object")
    for (const [k, v] of Object.entries(value)) findFunctions(v, `${path}.${k}`, found);
  return found;
}

describe("devtools.getSnapshot()", () => {
  test("reports an empty cache as an empty, plain snapshot", () => {
    const snapshot = new QueryController().toStore().devtools.getSnapshot();

    expect(snapshot.phase).toBe("idle");
    expect(snapshot.entries).toEqual([]);
    expect(snapshot.mutations).toEqual([]);
    expect(findFunctions(snapshot)).toEqual([]);
    expect(JSON.parse(JSON.stringify(snapshot))).toEqual(snapshot);
  });

  test("reports the controller lifecycle phase", () => {
    const controller = new QueryController();

    expect(controller.toStore().devtools.getSnapshot().phase).toBe("idle");
    controller.mount();
    expect(controller.toStore().devtools.getSnapshot().phase).toBe("mounted");
    controller.destroy();
    expect(controller.toStore().devtools.getSnapshot().phase).toBe("destroyed");
  });

  test("carries per-entry status, data, timestamps and staleTime", async () => {
    const controller = new QueryController();
    const store = controller.toStore();

    await store.fetch(["post", 7], () => Promise.resolve({ title: "t" }), { staleTime: 60_000 });

    const entry = store.devtools.getSnapshot().entries[0];
    expect(entry).toBeDefined();
    expect(entry?.key).toEqual(["post", 7]);
    expect(entry?.keyHash).toBe(JSON.stringify(["post", 7]));
    expect(entry?.status).toBe("success");
    expect(entry?.fetchStatus).toBe("idle");
    expect(entry?.data).toEqual({ title: "t" });
    expect(entry?.error).toBeNull();
    expect(entry?.dataUpdatedAt).toBeGreaterThan(0);
    expect(entry?.errorUpdatedAt).toBe(0);
    expect(entry?.staleTime).toBe(60_000);
    expect(entry?.isStale).toBe(false);
    expect(entry?.enabled).toBe(true);
  });

  test("flattens an Error into a name/message pair", async () => {
    const controller = new QueryController();
    const store = controller.toStore();

    await store.fetch(["boom"], () => Promise.reject(new TypeError("nope")));

    const snapshot = store.devtools.getSnapshot();
    const entry = snapshot.entries[0];
    expect(entry?.status).toBe("error");
    expect(entry?.error).toEqual({ name: "TypeError", message: "nope" });
    expect(entry?.errorUpdatedAt).toBeGreaterThan(0);
    // The reason a snapshot cannot keep the instance: `JSON.stringify` of an
    // Error is `{}`, so the failure would vanish from a serialized panel.
    expect(entry?.error).not.toBeInstanceOf(Error);
    expect(JSON.parse(JSON.stringify(snapshot)).entries[0].error).toEqual({
      name: "TypeError",
      message: "nope",
    });
  });

  test("stays serializable with several entries and no functions anywhere", async () => {
    const controller = new QueryController();
    const store = controller.toStore();
    await store.fetch(["a"], () => Promise.resolve(1));
    await store.fetch(["b"], () => Promise.resolve(2));
    await store.fetch(["c"], () => Promise.resolve(3));

    const snapshot = store.devtools.getSnapshot();

    expect(snapshot.entries).toHaveLength(3);
    expect(findFunctions(snapshot)).toEqual([]);
    expect(JSON.parse(JSON.stringify(snapshot))).toEqual(snapshot);
  });

  test("is a fresh value: mutating one snapshot cannot reach the cache", async () => {
    const store = new QueryController().toStore();
    await store.fetch(["a"], () => Promise.resolve("real"));

    const snapshot = store.devtools.getSnapshot();
    snapshot.entries.length = 0;
    snapshot.entries.push({
      key: ["fake"],
      keyHash: "fake",
      status: "error",
      fetchStatus: "idle",
      data: null,
      error: { name: "Fake", message: "fake" },
      dataUpdatedAt: 0,
      errorUpdatedAt: 0,
      staleTime: 0,
      isStale: false,
      enabled: true,
    });

    expect(store.devtools.getSnapshot().entries).toHaveLength(1);
    expect(store.devtools.getSnapshot().entries[0]?.data).toBe("real");
  });

  test("reports mutation state", async () => {
    const controller = new QueryController();
    const store = controller.toStore();
    const mutation = store.mutate({ mutationFn: (n: number) => Promise.resolve(n * 2) });

    await mutation.mutate(21);

    const snapshot = store.devtools.getSnapshot();
    expect(snapshot.mutations).toHaveLength(1);
    expect(snapshot.mutations[0]).toEqual({
      id: expect.any(Number),
      status: "success",
      data: 42,
      error: null,
    });
    expect(findFunctions(snapshot)).toEqual([]);
  });

  test("an un-run mutation is not reported", () => {
    const store = new QueryController().toStore();
    store.mutate({ mutationFn: () => Promise.resolve("never") });

    expect(store.devtools.getSnapshot().mutations).toEqual([]);
  });

  test("records a failed mutation as a flattened error", async () => {
    const controller = new QueryController();
    const store = controller.toStore();
    const mutation = store.mutate({
      mutationFn: () => Promise.reject(new RangeError("bad")),
    });

    await expect(mutation.mutate()).rejects.toThrow("bad");

    expect(store.devtools.getSnapshot().mutations[0]).toEqual({
      id: expect.any(Number),
      status: "error",
      data: undefined,
      error: { name: "RangeError", message: "bad" },
    });
  });
});

describe("devtools.subscribe()", () => {
  test("fires when a query starts and settles", async () => {
    const controller = new QueryController();
    const store = controller.toStore();
    const seen: QueryDevtoolsSnapshot[] = [];
    store.devtools.subscribe((s) => seen.push(s));

    await store.fetch(["a"], () => Promise.resolve(1));

    // The request start is a change, and so is the settle.
    expect(seen.length).toBeGreaterThanOrEqual(2);
    expect(seen.map((s) => s.entries[0]?.status)).toContain("pending");
    expect(seen.at(-1)?.entries[0]?.status).toBe("success");
    expect(seen.at(-1)?.entries[0]?.data).toBe(1);
  });

  test("fires when an entry is removed from the cache", async () => {
    const controller = new QueryController();
    const store = controller.toStore();
    await store.fetch(["a"], () => Promise.resolve(1));
    const seen: QueryDevtoolsSnapshot[] = [];
    store.devtools.subscribe((s) => seen.push(s));

    store.remove();

    expect(seen).toHaveLength(1);
    expect(seen[0]?.entries).toEqual([]);
  });

  test("fires on setData()", async () => {
    const controller = new QueryController();
    const store = controller.toStore();
    await store.fetch(["a"], () => Promise.resolve(1));
    const seen: QueryDevtoolsSnapshot[] = [];
    store.devtools.subscribe((s) => seen.push(s));

    store.setData(["a"], 2);

    expect(seen.at(-1)?.entries[0]?.data).toBe(2);
  });

  test("hands back an unsubscribe that stops the callback", async () => {
    const controller = new QueryController();
    const store = controller.toStore();
    const seen: QueryDevtoolsSnapshot[] = [];
    const stop = store.devtools.subscribe((s) => seen.push(s));

    await store.fetch(["a"], () => Promise.resolve(1));
    const countWhileSubscribed = seen.length;
    stop();

    await store.fetch(["b"], () => Promise.resolve(2));

    expect(countWhileSubscribed).toBeGreaterThan(0);
    expect(seen).toHaveLength(countWhileSubscribed);
  });

  test("unsubscribing twice is harmless", () => {
    const store = new QueryController().toStore();
    const stop = store.devtools.subscribe(() => {});

    expect(() => {
      stop();
      stop();
    }).not.toThrow();
  });

  test("subscribers are independent of each other", async () => {
    const controller = new QueryController();
    const store = controller.toStore();
    const first: QueryDevtoolsSnapshot[] = [];
    const second: QueryDevtoolsSnapshot[] = [];
    const stopFirst = store.devtools.subscribe((s) => first.push(s));
    store.devtools.subscribe((s) => second.push(s));

    await store.fetch(["a"], () => Promise.resolve(1));
    const secondCount = second.length;
    stopFirst();
    await store.fetch(["b"], () => Promise.resolve(2));

    expect(secondCount).toBeGreaterThan(0);
    // The second subscriber kept going; the first one stopped exactly where it was.
    expect(second.length).toBeGreaterThan(secondCount);
    expect(first.at(-1)?.entries).toHaveLength(1);
  });

  test("unsubscribing during a notification does not skip the others", async () => {
    const controller = new QueryController();
    const store = controller.toStore();
    const seen: string[] = [];
    let stopFirst = (): void => {};
    const first = (): void => {
      seen.push("first");
      stopFirst();
    };
    stopFirst = store.devtools.subscribe(first);
    store.devtools.subscribe(() => seen.push("second"));

    await store.fetch(["a"], () => Promise.resolve(1));

    expect(seen).toContain("first");
    expect(seen).toContain("second");
    expect(seen.at(-1)).toBe("second");
  });

  test("goes silent after destroy(): no callback, no leak", async () => {
    const controller = new QueryController();
    const store = controller.toStore();
    let calls = 0;
    store.devtools.subscribe(() => {
      calls += 1;
    });

    await store.fetch(["a"], () => Promise.resolve(1));
    const callsBeforeDestroy = calls;
    expect(callsBeforeDestroy).toBeGreaterThan(0);

    store.destroy();

    // Nothing that happens afterwards — including work an in-flight request
    // finishes — may reach a subscriber that belonged to the dead controller.
    await store.fetch(["late"], () => Promise.resolve(2));
    store.setData(["a"], 3);

    expect(calls).toBe(callsBeforeDestroy);
  });

  test("subscribing to a destroyed controller is a no-op with a working unsubscribe", () => {
    const controller = new QueryController();
    const store = controller.toStore();
    store.destroy();

    let calls = 0;
    const stop = store.devtools.subscribe(() => {
      calls += 1;
    });
    store.setData(["a"], 1);

    expect(calls).toBe(0);
    expect(typeof stop).toBe("function");
    expect(() => stop()).not.toThrow();
  });
});
