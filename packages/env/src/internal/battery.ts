import { safeWindow } from "@ailura/alpinejs-core/env";

import type { BatteryState } from "../types";

export function readBatteryStateSync(): BatteryState | null {
  // Battery API is async via navigator.getBattery(); sync read returns null
  // and the controller hydrates asynchronously when available.
  return null;
}

/**
 * Resolve the live `BatteryManager`, or `null` when the API is absent
 * (iOS Safari, desktop Firefox) or rejects.
 *
 * The caller MUST retain the returned instance: it is the only handle to the
 * browser's live battery state. Snapshots taken from it are frozen copies —
 * they never update on their own. Keeping the instance is what makes the
 * level observable after hydration.
 */
export async function getBatteryManager(): Promise<BatteryManagerLike | null> {
  const win = safeWindow() as
    | (Window & { navigator: Navigator & { getBattery?: () => Promise<BatteryManagerLike> } })
    | undefined;
  if (!win) return null;
  const nav = win.navigator as Navigator & { getBattery?: () => Promise<BatteryManagerLike> };
  if (typeof nav.getBattery !== "function") return null;
  try {
    return await nav.getBattery();
  } catch {
    return null;
  }
}

export async function readBatteryState(): Promise<BatteryState | null> {
  const m = await getBatteryManager();
  return m ? toBatteryState(m) : null;
}

/**
 * Synchronous re-read from an already-resolved manager. The `BatteryManager`
 * fields are plain live properties, so no second `getBattery()` round-trip is
 * needed once the instance is in hand.
 */
export function readBatteryStateFrom(m: BatteryManagerLike | null): BatteryState | null {
  return m ? toBatteryState(m) : null;
}

/**
 * `BatteryManager` events. `levelchange` is the one that tracks a discharging
 * device crossing a whole-percent boundary — the drop the OS indicator shows.
 */
export const BATTERY_EVENTS = [
  "levelchange",
  "chargingchange",
  "chargingtimechange",
  "dischargingtimechange",
] as const;

interface BatteryManagerLike {
  charging: boolean;
  level: number;
  chargingTime: number;
  dischargingTime: number;
  addEventListener?: (type: string, listener: () => void) => void;
  removeEventListener?: (type: string, listener: () => void) => void;
}

export function toBatteryState(m: BatteryManagerLike): BatteryState {
  return {
    charging: m.charging,
    level: m.level,
    chargingTime: m.chargingTime,
    dischargingTime: m.dischargingTime,
  };
}

export type { BatteryManagerLike };
