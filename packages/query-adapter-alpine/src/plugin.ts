import { guardStore } from "@ailura/alpinejs-core/guards";
import { QueryController } from "@ailura/alpinejs-query";
import type { Alpine } from "alpinejs";

export const DEFAULT_QUERY_STORE_KEY = "query";

const packageName = "@ailura/alpinejs-query-adapter-alpine";

export type QueryRegisterOptions = {
  /** `$store` key to register under. Default: {@link DEFAULT_QUERY_STORE_KEY}. */
  storeKey?: string;
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
 * Despite the name, this does not wire up the `QueryStateAdapter` in `./adapter`:
 * it builds a `QueryController` with no adapter and hands its `toStore()` to the
 * guard, so what gets registered is byte-for-byte what `queryPlugin()` from
 * `@ailura/alpinejs-query` registers. The reactive value box is opt-in and lives
 * on the other plugin — `queryPlugin({ adapter: createAlpineStoreAdapter(Alpine) })`
 * — because that is the call that has an Alpine instance to give it.
 *
 * What this plugin does add is `override: true`: the registration takes the name
 * from whoever holds it instead of throwing a `RegistrationError`. That is what
 * lets an app swap the store registration without unregistering the other one
 * first, and it is also why registering both plugins leaves the last one to run
 * in charge with no warning.
 */
export function createQueryPlugin(
  options: { storeKey?: string; defaultOptions?: unknown } = {}
): (alpine: Alpine) => void {
  const storeKey = options.storeKey ?? DEFAULT_QUERY_STORE_KEY;
  return function register(alpine: Alpine): void {
    const cache = new QueryController(undefined, options.defaultOptions as never);
    guardStore(alpine, storeKey, cache.toStore(), packageName, {
      override: true,
    } as never);
  };
}

/** Default export. Identical to {@link createQueryPlugin} — a naming alias, not a variant. */
export default function queryAdapterAlpine(
  options: QueryRegisterOptions = {}
): (alpine: Alpine) => void {
  return createQueryPlugin(options);
}

/**
 * The name the playground catalog advertises. Identical to
 * {@link createQueryPlugin}, and it takes fewer options: `defaultOptions` is not
 * in its parameter type, so passing one is a type error even though the call
 * would work.
 */
export function alpineStoreQueryPlugin(
  options: { storeKey?: string } = {}
): (alpine: Alpine) => void {
  return createQueryPlugin(options);
}
