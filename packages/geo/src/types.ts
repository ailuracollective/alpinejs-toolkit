import type { Alpine } from "alpinejs";

export interface GeoPositionOptions {
  enableHighAccuracy?: boolean;
  timeout?: number;
  maximumAge?: number;
}

export interface GeoPosition {
  latitude: number | null;
  longitude: number | null;
  accuracy: number | null;
  altitude: number | null;
  altitudeAccuracy: number | null;
  heading: number | null;
  speed: number | null;
  timestamp: number | null;
}
export type GeoState = GeoPosition & {
  error: string | null;
  errorCode: number | null;
  loading: boolean;
  watching: boolean;
  hasPosition: boolean;
  isSupported: boolean;
};

export interface GeoStore {
  latitude: number | null;
  longitude: number | null;
  accuracy: number | null;
  altitude: number | null;
  altitudeAccuracy: number | null;
  heading: number | null;
  speed: number | null;
  timestamp: number | null;
  error: string | null;
  errorCode: number | null;
  loading: boolean;
  watching: boolean;
  request(options?: GeoPositionOptions): Promise<boolean>;
  watch(options?: GeoPositionOptions): boolean;
  unwatch(): boolean;
  reset(): boolean;
  /**
   * Host-owned teardown: releases the `navigator.geolocation.watchPosition`
   * subscription a `watch()` started. Nothing invokes it automatically — the
   * host that registered the plugin calls it. `unwatch()` is unaffected and
   * remains available for stopping a watch on its own.
   */
  destroy(): void;
  readonly hasPosition: boolean;
  readonly isSupported: boolean;
  readonly isWatching: boolean;
  readonly isLoading: boolean;
  readonly hasError: boolean;
}

export type GeoAlpine = Alpine & { store(name: string): unknown };
export type GeoPluginCallback = (alpine: Alpine) => void;

export interface CreateGeoOptions {
  readonly id?: string;
  readonly storeKey?: string;
}

export const DEFAULT_GEO_STORE_KEY = "geo" as const;

/** Options for `createGeoController`. */
export type GeoControllerOptions = {
  /** Controller id. Generated when absent. */
  readonly id?: string;
};
