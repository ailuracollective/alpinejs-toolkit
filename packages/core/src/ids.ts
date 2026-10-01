/**
 * Monotonic unique id generator.
 *
 * Each call increments a module-level counter and renders it in base-36,
 * so ids are short, ordered, and unique within the process.
 */

let counter = 0;

/**
 * Generate a unique id with the given prefix.
 *
 * @param prefix - Prefix placed before the base-36 counter (default `"id"`).
 */
export function generateId(prefix = "id"): string {
  counter += 1;
  return `${prefix}-${counter.toString(36)}`;
}

/**
 * Reset the id counter. Intended for tests that assert exact ids.
 */
export function resetIdCounter(): void {
  counter = 0;
}
