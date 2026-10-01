import type { PermissionAdapter } from "@ailura/alpinejs-permissions";
// @vitest-environment happy-dom
/**
 * The notification permission adapter, with the iOS case the playground got
 * wrong.
 *
 * The regression this file exists for: the hand-written adapter that used to
 * live in the demo checked only `"Notification" in window`, so on an iPhone it
 * reported `availability: "available"` and `canRequest: true`, inviting a click
 * that iOS can only ever answer with `"denied"` — and then rendered a generic
 * "adjust your browser or OS settings" message pointing at the wrong fix, while
 * the `notify` section of the same playground showed the correct advice.
 */
import { afterEach, beforeEach, describe, expect, test } from "vite-plus/test";

import { createNotifyPermissionAdapter } from "../src/permission-adapter";

/** A UA that `isIosDevice()` recognizes as an iPhone. */
const IOS_UA =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 " +
  "(KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";

/** A UA that is plainly not an iPhone. */
const DESKTOP_UA =
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) " +
  "Chrome/120.0.0.0 Safari/537.36";

/** A stand-in `Notification` whose `requestPermission` the test drives. */
interface NotificationStub {
  requestResult: NotificationPermission;
  calls: number;
  /** Rejected `requestPermission` should surface as an error, not a crash. */
  throws: boolean;
}

let notification: NotificationStub | null;
let originalDescriptor: PropertyDescriptor | undefined;

function installNotification(stub: NotificationStub | null): void {
  notification = stub;
  originalDescriptor = Object.getOwnPropertyDescriptor(globalThis, "Notification");
  Object.defineProperty(globalThis, "Notification", {
    configurable: true,
    writable: true,
    value:
      stub === null
        ? undefined
        : {
            permission: "default",
            requestPermission: () => {
              if (!notification) throw new Error("unreachable");
              notification.calls += 1;
              if (notification.throws) throw new Error("browsers said no");
              return Promise.resolve(notification.requestResult);
            },
          },
  });
}

function setUserAgent(ua: string): void {
  Object.defineProperty(window.navigator, "userAgent", { configurable: true, value: ua });
}

function setSecureContext(value: boolean): void {
  Object.defineProperty(window, "isSecureContext", { configurable: true, value });
}

function setStandalone(value: boolean): void {
  const spy = (query: string): { matches: boolean } => ({
    matches: query.includes("standalone") ? value : false,
  });
  Object.defineProperty(window, "matchMedia", { configurable: true, writable: true, value: spy });
  Object.defineProperty(window.navigator, "standalone", { configurable: true, value });
}

beforeEach(() => {
  setUserAgent(DESKTOP_UA);
  setSecureContext(true);
  setStandalone(true);
});

afterEach(() => {
  if (originalDescriptor) {
    Object.defineProperty(globalThis, "Notification", originalDescriptor);
  } else {
    Reflect.deleteProperty(globalThis, "Notification");
  }
  notification = null;
});

describe("createNotifyPermissionAdapter — conformance", () => {
  test("is assignable to the registry's PermissionAdapter", () => {
    // The load-bearing assertion of the whole arrangement: `notify` declares
    // this shape structurally instead of importing it, so nothing but this
    // line stops the two sides from drifting apart.
    const adapter: PermissionAdapter<"notifications", Notification> =
      createNotifyPermissionAdapter();
    expect(adapter.name).toBe("notifications");
    expect(adapter.requiresUserGesture).toBe(true);
  });
});

describe("createNotifyPermissionAdapter — availability", () => {
  test("reports 'unsupported' when the Notification API is absent", () => {
    installNotification(null);
    const adapter = createNotifyPermissionAdapter();
    expect(adapter.isSupported()).toBe(false);
    expect(adapter.getAvailability()).toBe("unsupported");
  });

  test("reports 'insecure-context' on plain HTTP", () => {
    installNotification({ requestResult: "default", calls: 0, throws: false });
    setSecureContext(false);
    const adapter = createNotifyPermissionAdapter();
    expect(adapter.getAvailability()).toBe("insecure-context");
  });

  test("reports 'platform-restricted' on an iPhone that is not installed", () => {
    // The exact bug: the API exists and the context is secure, yet iOS will
    // never grant. Reporting "available" here is what sent the user chasing
    // browser settings that had nothing to do with it.
    installNotification({ requestResult: "denied", calls: 0, throws: false });
    setUserAgent(IOS_UA);
    setStandalone(false);

    const adapter = createNotifyPermissionAdapter();
    expect(adapter.isSupported()).toBe(true);
    expect(adapter.getAvailability()).toBe("platform-restricted");
  });

  test("reports 'available' on an installed iPhone", () => {
    installNotification({ requestResult: "granted", calls: 0, throws: false });
    setUserAgent(IOS_UA);
    setStandalone(true);
    expect(createNotifyPermissionAdapter().getAvailability()).toBe("available");
  });

  test("reports 'available' on a desktop browser", () => {
    installNotification({ requestResult: "granted", calls: 0, throws: false });
    setUserAgent(DESKTOP_UA);
    setStandalone(false);
    expect(createNotifyPermissionAdapter().getAvailability()).toBe("available");
  });
});

describe("createNotifyPermissionAdapter — request", () => {
  test("does not prompt at all when the platform restricts the grant", async () => {
    // Not merely denied — never even asked, because the answer cannot differ.
    const stub: NotificationStub = { requestResult: "denied", calls: 0, throws: false };
    installNotification(stub);
    setUserAgent(IOS_UA);
    setStandalone(false);

    const result = await createNotifyPermissionAdapter().request();

    expect(stub.calls).toBe(0);
    expect(result.permission).toBe("denied");
    expect(result.error?.message).toMatch(/Home Screen/i);
  });

  test("explains an insecure context instead of a bare denial", async () => {
    installNotification({ requestResult: "default", calls: 0, throws: false });
    setSecureContext(false);

    const result = await createNotifyPermissionAdapter().request();

    expect(result.permission).toBe("denied");
    expect(result.error?.message).toMatch(/secure context/i);
  });

  test("surfaces a browser-thrown requestPermission as an error", async () => {
    const stub: NotificationStub = { requestResult: "default", calls: 0, throws: true };
    installNotification(stub);

    const result = await createNotifyPermissionAdapter().request();

    expect(result.permission).toBe("denied");
    expect(result.error?.message).toBe("browsers said no");
  });

  test("falls back to an explicit 'no reason given' error, never a silent denial", async () => {
    // Availability is genuinely "available" here, so the browser denied for a
    // reason it did not disclose. The adapter says exactly that instead of
    // leaving the user with a bare "denied" and no next step.
    const stub: NotificationStub = { requestResult: "denied", calls: 0, throws: false };
    installNotification(stub);

    const result = await createNotifyPermissionAdapter().request();

    expect(stub.calls).toBe(1);
    expect(result.permission).toBe("denied");
    expect(result.error?.message).toMatch(/without giving a reason/i);
  });
});

describe("createNotifyPermissionAdapter — query", () => {
  test("reports the browser's own permission state", async () => {
    installNotification({ requestResult: "default", calls: 0, throws: false });
    await expect(createNotifyPermissionAdapter().query()).resolves.toBe("default");
  });

  test("reports 'denied' when the API is absent", async () => {
    installNotification(null);
    await expect(createNotifyPermissionAdapter().query()).resolves.toBe("denied");
  });
});
