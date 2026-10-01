/**
 * No `BaseController`: notification state is the browser's own state, read
 * through a getter on every access. There is nothing to snapshot, so what a
 * controller would hold here is a set of getters — and a factory that returns
 * them is what lets a standalone consumer and the Alpine magic share one
 * implementation instead of two.
 */

import { safeWindow } from "@ailura/alpinejs-core/env";

import {
  getNotifyPermission,
  isNotifySupported,
  requiresServiceWorkerNotifications,
  isServiceWorkerDeliveryRequired,
  isStandaloneDisplayMode,
  isIosDevice,
} from "./internal/support";
import type { NotifyMagic, NotifySendOptions } from "./types";

/** The subset of a service worker registration needed to show a notification. */
interface ServiceWorkerNotificationRegistration {
  showNotification?: (title: string, options?: unknown) => Promise<unknown>;
}

export function createNotifyMagic(): NotifyMagic {
  return {
    get isSupported() {
      return isNotifySupported();
    },
    get requiresHomeScreenInstall() {
      return isNotifySupported() && requiresServiceWorkerNotifications();
    },
    get permission(): NotificationPermission {
      return getNotifyPermission();
    },
    requestPermission(): Promise<NotificationPermission> {
      const win = safeWindow() as
        | (Window & { Notification?: { requestPermission: () => Promise<NotificationPermission> } })
        | undefined;
      if (!win?.Notification) return Promise.resolve("denied" as NotificationPermission);
      try {
        const result = win.Notification.requestPermission();
        return result instanceof Promise
          ? result
          : Promise.resolve(result as NotificationPermission);
      } catch {
        return Promise.resolve("denied" as NotificationPermission);
      }
    },
    send(title: string, options?: NotifySendOptions): Notification | null {
      if (!isNotifySupported()) return null;
      const permission = getNotifyPermission();
      if (permission !== "granted") return null;
      return dispatchNotification(title, options);
    },
    async sendAsync(title: string, options?: NotifySendOptions): Promise<Notification | null> {
      if (!isNotifySupported()) return null;
      let permission = getNotifyPermission();
      if (permission === "default") {
        permission = await this.requestPermission();
      }
      if (permission !== "granted") return null;
      return showNotify(title, options);
    },
    sendIfPermitted(title: string, options?: NotifySendOptions): Notification | null {
      if (!isNotifySupported()) return null;
      if (getNotifyPermission() !== "granted") return null;
      return dispatchNotification(title, options);
    },
    close(tag?: string): void {
      // No-op for simple Notification API; tag-based close would require SW registration
      void tag;
    },
  };
}

function dispatchNotification(title: string, options?: NotifySendOptions): Notification | null {
  const win = safeWindow() as
    | (Window & { Notification?: new (title: string, opts?: NotificationOptions) => Notification })
    | undefined;
  if (!win?.Notification) return null;
  try {
    return new win.Notification(title, options as NotificationOptions);
  } catch {
    // The constructor is illegal on platforms that mandate service-worker
    // delivery. `send()` is synchronous and cannot reach for the registration,
    // so it reports "nothing shown"; `sendAsync()` and the permission adapter
    // use `showNotify()`, which can.
    return null;
  }
}

/**
 * Show a notification through whichever route the platform allows.
 *
 * Three cases, in order:
 *
 *  1. **iOS** refuses the `Notification` constructor outright — "Illegal
 *     constructor. Use ServiceWorkerRegistration.showNotification() instead" —
 *     so the service worker is used directly. Checking this first rather than
 *     by catching keeps the console free of a browser-generated error.
 *  2. **Everywhere else** (Android, desktop) the constructor is the normal
 *     route and returns a real `Notification` object, which is what callers
 *     like the permission adapter report back. Chrome throws from the
 *     constructor whenever the document is not fully active — a background
 *     tab on Android being the common case — so a failure falls back to the
 *     service worker rather than being reported as "nothing shown".
 *  3. No route available: `null`.
 *
 * Never throws. A caller that is in the middle of *granting a permission* must
 * not have that grant turned into a failure by a cosmetic side effect.
 *
 * The return type is a union, deliberately. The service-worker route has to
 * await a registration and therefore hands back a promise, while the
 * constructor route is synchronous and hands back the `Notification` the
 * constructor actually created. Declaring the whole function `Promise`-shaped
 * was the defect: it made the synchronous return a lie and made the
 * no-window early return untypable. Callers `await` the result, which settles
 * both arms, and the notification object still reaches them unchanged.
 */
export function showNotify(
  title: string,
  options: NotifySendOptions = {}
): Notification | null | Promise<Notification | null> {
  const win = safeWindow() as
    | (Window & {
        Notification?: unknown;
        navigator?: {
          serviceWorker?: {
            getRegistration?: () => Promise<ServiceWorkerNotificationRegistration | undefined>;
          };
        };
      })
    | undefined;
  if (!win) return null;

  const viaServiceWorker = async (): Promise<Notification | null> => {
    const registration = await win.navigator?.serviceWorker?.getRegistration?.();
    if (!registration?.showNotification) return null;
    try {
      // Returns void by spec: a service-worker-shown notification has no
      // `Notification` object to hand back.
      await registration.showNotification(title, options);
    } catch {
      return null;
    }
    return null;
  };

  if (isServiceWorkerDeliveryRequired()) return viaServiceWorker();

  const constructed = dispatchNotification(title, options);
  if (constructed) return constructed;

  // The constructor is unavailable or threw. On Android that is usually a
  // backgrounded document rather than a missing capability, so a registered
  // service worker can still deliver.
  return viaServiceWorker();
}

export {
  isNotifySupported,
  getNotifyPermission,
  isStandaloneDisplayMode,
  requiresServiceWorkerNotifications,
  isServiceWorkerDeliveryRequired,
  isIosDevice,
};
