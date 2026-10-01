import type { ShortcutRegistration } from "./types";

export interface KeyboardEvents extends Record<string, unknown[]> {
  register: [ShortcutRegistration];
  unregister: [string];
  "scope:change": [{ active: string[]; suspended: string[] }];
  shortcut: [ShortcutRegistration, KeyboardEvent];
}
