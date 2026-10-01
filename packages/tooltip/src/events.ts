import type { TooltipChangeDetail } from "./types";

/**
 * Single-key contract: opening, closing, registration and teardown all emit
 * `change` with the same {@link TooltipChangeDetail} payload, which carries
 * the resulting `open` state as well as the id.
 */
export interface TooltipEvents extends Record<string, unknown[]> {
  change: [TooltipChangeDetail];
}
