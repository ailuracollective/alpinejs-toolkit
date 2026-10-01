/**
 * The permission-adapter contract.
 *
 * This module is **types only** — no runtime, no bundle cost. It is the one
 * definition of what a permission registry can track, and it lives here rather
 * than in `@ailura/alpinejs-core` because a permission contract in the
 * Foundation layer would imply that every package in the toolkit needs
 * permissions. Most of them do not.
 *
 * # How the capability packages use this without depending on it
 *
 * `notify`, `geo` and `attention` each ship a ready-made adapter for the
 * capability they own. None of them depends on `@ailura/alpinejs-permissions`:
 * each declares the narrow structural shape it actually implements, and a
 * conformance test in that package asserts the shape is assignable to
 * {@link PermissionAdapter} below. So the registry stays a *registry* — it
 * knows how to track a permission, never how to obtain one — and the packages
 * that implement adapters stay free of a permissions dependency while drift
 * between the two sides still fails the build.
 */

/**
 * A permission in its normalized four-state form.
 *
 * `prompt` doubles as "nobody has asked yet" — the honest answer for a
 * capability no one has requested, and what browsers without the Permissions
 * API report for one.
 */
export type PermissionState = "granted" | "prompt" | "denied" | "unknown";

/**
 * Why a permission can or cannot be requested.
 *
 * `platform-restricted` carries the most weight on mobile: the API exists and
 * the context is secure, but the OS will not grant it in the current situation
 * — iOS refusing anything outside a Home Screen install being the canonical
 * case. An adapter that cannot tell `platform-restricted` from a plain refusal
 * sends users to the wrong settings screen.
 */
export type PermissionAvailability =
  | "available"
  | "unsupported"
  | "insecure-context"
  | "policy-blocked"
  | "platform-restricted";

/** Lifecycle of a single `request()` call. */
export type PermissionRequestState = "idle" | "requesting" | "succeeded" | "failed";

/** The tracked state of one registered permission. */
export interface PermissionSnapshot<TResult = unknown> {
  readonly permission: PermissionState;
  readonly availability: PermissionAvailability;
  readonly requestState: PermissionRequestState;
  readonly canRequest: boolean;
  readonly requiresUserGesture: boolean;
  readonly error: Error | null;
  readonly result: TResult | null;
}

/** What an adapter's `request()` reports back. */
export interface PermissionRequestResult<TResult = unknown> {
  readonly permission: PermissionState;
  readonly result?: TResult;
  readonly error?: Error;
}

/** Notified when a permission changes on its own. */
export type PermissionListener<TResult = unknown> = (snapshot: PermissionSnapshot<TResult>) => void;

/**
 * A browser capability expressed as something this registry can track.
 *
 * Implementations MUST report the real reason a request cannot succeed through
 * {@link PermissionAdapter.getAvailability} and/or the `error` on
 * {@link PermissionAdapter.request}'s result — a bare `"denied"` with no
 * explanation is not enough for a user to act on.
 */
export interface PermissionAdapter<
  TName extends string = string,
  TResult = unknown,
  TOptions = unknown,
> {
  readonly name: TName;
  readonly requiresUserGesture?: boolean;
  isSupported(): boolean;
  getAvailability(): PermissionAvailability;
  query(): Promise<PermissionState>;
  request(options?: TOptions): Promise<PermissionRequestResult<TResult>>;
  subscribe?(listener: PermissionListener<TResult>): Promise<() => void> | (() => void);
}
