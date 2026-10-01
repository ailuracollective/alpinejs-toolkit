import type { Alpine } from "alpinejs";

export type ScrollDirection = "up" | "down" | "none";
export type ScrollBehavior = "auto" | "instant" | "smooth";
export type ScrollLockAxis = "y" | "both";

export type ScrollChangeSource =
  | "user"
  | "navigation"
  | "lock"
  | "section"
  | "reset"
  | "initialization";

export interface ScrollState {
  x: number;
  y: number;
  direction: ScrollDirection;
  atTop: boolean;
  atBottom: boolean;
  progress: number;
  locked: boolean;
  lockCount: number;
  activeSection: string | null;
  visibleSections: readonly string[];
}

export type ScrollSectionMode = "first-visible" | "nearest";

export interface ScrollSectionOptions {
  readonly mode?: ScrollSectionMode;
  readonly rootMargin?: string;
}

export const DEFAULT_SCROLL_STORE_KEY = "scroll";
export const DEFAULT_SCROLL_MAGIC_KEY = "scroll";

export interface ScrollOptions {
  readonly id?: string;
  readonly defaultBehavior?: ScrollBehavior;
  readonly respectReducedMotion?: boolean;
  readonly reserveScrollbarGap?: boolean;
  readonly target?: Element | string | null;
  readonly storeKey?: string;
  readonly magicKey?: string;
}

export interface ScrollChangeDetail {
  readonly state: ScrollState;
  readonly previous: ScrollState | null;
  readonly source: ScrollChangeSource;
  readonly reason?: string;
}

export interface ScrollLockChangeDetail {
  readonly locked: boolean;
  readonly count: number;
  readonly reason: string;
  readonly handle: string | null;
}

export type ScrollLockDetail = ScrollLockChangeDetail;

export interface ScrollSectionChangeDetail {
  readonly active: string | null;
  readonly previous: string | null;
  readonly visible: readonly string[];
  readonly reason?: string;
}

export interface ScrollPositionDetail {
  readonly x: number;
  readonly y: number;
  readonly direction: ScrollDirection;
  readonly progress: number;
}

export interface ScrollReachDetail {
  readonly edge: "top" | "bottom";
  readonly y: number;
}

export interface ScrollNavigationDetail {
  readonly from: number;
  readonly to: number;
  readonly behavior: ScrollBehavior;
  readonly reason?: string;
}

export interface ScrollIntoViewOptions {
  readonly behavior?: ScrollBehavior;
  readonly focus?: boolean;
}

export interface ScrollIntoViewAbsoluteOptions extends ScrollIntoViewOptions {
  readonly x: number;
  readonly y: number;
}

export interface ScrollNavigationOptions {
  readonly behavior?: ScrollBehavior;
}

export type ScrollLockReason = string;

export interface ScrollStore {
  x: number;
  y: number;
  direction: ScrollDirection;
  atTop: boolean;
  atBottom: boolean;
  progress: number;
  locked: boolean;
  lockCount: number;
  activeSection: string | null;
  visibleSections: readonly string[];
  scrollIntoView(target: { x: number; y: number } | Element, options?: ScrollIntoViewOptions): void;
  by(delta: { x?: number; y?: number }, options?: ScrollNavigationOptions): void;
  toTop(options?: ScrollNavigationOptions): void;
  toBottom(options?: ScrollNavigationOptions): void;
  lock(reason?: string): string;
  unlock(handle: string): void;
  unlockAll(): void;
  /**
   * Host-owned teardown: disconnects the section observer, releases every lock
   * and clears the registered sections. Nothing invokes it automatically — the
   * host that registered the plugin calls it.
   */
  destroy(): void;
}

export type ScrollAlpine = Alpine;
export type ScrollPluginCallback = (alpine: Alpine) => void;
export type Unsubscribe = () => void;
export type SingletonScope = Record<string, unknown>;

export interface ScrollManager {
  readonly state: ScrollState;
}
