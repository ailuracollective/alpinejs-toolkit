import type { SingletonScope } from "@ailura/alpinejs-core/singletons";
import type { Alpine } from "alpinejs";

/**
 * Options accepted by {@link OverlayController.configure} and the `overlayPlugin()` factory.
 */
export interface OverlayOptions {
  readonly root?: HTMLElement | string | null;
  readonly baseZIndex?: number;
  readonly step?: number;
  /**
   * Accepted and ignored. The controller holds one root and no state shared with
   * anything else, so there is nothing for a singleton scope to key on. The field
   * is here only because `OverlayOptions` doubles as the plugin factory's options,
   * and that shape carries a scope across the toolkit.
   */
  readonly scope?: SingletonScope;
  readonly storeKey?: string;
  readonly magicKey?: string;
}

/** Default `$store.overlay` key registered by {@link overlayPlugin}. */
export const DEFAULT_OVERLAY_STORE_KEY = "overlay";

/** Default `$overlay` magic key. */
export const DEFAULT_OVERLAY_MAGIC_KEY = "overlay";

/** Normalized, fully-resolved options. */
export interface NormalizedOverlayOptions {
  readonly root: HTMLElement | string | null;
  readonly baseZIndex: number;
  readonly step: number;
}

/** One open overlay. */
export interface OverlayStackEntry {
  readonly plugin: string;
  readonly id: string;
  readonly zIndex: number;
  readonly openedAt: number;
}

/** Reactive snapshot of the overlay controller state. */
export interface OverlayState {
  readonly root: HTMLElement | null;
  readonly stack: readonly OverlayStackEntry[];
  readonly count: number;
  readonly baseZIndex: number;
  readonly step: number;
}

/** Detail emitted on `controller.on('change', listener)`. */
export interface OverlayChangeDetail {
  readonly action: "claim" | "unregister" | "destroy";
  readonly stack: readonly OverlayStackEntry[];
  readonly added?: OverlayStackEntry;
  readonly removed?: OverlayStackEntry;
}

export interface OverlayEvents extends Record<string, unknown[]> {
  change: [OverlayChangeDetail];
}

export type OverlayChangeListener = (detail: OverlayChangeDetail) => void;

export interface OverlayStore {
  stack: OverlayStackEntry[];
  root: HTMLElement | null;
  count: number;
  baseZIndex: number;
  step: number;
  configure(options: OverlayOptions): void;
  claim(plugin: string, id: string): number;
  unregister(plugin: string, id: string): void;
  zIndexOf(plugin: string, id: string): number;
  isOpen(plugin: string, id: string): boolean;
  on(event: "change", listener: OverlayChangeListener): () => void;
  /**
   * Host-owned teardown: releases the portal root the controller resolved,
   * clears the slot map and empties the stack. Nothing invokes it
   * automatically — the host that registered the plugin calls it.
   */
  destroy(): void;
}

export interface OverlayMagicFacade {
  readonly stack: readonly OverlayStackEntry[];
  readonly count: number;
  readonly root: HTMLElement | null;
  readonly baseZIndex: number;
  readonly step: number;
  configure(options: OverlayOptions): void;
  claim(plugin: string, id: string): number;
  unregister(plugin: string, id: string): void;
  zIndexOf(plugin: string, id: string): number;
  isOpen(plugin: string, id: string): boolean;
  on(event: "change", listener: OverlayChangeListener): () => void;
  /**
   * The facade is the very object `overlayPlugin` registers as the magic
   * (`() => alpine.store(storeKey)`), so it carries the store's teardown.
   */
  destroy(): void;
}

export type OverlayPluginCallback = (alpine: Alpine) => void;

export interface AlpineOverlayAlpine {
  store(name: "overlay", value?: OverlayStore): OverlayStore;
  magic(name: "overlay", factory: () => OverlayMagicFacade): void;
}
