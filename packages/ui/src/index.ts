/**
 * Framework-agnostic infrastructure layer, consumed by toolkit packages and
 * by applications that need the same primitives without a plugin.
 *
 * Every domain is also a subpath (`@ailura/alpinejs-ui/storage`, `…/portal`,
 * `…/media`, `…/types`) so a consumer that only needs a storage adapter does
 * not load the portal helper. Nothing here ships an `Alpine.plugin()`: `ui`
 * has no registration surface of its own, by design.
 */

export { createMediaQueryListener } from "./media";
export { createPortalRoot, removePortalRoot } from "./portal";
export type { PortalRootOptions } from "./portal";
export { createLocalStorageAdapter, createMemoryAdapter } from "./storage";
export type {
  LocalStorageAdapterOptions,
  MemoryAdapterOptions,
  StorageAdapter,
  SubscribableStorageAdapter,
  Unsubscribe,
} from "./types";
