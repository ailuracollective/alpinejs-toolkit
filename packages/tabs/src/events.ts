import type { TabsChangeDetail } from "./types";

/**
 * Single-key contract: selection, registration, orientation and teardown all
 * emit `change` with the same {@link TabsChangeDetail} payload, so a consumer
 * subscribes once and filters on `instanceId`.
 */
export interface TabsEvents extends Record<string, unknown[]> {
  change: [TabsChangeDetail];
}
