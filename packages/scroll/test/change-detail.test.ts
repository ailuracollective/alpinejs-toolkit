// @vitest-environment happy-dom
/**
 * `change` event detail contract for `@ailura/alpinejs-scroll`.
 *
 * Two defects are pinned here:
 *  1. `detail.previous` must be the state from BEFORE the mutation, but the
 *     section transition paths (IntersectionObserver callback and
 *     `unregisterSection`) copied the state AFTER mutating it, so
 *     `detail.previous` deep-equalled `detail.state`.
 *  2. `ScrollChangeDetail.reason` was declared but never filled: `#emit`
 *     received `_reason` and dropped it on the floor.
 *
 * The controller is driven directly; no Alpine instance is involved. Only the
 * IntersectionObserver is stubbed, because happy-dom does not provide it and
 * `#setupSections` bails out early without it.
 *
 * The last describe block is the exception: the `destroy` handle lives on the
 * store the plugin registers, so it is exercised against a real Alpine
 * instance (`Alpine.store("scroll")`), still with the IntersectionObserver
 * stubbed.
 */

import { settled, start } from "@ailura/alpinejs-testing";
import Alpine from "alpinejs";
import { afterEach, beforeAll, beforeEach, describe, expect, test } from "vite-plus/test";

import { ScrollController } from "../src/controller";
import { scrollPlugin } from "../src/plugin";
import type { ScrollChangeDetail, ScrollSectionChangeDetail, ScrollStore } from "../src/types";

interface EntryInit {
  isIntersecting: boolean;
  target: Element;
}

/** Minimal IntersectionObserver stub that records its callback and options. */
class IntersectionObserverStub {
  static instances: IntersectionObserverStub[] = [];
  static last(): IntersectionObserverStub {
    const i = this.instances[this.instances.length - 1];
    if (!i) throw new Error("no IntersectionObserver was constructed");
    return i;
  }
  static reset(): void {
    this.instances = [];
  }
  readonly callback: (entries: EntryInit[]) => void;
  readonly options: unknown;
  readonly observed: Element[] = [];

  constructor(callback: (entries: EntryInit[]) => void, options?: unknown) {
    this.callback = callback;
    this.options = options;
    IntersectionObserverStub.instances.push(this);
  }

  observe(el: Element): void {
    this.observed.push(el);
  }
  unobserve(): void {}
  disconnect(): void {}
  takeRecords(): EntryInit[] {
    return [];
  }
  /** Drive one observer callback synchronously. */
  trigger(entries: EntryInit[]): void {
    this.callback(entries);
  }
}

interface Collected {
  changes: ScrollChangeDetail[];
  sections: ScrollSectionChangeDetail[];
}

let controller: ScrollController | null = null;
let collected: Collected;

function addSection(id: string): HTMLElement {
  const el = document.createElement("section");
  el.setAttribute("data-scroll-section", id);
  document.body.append(el);
  return el;
}

function changesFor(source: ScrollChangeDetail["source"]): ScrollChangeDetail[] {
  return collected.changes.filter((c) => c.source === source);
}

beforeEach(() => {
  (globalThis as { IntersectionObserver?: unknown }).IntersectionObserver =
    IntersectionObserverStub;
  IntersectionObserverStub.reset();
  document.body.innerHTML = "";
  collected = { changes: [], sections: [] };
  controller = new ScrollController();
  controller.mount();
  controller.on("change", (detail: ScrollChangeDetail) => collected.changes.push(detail));
  controller.on("section", (detail: ScrollSectionChangeDetail) => collected.sections.push(detail));
});

afterEach(() => {
  controller?.destroy();
  controller = null;
  document.body.innerHTML = "";
  delete (globalThis as { IntersectionObserver?: unknown }).IntersectionObserver;
  IntersectionObserverStub.reset();
});

describe("ScrollController change detail", () => {
  test("RED: observer transition reports the pre-transition state as previous", () => {
    const alpha = addSection("alpha");
    const beta = addSection("beta");
    controller?.registerSection("alpha");
    controller?.registerSection("beta");
    const observer = IntersectionObserverStub.last();

    // First transition: nothing active -> "alpha".
    observer.trigger([{ isIntersecting: true, target: alpha }]);
    // Second transition: "alpha" -> "beta".
    observer.trigger([{ isIntersecting: true, target: beta }]);

    const transitions = changesFor("section");
    expect(transitions).toHaveLength(2);

    expect(transitions[0]?.state.activeSection).toBe("alpha");
    expect(transitions[0]?.previous?.activeSection).toBeNull();

    // The discriminating assertion: previous is "alpha", state is "beta".
    expect(transitions[1]?.state.activeSection).toBe("beta");
    expect(transitions[1]?.previous?.activeSection).toBe("alpha");
  });

  test("RED: unregisterSection reports the pre-unregister state as previous", () => {
    const alpha = addSection("alpha");
    controller?.registerSection("alpha");
    IntersectionObserverStub.last().trigger([{ isIntersecting: true, target: alpha }]);

    expect(changesFor("section")[0]?.state.activeSection).toBe("alpha");

    controller?.unregisterSection("alpha");

    const last = changesFor("section")[1];
    expect(last?.state.activeSection).toBeNull();
    expect(last?.previous?.activeSection).toBe("alpha");
  });

  test("RED: lockWithHandle reason reaches the change detail", () => {
    controller?.lockWithHandle("menu-open");
    const last = collected.changes[collected.changes.length - 1];
    expect(last?.source).toBe("lock");
    expect(last?.reason).toBe("menu-open");
  });

  test("RED: unlockAll reason reaches the change detail", () => {
    controller?.lockWithHandle("menu-open");
    controller?.lockWithHandle("dialog");
    controller?.unlockAll();
    const last = collected.changes[collected.changes.length - 1];
    expect(last?.source).toBe("lock");
    expect(last?.reason).toBe("unlockAll");
  });

  test("guard: one section event and one change event per active-section transition", () => {
    const alpha = addSection("alpha");
    const beta = addSection("beta");
    controller?.registerSection("alpha");
    controller?.registerSection("beta");
    const observer = IntersectionObserverStub.last();

    observer.trigger([{ isIntersecting: true, target: alpha }]);
    expect(changesFor("section")).toHaveLength(1);
    expect(collected.sections).toHaveLength(1);

    observer.trigger([{ isIntersecting: true, target: beta }]);
    expect(changesFor("section")).toHaveLength(2);
    expect(collected.sections).toHaveLength(2);

    // No transition, no emission.
    observer.trigger([{ isIntersecting: true, target: beta }]);
    expect(changesFor("section")).toHaveLength(2);
    expect(collected.sections).toHaveLength(2);
  });

  test("guard: previous is a snapshot, not a live reference", () => {
    const alpha = addSection("alpha");
    const beta = addSection("beta");
    controller?.registerSection("alpha");
    controller?.registerSection("beta");
    const observer = IntersectionObserverStub.last();

    observer.trigger([{ isIntersecting: true, target: alpha }]);
    const first = changesFor("section")[0];
    expect(first?.previous?.activeSection).toBeNull();
    expect(first?.previous?.visibleSections).toEqual([]);

    observer.trigger([{ isIntersecting: true, target: beta }]);

    // The already-delivered first detail is unaffected by the later transition.
    expect(first?.previous?.activeSection).toBeNull();
    expect(first?.previous?.visibleSections).toEqual([]);
    expect(first?.state.activeSection).toBe("alpha");
  });
});

describe("ScrollStore destroy handle (real Alpine)", () => {
  // Alpine holds process-wide singleton state: start it exactly once per file.
  beforeAll(() => {
    start(() => {});
  });

  test("RED: store.destroy() exists, releases every lock and is safe to repeat", async () => {
    // Re-registering the same package is allowed by guardStore, so every test
    // gets a fresh controller behind a fresh store.
    scrollPlugin()(Alpine as unknown as import("alpinejs").Alpine);
    const store = Alpine.store("scroll") as unknown as ScrollStore;
    expect(typeof store.destroy).toBe("function");

    // Take two locks so the teardown has real work to undo: `destroy()` runs
    // `unlockAll()`, which is observable both on the store projection and in
    // the DOM lock it applies.
    store.lock("menu-open");
    store.lock("dialog");
    await settled();
    expect(store.locked).toBe(true);
    expect(store.lockCount).toBe(2);
    expect(document.body.style.overflow).toBe("hidden");

    store.destroy();
    await settled();

    // Observable 1: every lock is released — store projection and body lock.
    expect(store.locked).toBe(false);
    expect(store.lockCount).toBe(0);
    expect(document.body.style.overflow).toBe("");
    // Observable 2: the controller is gone for good — the `change` bridge was
    // unsubscribed by the teardown, so a later `lock()` is accepted by the
    // store but no longer projects any state into it.
    store.lock("after-destroy");
    await settled();
    expect(store.locked).toBe(false);
    expect(store.lockCount).toBe(0);

    // Idempotency is the controller's guarantee, not a view-level guard.
    expect(() => store.destroy()).not.toThrow();
  });
});
