import { clearAllSingletons } from "@ailura/alpinejs-core/singletons";
// @vitest-environment happy-dom
import "@testing-library/jest-dom/vitest";
import { html, mount, reset, resume, settled, start } from "@ailura/alpinejs-testing";
import Alpine from "alpinejs";
import { afterEach, beforeAll, beforeEach, describe, expect, test } from "vite-plus/test";

import { createThemeController } from "../src/controller";
import { createThemeStore, themePlugin } from "../src/plugin";
import { createMemoryThemeStorage } from "../src/storage/memory-storage";
import type { ThemePreference, ThemeStorage, ThemeStore } from "../src/types";

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

describe("themePlugin mock Alpine", () => {
  afterEach(() => {
    clearAllSingletons();
  });

  test("registers store and magic with default keys", () => {
    const { alpine, stores, magics } = createMockAlpine();
    const storage = createMemoryThemeStorage();
    themePlugin({ storage, watchSystem: false, strategy: "none", scope: {} })(alpine);
    expect(stores.has("theme")).toBe(true);
    expect(magics.has("theme")).toBe(true);
  });

  test("storeKey renames both store and magic", () => {
    const { alpine, stores, magics } = createMockAlpine();
    const storage = createMemoryThemeStorage();
    themePlugin({ storage, watchSystem: false, strategy: "none", storeKey: "custom", scope: {} })(
      alpine
    );
    expect(stores.has("custom")).toBe(true);
    expect(magics.has("custom")).toBe(true);
    expect(stores.has("theme")).toBe(false);
  });

  test("magicKey independently renames magic", () => {
    const { alpine, stores, magics } = createMockAlpine();
    const storage = createMemoryThemeStorage();
    themePlugin({
      storage,
      watchSystem: false,
      strategy: "none",
      storeKey: "myStore",
      magicKey: "myMagic",
      scope: {},
    })(alpine);
    expect(stores.has("myStore")).toBe(true);
    expect(magics.has("myMagic")).toBe(true);
    expect(magics.has("myStore")).toBe(false);
  });

  test("magic returns the store instance", () => {
    const { alpine, magics } = createMockAlpine();
    const storage = createMemoryThemeStorage();
    themePlugin({ storage, watchSystem: false, strategy: "none", scope: {} })(alpine);
    const magicFn = magics.get("theme") as () => unknown;
    const store = magicFn() as ThemeStore;
    expect(store).toBeDefined();
    expect(store.current).toBeDefined();
  });

  test("reactive sync: manager change updates alpine.store", () => {
    const { alpine, stores } = createMockAlpine();
    const storage = createMemoryThemeStorage();
    const scope = {};
    // Need to grab manager via createThemeController for manual trigger, but plugin creates its own manager internally
    // Instead verify via the store's set path: calling store.set triggers manager and then manager.on updates reactive copy
    themePlugin({ storage, watchSystem: false, strategy: "none", scope })(alpine);
    const store = stores.get("theme") as ThemeStore;
    // initial is system
    expect(store.current).toBe("system");
    store.set("dark");
    // manager.on callback runs synchronously; store should now be dark
    expect(store.current).toBe("dark");
    // also alpine.store read reflects same
    expect((alpine.store as (k: string) => ThemeStore)("theme").current).toBe("dark");
  });

  test("reapplyEvents wires document listener released by destroy", async () => {
    const { alpine, stores } = createMockAlpine();
    const storage = createMemoryThemeStorage();
    const scope = {};
    const eventType = `reapply-${Math.random().toString(36).slice(2)}`;
    const target = document.createElement("div");
    document.body.appendChild(target);
    themePlugin({
      storage,
      watchSystem: false,
      strategy: "class",
      target,
      reapplyEvents: [eventType] as never,
      scope,
    })(alpine);
    // initial light class should be present after mount
    await new Promise<void>((r) => queueMicrotask(r));
    // need to wait a tick for system observer? strategy class applied synchronously on mount, so check
    // remove class manually
    target.classList.remove("light", "dark");
    expect(target.classList.contains("light")).toBe(false);
    document.dispatchEvent(new Event(eventType));
    expect(target.classList.contains("light") || target.classList.contains("dark")).toBe(true);
    // cleanup
    target.remove();
    // The host-owned handle releases the plugin's own document listener.
    (stores.get("theme") as ThemeStore).destroy();
    clearAllSingletons(scope);
  });
});

/**
 * Instrument `document` listener bookkeeping for one event type.
 *
 * `manager.apply()` is lifecycle-guarded, so after teardown a leaked listener
 * is indistinguishable from a removed one by inspecting theme state. The
 * observable used here is the invocation of the registered reapply handler
 * itself: every registration is wrapped in a counting shim, so dispatching the
 * event reports whether a live handler is still attached.
 */
function instrumentDocumentEvent(eventType: string) {
  const shims = new Map<EventListenerOrEventListenerObject, EventListener>();
  const live = new Set<EventListener>();
  const calls: string[] = [];
  const originalAdd = document.addEventListener.bind(document);
  const originalRemove = document.removeEventListener.bind(document);

  document.addEventListener = function patchedAdd(
    this: Document,
    type: string,
    listener: EventListenerOrEventListenerObject,
    options?: boolean | AddEventListenerOptions
  ) {
    if (type !== eventType) {
      originalAdd(type, listener, options);
      return;
    }
    const target = listener as EventListener;
    const shim: EventListener = (event: Event): void => {
      calls.push(type);
      target.call(this, event);
    };
    shims.set(target, shim);
    live.add(shim);
    originalAdd(type, shim, options);
  } as typeof document.addEventListener;

  document.removeEventListener = function patchedRemove(
    this: Document,
    type: string,
    listener: EventListenerOrEventListenerObject,
    options?: boolean | EventListenerOptions
  ) {
    if (type !== eventType) {
      originalRemove(type, listener, options);
      return;
    }
    const shim = shims.get(listener as EventListener);
    if (!shim) {
      originalRemove(type, listener, options);
      return;
    }
    shims.delete(listener as EventListener);
    live.delete(shim);
    originalRemove(type, shim, options);
  } as typeof document.removeEventListener;

  return {
    activeCount: () => live.size,
    callsAfterDispatch: () => {
      const before = calls.length;
      document.dispatchEvent(new Event(eventType));
      return calls.length - before;
    },
    restore() {
      document.addEventListener = originalAdd;
      document.removeEventListener = originalRemove;
    },
  };
}

describe("themePlugin Alpine integration", () => {
  beforeAll(() => {
    start(() => {});
  });
  beforeEach(() => {
    resume();
  });
  afterEach(() => {
    reset();
    clearAllSingletons();
    // clear any theme stores leftover
    // Alpine.store is global; best to overwrite with undefined by setting property to undefined via delete?
    // Alpine stores are plain map, so we can delete by setting via internal? Use store delete via internal Alpine reference
    // Simpler: just clear known keys if present by setting to undefined is not supported, so we rely on next test using unique key
    document.documentElement.classList.remove("dark", "light");
    document.documentElement.removeAttribute("data-theme");
  });

  test("store is reactive: $store.theme reflects manager.set", async () => {
    const storage = createMemoryThemeStorage();
    const scope = {};
    const suffix = Math.random().toString(36).slice(2, 6);
    const storeKey = `theme${suffix}`;
    themePlugin({ storage, watchSystem: false, strategy: "none", storeKey, scope })(
      Alpine as unknown as import("alpinejs").Alpine
    );

    mount(
      html(`<div x-data>
        <span data-testid="cur" x-text="$store.${storeKey}.current"></span>
        <span data-testid="res" x-text="$store.${storeKey}.resolved"></span>
        <button data-testid="set-dark" @click="$store.${storeKey}.set('dark')">dark</button>
      </div>`)
    );
    await settled();
    // Alpine.store returns the store object
    const store = (Alpine.store as (k: string) => ThemeStore)(storeKey);
    expect(store.current).toBe("system");
    // click triggers set via store
    document.querySelector<HTMLButtonElement>('[data-testid="set-dark"]')?.click();
    await settled();
    expect(store.current).toBe("dark");
    expect(document.querySelector('[data-testid="cur"]')?.textContent).toBe("dark");
  });

  test("createThemeStore creates a ThemeStore bound to manager", () => {
    const storage = createMemoryThemeStorage();
    const scope = {};
    const manager = createThemeController({ storage, watchSystem: false, strategy: "none", scope });
    const store = createThemeStore(manager);
    expect(store.current).toBe("system");
    store.set("dark");
    expect(manager.current).toBe("dark");
    // createThemeStore snapshot is not auto-synced; only the plugin's reactive sync updates Alpine.store
    // so store.current stays at creation snapshot, manager is source of truth
    expect(manager.current).toBe("dark");
    // toggle and reset still delegate via manager
    store.toggle();
    expect(manager.current).toBe("light");
    store.reset();
    expect(manager.current).toBe("system");
    manager.destroy();
    clearAllSingletons(scope);
  });

  test("multiple instances via singleton scope are isolated", () => {
    const scopeA = {};
    const scopeB = {};
    const storageA = createMemoryThemeStorage();
    const storageB = createMemoryThemeStorage();
    const a = createThemeController({
      storage: storageA,
      watchSystem: false,
      strategy: "none",
      scope: scopeA,
    });
    const b = createThemeController({
      storage: storageB,
      watchSystem: false,
      strategy: "none",
      scope: scopeB,
    });
    expect(a).not.toBe(b);
    expect(a.id).not.toBe(b.id);
    a.set("dark");
    expect(a.current).toBe("dark");
    expect(b.current).toBe("system");
    b.set("light");
    expect(b.current).toBe("light");
    expect(a.current).toBe("dark");
    a.destroy();
    b.destroy();
    clearAllSingletons(scopeA);
    clearAllSingletons(scopeB);
  });

  test("singleton same scope reuses instance", () => {
    const scope = {};
    const storage = createMemoryThemeStorage();
    const first = createThemeController({ storage, watchSystem: false, strategy: "none", scope });
    const second = createThemeController({ storage, watchSystem: false, strategy: "none", scope });
    expect(first).toBe(second);
    first.destroy();
    clearAllSingletons(scope);
    const third = createThemeController({
      storage: createMemoryThemeStorage(),
      watchSystem: false,
      strategy: "none",
      scope,
    });
    expect(third).not.toBe(first);
    third.destroy();
    clearAllSingletons(scope);
  });

  test("destroy then re-create with same scope yields fresh instance", () => {
    const scope = {};
    const storage = createMemoryThemeStorage();
    const first = createThemeController({ storage, watchSystem: false, strategy: "none", scope });
    first.destroy();
    clearAllSingletons(scope);
    const second = createThemeController({
      storage: createMemoryThemeStorage(),
      watchSystem: false,
      strategy: "none",
      scope,
    });
    expect(second.lifecycle).toBe("mounted");
    expect(second).not.toBe(first);
    second.destroy();
    clearAllSingletons(scope);
  });
});

/**
 * Teardown contract for the `@ailura/alpinejs-theme` store surface.
 *
 * Observable: the cross-tab subscription the controller registers through
 * `onCleanup`. The stub storage owns its listener set, so a "write from
 * another tab" can be dispatched exactly like a real cross-tab event, and the
 * set's size proves the subscription itself was released — the controller's
 * `#handleCrossTabUpdate` also short-circuits on `lifecycle === "destroyed"`,
 * so state alone would not distinguish a removed subscription from a live one.
 */
function createInspectableStorage() {
  const listeners = new Set<(next: ThemePreference | null) => void>();
  let value: ThemePreference | null = null;
  const storage: ThemeStorage = {
    get: () => value,
    set: (next: ThemePreference) => {
      value = next;
      for (const listener of [...listeners]) listener(next);
    },
    remove: () => {
      value = null;
      for (const listener of [...listeners]) listener(null);
    },
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
  return {
    storage,
    listenerCount: () => listeners.size,
    /** A write performed by "another tab": value changes, subscribers notified. */
    writeFromOtherTab: (next: ThemePreference) => {
      value = next;
      for (const listener of [...listeners]) listener(next);
    },
  };
}

describe("themePlugin teardown", () => {
  test("store exposes a host-owned destroy handle", () => {
    const scope = {};
    const { alpine, stores } = createMockAlpine();
    themePlugin({
      storage: createMemoryThemeStorage(),
      watchSystem: false,
      strategy: "none",
      scope,
    })(alpine);
    const store = stores.get("theme") as ThemeStore;
    expect(typeof store.destroy).toBe("function");
    store.destroy();
    clearAllSingletons(scope);
  });

  test("cross-tab storage writes stop reaching the store after destroy", () => {
    const scope = {};
    const crossTab = createInspectableStorage();
    const { alpine, stores } = createMockAlpine();
    themePlugin({
      storage: crossTab.storage,
      watchSystem: false,
      strategy: "none",
      scope,
    })(alpine);
    const store = stores.get("theme") as ThemeStore;
    expect(store.current).toBe("system");
    expect(crossTab.listenerCount()).toBe(1);

    // Before destroy: a cross-tab write drives the store.
    crossTab.writeFromOtherTab("dark");
    expect(store.current).toBe("dark");

    store.destroy();

    // The subscription itself is gone, not merely inert.
    expect(crossTab.listenerCount()).toBe(0);

    // After destroy: another cross-tab write changes nothing.
    crossTab.writeFromOtherTab("light");
    expect(store.current).toBe("dark");
    clearAllSingletons(scope);
  });

  test("destroy is idempotent and does not throw when called twice", () => {
    const scope = {};
    const { alpine, stores } = createMockAlpine();
    themePlugin({
      storage: createMemoryThemeStorage(),
      watchSystem: false,
      strategy: "none",
      scope,
    })(alpine);
    const store = stores.get("theme") as ThemeStore;
    expect(() => {
      store.destroy();
      store.destroy();
    }).not.toThrow();
    clearAllSingletons(scope);
  });

  test("reapply document listener is released by destroy", () => {
    const scope = {};
    const { alpine, stores } = createMockAlpine();
    const eventType = `theme-reapply-${Math.random().toString(36).slice(2)}`;
    const probe = instrumentDocumentEvent(eventType);
    try {
      themePlugin({
        storage: createMemoryThemeStorage(),
        watchSystem: false,
        strategy: "none",
        scope,
        reapplyEvents: [eventType],
      })(alpine);
      const store = stores.get("theme") as ThemeStore;
      expect(probe.activeCount()).toBe(1);
      expect(probe.callsAfterDispatch()).toBe(1);

      store.destroy();

      // The listener itself is gone, so the reapply handler no longer runs.
      expect(probe.activeCount()).toBe(0);
      expect(probe.callsAfterDispatch()).toBe(0);
    } finally {
      probe.restore();
      clearAllSingletons(scope);
    }
  });

  test("destroy is idempotent for reapply listeners and does not double-register", () => {
    const scope = {};
    const { alpine, stores } = createMockAlpine();
    const eventType = `theme-reapply-${Math.random().toString(36).slice(2)}`;
    const probe = instrumentDocumentEvent(eventType);
    try {
      themePlugin({
        storage: createMemoryThemeStorage(),
        watchSystem: false,
        strategy: "none",
        scope,
        reapplyEvents: [eventType],
      })(alpine);
      const store = stores.get("theme") as ThemeStore;
      expect(probe.activeCount()).toBe(1);

      expect(() => {
        store.destroy();
        store.destroy();
      }).not.toThrow();

      expect(probe.activeCount()).toBe(0);
      // A second registration cycle must not accumulate listeners.
      themePlugin({
        storage: createMemoryThemeStorage(),
        watchSystem: false,
        strategy: "none",
        scope,
        storeKey: "theme-second",
        reapplyEvents: [eventType],
      })(alpine);
      expect(probe.activeCount()).toBe(1);
      (stores.get("theme-second") as ThemeStore).destroy();
      expect(probe.activeCount()).toBe(0);
      expect(probe.callsAfterDispatch()).toBe(0);
    } finally {
      probe.restore();
      clearAllSingletons(scope);
    }
  });

  test("destroy works when reapplyEvents is not supplied", () => {
    const scope = {};
    const { alpine, stores } = createMockAlpine();
    themePlugin({
      storage: createMemoryThemeStorage(),
      watchSystem: false,
      strategy: "none",
      scope,
    })(alpine);
    const store = stores.get("theme") as ThemeStore;
    expect(() => {
      store.destroy();
      store.destroy();
    }).not.toThrow();
    expect(store.current).toBe("system");
    clearAllSingletons(scope);
  });

  test("other store members stay readable after destroy", () => {
    const scope = {};
    const { alpine, stores } = createMockAlpine();
    themePlugin({
      storage: createMemoryThemeStorage(),
      watchSystem: false,
      strategy: "none",
      scope,
    })(alpine);
    const store = stores.get("theme") as ThemeStore;
    store.destroy();

    expect(store.current).toBe("system");
    expect(store.system).toBe("light");
    expect(store.resolved).toBe("light");
    // Mutations are lifecycle-guarded no-ops after teardown: the store is
    // readable but frozen.
    expect(() => store.set("dark")).not.toThrow();
    expect(store.current).toBe("system");
    clearAllSingletons(scope);
  });
});
