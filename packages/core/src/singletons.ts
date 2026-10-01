/**
 * Document-scoped (or explicit-scope) singletons.
 *
 * Instances are cached per scope so every caller within the same document
 * shares one instance, while server-side rendering — where no document
 * exists — gets a fresh scope per call and never leaks state across requests.
 */
import { safeDocument } from "./env";

/** Cache scope for singletons. Any object identity works (`document` by default). */
export type SingletonScope = object;

export interface SingletonOptions {
  /** Cache scope. Defaults to `document` when available, else a fresh object per call. */
  scope?: SingletonScope;
}

const registries = new WeakMap<SingletonScope, Map<string, unknown>>();
const trackedScopes = new Set<SingletonScope>();

/**
 * Get the cached singleton for `key`, creating it with `factory` on first use.
 *
 * @param key - Singleton key, unique within the scope.
 * @param factory - Creates the instance on first use within the scope.
 * @param options - Optional explicit scope.
 */
export function createSingleton<T>(key: string, factory: () => T, options?: SingletonOptions): T {
  const explicit = options?.scope;
  const fallbackDocument = safeDocument();
  const scope = explicit ?? fallbackDocument ?? {};
  let registry = registries.get(scope);
  if (!registry) {
    registry = new Map();
    registries.set(scope, registry);
  }
  // Track every scope except throwaway SSR defaults: an untracked fresh
  // object per call means no cross-request sharing and nothing to clear.
  if (explicit !== undefined || fallbackDocument !== undefined) trackedScopes.add(scope);
  if (!registry.has(key)) registry.set(key, factory());
  return registry.get(key) as T;
}

/**
 * Drop one cached singleton from a scope.
 *
 * @returns True when an entry was removed.
 */
export function releaseSingleton(key: string, scope?: SingletonScope): boolean {
  const resolved = scope ?? safeDocument();
  if (!resolved) return false;
  return registries.get(resolved)?.delete(key) ?? false;
}

/**
 * Clear cached singletons: one scope when given, otherwise every tracked scope.
 */
export function clearAllSingletons(scope?: SingletonScope): void {
  if (scope) {
    registries.get(scope)?.clear();
    return;
  }
  for (const tracked of trackedScopes) {
    registries.get(tracked)?.clear();
  }
}
