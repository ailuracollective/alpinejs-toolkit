import type { ToastChangeDetail } from "./types";

export interface ToastEvents extends Record<string, unknown[]> {
  change: [ToastChangeDetail];
}
