// @vitest-environment happy-dom
/**
 * `x-dialog` and `x-dialog.panel` — the element-bound half of a dialog.
 *
 * `bindContainer` already accepts `null` as a release, but nothing in the store
 * surface ever passed one, so a hand-written binding was permanent: the
 * container reference outlived its element and `handleOutsideClick` kept testing
 * clicks against a detached node. A store registration has no Alpine-invoked
 * teardown in Alpine 3.17 — `plugin()` discards the callback's return value and
 * the Alpine object exposes no `cleanup`/`stop()` — so the directive's own
 * `cleanup()` is the only mechanism the runtime really invokes, queued in
 * `el._x_cleanups` and drained by `cleanupElement` on element removal.
 *
 * The panel case also covers the `@click.stop` the docs require: outside-click is
 * only decidable once a container is bound, so the panel owns the listener and
 * has to tell its own clicks from the backdrop's.
 */
import { clearAllSingletons } from "@ailura/alpinejs-core/singletons";
import { html, mount, reset, resume, settled, start } from "@ailura/alpinejs-testing";
import Alpine from "alpinejs";
import { afterEach, beforeAll, beforeEach, describe, expect, test } from "vite-plus/test";

import { dialogPlugin } from "../src/plugin";
import type { DialogStore } from "../src/types";

function store(): DialogStore {
  return (Alpine as unknown as { store(name: string): DialogStore }).store("dialog");
}

/**
 * Flush past Alpine's mutation observer.
 *
 * A directive's `cleanup()` runs from the observer's `childList` callback, and
 * `settled()`'s two ticks are not always enough to reach it after an
 * `el.remove()`. Draining microtasks in between matches what
 * `packages/carousel/test/viewport-directive.test.ts` does for the same reason.
 */
async function flush(): Promise<void> {
  await settled();
  for (let i = 0; i < 20; i += 1) await Promise.resolve();
  await settled();
}

/** Click the panel's backdrop, i.e. the panel element itself. */
function clickBackdrop(el: HTMLElement): void {
  el.dispatchEvent(new MouseEvent("click", { bubbles: true }));
}

beforeAll(() => {
  start(() => {});
});

beforeEach(() => {
  clearAllSingletons();
  dialogPlugin()(Alpine as unknown as import("alpinejs").Alpine);
  resume();
});

afterEach(() => {
  reset();
});

describe("x-dialog directive", () => {
  test("binds its element as the container and leaves the instance usable", async () => {
    const root = html(
      `<div x-data><div id="panel" x-dialog="'settings'" role="dialog"><p>Body</p></div></div>`
    );
    mount(root);
    await flush();

    store().open("settings");
    await flush();
    expect(store().isOpen("settings")).toBe(true);
  });

  test("releases the container when Alpine removes the element", async () => {
    const root = html(
      `<div x-data><div id="panel" x-dialog="'settings'" role="dialog"><p>Body</p></div></div>`
    );
    mount(root);
    await flush();
    store().open("settings");
    await flush();

    root.querySelector("#panel")?.remove();
    await flush();

    // The instance survives (the host opened it explicitly), but the detached
    // node must no longer be its container: a stale reference would keep
    // `handleOutsideClick` testing clicks against a removed subtree.
    store().open("settings");
    await flush();
    clickBackdrop(document.body);
    await flush();
    // With no container bound, `handleOutsideClick` returns early — the dialog
    // stays open rather than closing on every backdrop click forever.
    expect(store().isOpen("settings")).toBe(true);
  });

  test("a click outside a bound container closes the dialog", async () => {
    const root = html(
      `<div x-data><div id="backdrop"><div id="panel" x-dialog.panel="'settings'" role="dialog"><button id="inner">ok</button></div></div></div>`
    );
    mount(root);
    await flush();
    store().open("settings");
    await flush();

    clickBackdrop(root.querySelector("#backdrop") as HTMLElement);
    await flush();
    expect(store().isOpen("settings")).toBe(false);
  });

  test("a backdrop that stops propagation still closes the dialog", async () => {
    // Capture phase is what makes this work: the backdrop's own handler calls
    // `stopPropagation()`, which is exactly what the old markup's `@click.stop`
    // on the *panel* was working around.
    const root = html(
      `<div x-data x-on:click.stop><div id="backdrop"><div id="panel" x-dialog.panel="'settings'" role="dialog"></div></div></div>`
    );
    mount(root);
    await flush();
    store().open("settings");
    await flush();

    clickBackdrop(root.querySelector("#backdrop") as HTMLElement);
    await flush();
    expect(store().isOpen("settings")).toBe(false);
  });

  test("a click inside the panel does not close it, so no @click.stop is needed", async () => {
    const root = html(
      `<div x-data><div id="backdrop"><div id="panel" x-dialog.panel="'settings'" role="dialog"><button id="inner">ok</button></div></div></div>`
    );
    mount(root);
    await flush();
    store().open("settings");
    await flush();

    const inner = root.querySelector("#inner") as HTMLElement;
    inner.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await flush();
    expect(store().isOpen("settings")).toBe(true);

    // And the backdrop still works from the same tree.
    clickBackdrop(root.querySelector("#backdrop") as HTMLElement);
    await flush();
    expect(store().isOpen("settings")).toBe(false);
  });

  test("releases the panel listener on element removal", async () => {
    const root = html(
      `<div x-data><div id="backdrop"><div id="panel" x-dialog.panel="'settings'" role="dialog"></div></div></div>`
    );
    mount(root);
    await flush();
    store().open("settings");
    await flush();

    root.querySelector("#panel")?.remove();
    await flush();

    clickBackdrop(root.querySelector("#backdrop") as HTMLElement);
    await flush();
    // No container bound after teardown, so the outside-click path is inert.
    expect(store().isOpen("settings")).toBe(true);
  });

  test("the hand-written bindContainer is unchanged — additive, not a replacement", async () => {
    // The host wires its own outside-click handler, exactly as the docs show.
    // This is the path `x-dialog.panel` replaces, so it has to keep working.
    const root = html(
      `<div x-data><div id="backdrop" @click="$store.dialog.handleOutsideClick('manual', $event)"><div id="panel" x-init="$store.dialog.bindContainer('manual', $el)" role="dialog"></div></div></div>`
    );
    mount(root);
    await flush();
    store().open("manual");
    await flush();
    expect(store().isOpen("manual")).toBe(true);

    clickBackdrop(root.querySelector("#backdrop") as HTMLElement);
    await flush();
    expect(store().isOpen("manual")).toBe(false);
  });

  test("an empty expression binds nothing and throws nothing", async () => {
    const root = html(`<div x-data><div id="panel" x-dialog role="dialog"></div></div>`);
    mount(root);
    await flush();

    expect(() => clickBackdrop(document.body)).not.toThrow();
  });
});
