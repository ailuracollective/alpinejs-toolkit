import type { SidebarChangeDetail } from "./types";

export interface SidebarEvents extends Record<string, unknown[]> {
  change: [SidebarChangeDetail];
}
