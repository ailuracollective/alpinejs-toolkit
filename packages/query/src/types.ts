import type { LifecyclePhase } from "@ailura/alpinejs-core/controller";

export type QueryKey = readonly unknown[];
export type QueryFunctionContext = { signal: AbortSignal };
export type QueryFunction<TData = unknown> = (context: QueryFunctionContext) => Promise<TData>;
export type CoerceAnyToUnknown<T> = 0 extends 1 & T ? unknown : T;
export type InferQueryData<TQueryFn extends QueryFunction<unknown>> = CoerceAnyToUnknown<
  Awaited<ReturnType<TQueryFn>>
>;
export type QueryData<T> = CoerceAnyToUnknown<T>;
export type QueryDefinition<TKey extends QueryKey = QueryKey, TData = unknown> = {
  queryKey: TKey;
  queryFn: QueryFunction<TData>;
} & QueryOptions<TData>;
export type QueryStatus = "pending" | "error" | "success";
export type FetchStatus = "fetching" | "paused" | "idle";
export type MutationStatus = "idle" | "pending" | "error" | "success";

export interface QueryOptions<TData = unknown> {
  enabled?: boolean;
  staleTime?: number;
  retry?: number | boolean;
  initialData?: TData;
}

export interface QueryState<TData = unknown> {
  data: TData | undefined;
  error: Error | null;
  status: QueryStatus;
  fetchStatus: FetchStatus;
  dataUpdatedAt: number;
  errorUpdatedAt: number;
  readonly isPending: boolean;
  readonly isLoading: boolean;
  readonly isFetching: boolean;
  readonly isError: boolean;
  readonly isSuccess: boolean;
  readonly isStale: boolean;
  refetch(): Promise<void>;
}

export interface QueryObserver<TData = unknown> extends QueryState<TData> {
  readonly state: QueryState<TData>;
}

export interface MutationOptions<TData = unknown, TVariables = void, TContext = unknown> {
  mutationFn: (variables: TVariables) => Promise<TData>;
  onMutate?: (variables: TVariables) => Promise<TContext> | TContext;
  onSuccess?: (data: TData, variables: TVariables, context: TContext | undefined) => void;
  onError?: (error: Error, variables: TVariables, context: TContext | undefined) => void;
  onSettled?: (
    data: TData | undefined,
    error: Error | null,
    variables: TVariables,
    context: TContext | undefined
  ) => void;
}

export interface MutationState<TData = unknown, TVariables = void> {
  data: TData | undefined;
  error: Error | null;
  status: MutationStatus;
  readonly isIdle: boolean;
  readonly isPending: boolean;
  readonly isError: boolean;
  readonly isSuccess: boolean;
  mutate(variables: TVariables): Promise<TData>;
  reset(): void;
}

export interface QueryPluginOptions {
  defaultOptions?: {
    queries?: Partial<QueryOptions>;
    mutations?: { retry?: number | boolean };
  };
  /**
   * Name the query store is registered under, replacing `DEFAULT_QUERY_STORE_KEY`
   * (`"query"`). Renaming it also renames the magic, since the magic falls back
   * to the store key.
   */
  readonly storeKey?: string;
  /**
   * Name the query magic is registered under, replacing
   * `DEFAULT_QUERY_MAGIC_KEY` (`"query"`). Wins over `storeKey`.
   */
  readonly magicKey?: string;
}

export interface QueryClientOptions extends QueryPluginOptions {
  /**
   * Optional state backend. The controller keeps its own entries either way — the
   * adapter is a *sink* it publishes {@link QueryDevtoolsSnapshot}s into, not a
   * source it reads from — so omitting it changes nothing about the store, the
   * events or the per-query state. See `@ailura/alpinejs-query-adapter-alpine`.
   */
  adapter?: QueryStateAdapter;
}

export const DEFAULT_QUERY_STORE_KEY = "query";
export const DEFAULT_QUERY_MAGIC_KEY = DEFAULT_QUERY_STORE_KEY;

/**
 * One slot the adapter handed the controller. `destroy` is FINAL and IDEMPOTENT
 * by contract: once it has run, `get()` reports `undefined` and `set()` is
 * inert, so a released handle can never be resurrected. The adapter package
 * asserts exactly this of its own handles, and the controller holds itself to
 * the same rule.
 */
export type QueryStateHandle<TState = unknown> = {
  get: () => TState;
  set: (value: TState) => void;
  destroy: () => void;
};

/**
 * The backend the controller publishes its state into. Deliberately the shape
 * `createAlpineStoreAdapter()` already implements — `{ create(initial) →
 * { get, set, destroy } }` — so an adapter package needs no glue and no
 * version dance. `initial` is the controller's first snapshot; `create` is
 * called once, when the controller is constructed.
 *
 * The value is opaque here: the controller always publishes a
 * {@link QueryDevtoolsSnapshot}. An adapter that wants a different projection
 * owns that projection, not this contract.
 */
export type QueryStateAdapter = {
  create: (initial: unknown) => QueryStateHandle;
};

/**
 * An `Error` flattened to a plain pair. `JSON.stringify(new Error("x"))` is
 * `{}` — `message` is an own property but `name` lives on the prototype — so a
 * snapshot that kept the instance would silently drop the failure it is meant
 * to report.
 */
export type QueryDevtoolsError = { name: string; message: string };

/** One cache entry as a panel reads it: values, not getters. */
export type QueryDevtoolsEntry = {
  /** The caller's key array, by reference — the snapshot does not copy it. */
  key: QueryKey;
  /** The serialised form of `key`, and the entry's identity in the table. */
  keyHash: string;
  status: QueryStatus;
  fetchStatus: FetchStatus;
  /** The caller's data verbatim; a snapshot does not second-guess its shape. */
  data: unknown;
  error: QueryDevtoolsError | null;
  dataUpdatedAt: number;
  errorUpdatedAt: number;
  /** The entry's effective `staleTime` (`options.staleTime ?? 0`). */
  staleTime: number;
  /** Recomputed from `staleTime` and `dataUpdatedAt` at snapshot time. */
  isStale: boolean;
  enabled: boolean;
};

/** A mutation created by `mutate()`, from its first call onwards. */
export type QueryDevtoolsMutation = {
  id: number;
  status: MutationStatus;
  data: unknown;
  error: QueryDevtoolsError | null;
};

/**
 * A plain, serialisable read of the whole cache. No class instances, no
 * functions, no DOM — so a panel can `JSON.stringify()` it, ship it over a
 * socket or diff two of them. `data` is the one exception to "plain": it is the
 * caller's own value, copied by reference.
 */
export type QueryDevtoolsSnapshot = {
  /** The controller's lifecycle phase: `idle`, `mounted` or `destroyed`. */
  phase: LifecyclePhase;
  entries: QueryDevtoolsEntry[];
  mutations: QueryDevtoolsMutation[];
};

/**
 * The contract `store.devtools` exposes. Both members are real: `getSnapshot()`
 * always exists, and `subscribe()` hands back its own unsubscribe.
 */
export type QueryDevtoolsApi = {
  /** A fresh snapshot of the current cache state. Never a live reference. */
  getSnapshot(): QueryDevtoolsSnapshot;
  /**
   * Called with a fresh snapshot on every meaningful state change — a cache
   * entry moving, an entry appearing or leaving, a mutation settling. Returns an
   * unsubscribe; after `store.destroy()` no callback runs again.
   */
  subscribe(callback: (snapshot: QueryDevtoolsSnapshot) => void): () => void;
};

export interface QueryStore {
  readonly devtools: QueryDevtoolsApi;
  observe<TData>(
    key: QueryKey,
    queryFn: QueryFunction<TData>,
    options?: QueryOptions<TData>
  ): QueryObserver<TData>;
  observe<TQueryFn extends QueryFunction<unknown>, TData = InferQueryData<TQueryFn>>(
    key: QueryKey,
    queryFn: TQueryFn,
    options?: QueryOptions<TData>
  ): QueryObserver<TData>;
  observe<
    const TKey extends QueryKey,
    TQueryFn extends QueryFunction<unknown>,
    TData = InferQueryData<TQueryFn>,
  >(
    definition: { queryKey: TKey; queryFn: TQueryFn } & QueryOptions<TData>
  ): QueryObserver<TData>;
  fetch<TData>(
    key: QueryKey,
    queryFn: QueryFunction<TData>,
    options?: QueryOptions<TData>
  ): QueryState<TData>;
  fetch<TQueryFn extends QueryFunction<unknown>, TData = InferQueryData<TQueryFn>>(
    key: QueryKey,
    queryFn: TQueryFn,
    options?: QueryOptions<TData>
  ): QueryState<TData>;
  fetch<
    const TKey extends QueryKey,
    TQueryFn extends QueryFunction<unknown>,
    TData = InferQueryData<TQueryFn>,
  >(
    definition: { queryKey: TKey; queryFn: TQueryFn } & QueryOptions<TData>
  ): QueryState<TData>;
  /**
   * Read a cached entry without starting anything. `undefined` when the key has
   * never been observed, fetched, prefetched or hydrated with `initialData`.
   */
  get<TData>(key: QueryKey): QueryState<TData> | undefined;
  prefetch<TData>(
    key: QueryKey,
    queryFn: QueryFunction<TData>,
    options?: QueryOptions<TData>
  ): Promise<void>;
  prefetch<TQueryFn extends QueryFunction<unknown>, TData = InferQueryData<TQueryFn>>(
    key: QueryKey,
    queryFn: TQueryFn,
    options?: QueryOptions<TData>
  ): Promise<void>;
  prefetch<
    const TKey extends QueryKey,
    TQueryFn extends QueryFunction<unknown>,
    TData = InferQueryData<TQueryFn>,
  >(
    definition: { queryKey: TKey; queryFn: TQueryFn } & QueryOptions<TData>
  ): Promise<void>;
  /**
   * Refetch in the background. A bare `key`/`key[]` refetches those entries and
   * returns immediately; omitting it refetches everything currently cached.
   * Entries whose `enabled` is `false` are skipped, and an unknown key is
   * ignored rather than fetched.
   */
  invalidate(key?: QueryKey | QueryKey[]): void;
  /**
   * Drop entries from the cache. Omitting the key empties it. The next
   * `observe()`/`fetch()` for a removed key starts a brand-new entry, so
   * `staleTime` and `initialData` apply again.
   */
  remove(key?: QueryKey | QueryKey[]): void;
  /**
   * Write a cache entry directly — the optimistic-update path. Marks the entry
   * `success` and refreshes `dataUpdatedAt`, so `isStale` is recomputed from now.
   * **Silently does nothing for a key that is not cached**: use `observe()` with
   * `initialData` to create one.
   */
  setData<TData>(key: QueryKey, data: TData | ((current: TData | undefined) => TData)): void;
  /** Abort an in-flight request. Its result is discarded; the entry keeps its previous data. */
  cancel(key: QueryKey): void;
  /** Empty the whole cache. Identical to `remove()`. */
  reset(): void;
  /** Alias of `remove()` — the same drop, offered under the TanStack name. */
  resetQueries(key?: QueryKey | QueryKey[]): void;
  /** A no-op: a mutation lives in the object `mutate()` returned, and is discarded with it. */
  clearMutations(): void;
  destroy(): void;
  mutate<TData, TVariables = void, TContext = unknown>(
    options: MutationOptions<TData, TVariables, TContext>
  ): MutationState<QueryData<TData>, QueryData<TVariables>>;
}

export type QueryAlpine = unknown;
export type QueryPluginCallback = (alpine: unknown) => void;

/**
 * Options for `createQueryController`.
 *
 * One bag rather than `createQueryController(id, opts)`: the id was positional,
 * so configuring a client meant `createQueryController(undefined, opts)`.
 */
export type QueryControllerOptions = QueryOptions & {
  /** Controller id. Generated when absent. */
  readonly id?: string;
  /**
   * Optional state backend, handed to the adapter's `create()` once. Omit it and
   * the controller keeps every byte of state inside itself, exactly as before.
   */
  readonly adapter?: QueryStateAdapter;
};
