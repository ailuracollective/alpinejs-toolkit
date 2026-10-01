/**
 * Shared runtime internals (not part of the public barrel).
 *
 * `runLifo` backs every LIFO teardown in the package (cleanup stacks and
 * bridge dispose functions) so the drain-and-rethrow logic exists once in
 * the bundle. The input array is never mutated: callers that must empty
 * their own list (e.g. `CleanupStack`) drain it before calling.
 */
export function runLifo(cleanups: ReadonlyArray<() => void>): void {
  let failed = false;
  let firstError: unknown;
  for (let index = cleanups.length - 1; index >= 0; index -= 1) {
    try {
      cleanups[index]();
    } catch (error) {
      if (!failed) {
        failed = true;
        firstError = error;
      }
    }
  }
  if (failed) throw firstError;
}
