import type { CommandItem } from "./types";

export interface CommandEvents extends Record<string, unknown[]> {
  open: [undefined];
  close: [undefined];
  run: [CommandItem];
  change: [undefined];
}
