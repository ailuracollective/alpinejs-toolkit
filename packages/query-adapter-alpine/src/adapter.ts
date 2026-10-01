import type { Alpine } from "alpinejs";

/**
 * The value-box contract: one `create()` per value, and the returned handle is
 * the only way to read or write it.
 *
 * This is the shape `@ailura/alpinejs-query` consumes as
 * `QueryClientOptions.adapter`, and it is deliberately the same shape rather than
 * a variant: the controller calls `create()` once and then `set()`s a fresh
 * `QueryDevtoolsSnapshot` into the returned handle on every change. The slot is a
 * SINK — nothing here ever reads a cache entry back out of it.
 */
export type QueryStateAdapter = {
  create: (initial: unknown) => {
    get: () => unknown;
    set: (v: unknown) => void;
    destroy: () => void;
  };
};

/**
 * Wrap a value in one `Alpine.reactive` box, so a template bound to the box
 * re-renders when the value changes.
 *
 * That is exactly what a `QueryController` needs for its `adapter` option: it
 * publishes a snapshot object on every change, and a box is what makes a
 * template reading that object update. `createAlpineStoreAdapter(Alpine)` is not
 * a reactive *store* and does not make the cache's per-query entries reactive —
 * it holds one value, the latest snapshot.
 *
 * `Alpine` is a parameter rather than an import: the factory is pure, has no
 * side effect at import time, and works with any host that exposes `reactive()`.
 */
export function createAlpineStoreAdapter(Alpine: Alpine): QueryStateAdapter {
  return {
    create: (initial: unknown) => {
      // The Alpine.reactive box is the single holder of the value. A second
      // plain copy alongside it would be invisible to Alpine and free to drift
      // from what a template bound to the box sees, so there is only one.
      let reactive = (Alpine as unknown as { reactive: (o: unknown) => unknown }).reactive({
        value: initial,
      }) as { value: unknown } | null;
      return {
        get: () => reactive?.value,
        set: (v: unknown) => {
          if (!reactive) return;
          reactive.value = v;
        },
        // The adapter owns exactly one thing — the reactive box — and what it
        // pins is the caller's value. `destroy` empties the box and drops the
        // adapter's reference to it, which is the whole release available
        // here: there is no controller, listener or timer behind a value box
        // to unwind. It is final, like every other `destroy` in the toolkit, so
        // `get()` reports `undefined` and `set()` is inert afterwards.
        destroy: () => {
          if (!reactive) return;
          reactive.value = undefined;
          reactive = null;
        },
      };
    },
  };
}
