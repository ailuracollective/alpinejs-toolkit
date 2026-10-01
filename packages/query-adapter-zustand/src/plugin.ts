import { guardStore } from "@ailura/alpinejs-core/guards";
import { resolveStoreKey } from "@ailura/alpinejs-core/registration";
import { QueryController } from "@ailura/alpinejs-query";
import type { QueryStateAdapter } from "@ailura/alpinejs-query";
import type { Alpine } from "alpinejs";

export const DEFAULT_QUERY_STORE_KEY = "query";

const packageName = "@ailura/alpinejs-query-adapter-zustand";

export type QueryRegisterOptions = {
  /** `$store` key to register under. Default: {@link DEFAULT_QUERY_STORE_KEY}. */
  storeKey?: string;
  /**
   * The state backend handed to the controller, normally an adapter from
   * `./adapter`. It is a sink the controller publishes snapshots into, never a
   * source it reads from, so the registered store is identical with or without
   * one. To observe the snapshots, build the adapter with a `create` option and
   * keep the stores it hands back: the singleton `zustandStoreAdapter` has no
   * injected creator and its stores are unreachable.
   */
  adapter?: QueryStateAdapter;
  /**
   * Forwarded verbatim as the controller's `QueryOptions` bag — `{ staleTime,
   * retry, enabled, initialData }`. Typed `unknown` here so this package does not
   * re-export `query`'s option types; there is no validation and no default
   * beyond the cache's own.
   */
  defaultOptions?: unknown;
};

/**
 * Register the query cache as `$store.<storeKey>`.
 *
 * The store itself is `QueryController.toStore()` — byte-for-byte what
 * `queryPlugin()` from `@ailura/alpinejs-query` registers. What makes this
 * plugin its own thing is `adapter`: it is forwarded to the controller, which
 * creates one handle and publishes a `QueryDevtoolsSnapshot` into it on every
 * change, so a zustand subscriber sees the cache over time instead of only
 * once. Pass an adapter from `./adapter` for that — one built with a `create`
 * option if you want to hold the stores; omit it and this registers the plain
 * store.
 *
 * No `override` here, unlike the sibling adapter's plugin: the registration
 * takes the name from whoever holds it, and a second registration of `"query"`
 * throws a `RegistrationError` rather than silently replacing the first. A host
 * that wants a different key passes `storeKey`, which is what lets this package
 * and `@ailura/alpinejs-query` coexist in one app without fighting over a name.
 */
export function createQueryPlugin(options: QueryRegisterOptions = {}): (alpine: Alpine) => void {
  const storeKey = resolveStoreKey(options, DEFAULT_QUERY_STORE_KEY);
  return function register(alpine: Alpine): void {
    const controller = new QueryController(
      undefined,
      options.defaultOptions as never,
      options.adapter
    );
    // No `change` listener and no magic: the store is a command surface, and
    // the adapter is where the observable per-change snapshots go. See the
    // matching note in `@ailura/alpinejs-query`'s own plugin.
    guardStore(alpine, storeKey, controller.toStore(), packageName);
  };
}

/** Default export. Identical to {@link createQueryPlugin} — a naming alias, not a variant. */
export default function queryAdapterZustand(
  options: QueryRegisterOptions = {}
): (alpine: Alpine) => void {
  return createQueryPlugin(options);
}

/**
 * A second name for {@link createQueryPlugin}, with a narrower options type:
 * neither `defaultOptions` nor `adapter` is in its parameter type, so passing
 * one is a type error even though the call would work. Nothing in the playground
 * catalog refers to this name — it is exported for hosts that already spell
 * their plugins that way, not as a registration that exists somewhere else.
 */
export function zustandStoreQueryPlugin(
  options: { storeKey?: string } = {}
): (alpine: Alpine) => void {
  return createQueryPlugin(options);
}
