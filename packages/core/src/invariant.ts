/**
 * Lightweight invariant helper.
 *
 * Every toolkit package throws its own messages through here, so the strings
 * exist once instead of once per call site. It is *not* stripped in
 * production today — a failed invariant is a real error, not a dev warning —
 * and a consumer can tree-shake the calls by aliasing this module.
 */

/** Asserts `condition` or throws with `message`. */
export function invariant(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}
