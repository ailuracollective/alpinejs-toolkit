/**
 * Permission adapters for the playground.
 *
 * `permissions` ships only the registry and the adapter contract; the browser
 * capabilities it tracks live in their own packages, and **so do the adapters
 * that describe them**. Each factory below is imported from the package that
 * owns the capability.
 *
 * This file used to hand-write all three adapters, and that was a bug factory:
 * the notification copy checked only `"Notification" in window`, so on an iPhone
 * it reported `availability: "available"` and invited a click that iOS can only
 * ever answer with `"denied"` — then rendered a generic "adjust your browser or
 * OS settings" message pointing at the wrong fix. Meanwhile the `notify`
 * section of the same playground showed the correct advice, because `notify`
 * had the iOS detection and the demo copy did not. Two sources of truth for one
 * permission, contradicting each other.
 *
 * The adapters now live with the capability, so there is exactly one place
 * that knows how a permission behaves, and `notify` / `geo` / `attention` stay
 * free of a dependency on `permissions` (the contract they implement is a
 * structural type re-exported from `@ailura/alpinejs-core/permission`).
 */

import { createWakeLockPermissionAdapter } from "@ailura/alpinejs-attention";
import { createGeolocationPermissionAdapter } from "@ailura/alpinejs-geo";
import { createNotifyPermissionAdapter } from "@ailura/alpinejs-notify";

export const notificationPermissionAdapter = createNotifyPermissionAdapter();
export const geolocationPermissionAdapter = createGeolocationPermissionAdapter();
export const wakeLockPermissionAdapter = createWakeLockPermissionAdapter();

/** Every adapter the playground registers, in display order. */
export const playgroundPermissionAdapters = [
  notificationPermissionAdapter,
  geolocationPermissionAdapter,
  wakeLockPermissionAdapter,
];
