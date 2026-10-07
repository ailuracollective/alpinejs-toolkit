import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { clearAllSingletons } from "@ailura/alpinejs-core/singletons";
// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, test, vi } from "vite-plus/test";

import {
  createThemeController,
  createThemeFaviconController,
  THEME_FAVICON_ATTRIBUTE,
  ThemeController,
  ThemeFaviconController,
} from "../src/controller";
import { createMemoryThemeStorage } from "../src/storage/memory-storage";
import type { ThemeChangeDetail, ThemePreference, ThemeStorage } from "../src/types";

// Drain microtask queue (initialization emit).
async function flush(): Promise<void> {
  await new Promise<void>((resolve) => queueMicrotask(resolve));
  await new Promise<void>((resolve) => setTimeout(resolve, 0));
}

// ---------------------------------------------------------------------------
// matchMedia mock helper
// ---------------------------------------------------------------------------
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
    // older API compat
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
      // keep mql.matches in sync via getter already
      const event = { matches } as MediaQueryListEvent;
      for (const l of [...listeners]) l(event);
    },
    cleanup() {
      window.matchMedia = original;
    },
  };
}

describe("ThemeController getters", () => {
  let media: MockMedia | undefined;
  afterEach(() => {
    media?.cleanup();
    media = undefined;
    clearAllSingletons();
  });

  test("defaults to system preference, resolved derived, get() snapshot", async () => {
    media = stubSystem("light");
    const storage = createMemoryThemeStorage();
    const c = new ThemeController({ storage, watchSystem: false, strategy: "none" });
    c.mount();
    await flush();
    expect(c.current).toBe("system");
    expect(c.system).toBe("light");
    expect(c.resolved).toBe("light");
    expect(c.get()).toEqual({ current: "system", system: "light", resolved: "light" });
    c.destroy();
  });

  test("explicit defaultTheme hydrates and derives resolved", async () => {
    media = stubSystem("dark");
    const storage = createMemoryThemeStorage();
    const c = new ThemeController({
      storage,
      defaultTheme: "light",
      watchSystem: false,
      strategy: "none",
    });
    c.mount();
    await flush();
    expect(c.current).toBe("light");
    expect(c.resolved).toBe("light");
    expect(c.system).toBe("dark");
    // resolved is current when explicit
    c.destroy();
  });

  test("coerce fallback: invalid defaultTheme falls back to system", async () => {
    media = stubSystem("light");
    const storage = createMemoryThemeStorage();
    const c = new ThemeController({
      // @ts-expect-error invalid
      defaultTheme: "garbage",
      storage,
      watchSystem: false,
      strategy: "none",
    });
    c.mount();
    await flush();
    expect(c.current).toBe("system");
    c.destroy();
  });

  test("storage persistence hydrates preference on mount", async () => {
    media = stubSystem("light");
    const storage = createMemoryThemeStorage("dark");
    const c = new ThemeController({ storage, watchSystem: false, strategy: "none" });
    c.mount();
    await flush();
    expect(c.current).toBe("dark");
    expect(c.resolved).toBe("dark");
    c.destroy();
  });

  test("invalid persisted value falls back to defaultTheme", async () => {
    const raw = createMemoryThemeStorage();
    // force invalid value via cast bypass
    (raw as unknown as { set(v: unknown): void }).set("nope" as never);
    media = stubSystem("light");
    const c = new ThemeController({ storage: raw as never, watchSystem: false, strategy: "none" });
    c.mount();
    await flush();
    expect(c.current).toBe("system");
    c.destroy();
  });
});

describe("ThemeController mutations", () => {
  let media: MockMedia | undefined;
  afterEach(() => {
    media?.cleanup();
    media = undefined;
    clearAllSingletons();
  });

  test("set changes preference, persists, and emits once", async () => {
    media = stubSystem("light");
    const storage = createMemoryThemeStorage();
    const c = new ThemeController({ storage, watchSystem: false, strategy: "none" });
    c.mount();
    await flush();
    const events: ThemeChangeDetail[] = [];
    c.on("change", (d) => events.push(d));
    events.length = 0; // drop initialization
    c.set("dark");
    expect(c.current).toBe("dark");
    expect(c.resolved).toBe("dark");
    expect(storage.get()).toBe("dark");
    expect(events).toHaveLength(1);
    expect(events[0].source).toBe("user");
    expect(events[0].previous?.current).toBe("system");
    c.destroy();
  });

  test("set same value is no-op with no emit and no storage write", async () => {
    media = stubSystem("light");
    const storage = createMemoryThemeStorage();
    const spy = vi.spyOn(storage, "set");
    const c = new ThemeController({ storage, watchSystem: false, strategy: "none" });
    c.mount();
    await flush();
    const events: ThemeChangeDetail[] = [];
    c.on("change", (d) => events.push(d));
    events.length = 0;
    // current is system -> set system is no-op
    c.set("system");
    expect(spy).not.toHaveBeenCalled();
    expect(events).toHaveLength(0);
    // set dark then set dark again no-op
    c.set("dark");
    events.length = 0;
    spy.mockClear();
    c.set("dark");
    expect(spy).not.toHaveBeenCalled();
    expect(events).toHaveLength(0);
    c.destroy();
  });

  test("set with invalid value coerces to defaultTheme", async () => {
    media = stubSystem("light");
    const storage = createMemoryThemeStorage();
    const c = new ThemeController({
      storage,
      defaultTheme: "light",
      watchSystem: false,
      strategy: "none",
    });
    c.mount();
    await flush();
    // current is light, invalid -> coerces to light => no-op
    const events: ThemeChangeDetail[] = [];
    c.on("change", (d) => events.push(d));
    events.length = 0;
    // @ts-expect-error invalid
    c.set("bogus");
    expect(c.current).toBe("light");
    expect(events).toHaveLength(0);
    // now set to dark, then invalid should coerce to light and change
    c.set("dark");
    events.length = 0;
    // @ts-expect-error invalid
    c.set("invalid");
    expect(c.current).toBe("light");
    expect(events).toHaveLength(1);
    expect(events[0].source).toBe("user");
    c.destroy();
  });

  test("toggle resolves via resolved and always writes explicit", async () => {
    media = stubSystem("light");
    const storage = createMemoryThemeStorage();
    const c = new ThemeController({ storage, watchSystem: false, strategy: "none" });
    c.mount();
    await flush();
    // system light, current system => resolved light => toggle -> dark
    c.toggle();
    expect(c.current).toBe("dark");
    expect(c.resolved).toBe("dark");
    c.toggle();
    expect(c.current).toBe("light");
    expect(c.resolved).toBe("light");
    c.destroy();
  });

  test("toggle when system is dark flips correctly", async () => {
    media = stubSystem("dark");
    const storage = createMemoryThemeStorage();
    const c = new ThemeController({ storage, watchSystem: false, strategy: "none" });
    c.mount();
    await flush();
    // current system, system dark => resolved dark => toggle -> light
    expect(c.resolved).toBe("dark");
    c.toggle();
    expect(c.current).toBe("light");
    expect(storage.get()).toBe("light");
    // now resolved light => toggle -> dark
    c.toggle();
    expect(c.current).toBe("dark");
    c.destroy();
  });

  test("toggle no-op when next equals current (edge)", async () => {
    media = stubSystem("light");
    const storage = createMemoryThemeStorage("light");
    const c = new ThemeController({ storage, watchSystem: false, strategy: "none" });
    c.mount();
    await flush();
    // current light, resolved light => toggle wants dark => not same => change
    // force case: current dark resolved dark => toggle wants light => not same
    // the only potential no-op is if resolved calculation already equals next? not possible
    // but test that toggle on dark with resolved dark works
    c.set("dark");
    expect(c.current).toBe("dark");
    c.toggle(); // resolved dark -> light
    expect(c.current).toBe("light");
    c.destroy();
  });

  test("reset returns to defaultTheme and removes storage", async () => {
    media = stubSystem("light");
    const storage = createMemoryThemeStorage();
    const c = new ThemeController({
      storage,
      defaultTheme: "system",
      watchSystem: false,
      strategy: "none",
    });
    c.mount();
    await flush();
    c.set("dark");
    expect(storage.get()).toBe("dark");
    const events: ThemeChangeDetail[] = [];
    c.on("change", (d) => events.push(d));
    events.length = 0;
    c.reset();
    expect(c.current).toBe("system");
    expect(c.resolved).toBe("light");
    expect(storage.get()).toBeNull();
    expect(events).toHaveLength(1);
    expect(events[0].source).toBe("reset");
    c.destroy();
  });

  test("reset at default is no-op except storage.remove called", async () => {
    media = stubSystem("light");
    const storage = createMemoryThemeStorage();
    const spy = vi.spyOn(storage, "remove");
    const c = new ThemeController({
      storage,
      defaultTheme: "system",
      watchSystem: false,
      strategy: "none",
    });
    c.mount();
    await flush();
    const events: ThemeChangeDetail[] = [];
    c.on("change", (d) => events.push(d));
    events.length = 0;
    c.reset();
    expect(spy).toHaveBeenCalledOnce();
    expect(events).toHaveLength(0);
    expect(c.current).toBe("system");
    c.destroy();
  });

  test("apply force applies even when resolved unchanged", async () => {
    media = stubSystem("light");
    // use real DOM target
    const target = document.createElement("div");
    document.body.appendChild(target);
    const storage = createMemoryThemeStorage();
    const c = new ThemeController({
      storage,
      watchSystem: false,
      strategy: "class",
      target,
      darkClass: "dark",
      lightClass: "light",
    });
    c.mount();
    await flush();
    expect(target.classList.contains("light")).toBe(true);
    // apply without force should be no-op (already applied)
    target.classList.remove("light");
    // internal current still light, #dom.current is light so non-force apply is no-op
    c.apply(); // not force? Actually apply calls with force true? check controller.apply -> dom.apply(resolved, true) => force true, so it reapplies
    expect(target.classList.contains("light")).toBe(true);
    c.destroy();
    target.remove();
  });

  test("destroy is idempotent and freezes further mutations", async () => {
    media = stubSystem("light");
    const storage = createMemoryThemeStorage();
    const c = new ThemeController({ storage, watchSystem: false, strategy: "none" });
    c.mount();
    await flush();
    c.set("dark");
    expect(c.current).toBe("dark");
    expect(() => {
      c.destroy();
      c.destroy();
    }).not.toThrow();
    expect(c.lifecycle).toBe("destroyed");
    const events: ThemeChangeDetail[] = [];
    c.on("change", (d) => events.push(d));
    c.set("light");
    c.toggle();
    c.reset();
    c.apply();
    expect(c.current).toBe("dark");
    expect(events).toHaveLength(0);
  });
});

describe("ThemeController cross-tab", () => {
  let media: MockMedia | undefined;
  afterEach(() => {
    media?.cleanup();
    media = undefined;
    clearAllSingletons();
  });

  test("crossTab dedup: local write does not re-emit via subscribe", async () => {
    media = stubSystem("light");
    const storage = createMemoryThemeStorage();
    const c = new ThemeController({
      storage,
      watchSystem: false,
      crossTab: true,
      strategy: "none",
    });
    c.mount();
    await flush();
    const events: ThemeChangeDetail[] = [];
    c.on("change", (d) => events.push(d));
    events.length = 0;
    c.set("dark"); // writes storage, subscribe will fire but deduped
    expect(events).toHaveLength(1);
    expect(events[0].source).toBe("user");
    // only 1 emit, not 2
    c.destroy();
  });

  test("external storage change emits source storage", async () => {
    media = stubSystem("light");
    const storage = createMemoryThemeStorage();
    const c = new ThemeController({
      storage,
      watchSystem: false,
      crossTab: true,
      strategy: "none",
    });
    c.mount();
    await flush();
    const events: ThemeChangeDetail[] = [];
    c.on("change", (d) => events.push(d));
    events.length = 0;
    // simulate other tab writing
    storage.set("dark");
    expect(c.current).toBe("dark");
    expect(events).toHaveLength(1);
    expect(events[0].source).toBe("storage");
    expect(events[0].current).toBe("dark");
    c.destroy();
  });

  test("external storage remove falls back to defaultTheme", async () => {
    media = stubSystem("light");
    const storage = createMemoryThemeStorage("dark");
    const c = new ThemeController({
      storage,
      defaultTheme: "system",
      watchSystem: false,
      crossTab: true,
      strategy: "none",
    });
    c.mount();
    await flush();
    expect(c.current).toBe("dark");
    const events: ThemeChangeDetail[] = [];
    c.on("change", (d) => events.push(d));
    events.length = 0;
    storage.remove(); // external tab cleared
    expect(c.current).toBe("system");
    expect(events).toHaveLength(1);
    expect(events[0].source).toBe("storage");
    c.destroy();
  });

  test("crossTab disabled does not subscribe", async () => {
    media = stubSystem("light");
    const storage = createMemoryThemeStorage();
    const spy = vi.spyOn(storage, "subscribe");
    const c = new ThemeController({
      storage,
      watchSystem: false,
      crossTab: false,
      strategy: "none",
    });
    c.mount();
    await flush();
    expect(spy).not.toHaveBeenCalled();
    storage.set("dark");
    expect(c.current).toBe("system"); // no reaction
    c.destroy();
  });

  test("crossTab null same-value is no-op", async () => {
    media = stubSystem("light");
    const storage = createMemoryThemeStorage();
    const c = new ThemeController({
      storage,
      watchSystem: false,
      crossTab: true,
      strategy: "none",
    });
    c.mount();
    await flush();
    const events: ThemeChangeDetail[] = [];
    c.on("change", (d) => events.push(d));
    events.length = 0;
    // current system, external remove (null) -> coerce to system -> same => no emit
    storage.remove();
    // memory storage remove from null is no-op (no listener call) so no emit anyway
    expect(events).toHaveLength(0);
    c.destroy();
  });
});

describe("ThemeController system observer", () => {
  let media: MockMedia | undefined;
  afterEach(() => {
    media?.cleanup();
    media = undefined;
    clearAllSingletons();
  });

  test("when current is system, system change updates resolved and emits source system", async () => {
    media = stubSystem("light");
    const storage = createMemoryThemeStorage();
    const c = new ThemeController({ storage, watchSystem: true, strategy: "none" });
    c.mount();
    await flush();
    expect(c.system).toBe("light");
    expect(c.resolved).toBe("light");
    const events: ThemeChangeDetail[] = [];
    c.on("change", (d) => events.push(d));
    events.length = 0;
    media.trigger("dark");
    expect(c.system).toBe("dark");
    expect(c.resolved).toBe("dark");
    expect(c.current).toBe("system");
    expect(events).toHaveLength(1);
    expect(events[0].source).toBe("system");
    expect(events[0].previous?.resolved).toBe("light");
    c.destroy();
  });

  test("when current is explicit, system change does not emit", async () => {
    media = stubSystem("light");
    const storage = createMemoryThemeStorage();
    const c = new ThemeController({ storage, watchSystem: true, strategy: "none" });
    c.mount();
    await flush();
    c.set("light"); // explicit
    const events: ThemeChangeDetail[] = [];
    c.on("change", (d) => events.push(d));
    events.length = 0;
    media.trigger("dark");
    expect(c.system).toBe("dark");
    expect(c.current).toBe("light");
    expect(c.resolved).toBe("light");
    expect(events).toHaveLength(0);
    c.destroy();
  });

  test("system observer disabled does not react", async () => {
    media = stubSystem("light");
    const storage = createMemoryThemeStorage();
    const c = new ThemeController({ storage, watchSystem: false, strategy: "none" });
    c.mount();
    await flush();
    const events: ThemeChangeDetail[] = [];
    c.on("change", (d) => events.push(d));
    events.length = 0;
    // manual mock still has matcher but observer not wired, so trigger via direct call not possible
    // verify no subscription: triggering our mocked media should not affect controller because observer not listening
    // but our mock listeners are still there if controller subscribed; since watchSystem false, no subscription => no call
    // we simulate by checking that system stays light
    // trigger would still be called on mock mql but controller not listening
    media.trigger("dark");
    expect(c.system).toBe("light");
    expect(events).toHaveLength(0);
    c.destroy();
  });

  test("system change dedup when resolved unchanged", async () => {
    media = stubSystem("light");
    const storage = createMemoryThemeStorage("dark"); // explicit dark, but we will set to system
    const c = new ThemeController({ storage, watchSystem: true, strategy: "none" });
    c.mount();
    await flush();
    // current dark, not system, first set to system then test
    c.set("system");
    expect(c.current).toBe("system");
    // currently system light (media light) => resolved light, now trigger light again? Actually media already light
    const events: ThemeChangeDetail[] = [];
    c.on("change", (d) => events.push(d));
    events.length = 0;
    media.trigger("light"); // same as current resolved
    expect(events).toHaveLength(0);
    c.destroy();
  });
});

describe("ThemeController initialization emit", () => {
  afterEach(() => {
    clearAllSingletons();
  });

  test("emits one initialization event with previous null via microtask", async () => {
    const media = stubSystem("light");
    const storage = createMemoryThemeStorage();
    const c = new ThemeController({ storage, watchSystem: false, strategy: "none" });
    const events: ThemeChangeDetail[] = [];
    c.on("change", (d) => events.push(d));
    c.mount();
    expect(events).toHaveLength(0);
    await flush();
    expect(events).toHaveLength(1);
    expect(events[0].source).toBe("initialization");
    expect(events[0].previous).toBeNull();
    expect(events[0].current).toBe("system");
    media.cleanup();
    c.destroy();
  });

  test("destroy before microtask suppresses initialization emit", async () => {
    const media = stubSystem("light");
    const storage = createMemoryThemeStorage();
    const c = new ThemeController({ storage, watchSystem: false, strategy: "none" });
    const events: ThemeChangeDetail[] = [];
    c.on("change", (d) => events.push(d));
    c.mount();
    c.destroy();
    await flush();
    expect(events).toHaveLength(0);
    media.cleanup();
  });
});

describe("ThemeController DOM strategies", () => {
  afterEach(() => {
    clearAllSingletons();
    document.documentElement.classList.remove("dark", "light", "custom-dark");
    document.documentElement.removeAttribute("data-theme");
  });

  test("strategy class toggles classes on change", async () => {
    const media = stubSystem("light");
    const storage = createMemoryThemeStorage();
    const c = new ThemeController({
      storage,
      watchSystem: false,
      strategy: "class",
      darkClass: "dark",
      lightClass: "light",
    });
    c.mount();
    await flush();
    expect(document.documentElement.classList.contains("light")).toBe(true);
    c.set("dark");
    expect(document.documentElement.classList.contains("dark")).toBe(true);
    expect(document.documentElement.classList.contains("light")).toBe(false);
    c.destroy();
    expect(document.documentElement.classList.contains("dark")).toBe(false);
    media.cleanup();
  });

  test("strategy attribute sets data-theme", async () => {
    const media = stubSystem("light");
    const storage = createMemoryThemeStorage();
    const c = new ThemeController({
      storage,
      watchSystem: false,
      strategy: "attribute",
      attribute: "data-theme",
    });
    c.mount();
    await flush();
    expect(document.documentElement.getAttribute("data-theme")).toBe("light");
    c.set("dark");
    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
    c.destroy();
    expect(document.documentElement.hasAttribute("data-theme")).toBe(false);
    media.cleanup();
  });

  test("strategy none never touches DOM", async () => {
    const media = stubSystem("light");
    const storage = createMemoryThemeStorage();
    const c = new ThemeController({ storage, watchSystem: false, strategy: "none" });
    c.mount();
    await flush();
    expect(document.documentElement.classList.contains("dark")).toBe(false);
    expect(document.documentElement.classList.contains("light")).toBe(false);
    c.set("dark");
    expect(document.documentElement.classList.contains("dark")).toBe(false);
    c.destroy();
    media.cleanup();
  });
});

// ---------------------------------------------------------------------------
// ThemeFaviconController
// ---------------------------------------------------------------------------
/**
 * Theme-aware favicons.
 *
 * Three claims, tested apart because they fail for different reasons: the two
 * strategies disagree about who decides (the browser vs
 * `ThemeController.resolved`), ownership is about what teardown does *not*
 * touch, and SSR is about construction without a DOM at all — that last one
 * lives in `controller-ssr.test.ts`, which runs in the node environment
 * because a test file can only pin one.
 */
describe("ThemeFaviconController", () => {
  const LIGHT_ICON = "/favicon-light.svg";
  const DARK_ICON = "/favicon-dark.svg";

  // Every assertion below reads <head> directly — what survives, what is
  // appended, what teardown removes — so it starts and ends from a clean one.
  let media: MockMedia | undefined;

  const created: ThemeFaviconController[] = [];
  const track = (favicon: ThemeFaviconController): ThemeFaviconController => {
    created.push(favicon);
    return favicon;
  };

  beforeEach(() => {
    document.head.innerHTML = "";
  });

  afterEach(() => {
    for (const favicon of created.splice(0)) favicon.destroy();
    media?.cleanup();
    media = undefined;
    document.head.innerHTML = "";
    clearAllSingletons();
  });
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
      track(
        createThemeFaviconController({ theme: controller, light: LIGHT_ICON, dark: DARK_ICON })
      );

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
      const source = readFileSync(
        resolve(import.meta.dirname, "..", "src", "controller.ts"),
        "utf8"
      );

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
});
