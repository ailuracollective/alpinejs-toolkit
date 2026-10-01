/**
 * Screen wake lock permission adapter for a `@ailura/alpinejs-permissions`
 * registry.
 *
 * `attention` owns the browser capability, so `attention` also owns the adapter
 * that describes it. See `notify`'s adapter for the reasoning, and
 * `test/permission-adapter.test.ts` for the conformance check that keeps this
 * shape assignable to the registry's `PermissionAdapter` without this package
 * ever depending on `permissions`.
 *
 * A wake lock is the odd one out among browser permissions: there is no prompt
 * and no persisted grant. It is authorized by the user gesture that calls
 * `request()` and it is revoked by the OS whenever the page is hidden. So
 * `query()` reports `"granted"` whenever the API exists — claiming otherwise
 * would make the registry permanently red for a capability that is, in fact,
 * available — while `request()` still reports honestly.
 */

import { safeWindow } from "@ailura/alpinejs-core/env";

import { isWakeLockSupported } from "./controller";

// --- The contract, declared structurally ---------------------------------
// Declared here rather than imported so `attention` keeps zero dependency on
// `@ailura/alpinejs-permissions`: this package must remain usable by an
// application that never opens a permission registry. The conformance test
// pins this shape to the registry's own `PermissionAdapter`.

export type WakeLockPermissionState = "granted" | "prompt" | "denied" | "unknown";

export type WakeLockPermissionAvailability =
  | "available"
  | "unsupported"
  | "insecure-context"
  | "policy-blocked"
  | "platform-restricted";

export interface WakeLockPermissionRequestResult<TResult = unknown> {
  readonly permission: WakeLockPermissionState;
  readonly result?: TResult;
  readonly error?: Error;
}

export interface WakeLockPermissionAdapter<TName extends string = string, TResult = unknown> {
  readonly name: TName;
  readonly requiresUserGesture?: boolean;
  isSupported(): boolean;
  getAvailability(): WakeLockPermissionAvailability;
  query(): Promise<WakeLockPermissionState>;
  request(options?: never): Promise<WakeLockPermissionRequestResult<TResult>>;
}

/** Permission name this adapter registers under. */
export const WAKE_LOCK_PERMISSION_NAME = "screen-wake-lock" as const;

// --- Implementation -------------------------------------------------------

const ERR_UNAVAILABLE = "The Screen Wake Lock API is not available in this browser.";
const ERR_REFUSED =
  "The browser refused the wake lock. Screen wake locks require a secure, visible document.";

function isSecure(): boolean {
  const win = safeWindow() as (Window & { isSecureContext?: boolean }) | undefined;
  if (!win) return false;
  return win.isSecureContext ?? true;
}

export function createWakeLockPermissionAdapter(): WakeLockPermissionAdapter<
  typeof WAKE_LOCK_PERMISSION_NAME,
  unknown
> {
  const getAvailability = (): WakeLockPermissionAvailability => {
    if (!isWakeLockSupported()) return "unsupported";
    if (!isSecure()) return "insecure-context";
    return "available";
  };

  return {
    name: WAKE_LOCK_PERMISSION_NAME,
    requiresUserGesture: true,

    isSupported: isWakeLockSupported,

    getAvailability,

    query(): Promise<WakeLockPermissionState> {
      // No prompt, no stored grant: the API existing is the whole story.
      return Promise.resolve(isWakeLockSupported() ? "granted" : "denied");
    },

    async request(): Promise<WakeLockPermissionRequestResult<unknown>> {
      const availability = getAvailability();
      if (availability !== "available") {
        return {
          permission: "denied",
          error: new Error(availability === "insecure-context" ? ERR_REFUSED : ERR_UNAVAILABLE),
        };
      }
      const wakeLock = (
        safeWindow() as unknown as { navigator?: { wakeLock?: unknown } } | undefined
      )?.navigator?.wakeLock as { request(type: "screen"): Promise<unknown> } | undefined;
      if (!wakeLock) {
        return { permission: "denied", error: new Error(ERR_UNAVAILABLE) };
      }
      try {
        const sentinel = await wakeLock.request("screen");
        return { permission: "granted", result: sentinel };
      } catch (e) {
        return { permission: "denied", error: e instanceof Error ? e : new Error(ERR_REFUSED) };
      }
    },
  };
}
