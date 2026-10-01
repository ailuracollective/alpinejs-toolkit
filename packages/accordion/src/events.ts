import type { AccordionChangeDetail } from "./types";

/**
 * Single-key contract: every open, close, registration and teardown emits
 * `change` with the same {@link AccordionChangeDetail} payload, so a consumer
 * subscribes once and filters on `instanceId` rather than per action.
 */
export interface AccordionEvents extends Record<string, unknown[]> {
  change: [AccordionChangeDetail];
}
