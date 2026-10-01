/**
 * Real-Alpine integration tests for the `$wakelock` / `$idle` magic surfaces.
 *
 * These drive a live Alpine instance on purpose: the defect under test is the
 * absence of a `reactive()` proxy around the magic view, and a mock Alpine
 * would happily re-render (or not) for reasons unrelated to the bug.
 */

// @vitest-environment happy-dom
import { clearAllSingletons } from "@ailura/alpinejs-core/singletons";
import { html, mount, reset, resume, settled, start } from "@ailura/alpinejs-testing";
import Alpine from "alpinejs";
import { afterEach, beforeAll, beforeEach, describe, expect, test } from "vite-plus/test";

import { attentionPlugin } from "../src/plugin";

// --- Browser API stubs (must exist before the plugin is registered) ---------

/** How many times the stub sentinel's `release()` has been invoked. */
let wakeLockReleaseCalls = 0;
/** The most recent sentinel handed out by the `navigator.wakeLock` stub. */
let latestSentinel: { released: boolean; release(): Promise<void> } | null = null;

/** A fresh sentinel per request, so one test's release cannot leak into the next. */
function createSentinel(): {
  released: boolean;
  release(): Promise<void>;
  addEventListener(): void;
  removeEventListener(): void;
} {
  const s = {
    released: false,
    release: (): Promise<void> => {
      wakeLockReleaseCalls += 1;
      return Promise.resolve();
    },
    addEventListener: () => {},
    removeEventListener: () => {},
  };
  latestSentinel = s;
  return s;
}

(window as unknown as { IdleDetector: unknown }).IdleDetector = class {
  userState = "active";
  screenState = "unlocked";
  start(): Promise<void> {
    return Promise.resolve();
  }
  addEventListener(): void {}
  removeEventListener(): void {}
  static requestPermission(): Promise<PermissionState> {
    return Promise.resolve("granted" as PermissionState);
  }
};

(navigator as unknown as { wakeLock?: unknown }).wakeLock = {
  request: () => Promise.resolve(createSentinel()),
};

// --- Helpers ---------------------------------------------------------------

const WL_KEYS = [
  "destroy",
  "error",
  "isActive",
  "isRequesting",
  "isSupported",
  "release",
  "request",
];
const IDLE_KEYS = [
  "destroy",
  "error",
  "isActive",
  "isIdle",
  "isLoading",
  "isSupported",
  "isWatching",
  "permission",
  "requestPermission",
  "screenState",
  "start",
  "stop",
  "threshold",
  "userState",
];

/** The magic view is captured from a template so the test reads the real object. */
type Captured = { wakelock: Record<string, unknown>; idle: Record<string, unknown> };

function captureViews(): Captured {
  const captured = { wakelock: null, idle: null } as unknown as Captured;
  (window as unknown as { __attention: Captured }).__attention = captured;
  return captured;
}

function text(testid: string): string {
  return document.querySelector(`[data-testid="${testid}"]`)?.textContent ?? "";
}

describe("attentionPlugin magic reactivity (real Alpine)", () => {
  // Alpine holds process-wide singleton state: start it exactly once per file.
  beforeAll(() => {
    start(() => {});
  });

  beforeEach(() => {
    // Re-registering the same package is allowed by guardMagic, so every test
    // gets fresh controllers and a fresh view with no leftover state.
    attentionPlugin()(Alpine as unknown as import("alpinejs").Alpine);
    resume();
    wakeLockReleaseCalls = 0;
    latestSentinel = null;
  });

  afterEach(() => {
    reset();
    clearAllSingletons();
  });

  test("RED: $wakelock.isActive re-renders after request()", async () => {
    const views = captureViews();
    mount(
      html(`<div x-data x-init="__attention.wakelock = $wakelock">
        <span data-testid="wl-active" x-text="$wakelock.isActive"></span>
        <span data-testid="wl-active-str" x-text="String($wakelock.isActive)"></span>
        <span data-testid="wl-requesting" x-text="String($wakelock.isRequesting)"></span>
        <span data-testid="wl-error" x-text="String($wakelock.error)"></span>
        <button data-testid="wl-request" @click="$wakelock.request()">request</button>
      </div>`)
    );
    await settled();
    (window as unknown as { __attention: Captured }).__attention = views;

    // happy-dom stringifies `false` to "" via `textContent =`, so the
    // String()-wrapped span is the reliable probe for the pre-click value;
    // the raw span is the faithful `x-text="$wakelock.isActive"` form.
    expect(text("wl-active-str")).toBe("false");

    document.querySelector<HTMLButtonElement>('[data-testid="wl-request"]')?.click();
    await settled();

    expect(text("wl-active")).toBe("true");
    expect(text("wl-active-str")).toBe("true");
    expect(text("wl-requesting")).toBe("false");
    expect(text("wl-error")).toBe("null");
  });

  test("RED: $idle.isWatching re-renders after start()", async () => {
    const views = captureViews();
    mount(
      html(`<div x-data x-init="__attention.idle = $idle">
        <span data-testid="idle-watching" x-text="String($idle.isWatching)"></span>
        <span data-testid="idle-user" x-text="String($idle.userState)"></span>
        <button data-testid="idle-start" @click="$idle.start()">start</button>
      </div>`)
    );
    await settled();
    (window as unknown as { __attention: Captured }).__attention = views;

    expect(text("idle-watching")).toBe("false");

    document.querySelector<HTMLButtonElement>('[data-testid="idle-start"]')?.click();
    await settled();

    expect(text("idle-watching")).toBe("true");
    expect(text("idle-user")).toBe("active");
  });

  test("guard: isLoading is projected onto the $idle surface as a boolean", async () => {
    const views = captureViews();
    mount(
      html(`<div x-data x-init="__attention.idle = $idle">
        <span data-testid="idle-loading" x-text="String($idle.isLoading)"></span>
      </div>`)
    );
    await settled();
    (window as unknown as { __attention: Captured }).__attention = views;

    const view = views.idle;
    // The transient `true` only exists between two awaited emits; the point of
    // this test is that the field EXISTS on the projected view and is boolean,
    // and that whatever a sync writes is what a template read observes.
    expect(view).toBeDefined();
    expect("isLoading" in view).toBe(true);
    expect(typeof view.isLoading).toBe("boolean");
    expect(typeof view.isActive).toBe("boolean");
    expect(typeof view.isIdle).toBe("boolean");
    expect(text("idle-loading")).toBe(String(view.isLoading));
  });

  test("writable: $wakelock.error written from an Alpine expression renders the written value", async () => {
    const views = captureViews();
    mount(
      html(`<div x-data x-init="__attention.wakelock = $wakelock">
        <span data-testid="wl-error-str" x-text="String($wakelock.error)"></span>
        <button data-testid="wl-set-error" @click="$wakelock.error = 'dismissed'">dismiss</button>
      </div>`)
    );
    await settled();
    (window as unknown as { __attention: Captured }).__attention = views;

    expect(text("wl-error-str")).toBe("null");

    document.querySelector<HTMLButtonElement>('[data-testid="wl-set-error"]')?.click();
    await settled();

    expect(text("wl-error-str")).toBe("dismissed");
  });

  test("writable: $idle.error written from an Alpine expression renders the written value", async () => {
    const views = captureViews();
    mount(
      html(`<div x-data x-init="__attention.idle = $idle">
        <span data-testid="idle-error-str" x-text="String($idle.error)"></span>
        <button data-testid="idle-set-error" @click="$idle.error = 'dismissed'">dismiss</button>
      </div>`)
    );
    await settled();
    (window as unknown as { __attention: Captured }).__attention = views;

    expect(text("idle-error-str")).toBe("null");

    document.querySelector<HTMLButtonElement>('[data-testid="idle-set-error"]')?.click();
    await settled();

    expect(text("idle-error-str")).toBe("dismissed");
  });

  test("writable: $idle.error survives an unrelated controller action (reaches the controller)", async () => {
    const views = captureViews();
    mount(
      html(`<div x-data x-init="__attention.idle = $idle">
        <span data-testid="idle-error-str" x-text="String($idle.error)"></span>
        <span data-testid="idle-permission" x-text="String($idle.permission)"></span>
        <button data-testid="idle-set-error" @click="$idle.error = 'dismissed'">dismiss</button>
        <button data-testid="idle-permission-btn" @click="$idle.requestPermission()">permission</button>
      </div>`)
    );
    await settled();
    (window as unknown as { __attention: Captured }).__attention = views;

    document.querySelector<HTMLButtonElement>('[data-testid="idle-set-error"]')?.click();
    await settled();
    expect(text("idle-error-str")).toBe("dismissed");

    // An unrelated `idle:change` (permission) re-runs the projection. A
    // view-local write would be reverted here; a controller write survives.
    document.querySelector<HTMLButtonElement>('[data-testid="idle-permission-btn"]')?.click();
    await settled();

    expect(text("idle-permission")).toBe("granted");
    expect(text("idle-error-str")).toBe("dismissed");
    expect(views.idle.error).toBe("dismissed");
  });

  test("guard: a readonly-typed field is still assignable in JS but is not durable", async () => {
    const views = captureViews();
    mount(
      html(`<div x-data x-init="__attention.idle = $idle">
        <span data-testid="idle-watching" x-text="String($idle.isWatching)"></span>
        <button data-testid="idle-start" @click="$idle.start()">start</button>
      </div>`)
    );
    await settled();
    (window as unknown as { __attention: Captured }).__attention = views;

    // `readonly` in the types is compile-time only. At runtime the assignment
    // is accepted and observable until the next `sync()` re-projects the
    // controller's real value over it — the write is reported state being
    // faked, not an input the controller accepted.
    views.idle.isWatching = true;
    expect(views.idle.isWatching).toBe(true);

    document.querySelector<HTMLButtonElement>('[data-testid="idle-start"]')?.click();
    await settled();

    expect(text("idle-watching")).toBe("true");
  });

  test("guard: the projection is unchanged — error is an accessor, keys stay exact", async () => {
    const views = captureViews();
    mount(
      html(`<div x-data x-init="__attention.idle = $idle; __attention.wakelock = $wakelock">
        <button data-testid="idle-start" @click="$idle.start()">start</button>
        <button data-testid="wl-request" @click="$wakelock.request()">request</button>
      </div>`)
    );
    await settled();
    (window as unknown as { __attention: Captured }).__attention = views;

    // `error` is a write-through accessor, not a plain data property.
    for (const view of [views.wakelock, views.idle]) {
      const descriptor = Object.getOwnPropertyDescriptor(view, "error");
      expect(descriptor?.get).toBeTypeOf("function");
      expect(descriptor?.set).toBeTypeOf("function");
      expect(descriptor?.enumerable).toBe(true);
    }

    document.querySelector<HTMLButtonElement>('[data-testid="wl-request"]')?.click();
    document.querySelector<HTMLButtonElement>('[data-testid="idle-start"]')?.click();
    await settled();

    // Fields still mirror the controller after a controller event, and the
    // accessor's backing store is not a new exposed key.
    expect(Object.keys(views.wakelock).sort()).toEqual(WL_KEYS);
    expect(Object.keys(views.idle).sort()).toEqual(IDLE_KEYS);
    expect(views.wakelock.isActive).toBe(true);
    expect(views.wakelock.error).toBe(null);
    expect(views.idle.isWatching).toBe(true);
    expect(views.idle.isActive).toBe(views.idle.isWatching);
    expect(views.idle.error).toBe(null);
  });

  test("guard: $wakelock exposes exactly the WakeLockMagic surface", async () => {
    const views = captureViews();
    mount(html(`<div x-data x-init="__attention.wakelock = $wakelock"></div>`));
    await settled();
    (window as unknown as { __attention: Captured }).__attention = views;

    const view = views.wakelock;
    expect(Object.keys(view).sort()).toEqual(WL_KEYS);
    expect(view.isSupported).toBe(true);
    expect(typeof view.request).toBe("function");
    expect(typeof view.release).toBe("function");
    expect(typeof view.destroy).toBe("function");
    // Not the raw controller: no controller members leak through. `destroy` is
    // a declared surface member now, so it is the only former controller name
    // that is expected on the view.
    for (const controllerOnly of ["lifecycle", "id", "mount", "on", "emit"]) {
      expect(controllerOnly in view).toBe(false);
    }
  });

  test("guard: $idle exposes exactly the IdleMagic surface and stays consistent", async () => {
    const views = captureViews();
    mount(
      html(`<div x-data x-init="__attention.idle = $idle">
        <button data-testid="idle-start" @click="$idle.start()">start</button>
      </div>`)
    );
    await settled();
    (window as unknown as { __attention: Captured }).__attention = views;

    const view = views.idle;
    expect(Object.keys(view).sort()).toEqual(IDLE_KEYS);
    expect(view.isSupported).toBe(true);
    expect(typeof view.destroy).toBe("function");
    for (const controllerOnly of ["lifecycle", "id", "mount", "on", "emit"]) {
      expect(controllerOnly in view).toBe(false);
    }

    document.querySelector<HTMLButtonElement>('[data-testid="idle-start"]')?.click();
    await settled();

    // Values stay correct after a sync: projection mirrors the controller.
    expect(view.isWatching).toBe(true);
    expect(view.isActive).toBe(true);
    expect(view.userState).toBe("active");
    expect(view.screenState).toBe("unlocked");
    expect(view.error).toBe(null);
    expect(view.threshold).toBe(60_000);
  });

  test("RED: $wakelock.destroy() releases the held sentinel and stops the controller", async () => {
    const views = captureViews();
    mount(html(`<div x-data x-init="__attention.wakelock = $wakelock"></div>`));
    await settled();
    (window as unknown as { __attention: Captured }).__attention = views;

    const view = views.wakelock as unknown as {
      request(): Promise<boolean>;
      destroy(): void;
    };
    expect(typeof view.destroy).toBe("function");

    // Take a lock first: `destroy()` only has a sentinel to release if one is
    // held, so a destroy-without-lock would pass vacuously.
    expect(await view.request()).toBe(true);
    const held = latestSentinel;
    expect(held).not.toBeNull();
    expect(wakeLockReleaseCalls).toBe(0);

    view.destroy();
    await settled();

    // Observable 1: the sentinel the browser handed us was released.
    expect(wakeLockReleaseCalls).toBe(1);
    // Observable 2: the controller no longer does work — `request()` short
    // circuits on the destroyed lifecycle and resolves `false`.
    expect(await view.request()).toBe(false);
    // A second destroy through the view must not throw: the controller owns
    // the idempotency guard, so the view adds none.
    expect(() => view.destroy()).not.toThrow();
    expect(wakeLockReleaseCalls).toBe(1);
  });

  test("RED: $idle.destroy() releases the idle watch and stops the controller", async () => {
    const views = captureViews();
    mount(html(`<div x-data x-init="__attention.idle = $idle"></div>`));
    await settled();
    (window as unknown as { __attention: Captured }).__attention = views;

    const view = views.idle as unknown as {
      start(options?: { threshold?: number }): Promise<boolean>;
      destroy(): void;
    };
    expect(typeof view.destroy).toBe("function");

    expect(await view.start()).toBe(true);
    expect(views.idle.isWatching).toBe(true);

    view.destroy();
    await settled();

    // The destroyed controller stops doing work: `start()` resolves `false`.
    expect(await view.start()).toBe(false);
    expect(() => view.destroy()).not.toThrow();
  });
});
