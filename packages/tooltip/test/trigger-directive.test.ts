// @vitest-environment happy-dom
/**
 * `x-tooltip` — the element-bound half of a tooltip trigger.
 *
 * `bindTrigger` attaches five listeners (`mouseenter`, `mousemove`,
 * `mouseleave`, `focus`, `blur`) plus a shared window `scroll` watcher, and a
 * store registration has no Alpine-invoked teardown in Alpine 3.17: `plugin()`
 * discards the callback's return value and the Alpine object exposes no
 * `cleanup`/`stop()`. The directive's own `cleanup()` is therefore the only
 * mechanism the runtime really invokes, queued in `el._x_cleanups` and drained
 * by `cleanupElement` when the element leaves the tree.
 *
 * These tests therefore prove the release through a real element removal
 * against a real Alpine instance. The observable is the listeners themselves:
 * dispatching a real `mouseenter` on a removed trigger must not open anything,
 * which is only true if the release actually ran.
 */
import { clearAllSingletons } from "@ailura/alpinejs-core/singletons";
import { html, mount, reset, resume, settled, start } from "@ailura/alpinejs-testing";
import Alpine from "alpinejs";
import { afterEach, beforeAll, beforeEach, describe, expect, test } from "vite-plus/test";

import { tooltipPlugin } from "../src/plugin";
import type { TooltipStore } from "../src/types";

/** Read the live store out of the running Alpine instance. */
function store(): TooltipStore {
  return (Alpine as unknown as { store(name: string): TooltipStore }).store("tooltip");
}

// `start()` runs once per file because Alpine is a singleton, and each test
// registers the plugin again so it gets a fresh controller — otherwise the
// instances registered by one test would still be in the store for the next.
beforeAll(() => {
  start(() => {});
});

beforeEach(() => {
  clearAllSingletons();
  tooltipPlugin()(Alpine as unknown as import("alpinejs").Alpine);
  resume();
});

afterEach(() => {
  reset();
});

describe("x-tooltip directive", () => {
  test("the directive registers the instance, so no separate register() call", async () => {
    const root = html(`<div x-data><button x-tooltip="'save-hint'">Save</button></div>`);
    mount(root);
    await settled();

    expect(store().instances["save-hint"]).toBeDefined();
  });

  test("an id held in a variable resolves reactively", async () => {
    // The quoted form is the documented one, so an unquoted expression is a real
    // expression — `x-tooltip="id"` must read the variable rather than binding
    // the id `"id"`.
    const root = html(
      `<div x-data="{ id: 'first' }"><button id="b" x-tooltip="id"></button></div>`
    );
    mount(root);
    await settled();

    expect(store().instances["first"]).toBeDefined();
    // No phantom instance named after the variable.
    expect(store().instances["id"]).toBeUndefined();

    (root.querySelector("#b") as HTMLElement).dispatchEvent(new MouseEvent("mouseenter"));
    await settled();
    expect(store().isOpen("first")).toBe(true);
  });

  test("a real mouseenter opens the tooltip", async () => {
    const root = html(`<div x-data><button x-tooltip="'hint'">Hover</button></div>`);
    mount(root);
    await settled();

    root.querySelector("button")?.dispatchEvent(new MouseEvent("mouseenter"));
    await settled();
    expect(store().isOpen("hint")).toBe(true);
  });

  test("a real focus opens the tooltip", async () => {
    const root = html(`<div x-data><button x-tooltip="'hint'">Focus</button></div>`);
    mount(root);
    await settled();

    root.querySelector("button")?.dispatchEvent(new FocusEvent("focus"));
    await settled();
    expect(store().isOpen("hint")).toBe(true);
  });

  test("releases the listeners when Alpine removes the trigger", async () => {
    const root = html(`<div x-data><button x-tooltip="'hint'">Hover</button></div>`);
    mount(root);
    await settled();

    const button = root.querySelector("button");
    button?.dispatchEvent(new MouseEvent("mouseenter"));
    await settled();
    expect(store().isOpen("hint")).toBe(true);

    button?.remove();
    await settled();

    // The instance survives the teardown on purpose (the panel is teleported
    // and still reads it), so it is still open here. Close it first, then prove
    // the release: a fresh `mouseenter` on the detached node must not reopen it,
    // which is only true if the listeners were actually removed.
    store().close("hint");
    await settled();
    expect(store().isOpen("hint")).toBe(false);

    button?.dispatchEvent(new MouseEvent("mouseenter"));
    await settled();
    expect(store().isOpen("hint")).toBe(false);
  });

  test("the instance survives the teardown, so the panel can still read it", async () => {
    const root = html(`<div x-data><button x-tooltip="'kept'">Hover</button></div>`);
    mount(root);
    await settled();

    root.querySelector("button")?.remove();
    await settled();

    // Unbind, not unregister: the panel is usually teleported into a portal and
    // outlives the trigger, so it still reads this instance.
    expect(store().instances["kept"]).toBeDefined();
  });

  test(".sticky opts out of the scroll-away close", async () => {
    const root = html(`<div x-data><button x-tooltip.sticky="'pinned'">Hover</button></div>`);
    mount(root);
    await settled();

    expect(store().instances["pinned"]?.closeOnScrollAway).toBe(false);
  });

  test("without .sticky the scroll-away close stays on", async () => {
    const root = html(`<div x-data><button x-tooltip="'loose'">Hover</button></div>`);
    mount(root);
    await settled();

    expect(store().instances["loose"]?.closeOnScrollAway).toBe(true);
  });

  test("an empty expression binds nothing and throws nothing", async () => {
    const root = html(`<div x-data><button x-tooltip>Hover</button></div>`);
    mount(root);
    await settled();

    root.querySelector("button")?.dispatchEvent(new MouseEvent("mouseenter"));
    await settled();
    expect(Object.keys(store().instances)).toHaveLength(0);
  });

  test("the hand-written bindTrigger is unchanged — additive, not a replacement", async () => {
    const root = html(
      `<div x-data><button id="manual" x-init="$store.tooltip.bindTrigger('manual', $el)">Hover</button></div>`
    );
    mount(root);
    await settled();

    root.querySelector("#manual")?.dispatchEvent(new MouseEvent("mouseenter"));
    await settled();
    expect(store().isOpen("manual")).toBe(true);
  });
});
