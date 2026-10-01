import { atom } from "nanostores";
import type { WritableAtom } from "nanostores";
/**
 * Contract tests for `createNanostoresStoreAdapter`.
 *
 * The adapter owns one nanostores `atom` per handle, and the controller that
 * consumes it never reads a cache entry back out — the handle is a sink. So the
 * tests here observe it from the outside only: what `get()` returns, what
 * `set()` changes, what a subscriber on the atom sees, and what `destroy()`
 * releases.
 *
 * Two families, because a store is reachable in two ways. With no `create`
 * option the adapter allocates its own atom and the handle is all a caller
 * holds. With one, the caller's creator hands the atom back and
 * `store.subscribe` — a real, public nanostores API — observes every published
 * snapshot. That second family is the reason the option exists, so it is tested
 * as behaviour, not as a private field.
 */
import { describe, expect, test } from "vite-plus/test";

import { createNanostoresStoreAdapter } from "../src/adapter";
import type { NanostoresStoreCreator } from "../src/adapter";

/** A snapshot shaped like the one `QueryController` publishes. */
function createSnapshot(entries: string[]) {
  return { phase: "idle", entries: entries.map((key) => ({ key: [key] })), mutations: [] };
}

/**
 * An adapter whose atoms the test holds on to, the way a host does.
 *
 * The wrapper is one line over `atom` and changes nothing about the store: the
 * point is only that the same function the adapter would have called is now the
 * one that remembers what it returned.
 */
function createRecordingAdapter() {
  const stores: WritableAtom<unknown>[] = [];
  const create: NanostoresStoreCreator = (initial) => {
    const store = atom(initial);
    stores.push(store);
    return store;
  };
  return { adapter: createNanostoresStoreAdapter({ create }), stores };
}

describe("createNanostoresStoreAdapter", () => {
  test("get() returns the initial value the controller created the handle with", () => {
    const handle = createNanostoresStoreAdapter().create({ id: 1 });

    expect(handle.get()).toEqual({ id: 1 });
  });

  test("set() stores exactly what the controller published, by reference", () => {
    const handle = createNanostoresStoreAdapter().create(undefined);
    const snapshot = createSnapshot(["todos"]);

    handle.set(snapshot);

    // By reference, not a copy: a snapshot is the controller's own value, and an
    // adapter that cloned it would freeze the first publish in time forever.
    expect(handle.get()).toBe(snapshot);
    expect(handle.get()).toEqual({ phase: "idle", entries: [{ key: ["todos"] }], mutations: [] });
  });

  test("a nanostores subscriber on an injected atom observes every published snapshot", () => {
    const { adapter, stores } = createRecordingAdapter();
    const handle = adapter.create(createSnapshot(["initial"]));
    const seen: unknown[] = [];
    // The host-side wiring this package exists for: the atom the adapter wrote
    // into is the atom the caller holds, so `subscribe` is real, public
    // nanostores API applied to the adapter's own store — not to a look-alike.
    // It fires once on attach with the current value, which is the handle's own
    // initial snapshot.
    const unsubscribe = stores[0].subscribe((value) => seen.push(value));

    handle.set(createSnapshot(["first"]));
    handle.set(createSnapshot(["second"]));
    unsubscribe();

    expect(seen).toEqual([
      { phase: "idle", entries: [{ key: ["initial"] }], mutations: [] },
      { phase: "idle", entries: [{ key: ["first"] }], mutations: [] },
      { phase: "idle", entries: [{ key: ["second"] }], mutations: [] },
    ]);
    expect(stores[0].get()).toEqual(handle.get());
  });

  test("an injected atom sees the value the handle was created with", () => {
    const { adapter, stores } = createRecordingAdapter();
    const initial = createSnapshot(["initial"]);

    adapter.create(initial);

    // nanostores keeps the initial value readable on its own terms, which a
    // handle alone cannot offer: this is a read of the store, not of the
    // adapter. `init` is the value the atom was created with, untouched by
    // every later publish.
    expect(stores[0].get()).toEqual(initial);
    expect(stores[0].init).toEqual(initial);
  });

  test("the default path allocates its own atoms and keeps the same handle semantics", () => {
    const handle = createNanostoresStoreAdapter().create(createSnapshot(["default"]));
    const snapshot = createSnapshot(["published"]);

    handle.set(snapshot);

    expect(handle.get()).toBe(snapshot);

    handle.destroy();
    expect(handle.get()).toBeUndefined();
  });

  test("an injected atom also carries the release: destroy() is final there too", () => {
    const { adapter, stores } = createRecordingAdapter();
    const handle = adapter.create(createSnapshot(["value"]));

    handle.destroy();
    handle.set(createSnapshot(["after destroy"]));

    // `set` is inert on the atom, not just hidden from `get`.
    expect(stores[0].get()).toBeUndefined();
    expect(handle.get()).toBeUndefined();
  });

  test("destroy() stays idempotent on an injected atom", () => {
    const { adapter, stores } = createRecordingAdapter();
    const handle = adapter.create("value");

    expect(() => {
      handle.destroy();
      handle.destroy();
    }).not.toThrow();
    expect(stores[0].get()).toBeUndefined();
  });

  test("destroy() detaches the listener the handle registered", () => {
    const { adapter, stores } = createRecordingAdapter();
    const handle = adapter.create(createSnapshot(["value"]));
    // The adapter holds exactly one listener of its own — the one that keeps
    // the store mounted — so the count goes 1 on creation and 2 once the
    // caller subscribes on top of it.
    const unsubscribe = stores[0].subscribe(() => {});

    handle.destroy();

    // Only the caller's own binding is left. Nothing of this package's survives
    // a released handle, and the handle's unbind is a real teardown rather than
    // a `clean`-style dev-only hook: nanostores has no per-store `destroy()`.
    expect(stores[0].lc).toBe(1);
    unsubscribe();
    expect(stores[0].lc).toBe(0);
  });

  test("a subscriber on a released handle is never called again", () => {
    const { adapter, stores } = createRecordingAdapter();
    const handle = adapter.create(createSnapshot(["value"]));
    const seen: unknown[] = [];
    const unsubscribe = stores[0].subscribe((value) => seen.push(value));

    handle.destroy();
    handle.set(createSnapshot(["after destroy"]));
    unsubscribe();

    // `subscribe` fires once on attach, then the release blanks the atom and
    // the late write is dropped by the latch — so nothing is ever published into
    // a store the caller was told is spent.
    expect(seen).toEqual([
      { phase: "idle", entries: [{ key: ["value"] }], mutations: [] },
      undefined,
    ]);
  });

  test("one adapter creates many independent atoms, injected or not", () => {
    const { adapter, stores } = createRecordingAdapter();
    const handles = [0, 1, 2].map((n) => adapter.create(n));
    const seen: unknown[] = [];
    stores[0].subscribe((value) => seen.push(value));

    handles[1].set("changed");
    handles[0].destroy();

    expect(handles.map((handle) => handle.get())).toEqual([undefined, "changed", 2]);
    expect(stores[1].get()).toBe("changed");
    expect(stores[2].get()).toBe(2);
    // Only the released store notified: a store shared across handles would
    // have leaked the sibling's write into this subscriber.
    expect(seen).toEqual([0, undefined]);
  });

  test("destroy() releases the snapshot the atom held", () => {
    const handle = createNanostoresStoreAdapter().create("keep");
    handle.set(createSnapshot(["before"]));

    handle.destroy();

    // RED-first: a handle that kept reporting its value after the caller
    // believed it was released.
    expect(handle.get()).toBeUndefined();
  });

  test("destroy() is final: set() cannot resurrect a released handle", () => {
    const handle = createNanostoresStoreAdapter().create(createSnapshot(["value"]));

    handle.destroy();
    handle.set(createSnapshot(["after destroy"]));

    expect(handle.get()).toBeUndefined();
  });

  test("destroy() is idempotent", () => {
    const handle = createNanostoresStoreAdapter().create("value");

    expect(() => {
      handle.destroy();
      handle.destroy();
    }).not.toThrow();
    expect(handle.get()).toBeUndefined();
  });

  test("handles are independent: destroying one leaves the other readable", () => {
    const adapter = createNanostoresStoreAdapter();
    const first = adapter.create(createSnapshot(["first"]));
    const second = adapter.create(createSnapshot(["second"]));

    first.destroy();

    expect(first.get()).toBeUndefined();
    expect(second.get()).toEqual({ phase: "idle", entries: [{ key: ["second"] }], mutations: [] });
  });

  test("one adapter serves many handles without sharing state", () => {
    const adapter = createNanostoresStoreAdapter();
    const handles = [0, 1, 2].map((n) => adapter.create(n));

    expect(handles.map((handle) => handle.get())).toEqual([0, 1, 2]);
  });

  test("the adapter works with no Alpine instance present", () => {
    // `nanostores` touches no DOM and no `window`; nothing in this file
    // constructs an Alpine instance, and nothing needs one. If this test ever
    // starts failing on a `window` reference, the package has reached for the
    // DOM.
    expect(typeof globalThis).toBe("object");
    const handle = createNanostoresStoreAdapter().create(createSnapshot(["ssr"]));

    expect(handle.get()).toEqual({ phase: "idle", entries: [{ key: ["ssr"] }], mutations: [] });

    handle.destroy();
    expect(handle.get()).toBeUndefined();
  });
});
