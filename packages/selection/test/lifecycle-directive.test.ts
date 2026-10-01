// @vitest-environment happy-dom
/**
 * `x-selection` — create on mount, destroy on teardown.
 *
 * The failure this exists to prevent is a leak, not a syntax problem. The
 * registry is reactive and long-lived, so an instance created for a component
 * that is later unmounted keeps its snapshot alive — the playground docs spell
 * the same rule out for `collection`: "create on mount and destroy on teardown,
 * or the memory grows one instance per navigation."
 *
 * A store registration has no Alpine-invoked teardown in Alpine 3.17 —
 * `plugin()` discards the callback's return value and the Alpine object exposes
 * no `cleanup`/`stop()` — so the directive's own `cleanup()` is the only
 * mechanism the runtime really invokes, queued in `el._x_cleanups` and drained
 * by `cleanupElement` when the element leaves the tree.
 *
 * The observable is the store's own instance registry: a real element removal
 * must remove the instance from it.
 */
import { clearAllSingletons } from "@ailura/alpinejs-core/singletons";
import { html, mount, reset, resume, settled, start } from "@ailura/alpinejs-testing";
import Alpine from "alpinejs";
import { afterEach, beforeAll, beforeEach, describe, expect, test } from "vite-plus/test";

import { selectionPlugin } from "../src/plugin";
import type { SelectionStore } from "../src/types";

function store(): SelectionStore {
  return (Alpine as unknown as { store(name: string): SelectionStore }).store("selection");
}

// `start()` runs once per file because Alpine is a singleton; each test
// re-registers the plugin so it gets a fresh controller and a fresh registry.
/**
 * Flush past Alpine's mutation observer.
 *
 * A directive's `cleanup()` runs from the observer's `childList` callback, and
 * `settled()`'s two ticks are not always enough to reach it after an
 * `el.remove()`. Draining microtasks in between matches what
 * `packages/carousel/test/viewport-directive.test.ts` does for the same
 * reason.
 */
async function flush(): Promise<void> {
  await settled();
  for (let i = 0; i < 20; i += 1) await Promise.resolve();
  await settled();
}

beforeAll(() => {
  start(() => {});
});

beforeEach(() => {
  clearAllSingletons();
  selectionPlugin()(Alpine as unknown as import("alpinejs").Alpine);
  resume();
});

afterEach(() => {
  reset();
});

describe("x-selection directive", () => {
  test("an explicit id registers the instance on mount", async () => {
    const root = html(`<div x-data><ul x-selection="'files'"></ul></div>`);
    mount(root);
    await settled();

    // A bare id carries no options, so the controller's own default applies.
    expect(store().instances["files"]).toBeDefined();
    expect(store().instances["files"]?.mode).toBe("single");
  });

  test("an options bag is read as options, not as an id", async () => {
    const root = html(
      `<div x-data="{ keys: ['a','b'] }"><ul x-selection="{ id: 'files', mode: 'multiple', keys }"></ul></div>`
    );
    mount(root);
    await settled();

    expect(store().instances["files"]?.mode).toBe("multiple");
    expect(store().instances["files"]?.keys).toEqual(["a", "b"]);
  });

  test("without an explicit id one is generated and exposed on the element", async () => {
    const root = html(`<div x-data><ul x-selection="{ mode: 'single' }"></ul></div>`);
    mount(root);
    await settled();

    const el = root.querySelector("ul") as HTMLElement;
    const id = el.dataset.selectionId;
    expect(id).toBeTruthy();
    expect(store().instances[id ?? ""]).toBeDefined();
  });

  test("destroys the instance when Alpine removes the element", async () => {
    const root = html(`<div x-data><ul id="box" x-selection="'files'"></ul></div>`);
    mount(root);
    await settled();
    expect(store().instances["files"]).toBeDefined();

    root.querySelector("#box")?.remove();
    await flush();

    // The whole point: without this, the instance outlives its component.
    expect(store().instances["files"]).toBeUndefined();
  });

  test("removes the generated id attribute on teardown", async () => {
    const root = html(`<div x-data><ul id="box" x-selection="{ mode: 'single' }"></ul></div>`);
    mount(root);
    await settled();

    const el = root.querySelector("#box") as HTMLElement;
    expect(el.dataset.selectionId).toBeTruthy();

    el.remove();
    await flush();

    const gone = root.querySelector("#box");
    // The element is detached, so the attribute is asserted through the
    // reference the test kept rather than through a fresh query.
    expect(el.dataset.selectionId).toBeUndefined();
    expect(gone).toBeNull();
  });

  test("the hand-written create is unchanged — additive, not a replacement", async () => {
    const root = html(
      `<div x-data><ul x-init="$store.selection.create('manual', { mode: 'single' })"></ul></div>`
    );
    mount(root);
    await settled();

    expect(store().instances["manual"]).toBeDefined();
  });

  test("an empty expression registers nothing and throws nothing", async () => {
    const root = html(`<div x-data><ul x-selection></ul></div>`);
    mount(root);
    await settled();

    expect(Object.keys(store().instances)).toHaveLength(0);
  });
});
