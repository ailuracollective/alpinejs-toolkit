import { BaseController } from "@ailura/alpinejs-core/controller";
import { safeDocument, safeWindow } from "@ailura/alpinejs-core/env";
import { generateId } from "@ailura/alpinejs-core/ids";

import type { EnvEvents } from "./events";
import {
  BATTERY_EVENTS,
  type BatteryManagerLike,
  getBatteryManager,
  readBatteryStateFrom,
  readBatteryStateSync,
} from "./internal/battery";
import { readNetworkState } from "./internal/network";
import { readPlatformState } from "./internal/platform";
import { readVisibilityState } from "./internal/visibility";
import type {
  BatteryState,
  EnvControllerOptions,
  EnvState,
  NetworkState,
  PlatformState,
  VisibilityState,
} from "./types";

export class EnvController extends BaseController<EnvEvents> {
  readonly id: string;

  #network: NetworkState;
  #visibility: VisibilityState;
  #battery: BatteryState | null;
  #batteryManager: BatteryManagerLike | null;
  #platform: PlatformState;

  constructor(id?: string) {
    super();
    this.id = id ?? generateId("env");
    this.#network = readNetworkState();
    this.#visibility = readVisibilityState();
    this.#battery = readBatteryStateSync();
    this.#batteryManager = null;
    this.#platform = readPlatformState();
  }

  get network(): NetworkState {
    return this.#network;
  }

  get visibility(): VisibilityState {
    return this.#visibility;
  }

  get battery(): BatteryState | null {
    return this.#battery;
  }

  get platform(): PlatformState {
    return this.#platform;
  }

  snapshot(): EnvState {
    return {
      network: { ...this.#network },
      visibility: { ...this.#visibility },
      battery: this.#battery ? { ...this.#battery } : null,
      platform: { ...this.#platform },
    };
  }

  refresh(): void {
    if (this.lifecycle === "destroyed") return;
    const nextNetwork = readNetworkState();
    const nextVisibility = readVisibilityState();
    const nextPlatform = readPlatformState();
    let changed = false;
    if (!shallowEqual(this.#network, nextNetwork)) {
      this.#network = nextNetwork;
      this.emit("network:change", this.#network);
      changed = true;
    }
    if (!shallowEqual(this.#visibility, nextVisibility)) {
      this.#visibility = nextVisibility;
      this.emit("visibility:change", this.#visibility);
      changed = true;
    }
    if (!shallowEqual(this.#platform, nextPlatform)) {
      this.#platform = nextPlatform;
      this.emit("platform:change", this.#platform);
      changed = true;
    }
    if (this.#syncBattery()) changed = true;
    if (changed) this.emit("change", this.snapshot());
  }

  protected override setup(): void {
    const win = safeWindow() as Window | undefined;
    const doc = safeDocument();

    if (win) {
      const onNetwork = (): void => {
        const next = readNetworkState();
        if (shallowEqual(this.#network, next)) return;
        this.#network = next;
        this.emit("network:change", this.#network);
        this.emit("change", this.snapshot());
      };
      win.addEventListener("online", onNetwork);
      win.addEventListener("offline", onNetwork);
      this.onCleanup(() => {
        win.removeEventListener("online", onNetwork);
        win.removeEventListener("offline", onNetwork);
      });

      // NetworkInformation change
      const conn = (
        win.navigator as unknown as {
          connection?: {
            addEventListener?: (t: string, l: () => void) => void;
            removeEventListener?: (t: string, l: () => void) => void;
          };
        }
      ).connection;
      if (conn?.addEventListener) {
        conn.addEventListener("change", onNetwork);
        this.onCleanup(() => conn.removeEventListener?.("change", onNetwork));
      }
    }

    if (doc) {
      const onVisibility = (): void => {
        const next = readVisibilityState();
        if (shallowEqual(this.#visibility, next)) return;
        this.#visibility = next;
        this.emit("visibility:change", this.#visibility);
        this.emit("change", this.snapshot());
      };
      doc.addEventListener("visibilitychange", onVisibility);
      this.onCleanup(() => doc.removeEventListener("visibilitychange", onVisibility));
    }

    // Battery — async hydration
    void getBatteryManager().then((manager) => {
      if (this.lifecycle === "destroyed") return;
      this.#batteryManager = manager;
      if (this.#syncBattery()) this.emit("change", this.snapshot());
      this.#attachBatteryListeners(manager);
    });

    // Keep platform reactive to resize/orientation is not needed — static by UA
  }

  /**
   * Re-take the battery snapshot from the held manager and emit `battery:change`
   * when a field actually moved. Returns whether the state changed, so callers
   * decide whether the aggregate `change` is warranted.
   */
  #syncBattery(): boolean {
    const next = readBatteryStateFrom(this.#batteryManager);
    if (
      shallowEqual(
        this.#battery as unknown as Record<string, unknown> | null,
        next as unknown as Record<string, unknown> | null
      )
    ) {
      return false;
    }
    this.#battery = next;
    this.emit("battery:change", next);
    return true;
  }

  /**
   * Subscribe to the manager's events for the lifetime of the mount. A null
   * manager — iOS Safari, desktop Firefox, or a rejected `getBattery()` — is not
   * an error here: `#battery` simply stays `null`, which is the documented
   * "unsupported" shape the view already projects.
   */
  #attachBatteryListeners(manager: BatteryManagerLike | null): void {
    if (!manager?.addEventListener) return;
    const onBattery = (): void => {
      if (this.lifecycle === "destroyed") return;
      if (!this.#syncBattery()) return;
      this.emit("change", this.snapshot());
    };
    for (const type of BATTERY_EVENTS) {
      manager.addEventListener(type, onBattery);
    }
    this.onCleanup(() => {
      for (const type of BATTERY_EVENTS) {
        manager.removeEventListener?.(type, onBattery);
      }
    });
  }

  override destroy(): void {
    super.destroy();
  }
}

function shallowEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  const ra = a as Record<string, unknown>;
  const rb = b as Record<string, unknown>;
  const ka = Object.keys(ra);
  const kb = Object.keys(rb);
  if (ka.length !== kb.length) return false;
  for (const k of ka) if (ra[k] !== rb[k]) return false;
  return true;
}

export function createEnvController(options: EnvControllerOptions = {}): EnvController {
  const controller = new EnvController(options.id);
  controller.mount();
  return controller;
}
