// @vitest-environment happy-dom
/**
 * Battery reactivity: the defect this package shipped for its whole life.
 *
 * The symptom was a battery level that was correct on load and then frozen
 * forever — the OS indicator dropping while the page kept showing the old
 * value. The cause was not Alpine: `plugin.ts` projects the controller onto an
 * `alpine.reactive()` view and re-syncs on every `change` event, which is
 * correct. The cause was upstream, in the controller:
 *
 *  1. `readBatteryState()` resolved the `BatteryManager`, copied four primitive
 *     fields out of it, and threw the instance away. A snapshot cannot update.
 *  2. `attachBatteryListeners()` was a **no-op with the name of the function
 *     that was supposed to fix it** — a comment explaining that holding the
 *     manager would be required, and then not doing it.
 *  3. `refresh()` re-read network, visibility and platform, but never battery.
 *
 * Nothing here would have caught any of that: no test in the package ever
 * stubbed `navigator.getBattery`, so `readBatteryState()` returned `null` on
 * every run. The one assertion that looked like coverage,
 * `expect(env().battery).toBeDefined()`, passes for `null` and asserts nothing.
 *
 * The stub below therefore mimics the real API rather than a snapshot: a live
 * object whose fields the test mutates, which then fires the genuine
 * `levelchange` event the browser would fire when a discharging device crosses
 * a whole-percent boundary.
 */

import { clearAllSingletons } from "@ailura/alpinejs-core/singletons";
import { html, mount, reset, resume, settled, start } from "@ailura/alpinejs-testing";
import Alpine from "alpinejs";
import { afterEach, beforeAll, beforeEach, describe, expect, test } from "vite-plus/test";

import { createEnvController, type EnvController } from "../src/controller";
import { envPlugin } from "../src/plugin";

/** A `BatteryManager` faithful enough to be a real event source. */
class FakeBatteryManager {
  charging = false;
  level = 0.8;
  chargingTime = Number.POSITIVE_INFINITY;
  dischargingTime = 3600;

  readonly #listeners = new Map<string, Set<() => void>>();

  addEventListener(type: string, listener: () => void): void {
    let set = this.#listeners.get(type);
    if (!set) {
      set = new Set();
      this.#listeners.set(type, set);
    }
    set.add(listener);
  }

  removeEventListener(type: string, listener: () => void): void {
    this.#listeners.get(type)?.delete(listener);
  }

  /** What the browser does when the level changes: update, then notify. */
  setLevel(level: number): void {
    this.level = level;
    this.fire("levelchange");
  }

  setCharging(charging: boolean): void {
    this.charging = charging;
    this.dischargingTime = charging ? Number.POSITIVE_INFINITY : 3600;
    this.chargingTime = charging ? 600 : Number.POSITIVE_INFINITY;
    this.fire("chargingchange");
  }

  /** Total listeners still attached — the teardown assertion depends on it. */
  listenerCount(type: string): number {
    return this.#listeners.get(type)?.size ?? 0;
  }

  fire(type: string): void {
    for (const listener of [...(this.#listeners.get(type) ?? [])]) listener();
  }
}

let originalGetBattery: PropertyDescriptor | undefined;
let originalPermissions: PropertyDescriptor | undefined;
let originalWakeLock: PropertyDescriptor | undefined;

function installBattery(value: FakeBatteryManager | null): void {
  // `getBattery` must be absent, not present-and-undefined: the adapter's
  // probe is `typeof nav.getBattery !== "function"`.
  Object.defineProperty(window.navigator, "getBattery", {
    configurable: true,
    writable: true,
    value: value === null ? undefined : () => Promise.resolve(value),
  });
}

function removeFromNavigatorPrototype(name: string): void {
  const proto = Object.getPrototypeOf(window.navigator) as object;
  Reflect.deleteProperty(proto, name);
}

/** Let the async `getBattery()` hydration settle. */
async function hydrate(): Promise<void> {
  await settled();
  await Promise.resolve();
  await settled();
}

function text(testid: string): string {
  return document.querySelector(`[data-testid="${testid}"]`)?.textContent ?? "";
}

beforeAll(() => {
  start(() => {});
});

beforeEach(() => {
  originalGetBattery = Object.getOwnPropertyDescriptor(window.navigator, "getBattery");
  originalPermissions = Object.getOwnPropertyDescriptor(window.navigator, "permissions");
  originalWakeLock = Object.getOwnPropertyDescriptor(window.navigator, "wakeLock");
  removeFromNavigatorPrototype("getBattery");
});

afterEach(() => {
  Reflect.deleteProperty(window.navigator, "getBattery");
  if (originalGetBattery) {
    Object.defineProperty(window.navigator, "getBattery", originalGetBattery);
  }
  if (originalPermissions) {
    Object.defineProperty(window.navigator, "permissions", originalPermissions);
  }
  if (originalWakeLock) {
    Object.defineProperty(window.navigator, "wakeLock", originalWakeLock);
  }
  reset();
  clearAllSingletons();
});

describe("battery — hydration", () => {
  test("resolves the level through the async API", async () => {
    installBattery(new FakeBatteryManager());
    const controller = createEnvController();
    await hydrate();

    expect(controller.battery).toEqual({
      charging: false,
      level: 0.8,
      chargingTime: Number.POSITIVE_INFINITY,
      dischargingTime: 3600,
    });
    controller.destroy();
  });

  test("stays null — the documented 'unsupported' shape — without the API", async () => {
    installBattery(null);
    const controller = createEnvController();
    await hydrate();

    expect(controller.battery).toBeNull();
    controller.destroy();
  });

  test("keeps Infinity handling intact, since Chrome reports it for both timers", async () => {
    const m = new FakeBatteryManager();
    installBattery(m);
    const controller = createEnvController();
    await hydrate();

    // `Infinity !== Infinity` is false, so a shallowEqual over these fields must
    // not report a spurious change on every re-read.
    expect(controller.battery?.chargingTime).toBe(Number.POSITIVE_INFINITY);
    controller.destroy();
  });
});

describe("battery — live updates", () => {
  test("levelchange re-reads the level and emits", async () => {
    const m = new FakeBatteryManager();
    installBattery(m);
    const controller = createEnvController();
    await hydrate();

    const seen: (number | undefined)[] = [];
    controller.on("battery:change", (state) => seen.push(state?.level));

    m.setLevel(0.79);
    expect(controller.battery?.level).toBe(0.79);
    expect(seen).toEqual([0.79]);

    controller.destroy();
  });

  test("follows the level across several drains, as a discharging phone does", async () => {
    const m = new FakeBatteryManager();
    installBattery(m);
    const controller = createEnvController();
    await hydrate();

    for (const level of [0.77, 0.71, 0.63, 0.55, 0.42]) m.setLevel(level);

    expect(controller.battery?.level).toBe(0.42);
    controller.destroy();
  });

  test("chargingchange updates the charging flag and timers together", async () => {
    const m = new FakeBatteryManager();
    installBattery(m);
    const controller = createEnvController();
    await hydrate();

    m.setCharging(true);

    expect(controller.battery?.charging).toBe(true);
    expect(controller.battery?.chargingTime).toBe(600);
    expect(controller.battery?.dischargingTime).toBe(Number.POSITIVE_INFINITY);
    controller.destroy();
  });

  test("emits nothing when an event fires but no field actually moved", async () => {
    const m = new FakeBatteryManager();
    installBattery(m);
    const controller = createEnvController();
    await hydrate();

    let changes = 0;
    controller.on("battery:change", () => {
      changes += 1;
    });

    m.setLevel(0.8); // the value it already had
    m.fire("levelchange"); // a duplicate delivery

    expect(changes).toBe(0);
    controller.destroy();
  });

  test("emits the aggregate `change` alongside `battery:change`", async () => {
    const m = new FakeBatteryManager();
    installBattery(m);
    const controller = createEnvController();
    await hydrate();

    const aggregates: number[] = [];
    controller.on("change", (snapshot) => aggregates.push(snapshot.battery?.level ?? -1));

    m.setLevel(0.5);

    // The plugin listens only to `change`; without this the view would never
    // re-render even though `battery:change` fired.
    expect(aggregates).toEqual([0.5]);
    controller.destroy();
  });
});

describe("battery — refresh()", () => {
  test("re-reads the level, where it previously ignored battery entirely", async () => {
    const m = new FakeBatteryManager();
    installBattery(m);
    const controller = createEnvController();
    await hydrate();

    // A field mutated with no event at all: only a re-read can catch this.
    m.level = 0.31;
    expect(controller.battery?.level).toBe(0.8);

    controller.refresh();
    expect(controller.battery?.level).toBe(0.31);
    controller.destroy();
  });
});

describe("battery — teardown", () => {
  test("detaches its listeners on destroy()", async () => {
    const m = new FakeBatteryManager();
    installBattery(m);
    const controller = createEnvController();
    await hydrate();

    expect(m.listenerCount("levelchange")).toBeGreaterThan(0);

    controller.destroy();
    expect(m.listenerCount("levelchange")).toBe(0);
    expect(m.listenerCount("chargingchange")).toBe(0);
  });

  test("a levelchange after destroy() neither throws nor emits", async () => {
    const m = new FakeBatteryManager();
    installBattery(m);
    const controller: EnvController = createEnvController();
    await hydrate();

    let changes = 0;
    controller.on("change", () => {
      changes += 1;
    });
    const before = controller.battery?.level;

    controller.destroy();
    m.setLevel(0.1);

    expect(controller.battery?.level).toBe(before);
    expect(changes).toBe(0);
  });

  test("destroy() before hydration resolves leaves no listener behind", async () => {
    const m = new FakeBatteryManager();
    installBattery(m);
    const controller = createEnvController();
    controller.destroy();

    await hydrate();

    // The hydration continuation checks the lifecycle before subscribing;
    // without that guard this leaks a listener on a dead controller.
    expect(m.listenerCount("levelchange")).toBe(0);
  });
});

describe("battery — view projection", () => {
  /**
   * Register the plugin AFTER the battery API is in place. The controller
   * hydrates exactly once, in `setup()`, so an API installed later is never
   * seen — the view would stay `null` no matter how many events fired.
   * guardMagic lets the same package re-register, so each test gets a fresh
   * controller and a fresh reactive view.
   */
  function registerPlugin(): void {
    envPlugin()(Alpine as unknown as import("alpinejs").Alpine);
    resume();
  }

  test("a template bound to $env.battery.level re-renders on levelchange", async () => {
    const m = new FakeBatteryManager();
    installBattery(m);
    registerPlugin();

    mount(
      html(`<div x-data>
        <span data-testid="level" x-text="String($env.battery?.level)"></span>
      </div>`)
    );
    await hydrate();

    // Hydration is async, so the first paint can legitimately read "undefined".
    // What matters is that the NEXT value is the new one.
    expect(text("level")).not.toBe("0.66");

    m.setLevel(0.66);
    await settled();

    // This is the exact contract the original bug violated: the page kept
    // showing a stale level while the OS indicator moved.
    expect(text("level")).toBe("0.66");

    m.setLevel(0.42);
    await settled();
    expect(text("level")).toBe("0.42");
  });

  test("a charging change re-renders too", async () => {
    const m = new FakeBatteryManager();
    installBattery(m);
    registerPlugin();

    mount(
      html(`<div x-data>
        <span data-testid="charging" x-text="String($env.battery?.charging)"></span>
      </div>`)
    );
    await hydrate();

    m.setCharging(true);
    await settled();

    expect(text("charging")).toBe("true");
  });

  test("the aggregate view still reads null when the API is absent", async () => {
    installBattery(null);
    registerPlugin();

    mount(
      html(`<div x-data>
        <span data-testid="level" x-text="String($env.battery)"></span>
      </div>`)
    );
    await hydrate();

    expect(text("level")).toBe("null");
  });
});
