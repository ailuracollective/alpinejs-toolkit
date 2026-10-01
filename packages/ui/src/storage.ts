/**
 * Generic storage adapter factories shared across the toolkit.
 *
 * Each factory returns a {@link import("./types").StorageAdapter}
 * whose value type is pinned by the caller. Feature packages compose
 * these factories into their own typed adapters instead of
 * re-deriving the SSR-safe read / write / subscribe dance from
 * scratch.
 */

import { safeWindow } from "@ailura/alpinejs-core/env";

import type {
  LocalStorageAdapterOptions,
  MemoryAdapterOptions,
  SubscribableStorageAdapter,
  Unsubscribe,
} from "./types";

/**
 * Reads `key` from `window.localStorage`. Returns `null` on SSR,
 * storage errors, or when `parse()` rejects the raw value.
 */
function readLocalStorage<Value>(key: string, parse: (raw: string) => Value | null): Value | null {
  const win = safeWindow();
  if (!win) {
    return null;
  }
  try {
    const raw = win.localStorage.getItem(key);
    if (raw === null) {
      return null;
    }
    return parse(raw);
  } catch {
    return null;
  }
}

/** Writes `value` to `window.localStorage`. Best-effort — never throws. */
function writeLocalStorage<Value>(
  key: string,
  value: Value,
  serialize: (value: Value) => string
): void {
  const win = safeWindow();
  if (!win) {
    return;
  }
  try {
    win.localStorage.setItem(key, serialize(value));
  } catch {
    // SecurityError (Safari private mode), quota exceeded, etc.
    // Persistence is best-effort — fail silently so the consumer stays alive.
  }
}

/** Removes `key` from `window.localStorage`. Best-effort — never throws. */
function removeLocalStorage(key: string): void {
  const win = safeWindow();
  if (!win) {
    return;
  }
  try {
    win.localStorage.removeItem(key);
  } catch {
    // Same rationale as `set`: a blocked or absent store must not take the
    // consumer down with it.
  }
}

/**
 * Subscribes to cross-tab `storage` events for `key`. Returns a
 * no-op cleanup under SSR. Filters out events for unrelated keys
 * and values that `parse()` rejects, so a different feature sharing
 * a key prefix cannot poison this adapter.
 *
 * Forwards `null` when the key was removed in the other tab so the
 * listener can distinguish a clear from a write.
 */
function subscribeLocalStorage<Value>(
  key: string,
  parse: (raw: string) => Value | null,
  listener: (next: Value | null) => void
): Unsubscribe {
  const win = safeWindow();
  if (!win) {
    return () => undefined;
  }
  const onStorage = (event: StorageEvent): void => {
    if (event.key !== key) {
      return;
    }
    if (event.newValue === null) {
      listener(null);
      return;
    }
    const parsed = parse(event.newValue);
    if (parsed !== null) {
      listener(parsed);
    }
  };
  win.addEventListener("storage", onStorage);
  return () => {
    win.removeEventListener("storage", onStorage);
  };
}

/**
 * Builds a {@link SubscribableStorageAdapter} backed by
 * `window.localStorage`.
 *
 * `parse` is the validation gate — invalid stored values (whether
 * because `localStorage` was hand-edited or because a third-party
 * script wrote garbage to the same key) come back as `null`. The
 * caller decides what the fallback is.
 *
 * `subscribe` is ALWAYS present on the returned adapter. When
 * `crossTab === false` it returns a no-op unsubscribe function
 * without registering a `window` listener, so consumers can rely
 * on the member existing regardless of cross-tab preference.
 *
 * Reads go through `window.localStorage` (no-op under SSR). Writes
 * are wrapped in try/catch so Safari private mode /
 * `SecurityError` failures degrade silently. `subscribe()` wires
 * the cross-browser `storage` event so other tabs' updates flow
 * into the local adapter.
 */
export function createLocalStorageAdapter<Value>(
  options: LocalStorageAdapterOptions<Value>
): SubscribableStorageAdapter<Value> {
  const { key, parse, serialize } = options;
  const crossTab = options.crossTab !== false;

  return {
    get: () => readLocalStorage(key, parse),
    set: (value) => writeLocalStorage(key, value, serialize),
    remove: () => removeLocalStorage(key),
    subscribe: (listener) =>
      crossTab ? subscribeLocalStorage(key, parse, listener) : () => undefined,
  };
}

/**
 * Builds a hermetic {@link SubscribableStorageAdapter} backed by an
 * in-process `Value | null` cell. Useful for tests that need a
 * hermetic storage layer and SSR / server-side flows that want to
 * seed a controller with a precomputed value.
 *
 * Holds a single `Value | null` cell. The `subscribe()` hook fires
 * whenever the value changes, so cross-instance observers can chain
 * it. Cross-tab sync is intentionally NOT supported — in-memory
 * state does not survive a reload.
 *
 * `remove()` emits `null` so consumers can distinguish "the storage
 * was cleared" from "a new value was set".
 *
 * @param options.initial - Seed value. `null` (default) leaves the
 *   storage empty.
 */
export function createMemoryAdapter<Value>(
  options: MemoryAdapterOptions<Value> = {}
): SubscribableStorageAdapter<Value> {
  const initial = options.initial ?? null;
  let value: Value | null = initial;
  const listeners = new Set<(next: Value | null) => void>();

  return {
    get(): Value | null {
      return value;
    },
    set(next: Value): void {
      value = next;
      for (const listener of listeners) {
        listener(next);
      }
    },
    remove(): void {
      if (value === null) {
        return;
      }
      value = null;
      for (const listener of listeners) {
        listener(null);
      }
    },
    subscribe(listener: (next: Value | null) => void): Unsubscribe {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}
