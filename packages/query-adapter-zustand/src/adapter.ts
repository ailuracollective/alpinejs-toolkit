import type { QueryStateAdapter, QueryStateHandle } from "@ailura/alpinejs-query";
import { createStore } from "zustand/vanilla";
import type { StoreApi } from "zustand/vanilla";

/**
 * The handle this package hands out, described by `QueryStateHandle` from
 * `@ailura/alpinejs-query` rather than by a local copy of the shape.
 *
 * The sibling adapter re-declares the contract in its own file; that worked
 * while the controller had no real adapter type to check against. Now that
 * `query` owns the contract, importing it is the only version of this that
 * cannot drift: if `create()` here stops satisfying `QueryStateAdapter`, the
 * package fails to typecheck rather than failing silently at the call site.
 *
 * The two types are intentionally NOT re-exported from `src/index.ts`. The
 * contract belongs to `query`; a host that needs it imports it from there, and
 * a second name for it here would only give it two owners.
 */

/** The one key a handle holds: the latest snapshot the controller published. */
type ZustandSlot = { value: unknown };

/**
 * How a handle's store is allocated. `zustand`'s own `createStore` satisfies
 * this shape, so the default below is zustand's function, not a wrapper around
 * it — and a caller who supplies their own gets zustand's `StoreApi` back, with
 * `subscribe`, `getState` and `getInitialState` on it, rather than a type this
 * package invented.
 *
 * It is typed over the slot shape rather than over a free type parameter: the
 * slot is fixed by this package, so a creator promising any `T` would force
 * every caller to cast the stores it collects.
 */
export type ZustandStoreCreator = (initializer: () => ZustandSlot) => StoreApi<ZustandSlot>;

/** Arguments to {@link createZustandStoreAdapter}. */
export type ZustandStoreAdapterOptions = {
  /**
   * The store creator each handle is built from. Defaults to zustand's
   * `createStore`, in which case the store is private to the handle and nothing
   * outside it can subscribe.
   *
   * Pass your own to keep a reference to the store:
   *
   * ```ts
   * const stores: StoreApi<{ value: unknown }>[] = [];
   * const adapter = createZustandStoreAdapter({
   *   create: (initializer) => {
   *     const store = createStore(initializer);
   *     stores.push(store);
   *     return store;
   *   },
   * });
   * ```
   *
   * The handle itself is unchanged by this: `get`, `set` and `destroy` behave
   * identically either way, because only the allocation is swapped.
   */
  create?: ZustandStoreCreator;
};

/**
 * A {@link QueryStateAdapter} backed by one `zustand/vanilla` store per handle.
 *
 * The vanilla store is the right subpath here: it carries no React and no DOM,
 * so the module imports cleanly under SSR and the adapter keeps working in a
 * Node process with no `window`. `zustand` stays a peer, so the host owns the
 * single copy of it — this package ships the glue and zero bytes of zustand.
 *
 * The store is a SINK, exactly as in `@ailura/alpinejs-query-adapter-alpine`:
 * the controller creates one handle and `set()`s a fresh
 * `QueryDevtoolsSnapshot` into it on every change. Nothing here ever reads a
 * cache entry back out, and `createStore` is never wired to a component, so the
 * handle is a plain mutable box that a subscriber can watch — not a source of
 * truth about the cache.
 *
 * `create` exists because `QueryStateHandle` is `{ get, set, destroy }` and
 * cannot grow a `subscribe` member, and because the controller keeps the handle
 * in a private field with no accessor. Rather than widen the shared contract,
 * the store itself is made reachable: pass a `create` that hands the store
 * back to you and you hold the only object that can observe every publish.
 * That is the whole difference between an adapter whose sink is invisible and
 * one that is not.
 */
export function createZustandStoreAdapter(
  options: ZustandStoreAdapterOptions = {}
): QueryStateAdapter {
  // Resolved once per adapter, not per handle, so an injected creator is the
  // host's and cannot be swapped underneath a handle it already built.
  const createStoreFor: ZustandStoreCreator = options.create ?? createStore;
  return {
    create: (initial: unknown): QueryStateHandle => {
      const store = createStoreFor(() => ({ value: initial }));
      // The release flag is what makes `destroy` final and idempotent, and it
      // is separate from the state so clearing the slot cannot itself become a
      // path back to a live handle.
      let released = false;
      return {
        get: () => store.getState().value,
        set: (value: unknown) => {
          if (released) return;
          store.setState({ value });
        },
        // FINAL and idempotent, per the contract in `query`: the slot is
        // emptied so `get()` reports `undefined`, and `released` is latched so
        // a later `set()` — a late publish from a controller that is being torn
        // down at the same time — is dropped instead of resurrecting a handle
        // the caller already believes is released. Calling `destroy()` twice is
        // a no-op, not a throw. There is nothing else to unwind: a vanilla
        // store holds no listener of its own, and its subscribers are the
        // caller's to drop.
        destroy: () => {
          if (released) return;
          released = true;
          store.setState({ value: undefined });
        },
      };
    },
  };
}

/**
 * The ready-made adapter. One instance, no configuration: `create()` allocates a
 * fresh store per handle, so sharing the adapter is sharing nothing mutable.
 *
 * It has no injected creator, so its stores are unreachable — a host that
 * registers this singleton gets snapshots it cannot subscribe to. Call
 * {@link createZustandStoreAdapter} with a `create` option when observation is
 * the point.
 */
export const zustandStoreAdapter = createZustandStoreAdapter();

export default zustandStoreAdapter;
