import type { PermissionSnapshot } from "./types";

export interface PermissionsEvents extends Record<string, unknown[]> {
  change: [{ name: string; snapshot: PermissionSnapshot | null }];
}
