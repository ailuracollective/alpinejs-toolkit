import type { MediaChangeDetail } from "./types";

export interface MediaEvents extends Record<string, unknown[]> {
  change: [detail: MediaChangeDetail];
}
