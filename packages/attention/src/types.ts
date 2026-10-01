import type { Alpine } from "alpinejs";

/** User activity state reported by the Idle Detection API. */
export type IdleUserState = "active" | "idle";

/** Screen lock state reported by the Idle Detection API. */
export type IdleScreenState = "locked" | "unlocked";

/** Minimal shape of a Wake Lock API sentinel. */
export interface WakeLockSentinelLike {
  /**
   * Flips to `true` when the **OS** revokes the lock, which it does whenever
   * the page is hidden. The controller reads this on every `isActive` access;
   * it does not subscribe to the sentinel's `release` event.
   */
  released: boolean;
  addEventListener(type: string, listener: EventListener): void;
  removeEventListener(type: string, listener: EventListener): void;
  release(): Promise<void>;
}

/** Minimal shape of the Navigator Wake Lock interface. */
export interface WakeLockLike {
  request(type: "screen"): Promise<WakeLockSentinelLike>;
}

/** Minimal shape of the Idle Detection API detector. */
export interface IdleDetectorLike {
  userState: IdleUserState;
  screenState: IdleScreenState;
  start(options?: { threshold?: number }): Promise<void>;
  addEventListener(type: string, listener: EventListener): void;
  removeEventListener(type: string, listener: EventListener): void;
}

/** Constructor shape of the Idle Detection API. */
export interface IdleDetectorConstructor {
  new (): IdleDetectorLike;
  /**
   * The browser's own permission prompt. Chrome and Edge only, and it must be
   * called from a user gesture. `IdleController.requestPermission()` reports
   * `"granted"` when this does not exist at all.
   */
  requestPermission(): Promise<PermissionState>;
}

/** Alpine-facing `$wakelock` magic surface. */
export interface WakeLockMagic {
  /** Writable: assigning dismisses the surfaced error on the controller. */
  error: string | null;
  readonly isRequesting: boolean;
  readonly isActive: boolean;
  readonly isSupported: boolean;
  request(): Promise<boolean>;
  release(): Promise<boolean>;
  /**
   * Host-owned teardown for the `$wakelock` surface: releases the held screen
   * wake-lock sentinel and stops the controller. Nothing invokes it
   * automatically — the host that registered the plugin calls it.
   */
  destroy(): void;
}

/** Alpine-facing `$idle` magic surface. */
export interface IdleMagic {
  readonly userState: IdleUserState | null;
  readonly screenState: IdleScreenState | null;
  readonly permission: PermissionState | null;
  /** Writable: assigning dismisses the surfaced error on the controller. */
  error: string | null;
  readonly threshold: number;
  readonly isLoading: boolean;
  readonly isWatching: boolean;
  readonly isSupported: boolean;
  readonly isActive: boolean;
  readonly isIdle: boolean;
  requestPermission(): Promise<PermissionState>;
  start(options?: { threshold?: number }): Promise<boolean>;
  stop(): boolean;
  /**
   * Host-owned teardown for the `$idle` surface: stops the watch and clears the
   * idle timer. Nothing invokes it automatically — the host that registered
   * the plugin calls it.
   */
  destroy(): void;
}

// The magic surfaces above are read models, not emitters. The two controllers
// also expose `on('wakelock:change')` and `on('idle:change')`; nothing on
// `$wakelock` / `$idle` re-emits, because Alpine has nothing to subscribe to.

/**
 * Default and minimum idle threshold.
 *
 * They are the same value, and that is not a copy-paste error: the Idle
 * Detection API's own floor is 60 s and it throws below it, so there is no
 * threshold this package would honour that the browser would not.
 */
export const DEFAULT_IDLE_THRESHOLD = 60_000;

/** Minimum idle threshold enforced by the browser (60 s). */
export const MIN_IDLE_THRESHOLD = 60_000;

/**
 * Options for the plugin factory.
 *
 * There is nothing else to configure. Threshold is a per-`start()` argument,
 * not a plugin option, because two `$idle` consumers on one page want
 * different thresholds and there is only one `$idle`.
 */
export interface CreateAttentionOptions {
  readonly wakelockKey?: string;
  readonly idleKey?: string;
}

/** Default `$wakelock` magic key registered by {@link attentionPlugin}. */
export const DEFAULT_ATTENTION_WAKELOCK_KEY = "wakelock";
/** Default `$idle` magic key registered by {@link attentionPlugin}. */
export const DEFAULT_ATTENTION_IDLE_KEY = "idle";

/** Typed view of Alpine the attention plugin uses internally. */
export type AttentionAlpine = Alpine;

/** `Alpine.plugin()` callback signature. */
export type AttentionPluginCallback = (alpine: Alpine) => void;

/**
 * Options for each of the three `attention` controller factories.
 *
 * `id` only, but declared per controller rather than shared: a wake lock and an
 * idle detector are different things, and a shared bag would let a caller hand
 * an id intended for one to the other without the type objecting.
 */
export type AttentionControllerOptions = {
  /** Controller id. Generated when absent. */
  readonly id?: string;
};
