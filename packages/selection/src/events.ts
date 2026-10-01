import type { SelectionKey, SelectionMode, SelectionValue } from "./types";

export interface SelectionChangeDetail {
  readonly id: string;
  readonly mode: SelectionMode;
  readonly value: SelectionValue;
  readonly selectedKeys: readonly SelectionKey[];
  readonly previous: SelectionValue;
}

/**
 * Detail payload for the `destroy` event.
 *
 * Separate from `change` because a `change` detail describes the instance's
 * state, and by the time a destroy is announced there is no state left to
 * describe. Without its own event there is no way to tell a listener that the
 * id is gone.
 */
export interface SelectionDestroyDetail {
  readonly id: string;
}

export interface SelectionEvents extends Record<string, unknown[]> {
  change: [detail: SelectionChangeDetail];
  destroy: [detail: SelectionDestroyDetail];
}
