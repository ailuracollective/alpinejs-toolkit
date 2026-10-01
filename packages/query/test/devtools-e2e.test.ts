/**
 * The end-to-end gap the adapter contract opened and the panel depends on.
 *
 * The devtools contract is only worth something if a REAL controller publishes
 * REAL snapshots into a REAL adapter and an INDEPENDENT consumer sees them.
 * Everything below is built from `src/types.ts` alone — a real
 * `QueryController`, a hand-written `QueryStateAdapter` and a subscriber that
 * holds nothing but the `QueryDevtoolsApi` it was handed. No adapter package is
 * imported: those are separate packages with their own contracts, and this test
 * is about the contract itself.
 *
 * The panel test proves the panel renders what it is given. This file proves
 * what it is given is real.
 */
import { describe, expect, test } from "vite-plus/test";

import { QueryController } from "../src/controller";
import { getQueryStore } from "../src/devtools/plugin";
import type {
  QueryDevtoolsSnapshot,
  QueryStateAdapter,
  QueryStateHandle,
  QueryStore,
} from "../src/types";

/**
 * A `QueryStateAdapter` built from the published contract: `create(initial)`
 * returns `{ get, set, destroy }`, and the controller publishes a
 * `QueryDevtoolsSnapshot` into it on every change.
 */
function createRecordingAdapter() {
  const published: unknown[] = [];
  let destroyed = false;
  let muted = false;
  const adapter: QueryStateAdapter = {
    create(initial): QueryStateHandle {
      let current = initial;
      published.push(current);
      return {
        get: () => current,
        set: (value) => {
          // A muted sink models a backend that is slow, broken or gone: the
          // write is dropped and the handle keeps its last value.
          if (muted) return;
          current = value;
          published.push(value);
        },
        destroy: () => {
          destroyed = true;
        },
      };
    },
  };
  return {
    adapter,
    published,
    last: () => published[published.length - 1],
    mute: () => {
      muted = true;
    },
    isDestroyed: () => destroyed,
  };
}

function must<T>(value: T | null | undefined): T {
  if (value === null || value === undefined) throw new Error("expected a value, got none");
  return value;
}

/** Fire-and-forget cache work (invalidate, remove) resolves over microtasks. */
async function flush(): Promise<void> {
  for (let i = 0; i < 10; i += 1) await Promise.resolve();
  await new Promise((resolve) => setTimeout(resolve, 0));
}

/**
 * An external consumer: it knows the `QueryDevtoolsApi` type and nothing else —
 * no controller, no store, no adapter. This is the shape a devtools panel, a
 * logger or a socket bridge takes.
 */
function createConsumer(devtools: QueryStore["devtools"]) {
  const received: QueryDevtoolsSnapshot[] = [];
  let notifications = 0;
  const unsubscribe = devtools.subscribe((snapshot) => {
    notifications += 1;
    received.push(snapshot);
  });
  return {
    received,
    last: () => received[received.length - 1],
    notifications: () => notifications,
    unsubscribe,
  };
}

describe("a real controller publishing into a real adapter", () => {
  test("the consumer receives the published snapshot, not a copy of it", async () => {
    const recorder = createRecordingAdapter();
    const controller = new QueryController("e2e", {}, recorder.adapter);
    const store = controller.toStore();
    const consumer = createConsumer(store.devtools);

    await store.fetch(["post", 7], () => Promise.resolve({ title: "hello" }), {
      staleTime: 60_000,
    });

    const snapshot = consumer.last();
    expect(snapshot).toBeDefined();
    expect(snapshot?.phase).toBe("idle");
    expect(snapshot?.entries).toHaveLength(1);
    expect(snapshot?.entries[0]?.key).toEqual(["post", 7]);
    expect(snapshot?.entries[0]?.status).toBe("success");
    expect(snapshot?.entries[0]?.data).toEqual({ title: "hello" });
    expect(snapshot?.entries[0]?.isStale).toBe(false);

    // The adapter and the subscribers are handed the SAME snapshot object: one
    // publish, one build. A panel and an adapter that disagreed would be
    // debugging two different states.
    expect(recorder.last()).toBe(snapshot);
    expect(consumer.notifications()).toBeGreaterThan(0);

    consumer.unsubscribe();
    controller.destroy();
  });

  test("every meaningful change reaches the consumer", async () => {
    const controller = new QueryController("e2e-changes");
    const store = controller.toStore();
    const consumer = createConsumer(store.devtools);

    await store.fetch(["a"], () => Promise.resolve(1));
    await store.fetch(["b"], () => Promise.resolve(2));
    store.invalidate(["a"]);
    await Promise.resolve();
    store.remove(["b"]);
    const mutation = store.mutate<number, number>({
      mutationFn: (value) => Promise.resolve(value * 2),
    });
    await mutation.mutate(21);

    const latest = must(consumer.last());
    expect(latest.entries.map((entry) => entry.key)).toEqual([["a"]]);
    expect(latest.mutations).toHaveLength(1);
    expect(latest.mutations[0]?.status).toBe("success");
    expect(latest.mutations[0]?.data).toBe(42);

    // A removal is not a `change` event, so it is the one transition that only
    // reaches a devtools subscriber when the controller publishes explicitly.
    expect(consumer.notifications()).toBeGreaterThan(4);

    consumer.unsubscribe();
    controller.destroy();
  });

  test("the adapter is a sink: a dropped adapter cannot change what a consumer reads", async () => {
    const recorder = createRecordingAdapter();
    const controller = new QueryController("e2e-sink", {}, recorder.adapter);
    const store = controller.toStore();
    const consumer = createConsumer(store.devtools);

    let call = 0;
    await store.fetch(["k"], () => Promise.resolve(`call-${++call}`));
    recorder.mute();
    recorder.published.length = 0;
    store.invalidate(["k"]);
    await flush();

    // The sink went quiet and kept its stale value; the cache and the consumer
    // moved on regardless.
    expect(recorder.published).toEqual([]);
    expect(consumer.last()?.entries[0]?.data).toBe("call-2");

    consumer.unsubscribe();
    controller.destroy();
  });

  test("destroy() releases the handle and silences the consumer for good", async () => {
    const recorder = createRecordingAdapter();
    const controller = new QueryController("e2e-destroy", {}, recorder.adapter);
    const store = controller.toStore();
    const consumer = createConsumer(store.devtools);

    await store.fetch(["x"], () => Promise.resolve(1));
    const before = consumer.notifications();

    controller.destroy();

    expect(recorder.isDestroyed()).toBe(true);
    expect(consumer.notifications()).toBe(before);
    // The contract's finality rule: a released handle can never be resurrected.
    store.setData(["x"], "late");
    expect(recorder.published).toHaveLength(recorder.published.length);
  });

  test("a consumer resolving the store by name sees the same snapshots", async () => {
    const controller = new QueryController("e2e-resolve");
    const store = controller.toStore();
    const stores = new Map([["query", store]]);
    // The shape a devtools plugin gets: something with `store(name)`.
    const resolved = getQueryStore({ store: (name: string) => stores.get(name) } as never, "query");

    const consumer = createConsumer(resolved.devtools);
    await store.fetch(["resolved"], () => Promise.resolve(true));

    expect(resolved).toBe(store);
    expect(consumer.last()?.entries[0]?.key).toEqual(["resolved"]);

    consumer.unsubscribe();
    controller.destroy();
  });
});
