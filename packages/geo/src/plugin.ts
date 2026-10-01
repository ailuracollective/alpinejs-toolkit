import { guardStore } from "@ailura/alpinejs-core/guards";
import { readAlpineStore, resolveStoreKey } from "@ailura/alpinejs-core/registration";
import type { Alpine } from "alpinejs";

import { GeoController } from "./controller";
import {
  DEFAULT_GEO_STORE_KEY,
  type CreateGeoOptions,
  type GeoPluginCallback,
  type GeoStore,
} from "./types";

const packageName = "@ailura/alpinejs-geo";

/**
 * Writable view of {@link GeoStore} for the projection below.
 *
 * `GeoStore` marks the five booleans `readonly`: they are derived flags, and a
 * consumer of `$store.geo` must read them rather than set them. The plugin is
 * the one owner that refreshes them, so `sync` writes through this local view
 * of the same type instead of loosening the public contract. No new type is
 * exported and no store member changes.
 */
type GeoStoreProjection = { -readonly [K in keyof GeoStore]: GeoStore[K] };

export function geoPlugin(options: CreateGeoOptions = {}): GeoPluginCallback {
  const storeKey = resolveStoreKey(options, DEFAULT_GEO_STORE_KEY);

  return function registerGeo(alpine: Alpine): void {
    const controller = new GeoController(options.id);
    // A flat snapshot, not `controller.toStore()`: Alpine needs an object it
    // can write into, and a record of getters is not one. The cost is that
    // every field has to be refreshed by an event — hence the explicit
    // projection below.
    const store: GeoStore = {
      latitude: controller.latitude,
      longitude: controller.longitude,
      accuracy: controller.accuracy,
      altitude: controller.altitude,
      altitudeAccuracy: controller.altitudeAccuracy,
      heading: controller.heading,
      speed: controller.speed,
      timestamp: controller.timestamp,
      error: controller.error,
      errorCode: controller.errorCode,
      loading: controller.loading,
      watching: controller.watching,
      hasPosition: controller.hasPosition,
      isSupported: controller.isSupported,
      isWatching: controller.isWatching,
      isLoading: controller.isLoading,
      hasError: controller.hasError,
      request: (opts) => controller.request(opts),
      watch: (opts) => controller.watch(opts),
      unwatch: () => controller.unwatch(),
      reset: () => controller.reset(),
      destroy: () => controller.destroy(),
    };

    // Every event that can change a field is subscribed; a field `sync` does not
    // write would keep its registration-time value for the life of the store.
    const sync = (): void => {
      const proxy = readAlpineStore<GeoStoreProjection>(alpine, storeKey);
      if (!proxy) return;
      proxy.latitude = controller.latitude;
      proxy.longitude = controller.longitude;
      proxy.accuracy = controller.accuracy;
      proxy.altitude = controller.altitude;
      proxy.altitudeAccuracy = controller.altitudeAccuracy;
      proxy.heading = controller.heading;
      proxy.speed = controller.speed;
      proxy.timestamp = controller.timestamp;
      proxy.error = controller.error;
      proxy.errorCode = controller.errorCode;
      proxy.loading = controller.loading;
      proxy.watching = controller.watching;
      proxy.hasPosition = controller.hasPosition;
      proxy.isSupported = controller.isSupported;
      proxy.isWatching = controller.isWatching;
      proxy.isLoading = controller.isLoading;
      proxy.hasError = controller.hasError;
    };

    controller.on("position", sync);
    controller.on("error", sync);
    controller.on("loading", sync);
    controller.on("watchStart", sync);
    controller.on("watchStop", sync);
    controller.on("update", sync);

    guardStore(alpine, storeKey, store, packageName);
  };
}

export default geoPlugin;
