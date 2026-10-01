/**
 * Loading-state truth for the command palette: `loadingIds`, the per-item
 * `loading` flag (including the `visibleItems` memoization key) and the removal
 * of the unreachable `hidden` field from `CommandItemState`.
 *
 * No fake timers: every async action returns a promise the test resolves by
 * hand, so every assertion is deterministic.
 */

import { describe, expect, test } from "vite-plus/test";

import { createCommandController } from "../src/controller";
import type { CommandItem } from "../src/types";

/** A promise plus the handles the test uses to settle it deterministically. */
function deferred(): { promise: Promise<void>; resolve: () => void } {
  let resolve!: () => void;
  const promise = new Promise<void>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

function item(id: string, action: () => void | Promise<void>): CommandItem {
  return { id, label: id, action };
}

describe("loadingIds projection", () => {
  test("reports the running item id while its action promise is in flight", () => {
    const gate = deferred();
    const controller = createCommandController({ id: "cmd", closeOnRun: false });
    controller.register(item("deploy", () => gate.promise));

    expect(controller.loadingIds).toEqual([]);

    const run = controller.run("deploy");

    expect(controller.runningId).toBe("deploy");
    expect(controller.loadingIds).toEqual(["deploy"]);

    gate.resolve();
    return run.then(() => {
      expect(controller.loadingIds).toEqual([]);
    });
  });

  test("every in-flight run is reported, in start order, while concurrent runs overlap", () => {
    const first = deferred();
    const second = deferred();
    const controller = createCommandController({ id: "cmd", closeOnRun: false });
    controller.register(item("a", () => first.promise));
    controller.register(item("b", () => second.promise));

    const runA = controller.run("a");
    expect(controller.loadingIds).toEqual(["a"]);

    // Concurrent runs are allowed, and the first one is not dropped from the
    // projection: both actions are still pending, so both ids are in flight.
    const runB = controller.run("b");
    expect(controller.loadingIds).toEqual(["a", "b"]);

    first.resolve();
    second.resolve();
    return Promise.all([runA, runB]).then(() => {
      expect(controller.loadingIds).toEqual([]);
    });
  });

  test("a still-pending first run keeps reporting loading after the second run resolves", () => {
    const first = deferred();
    const second = deferred();
    const controller = createCommandController({ id: "cmd", closeOnRun: false });
    controller.register(item("a", () => first.promise));
    controller.register(item("b", () => second.promise));

    const runA = controller.run("a");
    const runB = controller.run("b");
    expect(controller.loadingIds).toEqual(["a", "b"]);

    // Settling the second run must only touch the second run's bookkeeping.
    second.resolve();
    return runB
      .then(() => {
        expect(controller.loadingIds).toEqual(["a"]);
        const during = controller.visibleItems;
        expect(during.filter((s) => s.loading).map((s) => s.id)).toEqual(["a"]);

        first.resolve();
        return runA;
      })
      .then(() => {
        expect(controller.loadingIds).toEqual([]);
        expect(controller.visibleItems.some((s) => s.loading)).toBe(false);
      });
  });

  test("cancelRun clears every in-flight run, not just the newest", () => {
    const first = deferred();
    const second = deferred();
    const controller = createCommandController({ id: "cmd", closeOnRun: false });
    controller.register(item("a", () => first.promise));
    controller.register(item("b", () => second.promise));

    const runA = controller.run("a");
    const runB = controller.run("b");
    expect(controller.loadingIds).toEqual(["a", "b"]);

    controller.cancelRun();
    expect(controller.loadingIds).toEqual([]);
    expect(controller.runningId).toBeNull();
    expect(controller.executionState).toBe("idle");
    expect(controller.visibleItems.some((s) => s.loading)).toBe(false);

    first.resolve();
    second.resolve();
    return Promise.all([runA, runB]).then(() => {
      expect(controller.loadingIds).toEqual([]);
    });
  });

  test("runningId is the most recently started in-flight item and clears when all settle", () => {
    const first = deferred();
    const second = deferred();
    const controller = createCommandController({ id: "cmd", closeOnRun: false });
    controller.register(item("a", () => first.promise));
    controller.register(item("b", () => second.promise));

    const runA = controller.run("a");
    expect(controller.runningId).toBe("a");

    const runB = controller.run("b");
    expect(controller.runningId).toBe("b");

    // The newest settles first, so the accessor falls back to the older run.
    second.resolve();
    return runB
      .then(() => {
        expect(controller.runningId).toBe("a");

        first.resolve();
        return runA;
      })
      .then(() => {
        expect(controller.runningId).toBeNull();
        expect(controller.executionState).toBe("idle");
      });
  });

  test("returns a fresh array on every read so a caller cannot corrupt the controller", () => {
    const controller = createCommandController({ id: "cmd" });
    const first = controller.loadingIds;
    const second = controller.loadingIds;
    expect(first).not.toBe(second);

    first.push("injected");
    expect(controller.loadingIds).toEqual([]);
    expect(controller.loadingIds).not.toBe(first);
  });
});

describe("per-item loading flag and visibleItems memoization", () => {
  test("item reports loading while running and not after the promise resolves", () => {
    const gate = deferred();
    const controller = createCommandController({ id: "cmd", closeOnRun: false });
    controller.register(item("deploy", () => gate.promise));

    // Prime the memo cache before the run.
    const before = controller.visibleItems;
    expect(before).toHaveLength(1);
    expect(before[0].loading).toBe(false);

    const run = controller.run("deploy");

    const during = controller.visibleItems;
    expect(controller.itemState("deploy")?.loading).toBe(true);
    expect(during.filter((s) => s.loading).map((s) => s.id)).toEqual(["deploy"]);

    gate.resolve();
    return run.then(() => {
      const after = controller.visibleItems;
      expect(controller.itemState("deploy")?.loading).toBe(false);
      expect(after.some((s) => s.loading)).toBe(false);
      // The running id is part of the cache key, so the list is recomputed.
      expect(after).not.toBe(during);
    });
  });

  test("running id is part of the visibleItems cache key (cancelRun keeps the cache)", () => {
    const gate = deferred();
    const controller = createCommandController({ id: "cmd", closeOnRun: false });
    controller.register(item("deploy", () => gate.promise));
    const before = controller.visibleItems;

    const run = controller.run("deploy");
    const during = controller.visibleItems;
    expect(during).not.toBe(before);
    expect(during[0].loading).toBe(true);

    // `cancelRun` does not drop the memo cache, so a recomputation here can only
    // come from the running id being part of the cache key.
    controller.cancelRun();
    const afterCancel = controller.visibleItems;
    expect(afterCancel).not.toBe(during);
    expect(afterCancel[0].loading).toBe(false);

    gate.resolve();
    return run;
  });

  test("two concurrent items both report loading: true", () => {
    const first = deferred();
    const second = deferred();
    const controller = createCommandController({ id: "cmd", closeOnRun: false });
    controller.register(item("a", () => first.promise));
    controller.register(item("b", () => second.promise));

    const runA = controller.run("a");
    expect(controller.visibleItems.filter((s) => s.loading).map((s) => s.id)).toEqual(["a"]);

    const runB = controller.run("b");
    expect(controller.visibleItems.filter((s) => s.loading).map((s) => s.id)).toEqual(["a", "b"]);

    second.resolve();
    return runB
      .then(() => {
        expect(controller.visibleItems.filter((s) => s.loading).map((s) => s.id)).toEqual(["a"]);
        first.resolve();
        return runA;
      })
      .then(() => {
        expect(controller.visibleItems.some((s) => s.loading)).toBe(false);
      });
  });

  test("the in-flight set, not a single id or a count, is part of the visibleItems cache key", () => {
    const first = deferred();
    const second = deferred();
    const controller = createCommandController({ id: "cmd", closeOnRun: false });
    controller.register(item("a", () => first.promise));
    controller.register(item("b", () => second.promise));

    const runA = controller.run("a");
    const duringA = controller.visibleItems;
    expect(duringA.filter((s) => s.loading).map((s) => s.id)).toEqual(["a"]);

    // `cancelRun` does not drop the memo cache, so it is the only way to change
    // the in-flight set without the run success path nulling `_vis`.
    controller.cancelRun();
    const empty = controller.visibleItems;
    expect(empty).not.toBe(duringA);
    expect(empty.some((s) => s.loading)).toBe(false);

    // One id in flight again, but a different one: a count-only key would collide
    // with the `["a"]` key computed above.
    const runB = controller.run("b");
    const duringB = controller.visibleItems;
    expect(duringB).not.toBe(duringA);
    expect(duringB).not.toBe(empty);
    expect(duringB.filter((s) => s.loading).map((s) => s.id)).toEqual(["b"]);

    second.resolve();
    return runB
      .then(() => {
        first.resolve();
        return runA;
      })
      .then(() => {
        expect(controller.visibleItems.some((s) => s.loading)).toBe(false);
      });
  });
});

describe("CommandItemState shape", () => {
  test("hidden is absent from every item state (compile-time guarantee comes from the type)", () => {
    const controller = createCommandController({ id: "cmd" });
    controller.register(item("visible", () => {}));
    controller.register({ id: "hidden-item", label: "hidden", hidden: true, action: () => {} });

    const state = controller.itemState("visible");
    expect(state).not.toBeNull();
    expect(state).toBeDefined();
    if (!state) return;
    expect("hidden" in state).toBe(false);
    for (const entry of controller.visibleItems) {
      expect("hidden" in entry).toBe(false);
    }
  });
});
