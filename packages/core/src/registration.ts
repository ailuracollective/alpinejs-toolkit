/**
 * Plugin registration helpers: key resolution and typed store reads.
 *
 * Every plugin factory resolves the same two names from the same two option
 * keys and the same two package constants, then reads its store back off
 * Alpine. Both operations are pure and browser-global free, so they are safe
 * to call during server-side rendering.
 */
import type { Alpine } from "alpinejs";

/** The registration keys a plugin factory may override. */
export interface PluginKeyOptions {
  /** Name the store is registered under. */
  storeKey?: string;
  /** Name the magic is registered under. */
  magicKey?: string;
}

/** Resolved registration names, ready to hand to the guards. */
export interface ResolvedPluginKeys {
  storeKey: string;
  magicKey: string;
}

/**
 * Resolve the store and magic names a plugin registers under.
 *
 * The magic key follows the store key: renaming `storeKey` renames both, so
 * a single `storeKey` is enough to move a plugin out of a collided name. An
 * explicit `magicKey` wins over everything, including the resolved store key.
 *
 * @param options - Plugin options, possibly without either key.
 * @param defaultStoreKey - The package's `DEFAULT_*_STORE_KEY` constant.
 * @param defaultMagicKey - The package's `DEFAULT_*_MAGIC_KEY` constant.
 */
export function resolvePluginKeys(
  options: PluginKeyOptions,
  defaultStoreKey: string,
  defaultMagicKey: string
): ResolvedPluginKeys {
  const storeKey = options.storeKey ?? defaultStoreKey;
  const magicKey = options.magicKey ?? options.storeKey ?? defaultMagicKey;
  return { storeKey, magicKey };
}

/**
 * Resolve the store name a store-only plugin registers under.
 *
 * The store-only sibling of {@link resolvePluginKeys}, for plugins that expose
 * no magic and so have no second name to keep in step. An explicit `storeKey`
 * wins over the package default, including when it is an empty string: the
 * fallback is `??`, so only `undefined` and `null` hand control back to the
 * default — exactly as `resolvePluginKeys` resolves the same key.
 *
 * @param options - Plugin options, possibly without a `storeKey`.
 * @param defaultStoreKey - The package's `DEFAULT_*_STORE_KEY` constant.
 */
export function resolveStoreKey(options: { storeKey?: string }, defaultStoreKey: string): string {
  return options.storeKey ?? defaultStoreKey;
}

/**
 * Read a registered Alpine store, typed as `TStore` instead of `unknown`.
 *
 * `alpine.store(name)` is typed against the application's store map, which a
 * plugin cannot know, so call sites otherwise hand-write a cast. Returns
 * `undefined` when nothing is registered under `key` — a `sync` handler can
 * fire before `guardStore` has run.
 *
 * @param alpine - The Alpine instance handed to the plugin callback.
 * @param key - The resolved store name.
 */
export function readAlpineStore<TStore>(alpine: Alpine, key: string): TStore | undefined;
/**
 * Read a registered Alpine store, falling back to the base store literal.
 *
 * @param alpine - The Alpine instance handed to the plugin callback.
 * @param key - The resolved store name.
 * @param fallback - The store object the plugin is about to register, used
 *   until Alpine has wrapped it in a reactive proxy.
 */
export function readAlpineStore<TStore>(alpine: Alpine, key: string, fallback: TStore): TStore;
export function readAlpineStore<TStore>(
  alpine: Alpine,
  key: string,
  fallback?: TStore
): TStore | undefined {
  const read = alpine.store as (name: string) => TStore | undefined;
  return read.call(alpine, key) ?? fallback;
}
