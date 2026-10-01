import type { PermissionAdapter } from "@ailura/alpinejs-permissions";
// @vitest-environment happy-dom
/**
 * The screen wake lock permission adapter.
 *
 * The wake lock is the odd one out: no prompt, no stored grant. `query()`
 * reporting `"granted"` whenever the API exists is deliberate — claiming
 * otherwise would leave the registry permanently red for a capability that is
 * in fact available — and this file pins that decision so it cannot be
 * "fixed" into a lie later.
 */
import { afterEach, beforeEach, describe, expect, test } from "vite-plus/test";

import { createWakeLockPermissionAdapter } from "../src/permission-adapter";

interface WakeLockStub {
  request(type: string): Promise<unknown>;
  calls: string[];
  /** Rejected requests should surface as an error, not a crash. */
  throws: boolean;
}

let stub: WakeLockStub | null;
let originalDescriptor: PropertyDescriptor | undefined;

function installWakeLock(value: WakeLockStub | null): void {
  stub = value;
  // The support probe is `"wakeLock" in navigator`, so an own property set to
  // `undefined` would still read as supported. Absence has to be real.
  Reflect.deleteProperty(window.navigator, "wakeLock");
  if (value === null) return;
  Object.defineProperty(window.navigator, "wakeLock", {
    configurable: true,
    value: {
      request: (type: string): Promise<unknown> => {
        if (!stub) throw new Error("unreachable");
        stub.calls.push(type);
        if (stub.throws) return Promise.reject(new Error("document was hidden"));
        return Promise.resolve({ type, released: false });
      },
    },
  });
}

function setSecureContext(value: boolean): void {
  Object.defineProperty(window, "isSecureContext", { configurable: true, value });
}

beforeEach(() => {
  setSecureContext(true);
  originalDescriptor = Object.getOwnPropertyDescriptor(window.navigator, "wakeLock");
});

afterEach(() => {
  Reflect.deleteProperty(window.navigator, "wakeLock");
  if (originalDescriptor) {
    Object.defineProperty(window.navigator, "wakeLock", originalDescriptor);
  }
  stub = null;
});

describe("createWakeLockPermissionAdapter — conformance", () => {
  test("is assignable to the registry's PermissionAdapter", () => {
    const adapter: PermissionAdapter<"screen-wake-lock"> = createWakeLockPermissionAdapter();
    expect(adapter.name).toBe("screen-wake-lock");
    expect(adapter.requiresUserGesture).toBe(true);
  });
});

describe("createWakeLockPermissionAdapter — availability", () => {
  test("reports 'unsupported' when the API is absent", () => {
    installWakeLock(null);
    const adapter = createWakeLockPermissionAdapter();
    expect(adapter.isSupported()).toBe(false);
    expect(adapter.getAvailability()).toBe("unsupported");
  });

  test("reports 'available' in a secure context", () => {
    installWakeLock({ calls: [], throws: false, request: () => Promise.resolve({}) });
    expect(createWakeLockPermissionAdapter().getAvailability()).toBe("available");
  });

  test("reports 'insecure-context' on plain HTTP", () => {
    installWakeLock({ calls: [], throws: false, request: () => Promise.resolve({}) });
    setSecureContext(false);
    expect(createWakeLockPermissionAdapter().getAvailability()).toBe("insecure-context");
  });
});

describe("createWakeLockPermissionAdapter — query", () => {
  test("reports 'granted' when the API exists — there is no prompt to make", async () => {
    installWakeLock({ calls: [], throws: false, request: () => Promise.resolve({}) });
    await expect(createWakeLockPermissionAdapter().query()).resolves.toBe("granted");
  });

  test("reports 'denied' when the API is absent", async () => {
    installWakeLock(null);
    await expect(createWakeLockPermissionAdapter().query()).resolves.toBe("denied");
  });
});

describe("createWakeLockPermissionAdapter — request", () => {
  test("requests a screen lock and returns the sentinel", async () => {
    const w: WakeLockStub = { calls: [], throws: false, request: () => Promise.resolve({}) };
    installWakeLock({
      calls: w.calls,
      throws: w.throws,
      request: (type: string) => w.request(type),
    });

    const result = await createWakeLockPermissionAdapter().request();

    expect(w.calls).toEqual(["screen"]);
    expect(result.permission).toBe("granted");
    expect(result.result).toEqual({ type: "screen", released: false });
  });

  test("does not call the API when unsupported, and explains why", async () => {
    const w: WakeLockStub = { calls: [], throws: false, request: () => Promise.resolve({}) };
    installWakeLock(null);

    const result = await createWakeLockPermissionAdapter().request();

    expect(w.calls).toEqual([]);
    expect(result.permission).toBe("denied");
    expect(result.error?.message).toMatch(/not available/i);
  });

  test("surfaces a rejected request as an error", async () => {
    installWakeLock({
      calls: [],
      throws: true,
      request: () => Promise.reject(new Error("document was hidden")),
    });

    const result = await createWakeLockPermissionAdapter().request();

    expect(result.permission).toBe("denied");
    expect(result.error?.message).toBe("document was hidden");
  });
});
