/**
 * Teardown contract for the `@ailura/alpinejs-sidebar` store surface.
 *
 * Observable: the `MediaQueryList` change listener the controller registers,
 * driven through a stubbed `window.matchMedia`. The stub keeps its own listener
 * set, so the test can both emit real change events and prove the controller
 * unsubscribed.
 */

// @vitest-environment happy-dom
import { describe, expect, test } from "vite-plus/test";

import { sidebarPlugin } from "../src/plugin";
import type { SidebarAlpineStore } from "../src/types";

interface FakeMediaQueryList {
  matches: boolean;
  addEventListener(type: string, listener: (event: MediaQueryListEvent) => void): void;
  removeEventListener(type: string, listener: (event: MediaQueryListEvent) => void): void;
  emitChange(matches: boolean): void;
  listenerCount(): number;
}

function createFakeMediaQueryList(initial: boolean): FakeMediaQueryList {
  const listeners = new Set<(event: MediaQueryListEvent) => void>();
  return {
    matches: initial,
    addEventListener(type, listener) {
      if (type === "change") listeners.add(listener);
    },
    removeEventListener(type, listener) {
      if (type === "change") listeners.delete(listener);
    },
    emitChange(matches) {
      this.matches = matches;
      const event = { matches } as MediaQueryListEvent;
      for (const listener of [...listeners]) listener(event);
    },
    listenerCount() {
      return listeners.size;
    },
  };
}

function createMockAlpine() {
  const stores = new Map<string, unknown>();
  const magics = new Map<string, unknown>();
  const alpine = {
    store(name: string, value?: unknown) {
      if (value !== undefined) {
        stores.set(name, value);
        return;
      }
      return stores.get(name);
    },
    magic(name: string, callback: unknown) {
      magics.set(name, callback);
    },
  } as unknown as import("alpinejs").Alpine;
  return { alpine, stores, magics };
}

function register(mql: FakeMediaQueryList): SidebarAlpineStore {
  window.matchMedia = (() => mql) as unknown as typeof window.matchMedia;
  const { alpine, stores } = createMockAlpine();
  sidebarPlugin({
    initial: true,
    closeOnEscape: false,
    breakpoint: { query: "(min-width: 768px)", onMismatch: "hide" },
  })(alpine);
  return stores.get("sidebar") as SidebarAlpineStore;
}

describe("sidebarPlugin teardown", () => {
  test("store exposes a host-owned destroy handle", () => {
    const store = register(createFakeMediaQueryList(true));
    expect(typeof store.destroy).toBe("function");
  });

  test("MediaQueryList change events stop driving state after destroy", () => {
    const mql = createFakeMediaQueryList(true);
    const store = register(mql);
    expect(mql.listenerCount()).toBe(1);

    // Before destroy: the change event reaches the controller and the store.
    // The store starts at the pre-mount default `false`, so a `true` is a
    // real transition, not a coincidence.
    mql.emitChange(true);
    expect(store.matchesBreakpoint).toBe(true);
    mql.emitChange(false);
    expect(store.matchesBreakpoint).toBe(false);
    expect(store.visible).toBe(false); // onMismatch: "hide"

    store.destroy();

    // The listener itself is gone, not merely ignored.
    expect(mql.listenerCount()).toBe(0);

    // After destroy: the same real change event changes nothing.
    mql.emitChange(true);
    expect(store.matchesBreakpoint).toBe(false);
    expect(store.visible).toBe(false);
  });

  test("destroy is idempotent and does not throw when called twice", () => {
    const store = register(createFakeMediaQueryList(true));
    expect(() => {
      store.destroy();
      store.destroy();
    }).not.toThrow();
  });

  test("other store members stay readable after destroy", () => {
    const store = register(createFakeMediaQueryList(true));
    store.destroy();

    // The plugin's store holds snapshots taken at registration time (the
    // members are plain values, not getters), so after destroy they keep the
    // values they had when the plugin ran.
    expect(store.visible).toBe(true);
    expect(store.isVisible).toBe(true);
    expect(store.hasOverlay).toBe(true); // visible && closeOnOverlayClick
    // Captured before `mount()` reads the MediaQueryList, so the snapshot is
    // still the pre-mount default.
    expect(store.matchesBreakpoint).toBe(false);
    // `show()` does not throw, but it is a no-op: the controller is
    // lifecycle-guarded and the store no longer syncs.
    expect(() => store.show()).not.toThrow();
    expect(store.visible).toBe(true);
  });
});
