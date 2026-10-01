import type { QueryStateAdapter, QueryStateHandle } from "@ailura/alpinejs-query";
import { atom } from "nanostores";
import type { WritableAtom } from "nanostores";

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

/**
 * How a handle's store is allocated. `nanostores`' own `atom` satisfies this
 * shape, so the default below is `atom` itself, not a wrapper around it — and a
 * caller who supplies their own gets a real `WritableAtom` back, with
 * `subscribe`, `get` and `set` on it, rather than a type this package invented.
 *
 * The value type is nanostores', not a local one: the handle is a box that
 * already holds an opaque `QueryDevtoolsSnapshot`, and the only thing this
 * package needs of a store is the four members `WritableAtom` declares. Naming
 * them locally would be a re-declaration that could drift from nanostores'
 * own surface, and would force a cast at the `atom` assignment.
 *
 * The creator is generic over the value rather than fixed to `unknown`, so a
 * caller's own creator keeps the concrete type it produced: collecting
 * `WritableAtom<Snapshot>[]` in a devtools panel needs no annotation to survive
 * this parameter, while `atom` itself is assignable to it as-is — its parameter
 * accepts `[Value]` and it returns `PreinitializedWritableAtom<Value>`, which is
 * a `WritableAtom<Value>`.
 */
export type NanostoresStoreCreator = <Value>(initial: Value) => WritableAtom<Value>;

/** Arguments to {@link createNanostoresStoreAdapter}. */
export type NanostoresStoreAdapterOptions = {
  /**
   * The store creator each handle is built from. Defaults to nanostores' own
   * `atom`, in which case the store is private to the handle and nothing
   * outside it can subscribe.
   *
   * Pass your own to keep a reference to the store:
   *
   * ```ts
   * const stores: WritableAtom<unknown>[] = [];
   * const adapter = createNanostoresStoreAdapter({
   *   create: (initial) => {
   *     const store = atom(initial);
   *     stores.push(store);
   *     return store;
   *   },
   * });
   * ```
   *
   * The handle itself is unchanged by this: `get`, `set` and `destroy` behave
   * identically either way, because only the allocation is swapped.
   */
  create?: NanostoresStoreCreator;
};

/**
 * A {@link QueryStateAdapter} backed by one nanostores `atom` per handle.
 *
 * `atom`, not `map`: the handle publishes one value — the latest snapshot — and
 * nothing derives from it inside this package. `map` is for a store whose keys
 * change, and a `{ value }` wrapper object would only add a second shape for a
 * subscriber to unwrap. A plain atom is already a live observable box: every
 * `set` notifies whoever subscribed, which is exactly the property that makes
 * this adapter worth choosing over a sibling that hides its sink.
 *
 * `nanostores` stays a peer, so the host owns the single copy of it — this
 * package ships the glue and zero bytes of nanostores.
 *
 * The store is a SINK, exactly as in `@ailura/alpinejs-query-adapter-alpine`:
 * the controller creates one handle and `set()`s a fresh
 * `QueryDevtoolsSnapshot` into it on every change. Nothing here ever reads a
 * cache entry back out, and no store is wired to a component, so the handle is
 * an observable box that a subscriber can watch — not a source of truth about
 * the cache.
 *
 * `create` exists because `QueryStateHandle` is `{ get, set, destroy }` and
 * cannot grow a `subscribe` member, and because the controller keeps the handle
 * in a private field with no accessor. Rather than widen the shared contract,
 * the store itself is made reachable: pass a `create` that hands the store back
 * to you and you hold the only object that can observe every publish. That is
 * the whole difference between an adapter whose sink is invisible and one that
 * is not.
 */
export function createNanostoresStoreAdapter(
  options: NanostoresStoreAdapterOptions = {}
): QueryStateAdapter {
  // Resolved once per adapter, not per handle, so an injected creator is the
  // host's and cannot be swapped underneath a handle it already built.
  const createStoreFor: NanostoresStoreCreator = options.create ?? atom;
  return {
    create: (initial: unknown): QueryStateHandle => {
      const store = createStoreFor(initial);
      // nanostores has no `destroy()`, and its `off()` is a hook it redefines
      // in `onMount` — on a plain atom it does nothing at all. So the handle
      // owns the one binding it can actually drop: this `listen` call, whose
      // unbind is the only teardown primitive nanostores hands out per store.
      //
      // It is not a placeholder. A nanostores store is *mounted* by its
      // listeners, and an unmounted store is allowed to read back `undefined`
      // from `get()` — so a handle that never listened would be reading the
      // value of a store it had left unmounted, and its final `set(undefined)`
      // on release would travel no notification path at all. Holding one
      // listener keeps the store live for as long as the handle is, which is
      // what makes `get()` honest and makes the last publish observable.
      const detach = store.listen(() => {});
      // The release flag is what makes `destroy` final and idempotent, and it
      // is separate from the state so blanking the store cannot itself become
      // a path back to a live handle.
      let released = false;
      return {
        get: () => (released ? undefined : store.get()),
        set: (value: unknown) => {
          if (released) return;
          store.set(value);
        },
        // FINAL and idempotent, per the contract in `query`: the store is
        // blanked so a read of the atom itself agrees with the handle, and
        // `released` is latched so a later `set()` — a late publish from a
        // controller that is being torn down at the same time — is dropped
        // instead of resurrecting a handle the caller already believes is
        // released. Calling `destroy()` twice is a no-op, not a throw.
        //
        // The unbind runs last, and it is the only listener the handle ever
        // registered: a caller who called `store.subscribe` holds its own
        // binding and remains the one to call it. What survives a released
        // handle is therefore nothing of this package's.
        destroy: () => {
          if (released) return;
          released = true;
          store.set(undefined);
          detach();
        },
      };
    },
  };
}

/**
 * The ready-made adapter. One instance, no configuration: `create()` allocates a
 * fresh atom per handle, so sharing the adapter is sharing nothing mutable.
 *
 * It has no injected creator, so its stores are unreachable — a host that
 * registers this singleton gets snapshots it cannot subscribe to. Call
 * {@link createNanostoresStoreAdapter} with a `create` option when observation
 * is the point.
 */
export const nanostoresStoreAdapter = createNanostoresStoreAdapter();

export default nanostoresStoreAdapter;
