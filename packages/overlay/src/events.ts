import type { OverlayChangeDetail } from "./types";

export interface OverlayEvents extends Record<string, unknown[]> {
  change: [OverlayChangeDetail];
}
