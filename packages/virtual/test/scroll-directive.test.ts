// @vitest-environment happy-dom
/**
 * `x-virtual-scroll` — the Alpine-invoked teardown for a virtual scroll container.
 *
 * Alpine 3.17 gives a plugin no teardown of its own: `plugin()` discards the
 * callback's return value and the Alpine object exposes no `cleanup`/`stop()`.
 * A directive's `cleanup(cb)` is the only mechanism the runtime invokes, so
 * these tests prove the release through a real element removal against a real
 * Alpine instance, the same way `packages/core/test/bridge.test.ts` does.
 *
 * The observable is the scroll listener itself: a real `scroll` event is
 * dispatched on the container, and the controller's reactive `scrollOffset`
 * only moves while the listener is attached. No stub is used anywhere.
 */
import { html, mount, reset, resume, settled, start } from "@ailura/alpinejs-testing";
import Alpine, { type Alpine as AlpineInstance } from "alpinejs";
import { afterEach, beforeAll, beforeEach, describe, expect, test } from "vite-plus/test";

import { virtualPlugin } from "../src/plugin";
import type { VirtualStore } from "../src/types";

function store(name = "virtual"): VirtualStore {
  return (Alpine as unknown as { store(key: string): VirtualStore }).store(name);
}

/** Dispatch a real `scroll` event the way a user drag would. */
function scrollTo(el: HTMLElement, top: number): void {
  el.scrollTop = top;
  el.dispatchEvent(new Event("scroll"));
}

/** Lets the reactive `change` sync reach the store proxy. */
async function flush(): Promise<void> {
  await settled();
  await new Promise((resolve) => setTimeout(resolve, 0));
  await settled();
}

beforeAll(() => {
  start(virtualPlugin());
});

beforeEach(() => {
  resume();
});

afterEach(() => {
  reset();
});

describe("x-virtual-scroll directive", () => {
  test("scroll events on the container drive the controller", async () => {
    const root = html(
      "<div x-data x-init=\"$store.virtual.create('directive', { count: 500, estimateSize: 20 })\">" +
        '<div id="container" x-virtual-scroll="\'directive\'" style="height: 200px; overflow-y: auto">' +
        '<div style="height: 10000px"></div></div></div>'
    );
    mount(root);
    await flush();

    const container = root.querySelector("#container") as HTMLElement;
    expect(store().instances.directive).toBeDefined();
    expect(store().instances.directive.scrollOffset).toBe(0);

    scrollTo(container, 240);
    await flush();
    expect(store().instances.directive.scrollOffset).toBe(240);
  });

  test("the scroll listener is gone once Alpine removes the container", async () => {
    const root = html(
      "<div x-data x-init=\"$store.virtual.create('released', { count: 500, estimateSize: 20 })\">" +
        '<div id="container" x-virtual-scroll="\'released\'" style="height: 200px; overflow-y: auto">' +
        '<div style="height: 10000px"></div></div></div>'
    );
    mount(root);
    await flush();

    const container = root.querySelector("#container") as HTMLElement;
    scrollTo(container, 120);
    await flush();
    expect(store().instances.released.scrollOffset).toBe(120);

    container.remove();
    await flush();

    // The element is detached; a re-inserted one must not resurrect the binding.
    document.body.append(container);
    scrollTo(container, 480);
    await flush();
    expect(store().instances.released.scrollOffset).toBe(120);

    // The instance itself survives the element teardown.
    expect(store().instances.released).toBeDefined();
    expect(store().getVirtualItems("released").length).toBeGreaterThan(0);
  });

  test("the instance can be re-bound by hand after the release", async () => {
    const root = html(
      "<div x-data x-init=\"$store.virtual.create('rebound', { count: 100, estimateSize: 20 })\">" +
        '<div id="container" x-virtual-scroll="\'rebound\'"></div></div>'
    );
    mount(root);
    await flush();

    const container = root.querySelector("#container") as HTMLElement;
    container.remove();
    await flush();

    const fresh = document.createElement("div");
    document.body.append(fresh);
    store().bindScrollElement("rebound", fresh);
    await flush();

    scrollTo(fresh, 200);
    await flush();
    expect(store().instances.rebound.scrollOffset).toBe(200);
  });

  test("the hand-written store method is unchanged", async () => {
    const root = html(
      "<div x-data x-init=\"$store.virtual.create('manual', { count: 100, estimateSize: 20 }); $store.virtual.bindScrollElement('manual', $el)\"" +
        ' style="height: 200px; overflow-y: auto"></div>'
    );
    mount(root);
    await flush();

    const container = root.firstElementChild as HTMLElement;
    scrollTo(container, 160);
    await flush();
    expect(store().instances.manual.scrollOffset).toBe(160);

    // A hand-written binding is unchanged: nothing releases it but the
    // caller. The directive is additive, not a replacement contract.
    container.remove();
    await flush();
    scrollTo(container, 320);
    await flush();
    expect(store().instances.manual.scrollOffset).toBe(320);
  });

  test("an expression that is not an instance id binds nothing and throws nothing", async () => {
    const root = html(
      '<div x-data="{ id: null }"><div id="container" x-virtual-scroll="id"></div></div>'
    );
    const before = Object.keys(store().instances).length;
    mount(root);
    await flush();
    // No instance was conjured, and a scroll event on the element is inert.
    expect(Object.keys(store().instances).length).toBe(before);
    const container = root.querySelector("#container") as HTMLElement;
    scrollTo(container, 300);
    await flush();
    expect(Object.keys(store().instances).length).toBe(before);

    container.remove();
    await flush();
    expect(Object.keys(store().instances).length).toBe(before);
  });

  test("the directive name is configurable", async () => {
    virtualPlugin({ directiveKey: "virtualScroll", storeKey: "virtual-alt" })(
      Alpine as unknown as AlpineInstance
    );

    const ignored = html(
      "<div x-data x-init=\"$store.virtual.create('ignored', { count: 10 })\">" +
        '<div id="ignored-container" x-virtual-scroll="\'ignored\'"></div></div>'
    );
    mount(ignored);
    await flush();
    const ignoredContainer = ignored.querySelector("#ignored-container") as HTMLElement;
    scrollTo(ignoredContainer, 100);
    await flush();
    expect(store().instances.ignored.scrollOffset).toBe(0);

    const custom = html(
      "<div x-data x-init=\"$store['virtual-alt'].create('custom', { count: 10 })\">" +
        '<div id="custom-container" x-virtual-scroll="\'custom\'"></div></div>'
    );
    mount(custom);
    await flush();
    const customContainer = custom.querySelector("#custom-container") as HTMLElement;
    scrollTo(customContainer, 100);
    await flush();
    expect(store("virtual-alt").instances.custom.scrollOffset).toBe(100);
  });
});
