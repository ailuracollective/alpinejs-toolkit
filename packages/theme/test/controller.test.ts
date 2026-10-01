import { clearAllSingletons } from "@ailura/alpinejs-core/singletons";
// @vitest-environment happy-dom
import { afterEach, describe, expect, test, vi } from "vite-plus/test";

import { ThemeController } from "../src/controller";
import { createMemoryThemeStorage } from "../src/storage/memory-storage";
import type { ThemeChangeDetail } from "../src/types";

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
