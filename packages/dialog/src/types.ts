/**
 * Type-only module: it imports nothing at runtime, so a consumer can reach for
 * `DialogStore` or `DialogOptions` without pulling in the controller.
 */

import type { Alpine } from "alpinejs";

export type DialogOpenOptions = {
  trigger?: HTMLElement | null;
  labelledBy?: string;
  describedBy?: string;
};

export type DialogOptions = {
  closeOnEscape?: boolean;
  closeOnOutsideClick?: boolean;
  labelledBy?: string;
  describedBy?: string;
  onOpen?: () => void;
  onClose?: () => void;
};

/** One dialog's state, including the element references the host bound. */
export type DialogInstance = {
  open: boolean;
  closeOnEscape: boolean;
  closeOnOutsideClick: boolean;
  labelledBy?: string;
  describedBy?: string;
  trigger: HTMLElement | null;
  container: HTMLElement | null;
  onOpen?: () => void;
  onClose?: () => void;
};

export type DialogChangeSource = "user" | "initialization";

export interface DialogOpenDetail {
  readonly instanceId: string;
  readonly source: DialogChangeSource;
}

export interface DialogCloseDetail {
  readonly instanceId: string;
  readonly source: DialogChangeSource;
}

export interface DialogChangeDetail {
  readonly instanceId?: string;
}

/**
 * The Alpine-facing surface, i.e. everything reachable as `$store.dialog.*`.
 *
 * **No focus management.** Nothing here moves focus into the panel on open or
 * back to the trigger on close, and nothing traps it. `open()`'s `trigger`
 * option only records the element so a host can act on it itself.
 */
export interface DialogStore {
  readonly instances: Record<string, DialogInstance>;
  /**
   * Creates the instance if it does not exist, so a bare `open(id)` works
   * without `create()`. No-op if the dialog is already open.
   *
   * `options.trigger` is **recorded, not used** — the controller has no focus
   * management, so it never focuses it. Pass it, then restore focus yourself
   * in `onClose`.
   */
  open(id: string, options?: DialogOpenOptions): void;
  close(id: string): void;
  toggle(id: string, options?: DialogOpenOptions): void;
  isOpen(id: string): boolean;
  /** Create a dialog. Re-creating an id replaces it. */
  create(id: string, options?: DialogOptions): void;
  /**
   * Destroy ONE dialog, or the whole controller with no argument.
   *
   * Both arities through one key so `destroy(id)` cannot be confused with
   * `destroy()`.
   */
  destroy(id: string): void;
  destroy(): void;
  /** Destroy every dialog. */
  destroyAll(): void;
  /**
   * Hand the panel element to the controller, which `handleOutsideClick()`
   * tests the click target against. `null` releases it. The `x-dialog` directive
   * does this for you and is the path that also tears the binding down again.
   */
  bindContainer(id: string, container: HTMLElement | null): void;
  /** Closes on `Escape` when the dialog is open and its `closeOnEscape` is on. */
  handleKeydown(id: string, event: KeyboardEvent): void;
  /**
   * Closes when the click target is outside the bound container. Needs
   * `bindContainer()` first — without one it no-ops, silently.
   */
  handleOutsideClick(id: string, event: MouseEvent): void;
  /**
   * `role="dialog"`, `aria-modal="true"` and the `aria-labelledby` /
   * `aria-describedby` pair. All four are fixed for the element's life, so this
   * is the one dialog helper safe to spread into a single `x-bind`.
   */
  dialogProps(id: string): Record<string, string | boolean | undefined>;
}

/**
 * Options for the controller itself, as opposed to an instance.
 *
 * Renamed from `DialogStoreConfig`: the old name called it a store config while
 * describing controller-wide defaults that every instance inherits.
 */
export type DialogControllerOptions = {
  readonly id?: string;
  defaultCloseOnEscape?: boolean;
  defaultCloseOnOutsideClick?: boolean;
};

export interface CreateDialogOptions {
  readonly id?: string;
  /** Controller-wide default for every dialog's `closeOnEscape`. Default `true`. */
  readonly closeOnEscape?: boolean;
  /** Controller-wide default for every dialog's `closeOnOutsideClick`. Default `true`. */
  readonly closeOnOutsideClick?: boolean;
  /** `$store` key — default {@link DEFAULT_DIALOG_STORE_KEY} (`"dialog"`). */
  readonly storeKey?: string;
  /**
   * Alpine directive name, without the `x-` prefix, that binds its own element
   * as the dialog container and releases the binding when Alpine removes that
   * element. Defaults to {@link DEFAULT_DIALOG_DIRECTIVE_KEY}.
   *
   * Add the `.panel` modifier for outside-click handling, which retires both
   * the backdrop `@click="handleOutsideClick"` and the panel `@click.stop`:
   *
   * ```html
   * <div x-dialog.panel="'settings'" role="dialog">…</div>
   * ```
   *
   * `.panel` is a modifier of the same directive rather than a separate key,
   * because Alpine parses `x-dialog.panel` as type `dialog` with modifiers
   * `['panel']`.
   *
   * The hand-written `$store.dialog.bindContainer(id, el)` remains available
   * and unchanged.
   */
  readonly directiveKey?: string;
}

export const DEFAULT_DIALOG_STORE_KEY = "dialog";

export const DEFAULT_DIALOG_DIRECTIVE_KEY = "dialog";

export type DialogAlpine = Alpine;

export type DialogPluginCallback = (alpine: Alpine) => void;
