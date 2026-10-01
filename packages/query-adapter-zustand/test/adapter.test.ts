/**
 * Contract tests for `createZustandStoreAdapter`.
 *
 * The adapter owns one `zustand/vanilla` store per handle, and the controller
 * that consumes it never reads a cache entry back out — the handle is a sink.
 * So the tests here observe it from the outside only: what `get()` returns,
 * what `set()` changes, and what `destroy()` releases.
 *
 * Two families, because a store is reachable in two ways. With no `create`
 * option the adapter allocates its own store and the handle is all a caller
 * holds. With one, the caller's creator hands the store back and
 * `store.subscribe` — a real, public zustand API — observes every published
 * snapshot. That second family is the reason the option exists, so it is tested
 * as behaviour, not as a private field.
 */
import { describe, expect, test } from "vite-plus/test";
import { createStore } from "zustand/vanilla";
import type { StoreApi } from "zustand/vanilla";

import { createZustandStoreAdapter } from "../src/adapter";
import type { ZustandStoreCreator } from "../src/adapter";

/** A snapshot shaped like the one `QueryController` publishes. */
function createSnapshot(entries: string[]) {
  return { phase: "idle", entries: entries.map((key) => ({ key: [key] })), mutations: [] };
}

/**
 * An adapter whose stores the test holds on to, the way a host does.
 *
 * The wrapper is one line over `createStore` and changes nothing about the
 * store: the point is only that the same function the adapter would have called
 * is now the one that remembers what it returned.
 */
function createRecordingAdapter() {
  const stores: StoreApi<{ value: unknown }>[] = [];
  const create: ZustandStoreCreator = (initializer) => {
    const store = createStore(initializer);
    stores.push(store);
    return store;
  };
  return { adapter: createZustandStoreAdapter({ create }), stores };
}

describe("createZustandStoreAdapter", () => {
  test("get() returns the initial value the controller created the handle with", () => {
    const handle = createZustandStoreAdapter().create({ id: 1 });

    expect(handle.get()).toEqual({ id: 1 });
  });

  test("set() stores exactly what the controller published, by reference", () => {
    const handle = createZustandStoreAdapter().create(undefined);
    const snapshot = createSnapshot(["todos"]);

    handle.set(snapshot);

    // By reference, not a copy: a snapshot is the controller's own value, and an
    // adapter that cloned it would freeze the first publish in time forever.
    expect(handle.get()).toBe(snapshot);
    expect(handle.get()).toEqual({ phase: "idle", entries: [{ key: ["todos"] }], mutations: [] });
  });

  test("a zustand subscriber on an injected store observes every published snapshot", () => {
    const { adapter, stores } = createRecordingAdapter();
    const handle = adapter.create(undefined);
    const seen: unknown[] = [];
    // The host-side wiring this package exists for: the store the adapter wrote
    // into is the store the caller holds, so `subscribe` is real, public zustand
    // API applied to the adapter's own state — not to a look-alike.
    const unsubscribe = stores[0].subscribe((state) => seen.push(state.value));

    handle.set(createSnapshot(["first"]));
    handle.set(createSnapshot(["second"]));
    unsubscribe();

    expect(seen).toEqual([
      { phase: "idle", entries: [{ key: ["first"] }], mutations: [] },
      { phase: "idle", entries: [{ key: ["second"] }], mutations: [] },
    ]);
    expect(stores[0].getState().value).toEqual(handle.get());
  });

  test("an injected store sees the value the handle was created with", () => {
    const { adapter, stores } = createRecordingAdapter();
    const initial = createSnapshot(["initial"]);

    adapter.create(initial);

    // zustand keeps the initial state readable on its own terms, which a handle
    // alone cannot offer: this is a read of the store, not of the adapter.
    expect(stores[0].getState().value).toEqual(initial);
    expect(stores[0].getInitialState().value).toEqual(initial);
  });

  test("the default path allocates its own stores and keeps the same handle semantics", () => {
    const handle = createZustandStoreAdapter().create(createSnapshot(["default"]));
    const snapshot = createSnapshot(["published"]);

    handle.set(snapshot);

    expect(handle.get()).toBe(snapshot);

    handle.destroy();
    expect(handle.get()).toBeUndefined();
  });

  test("an injected store also carries the release: destroy() is final there too", () => {
    const { adapter, stores } = createRecordingAdapter();
    const handle = adapter.create(createSnapshot(["value"]));

    handle.destroy();
    handle.set(createSnapshot(["after destroy"]));

    // `set` is inert on the store, not just hidden from `get`.
    expect(stores[0].getState().value).toBeUndefined();
    expect(handle.get()).toBeUndefined();
  });

  test("destroy() stays idempotent on an injected store", () => {
    const { adapter, stores } = createRecordingAdapter();
    const handle = adapter.create("value");

    expect(() => {
      handle.destroy();
      handle.destroy();
    }).not.toThrow();
    expect(stores[0].getState().value).toBeUndefined();
  });

  test("one adapter creates many independent stores, injected or not", () => {
    const { adapter, stores } = createRecordingAdapter();
    const handles = [0, 1, 2].map((n) => adapter.create(n));
    const seen: unknown[] = [];
    stores[0].subscribe((state) => seen.push(state.value));

    handles[1].set("changed");
    handles[0].destroy();

    expect(handles.map((handle) => handle.get())).toEqual([undefined, "changed", 2]);
    expect(stores[1].getState().value).toBe("changed");
    expect(stores[2].getState().value).toBe(2);
    // Only the released store notified: a store shared across handles would
    // have leaked the sibling's write into this subscriber.
    expect(seen).toEqual([undefined]);
  });

  test("destroy() releases the snapshot the store held", () => {
    const handle = createZustandStoreAdapter().create("keep");
    handle.set(createSnapshot(["before"]));

    handle.destroy();

    // RED-first: a handle that kept reporting its value after the caller
    // believed it was released.
    expect(handle.get()).toBeUndefined();
  });

  test("destroy() is final: set() cannot resurrect a released handle", () => {
    const handle = createZustandStoreAdapter().create(createSnapshot(["value"]));

    handle.destroy();
    handle.set(createSnapshot(["after destroy"]));

    expect(handle.get()).toBeUndefined();
  });

  test("destroy() is idempotent", () => {
    const handle = createZustandStoreAdapter().create("value");

    expect(() => {
      handle.destroy();
      handle.destroy();
    }).not.toThrow();
    expect(handle.get()).toBeUndefined();
  });

  test("handles are independent: destroying one leaves the other readable", () => {
    const adapter = createZustandStoreAdapter();
    const first = adapter.create(createSnapshot(["first"]));
    const second = adapter.create(createSnapshot(["second"]));

    first.destroy();

    expect(first.get()).toBeUndefined();
    expect(second.get()).toEqual({ phase: "idle", entries: [{ key: ["second"] }], mutations: [] });
  });

  test("one adapter serves many handles without sharing state", () => {
    const adapter = createZustandStoreAdapter();
    const handles = [0, 1, 2].map((n) => adapter.create(n));

    expect(handles.map((handle) => handle.get())).toEqual([0, 1, 2]);
  });

  test("the adapter works with no Alpine instance present", () => {
    // `zustand/vanilla` touches no DOM and no `window`; nothing in this file
    // constructs an Alpine instance, and nothing needs one. If this test ever
    // starts failing on a `window` reference, the package has reached for the
    // DOM.
    expect(typeof globalThis).toBe("object");
    const handle = createZustandStoreAdapter().create(createSnapshot(["ssr"]));

    expect(handle.get()).toEqual({ phase: "idle", entries: [{ key: ["ssr"] }], mutations: [] });

    handle.destroy();
    expect(handle.get()).toBeUndefined();
  });
});
