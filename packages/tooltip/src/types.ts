/**
 * Type-only module: it imports nothing at runtime, so a consumer can reach for
 * `TooltipStore` or `TooltipOptions` without pulling in the controller.
 */

import type { Alpine } from "alpinejs";

export type TooltipOptions = {
  readonly openDelay?: number;
  readonly closeDelay?: number;
  readonly onOpen?: () => void;
  readonly onClose?: () => void;
  /**
   * Close the tooltip when scrolling moves the trigger out from under the
   * pointer. Defaults to **true**.
   *
   * A pointer that does not move produces no `mouseleave`: the browser only
   * re-dispatches pointer events on real movement, so a tooltip opened over a
   * trigger that then scrolls away under a stationary cursor stays open with
   * nothing to close it. This makes the scroll itself the cue.
   *
   * The check only ever *closes*. Scrolling back does not re-open: that stays
   * the job of a real `mouseenter`, so a scroll cannot spam the open path.
   */
  readonly closeOnScrollAway?: boolean;
};

/** One tooltip's state, including the two pending delay timers. */
export type TooltipInstance = {
  open: boolean;
  openDelay: number;
  closeDelay: number;
  openTimer: ReturnType<typeof setTimeout> | null;
  closeTimer: ReturnType<typeof setTimeout> | null;
  closeOnScrollAway: boolean;
  onOpen?: () => void;
  onClose?: () => void;
};

export type TooltipChangeSource = "user" | "initialization";

export interface TooltipChangeDetail {
  readonly instanceId: string;
  readonly open: boolean;
  readonly source: TooltipChangeSource;
}

/**
 * The Alpine-facing surface, i.e. everything reachable as `$store.tooltip.*`
 * (or `$tooltip.*`, the magic returns the same object).
 *
 * **No ARIA helpers.** There is no `tooltipProps()` and no generated
 * `aria-describedby` — the relationship between trigger and panel is the
 * author's to write, and the panel's own `role="tooltip"` and `id` never come
 * from this package.
 */
export interface TooltipStore {
  readonly instances: Record<string, TooltipInstance>;
  /** Create a tooltip. Re-creating an existing id replaces its options. */
  create(id: string, options?: TooltipOptions): void;
  /** Destroy ONE tooltip. Idempotent; an unknown id is a no-op. */
  destroy(id: string): void;
  /** Destroy every tooltip. */
  destroyAll(): void;
  /**
   * Opens after `openDelay` ms (immediately at `0`) and cancels any pending
   * close — so moving between two adjacent triggers does not flicker.
   */
  open(id: string): void;
  /** Closes after `closeDelay` ms, cancelling any pending open. */
  close(id: string): void;
  toggle(id: string): void;
  isOpen(id: string): boolean;
  /**
   * Attach the hover/focus behaviour to a trigger element, and — unless the
   * instance opted out with `closeOnScrollAway: false` — watch for the trigger
   * scrolling out from under a stationary pointer.
   *
   * This exists so callers stop hand-wiring `@mouseenter` / `@mouseleave` on
   * every trigger, which is where the scroll bug came from in the first place:
   * a hand-wired pair cannot tell that the element stopped being hovered,
   * because no `mouseleave` is dispatched when only the page moves.
   *
   * Binding twice for the same id replaces the previous binding.
   */
  bindTrigger(id: string, el: HTMLElement): void;
  /** Release whatever `bindTrigger` attached for `id`. */
  unbindTrigger(id: string): void;
  /**
   * Aliases for {@link open} / {@link close}, named for the hand-wired
   * `@mouseenter` / `@focus` handlers they replace. They do not carry the
   * pointer position the scroll check needs, so a trigger bound this way is
   * never closed by a scroll — use `bindTrigger` or `x-tooltip`.
   */
  showOnHover(id: string): void;
  hideOnHover(id: string): void;
  showOnFocus(id: string): void;
  hideOnFocus(id: string): void;
  /** `Escape` closes, when open. Route it yourself: `x-tooltip` listens to no keys. */
  handleKeydown(id: string, event: KeyboardEvent): void;
  /**
   * Destroy the whole controller, every instance with it.
   *
   * Host-owned: nothing invokes it automatically. The `x-tooltip` directive
   * releases its own instance through `destroy(id)` when the element leaves the
   * tree, which is the path Alpine actually runs.
   */
  destroy(): void;
}

export interface CreateTooltipOptions {
  readonly id?: string;
  /** `$store` key — default {@link DEFAULT_TOOLTIP_STORE_KEY} (`"tooltip"`). */
  readonly storeKey?: string;
  /** `$tooltip` magic key — default {@link DEFAULT_TOOLTIP_MAGIC_KEY} (`"tooltip"`). */
  readonly magicKey?: string;
  /**
   * Alpine directive name, without the `x-` prefix, that attaches the
   * hover/focus behaviour to its own element and releases it when Alpine
   * removes that element. Defaults to
   * {@link DEFAULT_TOOLTIP_DIRECTIVE_KEY}, i.e. `x-tooltip="save-hint"`.
   *
   * Add `.sticky` to opt out of `closeOnScrollAway`. The hand-written
   * `$store.tooltip.bindTrigger(id, el)` remains available and unchanged.
   */
  readonly directiveKey?: string;
}

export const DEFAULT_TOOLTIP_DIRECTIVE_KEY = "tooltip";

export const DEFAULT_TOOLTIP_STORE_KEY = "tooltip";

export const DEFAULT_TOOLTIP_MAGIC_KEY = "tooltip";

export type TooltipAlpine = Alpine;

export type TooltipPluginCallback = (alpine: Alpine) => void;

export type TooltipControllerOptions = {
  /** Instance id. Generated when absent. */
  readonly id?: string;
};
