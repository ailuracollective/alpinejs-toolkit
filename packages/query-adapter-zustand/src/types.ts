/**
 * Not re-exported from `src/index.ts`, and nothing in `src/` imports this file.
 *
 * The constant here is the same string as `DEFAULT_QUERY_STORE_KEY` in
 * `./plugin` (`"query"`), deliberately: it is the same store, so a host can
 * swap one adapter package for the other without renaming anything. Only the
 * name differs, and the name is what `apps/demo/test/helpers/package-surface.ts`
 * greps for (`DEFAULT_<PACKAGE>_STORE_KEY = "…"`), so a rename here would
 * silently unregister this package from the demo's key registry.
 */
export type AdapterOptions = {
  storeKey?: string;
};

export const DEFAULT_ADAPTER_ZUSTAND_STORE_KEY = "query";
