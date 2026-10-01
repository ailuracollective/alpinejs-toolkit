// @vitest-environment happy-dom
/**
 * The command store must actually be reactive.
 *
 * The defect this pins: the store was a bag of getters over the controller's
 * private fields, wired to a `const sync = () => {}` with a comment claiming
 * "Alpine reactivity will pick up getter reads". It does not. Alpine's
 * `injectMagics`/`store()` defines the value as a plain getter and does not
 * wrap it in `reactive()`, so a template read tracked only a key that nothing
 * ever wrote. `open()` flipped the controller's own state while the view kept
 * rendering its first read.
 *
 * The observable was a demo that could not demonstrate the one thing it exists
 * for: a command palette that never opened, a search box that never filtered,
 * and an active row that never moved.
 *
 * The assertions drive real DOM events and read the rendered text, so they fail
 * against a store that is merely *correct* but not reactive.
 */

import { clearAllSingletons } from "@ailura/alpinejs-core/singletons";
import { html, mount, reset, resume, settled, start } from "@ailura/alpinejs-testing";
import Alpine from "alpinejs";
import { afterEach, beforeAll, beforeEach, describe, expect, test } from "vite-plus/test";

import { commandPlugin } from "../src/plugin";
import type { CommandItem, CommandStore } from "../src/types";

function store(): CommandStore {
  return (Alpine as unknown as { store(name: string): CommandStore }).store("command");
}

function text(testid: string): string {
  return document.querySelector(`[data-testid="${testid}"]`)?.textContent ?? "";
}

function item(id: string, label: string): CommandItem {
  return { id, label, group: "Demo", action: () => undefined } as CommandItem;
}

beforeAll(() => start(() => {}));

beforeEach(() => {
  commandPlugin()(Alpine as unknown as import("alpinejs").Alpine);
  resume();
});

afterEach(() => {
  reset();
  clearAllSingletons();
});

describe("command store reactivity", () => {
  test("open() re-renders isOpen", async () => {
    store().register(item("a", "Alpha"));

    mount(
      html(`<div>
        <span data-testid="open" x-text="String($store.command.isOpen)"></span>
        <button data-testid="go" @click="$store.command.open()">open</button>
      </div>`)
    );
    await settled();
    expect(text("open")).toBe("false");

    document.querySelector<HTMLButtonElement>('[data-testid="go"]')?.click();
    await settled();

    // Before the fix this stayed "false" while the controller reported true.
    expect(text("open")).toBe("true");
  });

  test("close() re-renders back to false", async () => {
    store().register(item("a", "Alpha"));
    mount(
      html(`<div><span data-testid="open" x-text="String($store.command.isOpen)"></span></div>`)
    );
    await settled();

    store().open();
    await settled();
    expect(text("open")).toBe("true");

    store().close();
    await settled();
    expect(text("open")).toBe("false");
  });

  test("typing in the search box re-filters visibleItems", async () => {
    store().register(item("alpha", "Alpha"));
    store().register(item("beta", "Beta"));

    mount(
      html(`<div>
        <input data-testid="q" x-model="$store.command.search" />
        <span data-testid="n" x-text="String($store.command.visibleItems.length)"></span>
      </div>`)
    );
    await settled();
    expect(text("n")).toBe("2");

    const input = document.querySelector<HTMLInputElement>('[data-testid="q"]') as HTMLInputElement;
    input.value = "bet";
    input.dispatchEvent(new Event("input", { bubbles: true }));
    await settled();

    // Before the fix the count stayed at 2 for a search that matched one item.
    expect(text("n")).toBe("1");
  });

  test("registering after the first render shows up in visibleItems", async () => {
    store().register(item("alpha", "Alpha"));
    mount(
      html(
        `<div><span data-testid="n" x-text="String($store.command.visibleItems.length)"></span></div>`
      )
    );
    await settled();
    expect(text("n")).toBe("1");

    store().register(item("beta", "Beta"));
    await settled();

    expect(text("n")).toBe("2");
  });

  test("activeIndex moves and re-renders", async () => {
    store().register(item("alpha", "Alpha"));
    store().register(item("beta", "Beta"));
    store().open();

    mount(
      html(`<div><span data-testid="i" x-text="String($store.command.activeIndex)"></span></div>`)
    );
    await settled();
    expect(text("i")).toBe("0");

    store().activeIndex = 1;
    await settled();

    expect(text("i")).toBe("1");
  });

  test("currentPageId updates when a page is pushed", async () => {
    store().register(item("alpha", "Alpha"));
    mount(
      html(`<div><span data-testid="p" x-text="String($store.command.currentPageId)"></span></div>`)
    );
    await settled();

    await store().pushPage({ id: "settings", title: "Settings" } as never);

    expect(text("p")).toBe("settings");
  });

  test("the store is populated before any event fires", async () => {
    store().register(item("alpha", "Alpha"));
    mount(
      html(
        `<div><span data-testid="n" x-text="String($store.command.visibleItems.length)"></span></div>`
      )
    );
    // A host may read the store during init, before any command runs.
    await settled();
    expect(text("n")).toBe("1");
  });
});
