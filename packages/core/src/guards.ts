/**
 * Collision-safe registration guards for Alpine stores, magics, and directives.
 *
 * Alpine silently overwrites duplicate registrations, which hides conflicts
 * between plugins. These guards track every registration per process and
 * throw a {@link RegistrationError} when a *different* package claims an
 * already-owned name. Re-registration by the same package (e.g. hot reload)
 * stays allowed; pass `{ override: true }` for an intentional takeover.
 */
import type { Alpine, DirectiveCallback, MagicUtilities, ElementWithXAttributes } from "alpinejs";

import { RegistrationError, type RegistrationKind } from "./errors";

export interface GuardOptions {
  /** Allow taking over a name owned by another package. */
  override?: boolean;
}

/** Magic callback signature, matching `Alpine.magic()`. */
export type MagicCallback = (el: ElementWithXAttributes, options: MagicUtilities) => unknown;

const owners = new Map<string, string>();

/**
 * `Alpine.store` is typed against the ambient `Stores` augmentation, so
 * `keyof Stores` is whatever the host program has declared. A guard takes an
 * arbitrary `name: string` — the whole point is to catch collisions on names
 * the compiler knows nothing about — and that stops matching the moment a host
 * augments `Stores`, which is exactly what the demo app does for its own
 * stores. Narrow the call locally instead: the cast is about Alpine's
 * declaration-merging ergonomics, not about the value.
 */
type AlpineStoreRegistrar = {
  store(name: string, value?: unknown): unknown;
};

function registerStore(alpine: Alpine, name: string, value?: unknown): unknown {
  return (alpine as unknown as AlpineStoreRegistrar).store(name, value);
}

/**
 * Normalize a directive name to kebab-case.
 *
 * Alpine matches `x-` attributes by exact string lookup and the HTML parser
 * lowercases attribute names, so a camelCase registration (e.g.
 * `myDirective`) would silently never match its `x-my-directive` markup.
 * Normalizing here keeps both spellings working identically.
 */
function toDirectiveKey(name: string): string {
  return name.replace(/([a-z])([A-Z])/g, "$1-$2").toLowerCase();
}

function claim(
  kind: RegistrationKind,
  name: string,
  packageName: string,
  options?: GuardOptions
): void {
  const key = `${kind}:${name}`;
  const owner = owners.get(key);
  if (owner === undefined || owner === packageName || options?.override === true) {
    owners.set(key, packageName);
    return;
  }
  throw new RegistrationError(kind, name, packageName, owner);
}

/**
 * Register an Alpine store, throwing on cross-package collisions.
 *
 * @returns The registered store proxy, via `Alpine.store(name)`.
 */
export function guardStore<TStore>(
  alpine: Alpine,
  name: string,
  value: TStore,
  packageName: string,
  options?: GuardOptions
): TStore {
  claim("store", name, packageName, options);
  registerStore(alpine, name, value);
  return registerStore(alpine, name) as TStore;
}

/** Register an Alpine magic, throwing on cross-package collisions. */
export function guardMagic(
  alpine: Alpine,
  name: string,
  callback: MagicCallback,
  packageName: string,
  options?: GuardOptions
): void {
  claim("magic", name, packageName, options);
  alpine.magic(name, callback);
}

/** Alpine's directive chain, returned by `alpine.directive()`. */
export type DirectiveChain = { before(directive: string): void };

/**
 * Register an Alpine directive, throwing on cross-package collisions.
 *
 * @returns Alpine's directive chain, so a caller can order itself against
 *   another directive with `before()`. The chain is returned rather than
 *   discarded because `Alpine.directive()` returns it and no other way to
 *   reach it exists — a caller that casts the return to a chain object gets
 *   `undefined` and silently never runs its ordering request.
 */
export function guardDirective(
  alpine: Alpine,
  name: string,
  callback: DirectiveCallback,
  packageName: string,
  options?: GuardOptions
): DirectiveChain {
  const key = toDirectiveKey(name);
  claim("directive", key, packageName, options);
  return alpine.directive(key, callback);
}

/**
 * Forget all tracked registrations. Intended for tests that register the
 * same names repeatedly with different owner packages.
 *
 * Wired into the `@ailura/alpinejs-testing` lifecycle via `onReset` in
 * `test/setup.ts`, so `reset()` clears tracking automatically and dom tests
 * need no manual call.
 */
export function resetRegistrationTracking(): void {
  owners.clear();
}
