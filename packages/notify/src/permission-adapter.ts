/**
 * The whole point of this file is that a refusal must be explained. Reporting a
 * bare `"denied"` for an iPhone in Safari is technically true and completely
 * useless: the user goes to a settings screen that has nothing to offer, when
 * the actual fix is "add this site to the Home Screen". So the adapter
 * distinguishes the cases the browser refuses to distinguish for us.
 */

import { safeWindow } from "@ailura/alpinejs-core/env";

import { showNotify } from "./controller";
import {
  getNotifyPermission,
  isNotifySupported,
  requiresServiceWorkerNotifications,
} from "./internal/support";

// Declared here rather than imported so `notify` keeps zero dependency on
// `@ailura/alpinejs-permissions`: this package must remain usable by an
// application that never opens a permission registry. The conformance test
// pins this shape to the registry's own `PermissionAdapter`.

export type NotifyPermissionState = "granted" | "prompt" | "denied" | "unknown";

export type NotifyPermissionAvailability =
  | "available"
  | "unsupported"
  | "insecure-context"
  | "policy-blocked"
  | "platform-restricted";

export interface NotifyPermissionRequestResult<TResult = unknown> {
  readonly permission: NotifyPermissionState;
  readonly result?: TResult;
  readonly error?: Error;
}

export interface NotifyPermissionAdapter<TName extends string = string, TResult = unknown> {
  readonly name: TName;
  readonly requiresUserGesture?: boolean;
  isSupported(): boolean;
  getAvailability(): NotifyPermissionAvailability;
  query(): Promise<NotifyPermissionState>;
  request(options?: never): Promise<NotifyPermissionRequestResult<TResult>>;
}

/** Permission name this adapter registers under. */
export const NOTIFY_PERMISSION_NAME = "notifications" as const;

/**
 * Why a refusal happened, in terms a user can act on.
 *
 * Surfaced as the adapter's `error` so a host UI can render the actual remedy
 * instead of guessing from the `"denied"` state alone.
 */
const ERR_IOS_REQUIRES_INSTALL =
  "iOS only grants notification permission to web apps added to the Home Screen. " +
  "Add this site to the Home Screen and reopen it from there, then request again.";
const ERR_INSECURE_CONTEXT =
  "Notifications require a secure context. Serve this page over HTTPS (or localhost).";
const ERR_UNAVAILABLE = "The Notification API is not available in this browser.";

function isSecureContext(): boolean {
  const win = safeWindow() as (Window & { isSecureContext?: boolean }) | undefined;
  if (!win) return false;
  // Browsers without the property predate the secure-context spec, so absence
  // means "assume secure" rather than "assume insecure".
  return win.isSecureContext ?? true;
}

export function createNotifyPermissionAdapter(): NotifyPermissionAdapter<
  typeof NOTIFY_PERMISSION_NAME,
  Notification
> {
  const getAvailability = (): NotifyPermissionAvailability => {
    if (!isNotifySupported()) return "unsupported";
    if (!isSecureContext()) return "insecure-context";
    // The API is present and the context is secure, but iOS still refuses to
    // grant anything outside a Home Screen install. Reporting "available" here
    // is what made the playground invite a click that could only ever end in
    // "denied".
    if (requiresServiceWorkerNotifications()) return "platform-restricted";
    return "available";
  };

  return {
    name: NOTIFY_PERMISSION_NAME,
    requiresUserGesture: true,

    isSupported(): boolean {
      return isNotifySupported();
    },

    getAvailability,

    query(): Promise<NotifyPermissionState> {
      if (!isNotifySupported()) return Promise.resolve("denied");
      return Promise.resolve(getNotifyPermission() as NotifyPermissionState);
    },

    async request(): Promise<NotifyPermissionRequestResult<Notification>> {
      const availability = getAvailability();
      if (availability !== "available") {
        return { permission: "denied", error: errorFor(availability) };
      }

      const win = safeWindow() as
        | (Window & {
            Notification?: {
              requestPermission: () => Promise<NotificationPermission> | NotificationPermission;
            };
          })
        | undefined;
      if (!win?.Notification) {
        return { permission: "denied", error: new Error(ERR_UNAVAILABLE) };
      }

      let permission: NotificationPermission;
      try {
        const result = win.Notification.requestPermission();
        // Safari < 16 and some embedded webviews still use the callback form.
        permission = result instanceof Promise ? await result : (result as NotificationPermission);
      } catch (e) {
        return { permission: "denied", error: e instanceof Error ? e : new Error(String(e)) };
      }

      if (permission !== "granted") {
        // The browser gave no reason of its own. Re-derive it: the state may
        // have flipped to a restriction between the availability check and the
        // prompt (iOS: the page left standalone display mode).
        return { permission: "denied", error: errorFor(getAvailability()) };
      }

      // The permission IS granted from here on. The confirmation notification
      // is a cosmetic side effect of the playground, not the outcome, and on
      // iOS the `Notification` constructor is illegal outright ("Illegal
      // constructor. Use ServiceWorkerRegistration.showNotification() instead")
      // — so showing it unguarded used to throw, reject this promise, and get
      // recorded as a DENIAL. Losing a real grant over a toast is not an
      // acceptable trade, so the result is best-effort and never fatal.
      const shown = await showNotify("Alpine.js Toolkit", {
        body: "Notification permission granted",
      });
      return shown ? { permission: "granted", result: shown } : { permission: "granted" };
    },
  };
}

function errorFor(availability: NotifyPermissionAvailability): Error {
  switch (availability) {
    case "insecure-context":
      return new Error(ERR_INSECURE_CONTEXT);
    case "platform-restricted":
      return new Error(ERR_IOS_REQUIRES_INSTALL);
    case "unsupported":
      return new Error(ERR_UNAVAILABLE);
    default:
      // "available" yet refused: the browser denied without a reason. Say so
      // rather than inventing one.
      return new Error("The browser denied notification permission without giving a reason.");
  }
}
