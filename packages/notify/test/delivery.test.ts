// @vitest-environment happy-dom
/**
 * Notification delivery: which route the platform allows.
 *
 * The regression: `createNotifyPermissionAdapter().request()` constructed a
 * `Notification` unguarded to confirm a grant. On iOS the constructor is
 * illegal outright — "Failed to construct 'Notification': Illegal constructor.
 * Use ServiceWorkerRegistration.showNotification() instead" — so it threw, the
 * adapter's promise rejected, and the registry recorded a **denial** for a
 * permission the user had actually granted. The best-effort confirmation is the
 * fix, and the route selection below is what makes it not throw at all.
 *
 * The two platforms are asserted separately on purpose, because the correct
 * route differs and getting it backwards is its own bug: iOS must go straight
 * to the service worker (never touching the constructor, so the console stays
 * clean), while Android and desktop must keep using the constructor — it is the
 * only route that returns a real `Notification` object — and fall back to the
 * service worker only when the constructor fails.
 */

import { afterEach, beforeEach, describe, expect, test } from "vite-plus/test";

import { showNotify } from "../src/controller";
import { isServiceWorkerDeliveryRequired } from "../src/internal/support";
import { createNotifyPermissionAdapter } from "../src/permission-adapter";

const IOS_UA =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 " +
  "(KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";
const ANDROID_UA =
  "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) " +
  "Chrome/120.0.0.0 Mobile Safari/537.36";

interface DeliveryRecord {
  /** Titles the service worker was asked to show. */
  viaServiceWorker: string[];
  /** How many times the constructor was invoked. */
  constructorCalls: number;
}

let delivery: DeliveryRecord;
let notificationConstructorThrows: boolean;
let serviceWorkerRegistration: unknown;
let originalNotification: PropertyDescriptor | undefined;
let originalGetRegistration: PropertyDescriptor | undefined;
let originalUA: PropertyDescriptor | undefined;
let originalMatchMedia: PropertyDescriptor | undefined;

function setUserAgent(ua: string): void {
  Object.defineProperty(window.navigator, "userAgent", { configurable: true, value: ua });
}

/**
 * Install a `Notification` that records construction. When
 * `notificationConstructorThrows` is set it reproduces the platform refusal —
 * which is what Chrome does for a document that is not fully active, and what
 * Safari does on every iOS page.
 */
function installNotification(permission: NotificationPermission = "granted"): void {
  class FakeNotification {
    static permission = permission;
    /** The permission adapter prompts through this, so it has to exist. */
    static requestPermission = (): Promise<NotificationPermission> => Promise.resolve(permission);
    constructor(
      public title: string,
      public options?: unknown
    ) {
      delivery.constructorCalls += 1;
      if (notificationConstructorThrows) {
        throw new TypeError(
          "Failed to construct 'Notification': Illegal constructor. " +
            "Use ServiceWorkerRegistration.showNotification() instead."
        );
      }
    }
  }
  Object.defineProperty(globalThis, "Notification", {
    configurable: true,
    writable: true,
    value: FakeNotification,
  });
}

function installServiceWorker(present: boolean): void {
  Object.defineProperty(window.navigator, "serviceWorker", {
    configurable: true,
    value: present
      ? {
          getRegistration: () =>
            Promise.resolve(
              serviceWorkerRegistration === undefined
                ? {
                    showNotification: (title: string) => {
                      delivery.viaServiceWorker.push(title);
                      return Promise.resolve();
                    },
                  }
                : serviceWorkerRegistration
            ),
        }
      : undefined,
  });
}

beforeEach(() => {
  delivery = { viaServiceWorker: [], constructorCalls: 0 };
  notificationConstructorThrows = false;
  serviceWorkerRegistration = undefined;
  originalNotification = Object.getOwnPropertyDescriptor(globalThis, "Notification");
  originalGetRegistration = Object.getOwnPropertyDescriptor(window.navigator, "serviceWorker");
  originalUA = Object.getOwnPropertyDescriptor(window.navigator, "userAgent");
  originalMatchMedia = Object.getOwnPropertyDescriptor(window, "matchMedia");
  Object.defineProperty(window, "isSecureContext", { configurable: true, value: true });
  // An iPhone that is installed: the permission is obtainable, but delivery
  // still cannot use the constructor.
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    writable: true,
    value: (query: string) => ({ matches: query.includes("standalone") }),
  });
});

afterEach(() => {
  const restore = (
    key: string,
    descriptor: PropertyDescriptor | undefined,
    target: object
  ): void => {
    Reflect.deleteProperty(target, key);
    if (descriptor) Object.defineProperty(target, key, descriptor);
  };
  restore("Notification", originalNotification, globalThis);
  restore("serviceWorker", originalGetRegistration, window.navigator);
  restore("userAgent", originalUA, window.navigator);
  restore("matchMedia", originalMatchMedia, window);
});

describe("isServiceWorkerDeliveryRequired", () => {
  test("is true on iOS, installed or not", () => {
    setUserAgent(IOS_UA);
    expect(isServiceWorkerDeliveryRequired()).toBe(true);
  });

  test("is false on Android, where the constructor is the normal route", () => {
    setUserAgent(ANDROID_UA);
    expect(isServiceWorkerDeliveryRequired()).toBe(false);
  });
});

describe("showNotify — iOS", () => {
  beforeEach(() => {
    setUserAgent(IOS_UA);
    installNotification();
    installServiceWorker(true);
  });

  test("routes through the service worker", async () => {
    await showNotify("Hola", { body: "desde iOS" });
    expect(delivery.viaServiceWorker).toEqual(["Hola"]);
  });

  test("never touches the constructor, so no browser error is logged", async () => {
    // The platform refusal is a console error the browser emits itself. Trying
    // the constructor first would print "Illegal constructor" on every send.
    await showNotify("Hola");
    expect(delivery.constructorCalls).toBe(0);
  });

  test("returns null, because a service-worker notification has no object", async () => {
    await expect(showNotify("Hola")).resolves.toBeNull();
  });

  test("returns null instead of throwing when there is no registration", async () => {
    installServiceWorker(false);
    await expect(showNotify("Hola")).resolves.toBeNull();
  });
});

describe("showNotify — Android", () => {
  beforeEach(() => {
    setUserAgent(ANDROID_UA);
    installNotification();
    installServiceWorker(true);
  });

  test("uses the constructor and returns a real Notification", async () => {
    const result = await showNotify("Hola", { body: "desde Android" });
    expect(result).toBeInstanceOf(Notification);
    expect(result?.title).toBe("Hola");
    expect(delivery.constructorCalls).toBe(1);
    expect(delivery.viaServiceWorker).toEqual([]);
  });

  test("falls back to the service worker when the constructor is refused", async () => {
    // Chrome throws from the constructor whenever the document is not fully
    // active — a backgrounded tab on Android being the usual cause. That must
    // not read as "nothing was shown".
    notificationConstructorThrows = true;
    await showNotify("Hola");
    expect(delivery.viaServiceWorker).toEqual(["Hola"]);
  });

  test("returns null when both routes are unavailable", async () => {
    notificationConstructorThrows = true;
    installServiceWorker(false);
    await expect(showNotify("Hola")).resolves.toBeNull();
  });
});

describe("permission adapter — a granted permission is never downgraded", () => {
  test("a confirmation the platform refuses does not become a denial", async () => {
    setUserAgent(IOS_UA);
    installNotification("granted");
    installServiceWorker(true);

    const result = await createNotifyPermissionAdapter().request();

    // The whole point: iOS refuses the constructor, and the grant survives.
    expect(result.permission).toBe("granted");
    expect(result.error).toBeUndefined();
    expect(delivery.constructorCalls).toBe(0);
  });

  test("reports the Notification object when the constructor worked", async () => {
    setUserAgent(ANDROID_UA);
    installNotification("granted");
    installServiceWorker(true);

    const result = await createNotifyPermissionAdapter().request();

    expect(result.permission).toBe("granted");
    expect(result.result).toBeInstanceOf(Notification);
    expect(result.result?.title).toBe("Alpine.js Toolkit");
  });

  test("still denies, with a reason, when the browser denies", async () => {
    setUserAgent(IOS_UA);
    installNotification("denied");
    installServiceWorker(true);

    const result = await createNotifyPermissionAdapter().request();

    expect(result.permission).toBe("denied");
    expect(result.error).toBeInstanceOf(Error);
  });
});
