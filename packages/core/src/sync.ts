/**
 * In-place record sync from a plain snapshot.
 *
 * Mutates `target` so it matches `snapshot` exactly: snapshot keys are
 * assigned (only when changed, to avoid useless reactive triggers) and keys
 * missing from the snapshot are deleted. In-place mutation keeps Alpine
 * reactive proxies intact — never replace the store object itself.
 */

/**
 * Sync `target` to match `snapshot` in place.
 *
 * @param target - Reactive record to update (e.g. an Alpine store).
 * @param snapshot - Plain data to copy from.
 * @returns The same `target` reference, for chaining.
 */
export function syncRecordFromSnapshot<T extends Record<string, unknown>>(
  target: T,
  snapshot: Readonly<Record<string, unknown>>
): T {
  const record = target as Record<string, unknown>;
  for (const key of Object.keys(snapshot)) {
    if (record[key] !== snapshot[key]) {
      record[key] = snapshot[key];
    }
  }
  for (const key of Object.keys(record)) {
    if (!(key in snapshot)) {
      delete record[key];
    }
  }
  return target;
}
