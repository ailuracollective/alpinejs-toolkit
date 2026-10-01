/**
 * Geolocation permission adapter for a `@ailura/alpinejs-permissions` registry.
 *
 * `geo` owns the browser capability, so `geo` also owns the adapter that
 * describes it. See `notify`'s adapter for the reasoning, and
 * `test/permission-adapter.test.ts` for the conformance check that keeps this
 * shape assignable to the registry's `PermissionAdapter` without this package
 * ever depending on `permissions`.
 *
 * Unlike notifications, geolocation refuses for reasons the browser *does*
 * report — `getCurrentPosition` error codes are specific. This adapter surfaces
 * that code and message instead of flattening every failure to `"denied"`, and
 * it checks the secure context up front rather than letting a request fail
 * opaquely on plain HTTP.
 */

import { safeWindow } from "@ailura/alpinejs-core/env";

// Declared here rather than imported so `geo` keeps zero dependency on
// `@ailura/alpinejs-permissions`: this package must remain usable by an
// application that never opens a permission registry. The conformance test in
// `test/permission-adapter.test.ts` pins this shape to the registry's own
// `PermissionAdapter`.

export type GeoPermissionState = "granted" | "prompt" | "denied" | "unknown";

export type GeoPermissionAvailability =
  | "available"
  | "unsupported"
  | "insecure-context"
  | "policy-blocked"
  | "platform-restricted";

export interface GeoPermissionRequestResult<TResult = unknown> {
  readonly permission: GeoPermissionState;
  readonly result?: TResult;
  readonly error?: Error;
}

export interface GeoPermissionAdapter<
  TName extends string = string,
  TResult = unknown,
  TOptions = unknown,
> {
  readonly name: TName;
  readonly requiresUserGesture?: boolean;
  isSupported(): boolean;
  getAvailability(): GeoPermissionAvailability;
  query(): Promise<GeoPermissionState>;
  request(options?: TOptions): Promise<GeoPermissionRequestResult<TResult>>;
}

/** Permission name this adapter registers under. */
export const GEOLOCATION_PERMISSION_NAME = "geolocation" as const;

// --- Implementation -------------------------------------------------------

const ERR_INSECURE_CONTEXT =
  "Geolocation requires a secure context. Serve this page over HTTPS (or localhost).";
const ERR_UNAVAILABLE = "The Geolocation API is not available in this browser.";

function secureWindow(): (Window & { isSecureContext?: boolean }) | undefined {
  return safeWindow() as (Window & { isSecureContext?: boolean }) | undefined;
}

function isSupported(): boolean {
  const win = secureWindow();
  return !!win && "geolocation" in win.navigator;
}

function isSecure(): boolean {
  const win = secureWindow();
  if (!win) return false;
  // `?? true` for a window that does not report the flag at all: the absence of
  // `isSecureContext` is not evidence of an insecure origin, and failing closed
  // here would refuse geolocation on a browser that would have allowed it.
  return win.isSecureContext ?? true;
}

export function createGeolocationPermissionAdapter(): GeoPermissionAdapter<
  typeof GEOLOCATION_PERMISSION_NAME,
  GeolocationPosition,
  PositionOptions
> {
  const getAvailability = (): GeoPermissionAvailability => {
    if (!isSupported()) return "unsupported";
    if (!isSecure()) return "insecure-context";
    return "available";
  };

  return {
    name: GEOLOCATION_PERMISSION_NAME,
    requiresUserGesture: true,

    isSupported,

    getAvailability,

    async query(): Promise<GeoPermissionState> {
      if (!isSupported()) return "denied";

      // The Permissions API answers without prompting; every browser that does
      // not implement it reports `prompt`, which is also the honest answer for
      // a capability nobody has asked about yet.
      const nav = secureWindow()?.navigator;
      try {
        const result = await nav?.permissions?.query({ name: "geolocation" as PermissionName });
        return (result?.state ?? "prompt") as GeoPermissionState;
      } catch {
        return "prompt";
      }
    },

    request(options?: PositionOptions): Promise<GeoPermissionRequestResult<GeolocationPosition>> {
      const availability = getAvailability();
      if (availability !== "available") {
        return Promise.resolve({
          permission: "denied",
          error: new Error(
            availability === "insecure-context" ? ERR_INSECURE_CONTEXT : ERR_UNAVAILABLE
          ),
        });
      }

      const geolocation = secureWindow()?.navigator.geolocation;
      if (!geolocation) {
        return Promise.resolve({ permission: "denied", error: new Error(ERR_UNAVAILABLE) });
      }

      return new Promise((resolve) => {
        geolocation.getCurrentPosition(
          (position) => resolve({ permission: "granted", result: position }),
          (error) =>
            resolve({
              permission: "denied",
              // Keep the browser's own code: PERMISSION_DENIED (1) and
              // POSITION_UNAVAILABLE (2) call for completely different advice.
              error: new Error(
                `Geolocation denied (code ${error.code}): ${error.message || "no message"}`
              ),
            }),
          { timeout: 10_000, ...options }
        );
      });
    },
  };
}
