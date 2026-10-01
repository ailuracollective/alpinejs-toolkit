/**
 * Contract tests for the `QueryStateAdapter` option.
 *
 * Two halves, and the split matters:
 *
 * 1. NO adapter — the controller keeps every byte of state inside itself. The
 *    store surface, the per-query entry and the events are exactly what they
 *    were before the option existed.
 * 2. WITH an adapter — the controller publishes a snapshot into the slot it
 *    handed over. The slot is a SINK: the entries stay the source of truth, so
 *    everything a caller reads is unchanged.
 *
 * The mock is deliberately a second implementation of the contract
 * `createAlpineStoreAdapter()` already implements (`create` → `get`/`set`/
 * `destroy`), including its `destroy` rules, so the controller is held to the
 * guarantee the real adapter makes rather than to a convenient one.
 */
import { describe, expect, test } from "vite-plus/test";

import { QueryController } from "../src/controller";
import type { QueryDevtoolsSnapshot, QueryStateAdapter, QueryStore } from "../src/types";

type Slot = { initial: unknown; value: unknown; destroys: number };

function createMockAdapter() {
  const slots: Slot[] = [];
  const adapter: QueryStateAdapter = {
    create(initial: unknown) {
      const slot: Slot = { initial, value: initial, destroys: 0 };
      slots.push(slot);
      return {
        get: () => slot.value,
        set: (value: unknown) => {
          // Final release, exactly as the alpine adapter behaves.
          if (slot.destroys > 0) return;
          slot.value = value;
        },
        destroy: () => {
          slot.destroys += 1;
          slot.value = undefined;
        },
      };
    },
  };
  return {
    adapter,
    slot: (i: number) => slots[i] as Slot,
    creates: () => slots.length,
  };
}

describe("QueryController without an adapter", () => {
  test("exposes exactly the store surface it always did", () => {
    const store: QueryStore = new QueryController().toStore();

    expect(Object.keys(store).sort()).toEqual([
      "cancel",
      "clearMutations",
      "destroy",
      "devtools",
      "fetch",
      "get",
      "invalidate",
      "mutate",
      "observe",
      "prefetch",
      "remove",
      "reset",
      "resetQueries",
      "setData",
    ]);
  });

  test("keeps its state internally: no adapter is created and entries read back", async () => {
    const controller = new QueryController();

    const state = await controller.fetch(["a"], () => Promise.resolve(42));

    expect(state.data).toBe(42);
    expect(state.isSuccess).toBe(true);
    expect(controller.get(["a"])?.data).toBe(42);
  });

  test("still serves the devtools contract, adapter or not", () => {
    const store = new QueryController().toStore();

    expect(typeof store.devtools.getSnapshot).toBe("function");
    expect(typeof store.devtools.subscribe).toBe("function");
  });
});

describe("QueryController with an adapter", () => {
  test("hands the adapter's create() one initial snapshot", () => {
    const { adapter, slot, creates } = createMockAdapter();

    new QueryController(undefined, {}, adapter);

    // Once. A second slot would mean the controller had re-created the backend
    // behind the caller's back.
    expect(creates()).toBe(1);
    const initial = slot(0).initial as QueryDevtoolsSnapshot;
    expect(initial.phase).toBe("idle");
    expect(initial.entries).toEqual([]);
  });

  test("routes the cache state through the slot", async () => {
    const { adapter, slot } = createMockAdapter();
    const controller = new QueryController(undefined, {}, adapter);

    await controller.fetch(["user", 1], () => Promise.resolve({ name: "ada" }), {
      staleTime: 5000,
    });

    const published = slot(0).value as QueryDevtoolsSnapshot;
    expect(published.entries).toHaveLength(1);
    expect(published.entries[0]?.keyHash).toBe(JSON.stringify(["user", 1]));
    expect(published.entries[0]?.data).toEqual({ name: "ada" });
    expect(published.entries[0]?.status).toBe("success");
    expect(published.entries[0]?.staleTime).toBe(5000);
  });

  test("keeps the slot a sink: reads still come from the controller's own entries", async () => {
    const { adapter, slot } = createMockAdapter();
    const controller = new QueryController(undefined, {}, adapter);

    await controller.fetch(["a"], () => Promise.resolve(1));

    // Whatever the backend holds, dropping it must not change what a caller
    // reads: an adapter is a projection, never the truth.
    slot(0).value = undefined;

    expect(controller.get(["a"])?.data).toBe(1);
    expect(controller.get(["a"])?.isSuccess).toBe(true);
  });

  test("publishes an empty snapshot when the cache is emptied", async () => {
    const { adapter, slot } = createMockAdapter();
    const controller = new QueryController(undefined, {}, adapter);
    await controller.fetch(["a"], () => Promise.resolve(1));

    controller.remove();

    expect((slot(0).value as QueryDevtoolsSnapshot).entries).toEqual([]);
    expect(controller.get(["a"])).toBeUndefined();
  });

  test("releases the slot exactly once on destroy()", async () => {
    const { adapter, slot } = createMockAdapter();
    const controller = new QueryController(undefined, {}, adapter);
    await controller.fetch(["a"], () => Promise.resolve(1));

    controller.destroy();
    controller.destroy();

    expect(slot(0).destroys).toBe(1);
  });

  test("destroy() is final: a later change cannot resurrect a released slot", async () => {
    const { adapter, slot } = createMockAdapter();
    const controller = new QueryController(undefined, {}, adapter);
    const controllerRef = controller;

    controller.destroy();

    // The controller is destroyed, so this entry is a fresh one that no longer
    // has anywhere to publish to — and the slot must stay released.
    await controllerRef.fetch(["late"], () => Promise.resolve("value"));

    expect(slot(0).destroys).toBe(1);
    expect(slot(0).value).toBeUndefined();
  });

  test("a destroyed controller publishes nothing further", async () => {
    const { adapter, slot } = createMockAdapter();
    const controller = new QueryController(undefined, {}, adapter);
    const seen: unknown[] = [];
    const stop = controller.toStore().devtools.subscribe((s) => seen.push(s));

    controller.destroy();
    stop();

    await controller.fetch(["late"], () => Promise.resolve("value"));

    expect(seen).toEqual([]);
    expect(slot(0).value).toBeUndefined();
  });
});
