// @vitest-environment happy-dom
/**
 * Host-owned teardown for the service worker the notify plugin registers.
 *
 * The resource under test is the registration itself: the stub hands out a
 * fake `ServiceWorkerRegistration` carrying an `unregister()` spy, so the test
 * observes the real release rather than a flag. `getRegistrations()` is a spy
 * that would expose a blanket "unregister everything" sweep, which must never
 * happen — a service worker normally belongs to the host application.
 */
import { afterEach, beforeEach, describe, expect, test } from "vite-plus/test";

import { notifyPlugin } from "../src/plugin";
import type { NotifyMagicWithTeardown } from "../src/types";

const SW_URL = "/sw.js";

interface FakeRegistration {
  unregisterCalls: number;
  unregister(): Promise<boolean>;
}

function createRegistration(): FakeRegistration {
  return {
    unregisterCalls: 0,
    unregister(): Promise<boolean> {
      this.unregisterCalls += 1;
      return Promise.resolve(true);
    },
  };
}

let registration: FakeRegistration;
/** Ids the stub has been asked to `register()`. */
let registerCalls: string[] = [];
/** Ids handed back by `getRegistrations()` — must never be swept. */
let getRegistrationsCalls = 0;
/** When set, `register()` hands out this promise instead of resolving at once. */
let held: { promise: Promise<FakeRegistration>; settle(reg: FakeRegistration): void } | null = null;

/** Make the next `register()` calls stay pending until {@link settleHeld}. */
function holdRegistration(): () => void {
  let settle: (reg: FakeRegistration) => void = () => {};
  const promise = new Promise<FakeRegistration>((resolve) => {
    settle = resolve;
  });
  held = {
    promise,
    settle: (reg) => {
      held = null;
      settle(reg);
    },
  };
  return () => settle(registration);
}

function installServiceWorkerStub(): void {
  (navigator as unknown as { serviceWorker?: unknown }).serviceWorker = {
    register(_url: string): Promise<FakeRegistration> {
      registerCalls.push(_url);
      return held ? held.promise : Promise.resolve(registration);
    },
    getRegistrations(): Promise<FakeRegistration[]> {
      getRegistrationsCalls += 1;
      return Promise.resolve([registration]);
    },
  };
}

function createMockAlpine() {
  const magics = new Map<string, unknown>();
  const alpine = {
    store: () => undefined,
    magic(name: string, callback: unknown) {
      magics.set(name, callback);
    },
  } as unknown as import("alpinejs").Alpine;
  return { alpine, magics };
}

/** Run the plugin and read back the facade it registered as `$notify`. */
function mountPlugin(): NotifyMagicWithTeardown {
  const { alpine, magics } = createMockAlpine();
  notifyPlugin({ serviceWorkerUrl: SW_URL })(alpine);
  const factory = magics.get("notify") as () => NotifyMagicWithTeardown;
  return factory();
}

/** Let every already-resolved microtask (and its `.then` chain) run. */
async function flush(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
}

beforeEach(() => {
  registration = createRegistration();
  registerCalls = [];
  getRegistrationsCalls = 0;
  held = null;
  installServiceWorkerStub();
});

afterEach(() => {
  (navigator as unknown as { serviceWorker?: unknown }).serviceWorker = undefined;
});

describe("notify service worker teardown", () => {
  // RED-first: pre-fix the registration promise was discarded, the `$notify`
  // facade had no `destroy` member, and nothing could ever unregister.
  test("destroy() unregisters the registration the plugin created", async () => {
    const notify = mountPlugin();
    await flush();

    expect(registerCalls).toEqual([SW_URL]);
    expect(registration.unregisterCalls).toBe(0);

    // pre-fix: TypeError, `destroy` is not a function
    notify.destroy();
    await flush();

    expect(registration.unregisterCalls).toBe(1);
  });

  // RED-first: the race. The registration is deliberately not awaited, so
  // `destroy()` can run first; the unregister must still happen once the
  // promise settles.
  test("destroy() before the registration resolves still unregisters", async () => {
    const settle = holdRegistration();
    const notify = mountPlugin();
    await flush();

    expect(registerCalls).toEqual([SW_URL]);
    // The registration is still in flight: nothing to unregister yet.
    expect(registration.unregisterCalls).toBe(0);

    // pre-fix: TypeError, `destroy` is not a function
    notify.destroy();
    await flush();
    expect(registration.unregisterCalls).toBe(0);

    settle();
    await flush();

    expect(registration.unregisterCalls).toBe(1);
  });

  // Guard: the release is scoped to the registration this plugin created. A
  // blanket sweep would touch the host application's own service workers.
  test("never sweeps unrelated service worker registrations", async () => {
    const notify = mountPlugin();
    await flush();

    notify.destroy();
    await flush();

    expect(getRegistrationsCalls).toBe(0);
  });

  // Guard: a second `destroy()` is a no-op — the registration is dropped on the
  // first call, so the registration is not unregistered twice.
  test("a second destroy() is a no-op rather than a throw", async () => {
    const notify = mountPlugin();
    await flush();

    notify.destroy();
    // pre-fix: TypeError, `destroy` is not a function
    notify.destroy();
    await flush();

    expect(registration.unregisterCalls).toBe(1);
  });

  // Guard: a failed registration is swallowed exactly as before, and
  // `destroy()` has nothing to release.
  test("a rejected registration does not break destroy()", async () => {
    (
      navigator as unknown as {
        serviceWorker: {
          register(): Promise<never>;
          getRegistrations(): Promise<never[]>;
        };
      }
    ).serviceWorker = {
      register: () => Promise.reject(new Error("no worker here")),
      getRegistrations: () => Promise.resolve([]),
    };
    const notify = mountPlugin();
    await flush();

    notify.destroy();
    await flush();

    expect(getRegistrationsCalls).toBe(0);
  });
});
