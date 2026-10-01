/**
 * Public type contracts for `@ailura/alpinejs-toast`.
 *
 * Every public type lives in a `types.ts` module so consumers can import
 * them without pulling the implementation. The shape IS the contract.
 *
 * The declarations at the bottom of this file are legacy: those names predate
 * `ToastOptions` / `CreateToastOptions`, and the barrel does not re-export them,
 * so nothing outside `src/` can reach them.
 */

import type { Alpine } from "alpinejs";

export const DEFAULT_TOAST_STORE_KEY = "toast" as const;
export const DEFAULT_TOAST_MAGIC_KEY = DEFAULT_TOAST_STORE_KEY;

/**
 * `"bottom-right" | (string & {})` rather than a bare `string`: the union keeps
 * the known value in the type, so a typo in it is a compile error, while the
 * `& {}` arm still accepts any other string and keeps editor completion for the
 * built-in. A plain `string` would take the typo silently; a closed union would
 * reject a consumer's own position name.
 */
export type ToastPosition = "bottom-right" | (string & {});
export type ToastVariant = "default" | (string & {});
export type ToastDuration = number | false;

export interface ToastAction {
  label: string;
  onClick?: () => void;
}

export interface ToastOptions {
  title?: string | null;
  description?: string | null;
  content?: unknown;
  variant?: ToastVariant;
  position?: ToastPosition;
  duration?: ToastDuration;
  action?: ToastAction | null;
  key?: string | null;
}

export interface CreateToastOptions {
  readonly id?: string;
  readonly defaultPosition?: ToastPosition;
  readonly defaultDuration?: number;
  readonly maxToasts?: number;
  readonly maxVisible?: number;
  readonly storeKey?: string;
  readonly magicKey?: string;
}

export interface ToastItem {
  id: string;
  key: string | null;
  content: unknown;
  title: string | null;
  description: string | null;
  variant: ToastVariant;
  position: ToastPosition;
  duration: ToastDuration;
  action: ToastAction | null;
  removed: boolean;
}

export type ToastChangeSource =
  | "initialization"
  | "push"
  | "pushUnique"
  | "update"
  | "dismiss"
  | "dismissAt"
  | "dismissAll";

export interface ToastChangeDetail {
  readonly source: ToastChangeSource;
  readonly items: ToastItem[];
}

export interface ToastStore {
  /**
   * The live queue, newest first. A dismissed item stays here for 300 ms with
   * `removed: true` so a renderer can animate it out — filter on `removed` if
   * you are not animating.
   */
  items: ToastItem[];
  defaultPosition: ToastPosition;
  /** Always `[defaultPosition]`. A toast's own `position` never joins it. */
  stackPositions: readonly ToastPosition[];
  maxToasts: number;
  /** Advisory only — the queue enforces `maxToasts`, never this. */
  maxVisible: number;
  push(payload?: ToastOptions): string;
  pushUnique(key: string, payload?: ToastOptions): string;
  update(id: string, payload?: Partial<ToastOptions>): void;
  dismiss(id: string): void;
  dismissAt(position: ToastPosition): void;
  dismissAll(): void;
  itemsAt(position: ToastPosition): ToastItem[];
  destroy(): void;
}

/** Legacy names for shapes that still exist under a current name. */
export type ToastPayload = ToastOptions;
export type CreateToastControllerOptions = CreateToastOptions;
export type ToastManager = ToastStore;

export type ToastAlpine = Alpine & { store(name: string): unknown };
export type ToastPluginCallback = (alpine: Alpine) => void;

// Legacy names, kept for source compatibility; the barrel does not re-export them.
export type DefaultToastPosition = "bottom-right";
export type DefaultToastVariant = "default";
export interface ToastPromiseOptions {
  loading?: string;
  error?: string;
  duration?: ToastDuration;
}
export interface ToastPluginOptions {
  variants?: readonly string[];
  positions?: readonly string[];
  defaultPosition?: ToastPosition;
  defaultDuration?: number;
  maxToasts?: number;
  maxVisible?: number;
  storeKey?: string;
  magicKey?: string;
}
