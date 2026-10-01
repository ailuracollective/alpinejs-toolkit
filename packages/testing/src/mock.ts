/**
 * A minimal fake `Alpine` for registration-only tests.
 *
 * A plugin's registration callback touches several surfaces at once — store,
 * magic, and now directive — so a hand-written stub that implements only the
 * one a test cares about throws `x.directive is not a function` the moment the
 * package grows a directive, in a test that has nothing to do with directives.
 * {@link createMockAlpine} records all three, so adding a registration to a
 * plugin never breaks an unrelated test.
 *
 * Test-only: like the rest of this package it must never be imported from
 * plugin runtime code.
 */
import type { Alpine, DirectiveCallback } from "alpinejs";

/** Magic callback signature, matching `Alpine.magic()`. */
export type MockMagicCallback = (
  el: Parameters<Alpine["magic"]>[1] extends never ? never : Element,
  options: unknown
) => unknown;

export interface MockAlpine {
  /** The fake, cast to `Alpine` for passing to a plugin. */
  alpine: Alpine;
  /** Registered stores, by key. */
  stores: Map<string, unknown>;
  /** Registered magic callbacks, by key. */
  magics: Map<string, MockMagicCallback>;
  /** Registered directive callbacks, by key. */
  directives: Map<string, DirectiveCallback>;
}

/**
 * Create a fake Alpine that records registrations instead of performing them.
 *
 * `Alpine.store(name, value)` writes, `Alpine.store(name)` reads — matching the
 * real API's overloads, which is what `guardStore` relies on.
 */
export function createMockAlpine(): MockAlpine {
  const stores = new Map<string, unknown>();
  const magics = new Map<string, MockMagicCallback>();
  const directives = new Map<string, DirectiveCallback>();
  const alpine = {
    store(name: string, value?: unknown) {
      if (value !== undefined) {
        stores.set(name, value);
        return;
      }
      return stores.get(name);
    },
    magic(name: string, callback: MockMagicCallback) {
      magics.set(name, callback);
    },
    directive(name: string, callback: DirectiveCallback) {
      directives.set(name, callback);
      // Alpine returns a chain object with `before`; `guardDirective` hands it
      // back to callers, so the fake has to too.
      return { before: () => {} };
    },
  } as unknown as Alpine;
  return { alpine, stores, magics, directives };
}
