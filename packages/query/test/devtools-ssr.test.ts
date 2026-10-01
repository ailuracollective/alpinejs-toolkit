/**
 * The devtools subpath on a server.
 *
 * This file runs in the default (node) environment: no `window`, no `document`,
 * no DOM. That is the environment the SSR invariant is about, and the one the
 * old panel failed in — it reached for `document`, `localStorage`,
 * `matchMedia` and `ResizeObserver` with no guard at all, so importing it from a
 * server render was enough to throw before a single method was called.
 *
 * Three shapes of "no DOM" are covered, because they are different environments
 * and not the same test:
 *
 * 1. No globals at all — a plain Node process, which is what this file is.
 * 2. Globals present but `undefined` — a server that shims the DOM surface.
 *    `vi.stubGlobal` reproduces the identifier resolving to `undefined` instead
 *    of throwing on lookup, which is what the `typeof` guards test.
 * 3. A document with no `body` — a mount point that does not exist yet.
 */
import { afterEach, describe, expect, test, vi } from "vite-plus/test";

import { mountQueryDevtools } from "../src/devtools/panel";
import { getQueryStore, queryDevtoolsPlugin } from "../src/devtools/plugin";
import type { QueryDevtoolsSource } from "../src/devtools/types";
import type { QueryDevtoolsSnapshot } from "../src/types";

function createSource(): QueryDevtoolsSource {
  const snapshot: QueryDevtoolsSnapshot = { phase: "idle", entries: [], mutations: [] };
  return {
    devtools: {
      getSnapshot: () => snapshot,
      subscribe: () => () => {},
    },
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("mountQueryDevtools() without a DOM", () => {
  test("importing the subpath touches no global", () => {
    expect(typeof window).toBe("undefined");
    expect(typeof document).toBe("undefined");
    expect(typeof localStorage).toBe("undefined");
  });

  test("mounting is a no-op that returns a working controller", () => {
    const controller = mountQueryDevtools({ store: createSource() });

    expect(() => controller.open()).not.toThrow();
    expect(() => controller.close()).not.toThrow();
    expect(() => controller.toggle()).not.toThrow();
    expect(() => controller.destroy()).not.toThrow();
  });

  test("the corner is readable and settable even with nothing mounted", () => {
    const controller = mountQueryDevtools({ store: createSource(), toggleCorner: "top-left" });
    expect(controller.getToggleCorner()).toBe("top-left");
    controller.setToggleCorner("bottom-left");
    expect(controller.getToggleCorner()).toBe("bottom-left");
  });

  test("a missing source is not even inspected on a server", () => {
    // Nothing is built without a DOM, so option validation is moot: the panel
    // must not turn a server render into a configuration error. The same call
    // in a browser throws, which `devtools-panel.test.ts` covers.
    expect(() => mountQueryDevtools({})).not.toThrow();
  });

  test("window and document present but undefined behave like no DOM", () => {
    vi.stubGlobal("window", undefined);
    vi.stubGlobal("document", undefined);
    vi.stubGlobal("localStorage", undefined);

    const controller = mountQueryDevtools({ store: createSource() });
    expect(() => controller.destroy()).not.toThrow();
  });

  test("the plugin defers to nothing and hands back a safe cleanup", () => {
    const register = queryDevtoolsPlugin();
    const cleanup = register({ store: () => createSource() } as never);
    expect(typeof cleanup).toBe("function");
    expect(() => cleanup()).not.toThrow();
  });
});

describe("getQueryStore() without a DOM", () => {
  test("accepts a source that already exposes devtools", () => {
    const source = createSource();
    expect(getQueryStore(source)).toBe(source);
  });

  test("resolves a store by name from an Alpine-like source", () => {
    const store = createSource();
    expect(
      getQueryStore(
        { store: (name: string) => (name === "cache" ? store : undefined) } as never,
        "cache"
      )
    ).toBe(store);
  });

  test("names the plugin that has to be registered when the store has no devtools", () => {
    expect(() => getQueryStore({ store: () => ({}) } as never)).toThrow(
      /Register @ailura\/alpinejs-query first/
    );
  });
});
