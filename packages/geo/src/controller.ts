import { BaseController } from "@ailura/alpinejs-core/controller";
import { generateId } from "@ailura/alpinejs-core/ids";

import type { GeoErrorDetail, GeoEvents, GeoPositionDetail } from "./events";
import type { GeoControllerOptions, GeoPositionOptions, GeoStore } from "./types";

export class GeoController extends BaseController<GeoEvents> {
  readonly id: string;
  #latitude: number | null = null;
  #longitude: number | null = null;
  #accuracy: number | null = null;
  #altitude: number | null = null;
  #altitudeAccuracy: number | null = null;
  #heading: number | null = null;
  #speed: number | null = null;
  #timestamp: number | null = null;
  #error: string | null = null;
  #errorCode: number | null = null;
  #loading = false;
  #watching = false;
  #watchId: number | null = null;
  #generation = 0;
  readonly #supported: boolean;

  constructor(id?: string) {
    super();
    this.id = id ?? generateId("geo");
    // Latched in the constructor, not read per call: `isSupported` is the
    // answer to "can this document ever geolocate", and a store built at plugin
    // registration should not flip to `false` on a transient probe. The
    // permission state is a different question and lives in the adapter.
    this.#supported =
      typeof navigator !== "undefined" &&
      typeof navigator.geolocation?.getCurrentPosition === "function";
  }

  get latitude(): number | null {
    return this.#latitude;
  }
  get longitude(): number | null {
    return this.#longitude;
  }
  get accuracy(): number | null {
    return this.#accuracy;
  }
  get altitude(): number | null {
    return this.#altitude;
  }
  get altitudeAccuracy(): number | null {
    return this.#altitudeAccuracy;
  }
  get heading(): number | null {
    return this.#heading;
  }
  get speed(): number | null {
    return this.#speed;
  }
  get timestamp(): number | null {
    return this.#timestamp;
  }
  get error(): string | null {
    return this.#error;
  }
  get errorCode(): number | null {
    return this.#errorCode;
  }
  get loading(): boolean {
    return this.#loading;
  }
  get watching(): boolean {
    return this.#watching;
  }
  get hasPosition(): boolean {
    return this.#latitude !== null && this.#longitude !== null;
  }
  get isSupported(): boolean {
    return this.#supported;
  }
  get isWatching(): boolean {
    return this.#watching;
  }
  get isLoading(): boolean {
    return this.#loading;
  }
  get hasError(): boolean {
    return this.#error !== null;
  }

  request(options?: GeoPositionOptions): Promise<boolean> {
    if (!this.#supported) {
      this.#error = "Geolocation is not supported";
      this.#errorCode = null;
      this.emit("error", { message: "Geolocation is not supported", code: 0 });
      return Promise.resolve(false);
    }
    this.#loading = true;
    this.#error = null;
    this.#errorCode = null;
    // Announced so the projection can show a pending state. The plugin's `sync`
    // only runs on the events below, so without this the store kept reporting
    // `isLoading: false` for the whole request and the demo's "Locating…" label
    // was unreachable.
    this.emit("loading", undefined);
    const gen = ++this.#generation;
    // One generation per request: a second `request()` while the first is still
    // in flight bumps it, and the older callbacks see a stale generation and
    // resolve `false` without touching the state. Without that, a slow first
    // response could land after a fast second one and overwrite it.
    return new Promise((resolve) => {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          if (gen !== this.#generation) return resolve(false);
          this.#loading = false;
          this.#applyPosition(pos);
          resolve(true);
        },
        (err) => {
          if (gen !== this.#generation) return resolve(false);
          this.#loading = false;
          this.#clearCoords();
          this.#applyError(err);
          resolve(false);
        },
        options as PositionOptions
      );
    });
  }

  watch(options?: GeoPositionOptions): boolean {
    // One watch at a time, deliberately: `watchPosition` hands back an integer
    // id, and the cleanup stack below can only be pushed once per controller
    // lifecycle, so a second concurrent watch would leak the first id. `false`
    // says so rather than silently replacing the subscription.
    if (!this.#supported || this.#watching) return false;
    this.#error = null;
    this.#errorCode = null;
    this.#watchId = navigator.geolocation.watchPosition(
      (pos) => this.#applyPosition(pos),
      (err) => {
        this.#clearCoords();
        this.#applyError(err);
      },
      options as PositionOptions
    );
    this.#watching = true;
    this.onCleanup(() => {
      if (this.#watchId !== null) {
        navigator.geolocation.clearWatch(this.#watchId);
        this.#watchId = null;
        this.#watching = false;
      }
    });
    this.emit("watchStart", undefined);
    return true;
  }

  unwatch(): boolean {
    if (this.#watchId === null) return false;
    navigator.geolocation.clearWatch(this.#watchId);
    this.#watchId = null;
    this.#watching = false;
    this.emit("watchStop", undefined);
    return true;
  }

  override destroy(): void {
    // The destroyed-phase check runs before anything is mutated, so a repeated
    // destroy stays a no-op: no second `clearWatch`, no second `watchStop`.
    if (this.lifecycle === "destroyed") return;
    // Release the watch the way `unwatch()` does — clearWatch, clear the id,
    // flip `#watching` and emit `watchStop` — instead of letting the cleanup
    // stack do it silently. The emit is what makes the teardown honest for
    // observers: the plugin's store is a flat snapshot refreshed only by
    // controller events, so without `watchStop` the projection would keep
    // reporting `watching: true` after the controller stopped watching.
    // `unwatch()` emits before `super.destroy()` drains the plugin's
    // `watchStop` listener; the cleanup `watch()` pushed is a no-op afterwards
    // because `#watchId` is already `null`, so `clearWatch` runs exactly once.
    this.unwatch();
    super.destroy();
  }

  reset(): boolean {
    this.#latitude = null;
    this.#longitude = null;
    this.#accuracy = null;
    this.#altitude = null;
    this.#altitudeAccuracy = null;
    this.#heading = null;
    this.#speed = null;
    this.#timestamp = null;
    this.#error = null;
    this.#errorCode = null;
    this.emit("update", undefined);
    return true;
  }

  /**
   * A live view of the controller, not a snapshot: every field is a getter, so
   * a standalone consumer that keeps the object sees coordinates arrive. The
   * plugin cannot use it — Alpine needs a plain object it can write into — so
   * it builds its own and refreshes it from the events.
   */
  toStore(): GeoStore {
    const self = this;
    return {
      get latitude() {
        return self.latitude;
      },
      get longitude() {
        return self.longitude;
      },
      get accuracy() {
        return self.accuracy;
      },
      get altitude() {
        return self.altitude;
      },
      get altitudeAccuracy() {
        return self.altitudeAccuracy;
      },
      get heading() {
        return self.heading;
      },
      get speed() {
        return self.speed;
      },
      get timestamp() {
        return self.timestamp;
      },
      get error() {
        return self.error;
      },
      get errorCode() {
        return self.errorCode;
      },
      get loading() {
        return self.loading;
      },
      get watching() {
        return self.watching;
      },
      get hasPosition() {
        return self.hasPosition;
      },
      get isSupported() {
        return self.isSupported;
      },
      get isWatching() {
        return self.isWatching;
      },
      get isLoading() {
        return self.isLoading;
      },
      get hasError() {
        return self.hasError;
      },
      request: (o) => self.request(o),
      watch: (o) => self.watch(o),
      unwatch: () => self.unwatch(),
      reset: () => self.reset(),
      destroy: () => self.destroy(),
    } as GeoStore;
  }

  #applyPosition(pos: GeolocationPosition): void {
    this.#latitude = pos.coords.latitude;
    this.#longitude = pos.coords.longitude;
    this.#accuracy = pos.coords.accuracy;
    this.#altitude = pos.coords.altitude;
    this.#altitudeAccuracy = pos.coords.altitudeAccuracy;
    this.#heading = pos.coords.heading;
    this.#speed = pos.coords.speed;
    this.#timestamp = pos.timestamp;
    this.#error = null;
    this.#errorCode = null;
    const detail: GeoPositionDetail = {
      latitude: pos.coords.latitude,
      longitude: pos.coords.longitude,
      accuracy: pos.coords.accuracy,
      altitude: pos.coords.altitude,
      altitudeAccuracy: pos.coords.altitudeAccuracy,
      heading: pos.coords.heading,
      speed: pos.coords.speed,
      timestamp: pos.timestamp,
    };
    this.emit("position", detail);
  }

  #applyError(err: GeolocationPositionError): void {
    this.#error = err.message;
    this.#errorCode = err.code;
    const detail: GeoErrorDetail = { message: err.message, code: err.code };
    this.emit("error", detail);
  }

  #clearCoords(): void {
    this.#latitude = null;
    this.#longitude = null;
    this.#accuracy = null;
    this.#altitude = null;
    this.#altitudeAccuracy = null;
    this.#heading = null;
    this.#speed = null;
    this.#timestamp = null;
  }
}

export function createGeoController(options: GeoControllerOptions = {}): GeoController {
  const controller = new GeoController(options.id);
  controller.mount();
  return controller;
}
