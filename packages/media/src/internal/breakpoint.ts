import type { MediaIntervals } from "../types";

export function resolveBreakpoint(width: number, intervals: MediaIntervals): string {
  const entries = Object.entries(intervals).sort((a, b) => a[1] - b[1]);
  let current = entries[0]?.[0] ?? "base";
  // Anything below the smallest interval is 'base'
  if (entries.length === 0) return "base";
  if (width < (entries[0]?.[1] ?? 0)) return "base";
  for (const [name, min] of entries) {
    if (width >= min) current = name;
  }
  return current;
}
