import type { OverlayStackEntry } from "./types";

/**
 * Refill `target` from `snapshot` without replacing the array.
 *
 * The identity has to survive: the store object is registered once with Alpine
 * and its `stack` property is what a template's `x-for` reads, so swapping in a
 * new array would leave the reactive binding pointing at the old one. Clearing
 * the length and pushing in place is the cheapest way to keep it.
 */
export function syncStack(
  target: OverlayStackEntry[],
  snapshot: readonly OverlayStackEntry[]
): void {
  target.length = 0;
  for (const e of snapshot) target.push(e);
}
