import type { Alpine } from "alpinejs";

export interface NetworkState {
  readonly online: boolean;
  readonly effectiveType?: string;
  readonly saveData?: boolean;
  readonly downlink?: number;
  readonly rtt?: number;
}

export interface VisibilityState {
  readonly visible: boolean;
  readonly hidden: boolean;
  readonly state: DocumentVisibilityState;
}

export interface BatteryState {
  readonly charging: boolean;
  readonly level: number;
  readonly chargingTime: number;
  readonly dischargingTime: number;
}

export interface PlatformState {
  readonly userAgent: string;
  readonly platform: string;
  readonly vendor: string;
  readonly isIos: boolean;
  readonly isAndroid: boolean;
  readonly isMobile: boolean;
  readonly isMac: boolean;
  readonly isWindows: boolean;
}

/**
 * The single `$env` magic: one reactive projection of every environment domain
 * the controller tracks, plus the host-owned teardown handle.
 *
 * Every domain carries a `supported` flag except battery, which keeps the
 * API's own `null` for "unsupported" — a domain disabled through the plugin
 * options reports exactly the shape a browser without the API does.
 */
export interface EnvMagic {
  readonly network: NetworkState & { readonly supported: boolean };
  readonly visibility: VisibilityState & { readonly supported: boolean };
  readonly battery: BatteryState | null;
  readonly platform: PlatformState & { readonly supported: boolean };
  /**
   * Host-owned teardown: removes the `window` online/offline and
   * `document` visibilitychange listeners (and every other page-level listener
   * the env controller registered). Nothing invokes it automatically — the host
   * that registered the plugin calls it.
   */
  destroy(): void;
}

export interface EnvState {
  readonly network: NetworkState;
  readonly visibility: VisibilityState;
  readonly battery: BatteryState | null;
  readonly platform: PlatformState;
}

export interface EnvPluginOptions {
  readonly id?: string;
  /**
   * Domain switches. A disabled domain is still present on the `$env` view —
   * the aggregate is never partial — but it reports `supported: false` and is
   * frozen at its registration read, so nothing re-renders for it.
   */
  readonly network?: boolean;
  readonly visibility?: boolean;
  readonly battery?: boolean;
  readonly platform?: boolean;
  /**
   * Magic name. Defaults to {@link DEFAULT_ENV_MAGIC_KEY}.
   *
   * Renamed from `envKey`: the canon names a rename option after what it
   * renames (`storeKey`, `magicKey`, `directiveKey`), and a package with no
   * store has exactly one thing to rename.
   */
  readonly magicKey?: string;
}

/** Default `$env` magic key registered by {@link envPlugin}. */
export const DEFAULT_ENV_MAGIC_KEY = "env";

export type EnvAlpine = Alpine;
export type EnvPluginCallback = (alpine: Alpine) => void;

export type EnvControllerOptions = {
  /** Controller id. Generated when absent. */
  readonly id?: string;
};
