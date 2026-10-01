// @vitest-environment happy-dom
/**
 * `$store.sidebar` must refresh every state field, not just two of them.
 *
 * The defect this pins: the store literal snapshotted `isVisible` and
 * `hasOverlay` at registration, and the `sync` handler only ever wrote
 * `visible` and `matchesBreakpoint`. A template reading the other two tracked a
 * key that was never written again, so they stayed frozen for the life of the
 * page — `hasOverlay` in particular is `visible && closeOnOverlayClick`, so it
 * read `false` forever no matter how many times the drawer was shown.
 */

import { clearAllSingletons } from "@ailura/alpinejs-core/singletons";
import { html, mount, reset, resume, settled, start } from "@ailura/alpinejs-testing";
import Alpine from "alpinejs";
import { afterEach, beforeAll, beforeEach, describe, expect, test } from "vite-plus/test";

import { sidebarPlugin } from "../src/plugin";
import type { SidebarAlpineStore } from "../src/types";

function store(): SidebarAlpineStore {
  return (Alpine as unknown as { store(name: string): SidebarAlpineStore }).store("sidebar");
}

function text(testid: string): string {
  return document.querySelector(`[data-testid="${testid}"]`)?.textContent ?? "";
}

beforeAll(() => start(() => {}));

beforeEach(() => {
  // `closeOnOverlayClick` defaults on, so `hasOverlay` follows `visible` — which
  // is exactly the field the old sync forgot to recompute.
  sidebarPlugin({ initial: false })(Alpine as unknown as import("alpinejs").Alpine);
  resume();
});

afterEach(() => {
  reset();
  clearAllSingletons();
});

describe("$store.sidebar reactivity", () => {
  test("show() re-renders visible, isVisible and hasOverlay", async () => {
    mount(
      html(`<div>
        <span data-testid="v" x-text="String($store.sidebar.visible)"></span>
        <span data-testid="iv" x-text="String($store.sidebar.isVisible)"></span>
        <span data-testid="ov" x-text="String($store.sidebar.hasOverlay)"></span>
      </div>`)
    );
    await settled();
    expect(text("v")).toBe("false");
    expect(text("iv")).toBe("false");
    expect(text("ov")).toBe("false");

    store().show();
    await settled();

    expect(text("v")).toBe("true");
    // These two never changed before: `sync` did not write them.
    expect(text("iv")).toBe("true");
    expect(text("ov")).toBe("true");
  });

  test("hide() re-renders them back", async () => {
    store().show();
    mount(
      html(`<div>
        <span data-testid="ov" x-text="String($store.sidebar.hasOverlay)"></span>
      </div>`)
    );
    await settled();
    expect(text("ov")).toBe("true");

    store().hide();
    await settled();

    expect(text("ov")).toBe("false");
  });

  test("closeOnOverlayClick: false keeps hasOverlay false while visible", async () => {
    reset();
    clearAllSingletons();
    sidebarPlugin({ initial: false, closeOnOverlayClick: false })(
      Alpine as unknown as import("alpinejs").Alpine
    );
    resume();

    mount(
      html(`<div>
        <span data-testid="v" x-text="String($store.sidebar.visible)"></span>
        <span data-testid="ov" x-text="String($store.sidebar.hasOverlay)"></span>
      </div>`)
    );
    await settled();

    store().show();
    await settled();

    expect(text("v")).toBe("true");
    expect(text("ov")).toBe("false");
  });
});
