// @vitest-environment happy-dom
/**
 * `$store.keyboard` must actually be reactive.
 *
 * The defect this pins: the store was three plain getters over the
 * controller's private fields, with no `sync` at all. Alpine's `store()` wraps
 * the value in a reactive proxy, but a getter reading a private field registers
 * no dependency, so `activeScopes` and `suspendedScopes` stayed frozen at their
 * first read. All four scope buttons in the demo changed nothing visible.
 * `commands` only *looked* right because registrations run in `x-init`, before
 * the first render.
 */

import { clearAllSingletons } from "@ailura/alpinejs-core/singletons";
import { html, mount, reset, resume, settled, start } from "@ailura/alpinejs-testing";
import Alpine from "alpinejs";
import { afterEach, beforeAll, beforeEach, describe, expect, test } from "vite-plus/test";

import { keyboardPlugin } from "../src/plugin";
import type { KeyboardStore } from "../src/types";

function store(): KeyboardStore {
  return (Alpine as unknown as { store(name: string): KeyboardStore }).store("keyboard");
}

function text(testid: string): string {
  return document.querySelector(`[data-testid="${testid}"]`)?.textContent ?? "";
}

function mountScopes(): void {
  mount(
    html(`<div>
      <span data-testid="active" x-text="$store.keyboard.activeScopes.join(', ')"></span>
      <span data-testid="suspended" x-text="$store.keyboard.suspendedScopes.join(', ') || 'none'"></span>
      <span data-testid="commands" x-text="String($store.keyboard.commands.length)"></span>
    </div>`)
  );
}

beforeAll(() => start(() => {}));

beforeEach(() => {
  keyboardPlugin()(Alpine as unknown as import("alpinejs").Alpine);
  resume();
});

afterEach(() => {
  reset();
  clearAllSingletons();
});

describe("$store.keyboard reactivity", () => {
  test("activateScope re-renders activeScopes", async () => {
    mountScopes();
    await settled();
    expect(text("active")).toBe("default");

    store().activateScope("editor");
    await settled();

    expect(text("active")).toBe("default, editor");
  });

  test("deactivateScope re-renders activeScopes", async () => {
    store().activateScope("editor");
    mountScopes();
    await settled();
    expect(text("active")).toBe("default, editor");

    store().deactivateScope("editor");
    await settled();

    expect(text("active")).toBe("default");
  });

  test("suspendScope and resumeScope re-render suspendedScopes", async () => {
    store().activateScope("editor");
    mountScopes();
    await settled();
    expect(text("suspended")).toBe("none");

    store().suspendScope("editor");
    await settled();
    expect(text("suspended")).toBe("editor");

    store().resumeScope("editor");
    await settled();
    expect(text("suspended")).toBe("none");
  });

  test("registering after the first render updates commands", async () => {
    mountScopes();
    await settled();
    expect(text("commands")).toBe("0");

    store().register("k", () => undefined, { id: "later" });
    await settled();

    expect(text("commands")).toBe("1");
  });

  test("unregistering updates commands", async () => {
    store().register("k", () => undefined, { id: "gone" });
    mountScopes();
    await settled();
    expect(text("commands")).toBe("1");

    store().unregister("gone");
    await settled();

    expect(text("commands")).toBe("0");
  });

  test("the store is populated before any event fires", async () => {
    mountScopes();
    await settled();
    // `activeScopes` must report the controller's default immediately, not "".
    expect(text("active")).toBe("default");
  });
});
