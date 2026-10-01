/**
 * Not re-exported from `src/index.ts`, and nothing in `src/` imports this file.
 *
 * `DEFAULT_ADAPTER_ALPINE_STORE_KEY` and `DEFAULT_QUERY_STORE_KEY` in
 * `./plugin` are the same string (`"query"`), and `AdapterOptions` is a subset of
 * `QueryRegisterOptions`. The duplicates are dead weight, kept only so the
 * omission is a decision on the record rather than an accident: removing them is
 * an export-surface change, not a comment one.
 */
export type AdapterOptions = {
  storeKey?: string;
};

export const DEFAULT_ADAPTER_ALPINE_STORE_KEY = "query";
