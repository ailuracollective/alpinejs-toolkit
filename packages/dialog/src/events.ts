import type { DialogChangeDetail, DialogCloseDetail, DialogOpenDetail } from "./types";

/**
 * `change` carries only `{ instanceId? }` and is the adapter-sync signal;
 * `open` and `close` are the two a consumer actually reacts to, and both carry
 * the `source` that produced them.
 */
export interface DialogEvents extends Record<string, unknown[]> {
  open: [DialogOpenDetail];
  close: [DialogCloseDetail];
  change: [DialogChangeDetail];
}
