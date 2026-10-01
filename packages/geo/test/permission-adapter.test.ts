import type { PermissionAdapter } from "@ailura/alpinejs-permissions";
// @vitest-environment happy-dom
/**
 * The geolocation permission adapter.
 *
 * Two things are worth pinning here. First, the conformance check: `geo`
 * declares the registry contract structurally instead of importing it, so this
 * file is the only thing stopping the two sides from drifting. Second, the
 * refusal detail — a flattened `"denied"` loses the browser's error code, and
 * `PERMISSION_DENIED` (1) and `POSITION_UNAVAILABLE` (2) call for completely
 * different advice.
 */
import { afterEach, beforeEach, describe, expect, test } from "vite-plus/test";

import { createGeolocationPermissionAdapter } from "../src/permission-adapter";

interface GeolocationStub {
  /** The `PositionOptions` the adapter passed, or `undefined` if it never called. */
  calls: PositionOptions | undefined;
  /** What the stub hands back: a position, or a coded failure. */
  outcome:
    | { kind: "position"; coords: { latitude: number; longitude: number } }
    | { kind: "error"; code: number; message: string };
}

let stub: GeolocationStub | null;
let originalDescriptor: PropertyDescriptor | undefined;

function installGeolocation(value: GeolocationStub | null): void {
  stub = value;
  // The support probe is `"geolocation" in navigator`, so an own property set
  // to `undefined` would still read as supported. Absence has to be real.
  Reflect.deleteProperty(window.navigator, "geolocation");
  if (value === null) return;
  Object.defineProperty(window.navigator, "geolocation", {
    configurable: true,
    value: {
      getCurrentPosition: (
        success: (position: GeolocationPosition) => void,
        error?: (e: GeolocationPositionError) => void,
        options?: PositionOptions
      ): void => {
        if (!stub) throw new Error("unreachable");
        stub.calls = options;
        if (stub.outcome.kind === "position") {
          success({ coords: stub.outcome.coords } as GeolocationPosition);
        } else {
          error?.({
            code: stub.outcome.code,
            message: stub.outcome.message,
          } as GeolocationPositionError);
        }
      },
    },
  });
}

function setSecureContext(value: boolean): void {
  Object.defineProperty(window, "isSecureContext", { configurable: true, value });
}

/**
 * happy-dom ships both `geolocation` and `permissions` on `Navigator.prototype`,
 * so deleting an own property cannot make a `in navigator` probe go false.
 * Absence has to be simulated one level up. Returns a restore function.
 */
function removePrototypeProp(name: string): () => void {
  const proto = Object.getPrototypeOf(window.navigator) as object;
  const original = Object.getOwnPropertyDescriptor(proto, name);
  if (original) Reflect.deleteProperty(proto, name);
  return () => {
    if (original) Object.defineProperty(proto, name, original);
  };
}

const removePrototypeGeolocation = (): (() => void) => removePrototypeProp("geolocation");
const removePrototypePermissions = (): (() => void) => removePrototypeProp("permissions");

/** Run `fn` with `navigator.permissions` genuinely absent. */
function withoutPermissions<T>(fn: () => Promise<T>): Promise<T> {
  const restore = removePrototypePermissions();
  Reflect.deleteProperty(window.navigator, "permissions");
  return fn().finally(restore);
}

beforeEach(() => {
  setSecureContext(true);
  originalDescriptor = Object.getOwnPropertyDescriptor(window.navigator, "geolocation");
});

afterEach(() => {
  Reflect.deleteProperty(window.navigator, "geolocation");
  if (originalDescriptor) {
    Object.defineProperty(window.navigator, "geolocation", originalDescriptor);
  }
  stub = null;
});

describe("createGeolocationPermissionAdapter — conformance", () => {
  test("is assignable to the registry's PermissionAdapter", () => {
    const adapter: PermissionAdapter<"geolocation", GeolocationPosition> =
      createGeolocationPermissionAdapter();
    expect(adapter.name).toBe("geolocation");
    expect(adapter.requiresUserGesture).toBe(true);
  });
});

describe("createGeolocationPermissionAdapter — availability", () => {
  test("reports 'unsupported' when the API is absent", () => {
    const restore = removePrototypeGeolocation();
    try {
      installGeolocation(null);
      const adapter = createGeolocationPermissionAdapter();
      expect(adapter.isSupported()).toBe(false);
      expect(adapter.getAvailability()).toBe("unsupported");
    } finally {
      restore();
    }
  });

  test("reports 'insecure-context' on plain HTTP", () => {
    installGeolocation({
      calls: undefined,
      outcome: { kind: "position", coords: { latitude: 0, longitude: 0 } },
    });
    setSecureContext(false);
    expect(createGeolocationPermissionAdapter().getAvailability()).toBe("insecure-context");
  });

  test("reports 'available' in a secure context", () => {
    installGeolocation({
      calls: undefined,
      outcome: { kind: "position", coords: { latitude: 0, longitude: 0 } },
    });
    expect(createGeolocationPermissionAdapter().getAvailability()).toBe("available");
  });
});

describe("createGeolocationPermissionAdapter — request", () => {
  test("does not call the API on plain HTTP, and explains why", async () => {
    const g: GeolocationStub = {
      calls: undefined,
      outcome: { kind: "position", coords: { latitude: 1, longitude: 2 } },
    };
    installGeolocation(g);
    setSecureContext(false);

    const result = await createGeolocationPermissionAdapter().request();

    expect(g.calls).toBeUndefined();
    expect(result.permission).toBe("denied");
    expect(result.error?.message).toMatch(/secure context/i);
  });

  test("returns the position on success", async () => {
    installGeolocation({
      calls: undefined,
      outcome: { kind: "position", coords: { latitude: 41.4, longitude: 2.17 } },
    });

    const result = await createGeolocationPermissionAdapter().request();

    expect(result.permission).toBe("granted");
    expect(result.result?.coords.latitude).toBe(41.4);
  });

  test("keeps the browser's error code in the message", async () => {
    installGeolocation({
      calls: undefined,
      outcome: { kind: "error", code: 1, message: "User denied Geolocation" },
    });

    const result = await createGeolocationPermissionAdapter().request();

    expect(result.permission).toBe("denied");
    expect(result.error?.message).toContain("code 1");
    expect(result.error?.message).toContain("User denied Geolocation");
  });

  test("forwards caller options over the default timeout", async () => {
    const g: GeolocationStub = {
      calls: undefined,
      outcome: { kind: "position", coords: { latitude: 0, longitude: 0 } },
    };
    installGeolocation(g);

    await createGeolocationPermissionAdapter().request({
      timeout: 2_000,
      enableHighAccuracy: true,
    });

    expect(g.calls?.timeout).toBe(2_000);
    expect(g.calls?.enableHighAccuracy).toBe(true);
  });
});

describe("createGeolocationPermissionAdapter — query", () => {
  test("falls back to 'prompt' when the Permissions API is unavailable", async () => {
    installGeolocation({
      calls: undefined,
      outcome: { kind: "position", coords: { latitude: 0, longitude: 0 } },
    });
    // A capability nobody has asked about is honestly "prompt", not "denied".
    await withoutPermissions(() =>
      expect(createGeolocationPermissionAdapter().query()).resolves.toBe("prompt")
    );
  });

  test("relays the Permissions API state when it answers", async () => {
    installGeolocation({
      calls: undefined,
      outcome: { kind: "position", coords: { latitude: 0, longitude: 0 } },
    });
    const original = Object.getOwnPropertyDescriptor(window.navigator, "permissions");
    Object.defineProperty(window.navigator, "permissions", {
      configurable: true,
      value: { query: () => Promise.resolve({ state: "denied" }) },
    });
    try {
      await expect(createGeolocationPermissionAdapter().query()).resolves.toBe("denied");
    } finally {
      if (original) Object.defineProperty(window.navigator, "permissions", original);
    }
  });

  test("reports 'denied' when the API is absent", async () => {
    const restore = removePrototypeGeolocation();
    try {
      installGeolocation(null);
      await expect(createGeolocationPermissionAdapter().query()).resolves.toBe("denied");
    } finally {
      restore();
    }
  });
});
