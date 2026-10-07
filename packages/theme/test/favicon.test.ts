import { readFileSync } from "node:fs";
import { resolve } from "node:path";

// @vitest-environment happy-dom
/**
 * Theme-aware favicons.
 *
 * Three claims are tested separately, because they fail for different reasons:
 * the two strategies disagree about who decides (the browser vs
 * `ThemeController.resolved`), ownership is about what teardown does *not*
 * touch, and SSR is about construction without a DOM at all — that last one
 * lives in `favicon-ssr.test.ts`, which runs in the node environment.
 */
import { clearAllSingletons } from "@ailura/alpinejs-core/singletons";
import { afterEach, beforeEach, describe, expect, test, vi } from "vite-plus/test";

import {
  createThemeController,
  createThemeFaviconController,
  THEME_FAVICON_ATTRIBUTE,
  ThemeController,
  ThemeFaviconController,
} from "../src/controller";
import { createMemoryThemeStorage } from "../src/storage/memory-storage";
import type { ThemePreference, ThemeStorage } from "../src/types";

const LIGHT_ICON = "/favicon-light.svg";
const DARK_ICON = "/favicon-dark.svg";

interface MockMedia {
  trigger(next: "light" | "dark"): void;
  cleanup(): void;
}

function stubSystem(initial: "light" | "dark"): MockMedia {
  let matches = initial === "dark";
  const listeners = new Set<(e: MediaQueryListEvent) => void>();
  const mql = {
    get matches() {
      return matches;
    },
    media: "(prefers-color-scheme: dark)",
    addEventListener(_type: string, cb: (e: MediaQueryListEvent) => void) {
      listeners.add(cb);
    },
    removeEventListener(_type: string, cb: (e: MediaQueryListEvent) => void) {
      listeners.delete(cb);
    },
    addListener(cb: (e: MediaQueryListEvent) => void) {
      listeners.add(cb);
    },
    removeListener(cb: (e: MediaQueryListEvent) => void) {
      listeners.delete(cb);
    },
    dispatchEvent() {
      return true;
    },
  } as unknown as MediaQueryList;

  const original = window.matchMedia;
  window.matchMedia = vi.fn(() => mql) as unknown as typeof window.matchMedia;

  return {
    trigger(next) {
      matches = next === "dark";
      for (const l of [...listeners]) l({ matches } as MediaQueryListEvent);
    },
    cleanup() {
      window.matchMedia = original;
    },
  };
}

interface TestThemeOptions {
  defaultTheme?: ThemePreference;
  storage?: ThemeStorage;
  watchSystem?: boolean;
}

function createTheme(options: TestThemeOptions = {}): ThemeController {
  const controller = new ThemeController({
    storage: createMemoryThemeStorage(),
    strategy: "none",
    watchSystem: false,
    crossTab: false,
    ...options,
  });
  controller.mount();
  return controller;
}

/**
 * A storage whose own `set()` does not notify — the localStorage contract,
 * where the `storage` event fires in *other* tabs only — with a `remote()`
 * hook standing in for one of them.
 */
function createBroadcastStorage(): ThemeStorage & { remote(next: ThemePreference): void } {
  let value: ThemePreference | null = null;
  const listeners = new Set<(next: ThemePreference | null) => void>();
  return {
    get: () => value,
    set: (next) => {
      value = next;
    },
    remove: () => {
      value = null;
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    remote(next) {
      value = next;
      for (const listener of [...listeners]) listener(next);
    },
  };
}

const OWNED_SELECTOR = `link[${THEME_FAVICON_ATTRIBUTE}]`;

/** The links this feature owns, in document order. */
function ownedLinks(): HTMLLinkElement[] {
  return Array.from(document.head.querySelectorAll<HTMLLinkElement>(OWNED_SELECTOR));
}

function hrefs(): string[] {
  return ownedLinks().map((link) => link.getAttribute("href") ?? "");
}

/** An icon link the host owns; the feature must never read or remove it. */
function addHostIcon(href: string, rel = "icon"): HTMLLinkElement {
  const link = document.createElement("link");
  link.setAttribute("rel", rel);
  link.setAttribute("href", href);
  document.head.append(link);
  return link;
}

const created: ThemeFaviconController[] = [];
const track = (favicon: ThemeFaviconController): ThemeFaviconController => {
  created.push(favicon);
  return favicon;
};

let media: MockMedia | undefined;

beforeEach(() => {
  document.head.innerHTML = "";
});

afterEach(() => {
  for (const favicon of created.splice(0)) favicon.destroy();
  media?.cleanup();
  media = undefined;
  clearAllSingletons();
});

describe("theme strategy", () => {
  test("applies the resolved theme immediately, without waiting for an event", () => {
    media = stubSystem("light");
    const theme = createTheme({ defaultTheme: "system" });

    const favicon = track(
      createThemeFaviconController({ theme, light: LIGHT_ICON, dark: DARK_ICON })
    );

    // Not queued, not deferred: the link is in place when the factory returns.
    expect(hrefs()).toEqual([LIGHT_ICON]);
    expect(favicon.resolved).toBe("light");
    expect(favicon.strategy).toBe("theme");
    // No media query — that is the whole difference between the strategies.
    expect(ownedLinks()[0].hasAttribute("media")).toBe(false);
  });

  test("an explicit light preference keeps the light icon on a dark OS", () => {
    media = stubSystem("dark");
    const theme = createTheme({ defaultTheme: "light" });

    track(createThemeFaviconController({ theme, light: LIGHT_ICON, dark: DARK_ICON }));

    // The media query says dark. The application says light, and the
    // application wins — the case the native strategy cannot express.
    expect(theme.system).toBe("dark");
    expect(hrefs()).toEqual([LIGHT_ICON]);
  });

  test("an explicit dark preference keeps the dark icon on a light OS", () => {
    media = stubSystem("light");
    const theme = createTheme({ defaultTheme: "dark" });

    track(createThemeFaviconController({ theme, light: LIGHT_ICON, dark: DARK_ICON }));

    expect(hrefs()).toEqual([DARK_ICON]);
  });

  test("user changes move the icon, and reset() follows the OS again", () => {
    media = stubSystem("light");
    const theme = createTheme({ defaultTheme: "system" });
    const favicon = track(
      createThemeFaviconController({ theme, light: LIGHT_ICON, dark: DARK_ICON })
    );

    theme.set("dark");
    expect(hrefs()).toEqual([DARK_ICON]);
    expect(favicon.resolved).toBe("dark");

    theme.set("light");
    expect(hrefs()).toEqual([LIGHT_ICON]);

    theme.toggle();
    expect(hrefs()).toEqual([DARK_ICON]);

    // Back to "system", and the OS is light — so light again.
    theme.reset();
    expect(theme.current).toBe("system");
    expect(favicon.resolved).toBe("light");
    expect(hrefs()).toEqual([LIGHT_ICON]);
  });

  test("an OS change moves the icon only while the preference is system", () => {
    media = stubSystem("light");
    const theme = createTheme({ defaultTheme: "system", watchSystem: true });
    track(createThemeFaviconController({ theme, light: LIGHT_ICON, dark: DARK_ICON }));

    media.trigger("dark");
    expect(hrefs()).toEqual([DARK_ICON]);

    // From here the user has chosen, so the OS stops mattering.
    theme.set("light");
    expect(hrefs()).toEqual([LIGHT_ICON]);

    media.trigger("light");
    expect(hrefs()).toEqual([LIGHT_ICON]);
    expect(theme.system).toBe("light");

    theme.set("system");
    media.trigger("dark");
    expect(hrefs()).toEqual([DARK_ICON]);
  });

  test("a write from another tab moves the icon too", () => {
    media = stubSystem("light");
    const storage = createBroadcastStorage();
    const controller = new ThemeController({
      storage,
      strategy: "none",
      watchSystem: false,
      crossTab: true,
    });
    controller.mount();
    track(createThemeFaviconController({ theme: controller, light: LIGHT_ICON, dark: DARK_ICON }));

    // Another tab wrote "dark". That arrives through the storage subscription
    // and crosses the machine, so it is a change event like any other — and an
    // explicit choice in tab B, overriding whatever B had.
    storage.remote("dark");

    expect(controller.current).toBe("dark");
    expect(hrefs()).toEqual([DARK_ICON]);
    controller.destroy();
  });

  test("apply() re-points the link after the host replaced the head", () => {
    media = stubSystem("light");
    const theme = createTheme({ defaultTheme: "dark" });
    const favicon = track(
      createThemeFaviconController({ theme, light: LIGHT_ICON, dark: DARK_ICON })
    );
    const original = favicon.links[0];

    // What a client-side router does: the head we appended to is gone.
    document.head.innerHTML = "";
    expect(hrefs()).toEqual([]);

    favicon.apply();

    // Forced, not conditional: the resolved value did not change, the element did.
    expect(hrefs()).toEqual([DARK_ICON]);
    expect(theme.resolved).toBe("dark");
    // Re-appended, because an href written on the detached one would do nothing.
    expect(favicon.links[0]).not.toBe(original);
    expect(favicon.links[0].parentNode).toBe(document.head);
  });

  test("apply() rewrites the same element when the head survived", () => {
    media = stubSystem("light");
    const theme = createTheme({ defaultTheme: "light" });
    const favicon = track(
      createThemeFaviconController({ theme, light: LIGHT_ICON, dark: DARK_ICON })
    );
    const link = favicon.links[0];

    link.setAttribute("href", "/stale.png");
    favicon.apply();

    expect(favicon.links[0]).toBe(link);
    expect(hrefs()).toEqual([LIGHT_ICON]);
  });

  test("destroy() unsubscribes and removes its own link", () => {
    media = stubSystem("light");
    const theme = createTheme({ defaultTheme: "system" });
    const favicon = createThemeFaviconController({
      theme,
      light: LIGHT_ICON,
      dark: DARK_ICON,
    });

    favicon.destroy();
    expect(hrefs()).toEqual([]);
    expect(favicon.resolved).toBeNull();
    expect(favicon.links).toEqual([]);

    // A late change must not resurrect the element.
    theme.set("dark");
    expect(hrefs()).toEqual([]);

    expect(() => favicon.apply()).not.toThrow();
    expect(() => favicon.destroy()).not.toThrow();
  });

  test("the default strategy follows the package's singleton controller", () => {
    media = stubSystem("light");
    // No explicit `scope`: this is the document-scoped singleton that the
    // favicon factory resolves when no `theme` option is given.
    const theme = createThemeController({
      storage: createMemoryThemeStorage(),
      strategy: "none",
      watchSystem: false,
      crossTab: false,
    });

    const favicon = track(createThemeFaviconController({ light: LIGHT_ICON, dark: DARK_ICON }));

    expect(favicon.strategy).toBe("theme");
    expect(hrefs()).toEqual([LIGHT_ICON]);

    theme.set("dark");
    expect(hrefs()).toEqual([DARK_ICON]);
    theme.destroy();
  });
});

describe("media strategy", () => {
  test("writes two media-scoped links and reports no resolved theme", () => {
    const favicon = track(
      createThemeFaviconController({
        strategy: "media",
        light: LIGHT_ICON,
        dark: DARK_ICON,
      })
    );

    expect(ownedLinks()).toHaveLength(2);
    expect(hrefs()).toEqual([LIGHT_ICON, DARK_ICON]);
    expect(ownedLinks().map((link) => link.getAttribute("media"))).toEqual([
      "(prefers-color-scheme: light)",
      "(prefers-color-scheme: dark)",
    ]);
    // The browser decides, so the controller has no opinion to report.
    expect(favicon.resolved).toBeNull();
  });

  test("needs no theme controller and ignores one when given", () => {
    media = stubSystem("dark");
    const theme = createTheme({ defaultTheme: "light" });
    track(
      createThemeFaviconController({
        strategy: "media",
        theme,
        light: LIGHT_ICON,
        dark: DARK_ICON,
      })
    );

    theme.set("dark");
    media.trigger("light");

    // Unchanged: this strategy is not wired to anything at runtime.
    expect(hrefs()).toEqual([LIGHT_ICON, DARK_ICON]);
  });

  test("apply() is a no-op — the browser owns the decision", () => {
    const favicon = track(
      createThemeFaviconController({
        strategy: "media",
        light: LIGHT_ICON,
        dark: DARK_ICON,
      })
    );

    favicon.apply();
    expect(hrefs()).toEqual([LIGHT_ICON, DARK_ICON]);
  });

  test("destroy() removes both links", () => {
    const favicon = createThemeFaviconController({
      strategy: "media",
      light: LIGHT_ICON,
      dark: DARK_ICON,
    });

    favicon.destroy();

    expect(ownedLinks()).toHaveLength(0);
  });
});

describe("DOM ownership", () => {
  test("unrelated icon links survive creation and destruction untouched", () => {
    media = stubSystem("light");
    const theme = createTheme({ defaultTheme: "system" });
    const host = addHostIcon("/host-icon.png");
    const touch = addHostIcon("/host-touch.png", "apple-touch-icon");

    const favicon = createThemeFaviconController({
      theme,
      light: LIGHT_ICON,
      dark: DARK_ICON,
    });
    expect(ownedLinks()).toHaveLength(1);

    theme.set("dark");
    favicon.destroy();

    expect(host.isConnected).toBe(true);
    expect(touch.isConnected).toBe(true);
    expect(host.getAttribute("href")).toBe("/host-icon.png");
    expect(touch.getAttribute("rel")).toBe("apple-touch-icon");
  });

  test("the owned link is appended last, so it wins", () => {
    media = stubSystem("light");
    const theme = createTheme({ defaultTheme: "system" });
    addHostIcon("/host-icon.png");

    track(createThemeFaviconController({ theme, light: LIGHT_ICON, dark: DARK_ICON }));

    expect(document.head.lastElementChild?.getAttribute("href")).toBe(LIGHT_ICON);
  });

  test("two controllers coexist; destroying one leaves the other working", () => {
    media = stubSystem("light");
    const first = createTheme({ defaultTheme: "light" });
    const second = createTheme({ defaultTheme: "dark" });

    const a = track(
      createThemeFaviconController({ theme: first, light: "/a-light.svg", dark: "/a-dark.svg" })
    );
    const b = track(
      createThemeFaviconController({ theme: second, light: "/b-light.svg", dark: "/b-dark.svg" })
    );

    expect(hrefs()).toEqual(["/a-light.svg", "/b-dark.svg"]);

    a.destroy();
    expect(hrefs()).toEqual(["/b-dark.svg"]);

    second.set("light");
    expect(hrefs()).toEqual(["/b-light.svg"]);
    expect(b.resolved).toBe("light");
  });

  test("type and sizes are written under both strategies", () => {
    const native = track(
      createThemeFaviconController({
        strategy: "media",
        light: LIGHT_ICON,
        dark: DARK_ICON,
        type: "image/svg+xml",
        sizes: "any",
      })
    );
    expect(native.links.map((link) => link.getAttribute("type"))).toEqual([
      "image/svg+xml",
      "image/svg+xml",
    ]);
    expect(native.links.map((link) => link.getAttribute("sizes"))).toEqual(["any", "any"]);
    native.destroy();

    const theme = createTheme({ defaultTheme: "light" });
    track(
      createThemeFaviconController({
        theme,
        light: LIGHT_ICON,
        dark: DARK_ICON,
        type: "image/svg+xml",
      })
    );
    expect(ownedLinks()[0].getAttribute("type")).toBe("image/svg+xml");
    expect(ownedLinks()[0].hasAttribute("sizes")).toBe(false);
  });

  test("target: null is inert and still destroyable", () => {
    const favicon = createThemeFaviconController({
      light: LIGHT_ICON,
      dark: DARK_ICON,
      target: null,
    });

    expect(ownedLinks()).toHaveLength(0);
    expect(favicon.resolved).toBeNull();
    expect(() => favicon.apply()).not.toThrow();
    expect(() => favicon.destroy()).not.toThrow();
  });

  test("target places the links in another head", () => {
    // A detached head: enough to prove the links go where `target` says rather
    // than into `document.head`.
    const otherHead = document.createElement("head");
    const favicon = track(
      createThemeFaviconController({
        strategy: "media",
        light: LIGHT_ICON,
        dark: DARK_ICON,
        target: otherHead,
      })
    );

    expect(ownedLinks()).toHaveLength(0);
    expect(otherHead.querySelectorAll("link[rel=icon]")).toHaveLength(2);
    expect(favicon.links.every((link) => link.parentNode === otherHead)).toBe(true);
  });
});

describe("Alpine is optional", () => {
  test("the controller layer does not import alpinejs", () => {
    // Not `new URL(..., import.meta.url)`: Vite rewrites that pattern as an
    // asset URL before the test sees it.
    const source = readFileSync(resolve(import.meta.dirname, "..", "src", "controller.ts"), "utf8");

    // A favicon lives in <head>. Nothing about it should make the framework a
    // runtime requirement of the controller that owns it — and the theme
    // controller beside it sets the precedent by not importing Alpine either.
    expect(source).not.toMatch(/from "alpinejs"/);
    expect(source).not.toMatch(/from 'alpinejs'/);
    // It reads theme state through ThemeController, never through a store:
    // the store projection is plugin.ts's job, and it is not in this file.
    expect(source).not.toContain("./plugin");
    // The document goes through the env guard, like every other DOM access here.
    expect(source).toContain('from "@ailura/alpinejs-core/env"');
  });

  test("no Alpine is on the page, and the favicon still works", () => {
    expect((globalThis as { Alpine?: unknown }).Alpine).toBeUndefined();

    const favicon = track(
      createThemeFaviconController({
        strategy: "media",
        light: LIGHT_ICON,
        dark: DARK_ICON,
      })
    );

    expect(favicon.links).toHaveLength(2);
  });
});
