/**
 * Contract for the single reactive `$env` aggregate magic.
 *
 * `$env` replaces the four independent `$network` / `$visibility` / `$battery` /
 * `$platform` magics. Three defects drove the collapse, and each has a test
 * here:
 *
 * 1. The teardown handle could disappear (`envPlugin({ network: false })` left a
 *    controller holding `window` listeners with nothing to destroy it from).
 * 2. The three hand-registered magics were NOT reactive: Alpine's `injectMagics`
 *    does not wrap a magic's return value in `reactive()`, so a listener
 *    mutating the controller's plain object never re-rendered. The real-Alpine
 *    tests below drive real `visibilitychange` / `online` / `offline` events and
 *    assert the rendered text changes — a mock Alpine would pass either way.
 * 3. `EnvState` was exported but had no surface at runtime. The aggregate
 *    completeness test pins all four domains onto the view.
 */

// @vitest-environment happy-dom
import { clearAllSingletons } from "@ailura/alpinejs-core/singletons";
import { html, mount, reset, resume, settled, start } from "@ailura/alpinejs-testing";
import Alpine from "alpinejs";
import { afterEach, beforeAll, beforeEach, describe, expect, test } from "vite-plus/test";

import { envPlugin } from "../src/plugin";
import type { EnvMagic, EnvPluginOptions } from "../src/types";

// --- Alpine doubles --------------------------------------------------------

function createMockAlpine() {
  const magics = new Map<string, unknown>();
  const alpine = {
    magic(name: string, callback: unknown) {
      magics.set(name, callback);
    },
  } as unknown as import("alpinejs").Alpine;
  return { alpine, magics };
}

// --- Browser API stubs (installed before any controller is constructed) ------

/** Mutable backing value for the stubbed `navigator.onLine` read. */
let online = true;

function stubOnline(): void {
  Object.defineProperty(window.navigator, "onLine", {
    configurable: true,
    get: () => online,
  });
}

/** Mutable backing value for the stubbed `document.visibilityState` read. */
let visibility: "visible" | "hidden" = "visible";

function stubVisibility(): void {
  Object.defineProperty(document, "visibilityState", {
    configurable: true,
    get: () => visibility,
  });
  Object.defineProperty(document, "hidden", {
    configurable: true,
    get: () => visibility === "hidden",
  });
}

/** A REAL `offline` event, as the browser would deliver it. */
function goOffline(): void {
  online = false;
  window.dispatchEvent(new Event("offline"));
}

/** A REAL `online` event, as the browser would deliver it. */
function goOnline(): void {
  online = true;
  window.dispatchEvent(new Event("online"));
}

/** A REAL `visibilitychange` event on `document`. */
function setVisibility(next: "visible" | "hidden"): void {
  visibility = next;
  document.dispatchEvent(new Event("visibilitychange"));
}

function registerMock(options?: EnvPluginOptions): {
  alpine: import("alpinejs").Alpine;
  magics: Map<string, unknown>;
  /** Reads the magic under whatever name the options configured. */
  env: () => EnvMagic;
} {
  const { alpine, magics } = createMockAlpine();
  envPlugin(options)(alpine);
  const key = options?.magicKey ?? "env";
  const env = magics.get(key) as () => EnvMagic;
  return { alpine, magics, env };
}

function text(testid: string): string {
  return document.querySelector(`[data-testid="${testid}"]`)?.textContent ?? "";
}

// --- Mock Alpine: the surface, the handle, the aggregate --------------------

describe("envPlugin $env surface (mock Alpine)", () => {
  beforeEach(() => {
    online = true;
    visibility = "visible";
    stubOnline();
    stubVisibility();
  });

  afterEach(() => {
    clearAllSingletons();
  });

  test("registers exactly one magic, and none of the four removed ones", () => {
    const { magics, env } = registerMock();
    expect([...magics.keys()]).toEqual(["env"]);
    expect(env().network).toBeDefined();
    expect(env().visibility).toBeDefined();
    // `toBeDefined()` passes for `null`, so it asserted nothing about battery —
    // which is how a package whose battery never updated shipped a test that
    // looked like coverage. The battery domain is legitimately `null` without
    // the API, so pin the documented shape. The live-update half of this
    // contract lives in `battery.test.ts`.
    expect(env().battery).toBeNull();
    expect(env().platform).toBeDefined();
  });

  test("magicKey renames the single magic", () => {
    const { magics, env } = registerMock({ magicKey: "context" });
    expect([...magics.keys()]).toEqual(["context"]);
    expect(typeof env().destroy).toBe("function");
  });

  test("$env is never empty: registration syncs the controller's own getters", () => {
    const { env } = registerMock();
    const view = env();
    expect(view.network.online).toBe(true);
    expect(view.visibility).toEqual({
      visible: true,
      hidden: false,
      state: "visible",
      supported: true,
    });
    expect(view.platform.platform).toBe(window.navigator.platform ?? "");
    expect(typeof view.destroy).toBe("function");
  });

  test("$env exposes a host-owned destroy handle", () => {
    const { env } = registerMock();
    expect(typeof env().destroy).toBe("function");
  });

  test("window online/offline events stop updating state after destroy", () => {
    const { env } = registerMock();

    // Before destroy: the window listener is live and drives the state.
    goOffline();
    expect(env().network.online).toBe(false);
    goOnline();
    expect(env().network.online).toBe(true);

    env().destroy();

    // After destroy: the same real event no longer reaches the controller.
    goOffline();
    expect(env().network.online).toBe(true);
    goOnline();
    expect(env().network.online).toBe(true);
  });

  test("the other domains stay readable after destroy (state is frozen, not broken)", () => {
    const { env } = registerMock();
    const view = env();
    goOffline();
    view.destroy();

    // The view keeps its last known value; nothing throws.
    expect(view.network.online).toBe(false);
    // A sibling domain is entirely unaffected.
    expect(typeof view.platform.platform).toBe("string");
    expect(view.visibility.supported).toBe(true);
  });

  test("destroy is idempotent and does not throw when called twice", () => {
    const { env } = registerMock();
    expect(() => {
      env().destroy();
      env().destroy();
    }).not.toThrow();
  });

  // Defect 1: with `network: false` the teardown handle used to disappear while
  // the controller kept the other domains' listeners alive.
  test("the handle exists with network disabled and still releases the other domains' listeners", () => {
    const { magics } = registerMock({ network: false });
    const env = magics.get("env") as () => EnvMagic;
    const view = env();

    // The network magic is not a surface anymore, but `destroy` always is.
    expect(typeof view.destroy).toBe("function");
    expect(view.network.supported).toBe(false);

    // Before destroy: the still-enabled visibility domain tracks the real event.
    setVisibility("hidden");
    expect(view.visibility.visible).toBe(false);

    view.destroy();

    // After destroy: the document listener is gone, so the same real event is
    // inert for this view.
    setVisibility("visible");
    expect(view.visibility.visible).toBe(false);
  });

  // Defect 3: no domain may be dropped from the projection silently.
  test("the aggregate carries all four domains and they match the controller", () => {
    const { env } = registerMock();
    const view = env();
    expect(Object.keys(view).sort()).toEqual([
      "battery",
      "destroy",
      "network",
      "platform",
      "visibility",
    ]);

    goOffline();
    setVisibility("hidden");

    expect(view.network).toEqual({ online: false, supported: true });
    expect(view.visibility).toEqual({
      visible: false,
      hidden: true,
      state: "hidden",
      supported: true,
    });
    expect(view.battery).toBeNull();
    expect(view.platform).toEqual({
      userAgent: window.navigator.userAgent,
      platform: window.navigator.platform,
      vendor: window.navigator.vendor,
      isIos: false,
      isAndroid: false,
      isMobile: false,
      isMac: /mac/i.test(window.navigator.platform),
      isWindows: /win/i.test(window.navigator.platform),
      supported: true,
    });

    goOnline();
    setVisibility("visible");
    expect(view.network.online).toBe(true);
    expect(view.visibility.state).toBe("visible");
  });

  test("a disabled domain reports supported: false and is frozen, while enabled ones track", () => {
    const { env } = registerMock({ visibility: false, battery: false });
    const view = env();

    expect(view.visibility.supported).toBe(false);
    // A disabled battery domain reports the same "unsupported" shape a browser
    // without the Battery API does: `null`.
    expect(view.battery).toBeNull();
    expect(view.network.supported).toBe(true);
    expect(view.platform.supported).toBe(true);

    // A change to an ENABLED domain still projects...
    goOffline();
    expect(view.network.online).toBe(false);
    // ...while the disabled one is frozen at its registration read.
    setVisibility("hidden");
    expect(view.visibility.visible).toBe(true);
  });
});

// --- Real Alpine: the reactivity the four magics never had ------------------

describe("envPlugin $env reactivity (real Alpine)", () => {
  // Alpine holds process-wide singleton state: start it exactly once per file.
  beforeAll(() => {
    start(() => {});
  });

  beforeEach(() => {
    online = true;
    visibility = "visible";
    stubOnline();
    stubVisibility();
    // guardMagic allows the same package to re-register (hot reload), so every
    // test gets a fresh controller and a fresh view.
    envPlugin()(Alpine as unknown as import("alpinejs").Alpine);
    resume();
  });

  afterEach(() => {
    reset();
    clearAllSingletons();
  });

  // happy-dom stringifies `false` to "" through `textContent =`, so the probe
  // wraps the value in String() and the raw binding stays in the same node.
  test("a real visibilitychange re-renders $env.visibility.visible", async () => {
    mount(
      html(`<div x-data>
        <span data-testid="vis" x-text="String($env.visibility.visible)"></span>
      </div>`)
    );
    await settled();
    expect(text("vis")).toBe("true");

    setVisibility("hidden");
    await settled();

    expect(text("vis")).toBe("false");
  });

  test("real window online/offline events re-render $env.network.online", async () => {
    mount(
      html(`<div x-data>
        <span data-testid="net" x-text="String($env.network.online)"></span>
      </div>`)
    );
    await settled();
    expect(text("net")).toBe("true");

    goOffline();
    await settled();
    expect(text("net")).toBe("false");

    goOnline();
    await settled();
    expect(text("net")).toBe("true");
  });

  test("a real visibilitychange also re-renders a sibling domain's view of the aggregate", async () => {
    mount(
      html(`<div x-data>
        <span data-testid="offline-banner" x-text="$env.network.online ? '' : 'offline'"></span>
        <span data-testid="hidden-banner" x-text="$env.visibility.visible ? '' : 'hidden'"></span>
        <span data-testid="platform" x-text="$env.platform.platform"></span>
      </div>`)
    );
    await settled();
    expect(text("hidden-banner")).toBe("");
    expect(text("platform")).toBe(window.navigator.platform ?? "");

    setVisibility("hidden");
    await settled();

    expect(text("hidden-banner")).toBe("hidden");
    // The sibling condition was never true and must not have been rendered.
    expect(text("offline-banner")).toBe("");
  });

  test("guard: destroy() is reachable from a template and is idempotent", async () => {
    mount(
      html(`<div x-data>
        <span data-testid="handle" x-text="typeof $env.destroy"></span>
        <button data-testid="twice" @click="$env.destroy(); $env.destroy()">twice</button>
      </div>`)
    );
    await settled();
    expect(text("handle")).toBe("function");

    document.querySelector<HTMLButtonElement>('[data-testid="twice"]')?.click();
    await settled();

    // The view survives its own teardown: readable, frozen, no throw.
    expect(text("handle")).toBe("function");
  });

  test("guard: the four removed magics no longer resolve in a template", async () => {
    // Alpine's scope proxy reports `has: false` for an unregistered magic, so an
    // unknown `$name` falls through the evaluator's `with` block and throws a
    // `ReferenceError`. The probe catches it INSIDE the expression: letting it
    // escape would make Alpine's own error handler rethrow it on a timer and
    // fail the run as an unhandled error.
    const probe = (name: string): string =>
      `(() => { try { return 'resolved:' + String(${name}) } catch (e) { return e.constructor.name } })()`;
    mount(
      html(`<div x-data>
        <span data-testid="network" x-text="${probe("$network")}"></span>
        <span data-testid="visibility" x-text="${probe("$visibility")}"></span>
        <span data-testid="battery" x-text="${probe("$battery")}"></span>
        <span data-testid="platform" x-text="${probe("$platform")}"></span>
        <span data-testid="env" x-text="${probe("$env")}"></span>
      </div>`)
    );
    await settled();

    for (const testid of ["network", "visibility", "battery", "platform"]) {
      expect(text(testid)).toBe("ReferenceError");
    }
    // The aggregate itself still resolves.
    expect(text("env")).toBe("resolved:[object Object]");
  });
});
