/**
 * Type-only module: it imports nothing at runtime, so a consumer can reach for
 * `AccordionStore` or `AccordionOptions` without pulling in the controller.
 */

import type { Alpine } from "alpinejs";

export type AccordionMode = "single" | "multiple";

export type AccordionItem = {
  id: string;
  disabled: boolean;
};

export type AccordionOptions = {
  readonly mode?: AccordionMode;
  /** Item id or ids open on init. In `single` mode only the first id is used. */
  readonly defaultOpen?: string | string[];
  readonly onChange?: (openIds: string[]) => void;
};

/** One accordion's state as the store exposes it. */
export type AccordionInstance = {
  mode: AccordionMode;
  open: Record<string, boolean>;
  activeItemId: string | null;
  items: AccordionItem[];
  defaultOpen: string[];
  onChange?: (openIds: string[]) => void;
};

export type AccordionChangeSource = "user" | "initialization";

export interface AccordionChangeDetail {
  readonly instanceId: string;
  readonly openIds: string[];
  readonly source: AccordionChangeSource;
}

/**
 * The Alpine-facing surface. Every method that exists here is
 * `$store.accordion.<name>`, and each one is safe to call on an accordion that
 * was never registered — it returns a falsy value instead of throwing.
 */
export interface AccordionStore {
  readonly instances: Record<string, AccordionInstance>;
  /** Create an accordion. Re-creating an id replaces it. */
  create(accordionId: string, options?: AccordionOptions): void;
  /**
   * Destroy ONE accordion, or the whole controller with no argument.
   *
   * The overload is the store's, mirroring `AccordionController.destroy`. Both
   * arities are reachable through one key so `store.destroy(id)` cannot be
   * confused with `store.destroy()`.
   */
  destroy(accordionId: string): void;
  destroy(): void;
  /** Destroy every accordion. */
  destroyAll(): void;
  /**
   * Register an item, creating its accordion on the way if none exists.
   *
   * This is the one entry point that needs no `create()` first, which makes it
   * the safe way to build a group from a list of ids.
   */
  createItem(accordionId: string, itemId: string, disabled?: boolean): void;
  destroyItem(accordionId: string, itemId: string): void;
  /**
   * No-ops for an unknown accordion, an unknown item or a disabled one, so a
   * `toggle()` on an accordion nobody created is silent rather than loud. Call
   * `create()` (or `createItem()`) first if the group is not guaranteed.
   */
  open(accordionId: string, itemId: string): void;
  close(accordionId: string, itemId: string): void;
  toggle(accordionId: string, itemId: string): void;
  isOpen(accordionId: string, itemId: string): boolean;
  openIds(accordionId: string): string[];
  activeItem(accordionId: string): string | null;
  setActiveItem(accordionId: string, itemId: string | null): void;
  handleKeydown(accordionId: string, event: KeyboardEvent): void;
  /**
   * `aria-expanded`, `aria-controls`, the trigger `id` and the roving
   * `tabindex`. Alpine applies an object-form `x-bind` exactly once, so the
   * roving `tabindex` in here freezes at its initial value — bind that one
   * per attribute with `x-bind:tabindex` or `:tabindex` instead.
   */
  triggerProps(
    accordionId: string,
    itemId: string
  ): Record<string, string | number | boolean | undefined>;
  panelProps(accordionId: string, itemId: string): Record<string, string | boolean | undefined>;
}

export interface CreateAccordionOptions {
  readonly id?: string;
  /**
   * `$store` key the Alpine plugin registers under. Defaults to
   * {@link DEFAULT_ACCORDION_STORE_KEY}. Set when the host already
   * owns an `accordion` store or another toolkit plugin would
   * collide on that name — the rename avoids the collision without
   * touching the controller. Ignored by the standalone
   * `createAccordionController` factory.
   */
  readonly storeKey?: string;
}

export const DEFAULT_ACCORDION_STORE_KEY = "accordion";

export type AccordionAlpine = Alpine;

export type AccordionPluginCallback = (alpine: Alpine) => void;

export type AccordionControllerOptions = {
  /** Instance id. Generated when absent. */
  readonly id?: string;
};
