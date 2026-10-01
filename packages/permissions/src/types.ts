import type { Alpine } from "alpinejs";

// The adapter contract lives in `./adapter`, types-only, so the capability
// packages that *implement* adapters (`notify`, `geo`, `attention`) can be
// conformance-tested against it without depending on this package. These
// aliases are the same names the public API has always exported.
export type {
  PermissionAdapter,
  PermissionAvailability,
  PermissionListener,
  PermissionRequestResult,
  PermissionRequestState,
  PermissionSnapshot,
  PermissionState,
} from "./adapter";

import type { PermissionAdapter, PermissionSnapshot, PermissionState } from "./adapter";

/** @deprecated Prefer {@link PermissionState}; kept as the historical name. */
export type NormalizedPermissionState = PermissionState;

export type PermissionName = string;

export type PermissionRegistry = Readonly<Record<string, PermissionSnapshot>>;

export interface PermissionOptions {
  adapters?: readonly PermissionAdapter[];
  storeKey?: string;
  magicKey?: string;
}

export interface PermissionsPluginOptions {
  readonly adapters?: readonly PermissionAdapter[];
  readonly storeKey?: string;
  readonly magicKey?: string;
}

export const DEFAULT_PERMISSIONS_STORE_KEY = "permissions" as const;
export const DEFAULT_PERMISSIONS_MAGIC_KEY = "permissions" as const;

export interface PermissionsMagic {
  readonly registry: PermissionRegistry;
  get(name: string): PermissionSnapshot | undefined;
  query(name: string): Promise<PermissionSnapshot>;
  request(name: string, options?: unknown): Promise<PermissionSnapshot>;
  refresh(name: string): Promise<PermissionSnapshot>;
  watch(name: string): Promise<() => void>;
  /**
   * Host-owned teardown: unsubscribes every permission subscription the store
   * opened and drops the registered adapters. Nothing invokes it
   * automatically — the host that registered the plugin calls it.
   */
  destroy(): void;
}

export interface PermissionsStore extends PermissionsMagic {
  register(adapter: PermissionAdapter): () => void;
}

export type PermissionsAlpine = Alpine & { store(name: string): unknown };
export type PermissionsPluginCallback = (alpine: Alpine) => void;
