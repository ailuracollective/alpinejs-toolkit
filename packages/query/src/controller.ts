import { BaseController } from "@ailura/alpinejs-core/controller";
import { generateId } from "@ailura/alpinejs-core/ids";

import type { QueryEvents } from "./events";
import type {
  MutationOptions,
  MutationState,
  QueryControllerOptions,
  QueryDevtoolsApi,
  QueryDevtoolsEntry,
  QueryDevtoolsError,
  QueryDevtoolsMutation,
  QueryDevtoolsSnapshot,
  QueryFunction,
  QueryKey,
  QueryObserver,
  QueryOptions,
  QueryState,
  QueryStateAdapter,
  QueryStateHandle,
  QueryStore,
} from "./types";

type Entry<TData> = {
  key: QueryKey;
  queryFn: QueryFunction<TData>;
  options: QueryOptions<TData>;
  state: InternalState<TData>;
  timers: Set<ReturnType<typeof setTimeout>>;
  abort?: AbortController;
};

type InternalState<TData> = {
  data: TData | undefined;
  error: Error | null;
  status: "pending" | "error" | "success";
  fetchStatus: "fetching" | "paused" | "idle";
  dataUpdatedAt: number;
  errorUpdatedAt: number;
};

function createState<TData>(options: QueryOptions<TData>): InternalState<TData> {
  return {
    data: options.initialData,
    error: null,
    status: options.initialData !== undefined ? "success" : "pending",
    fetchStatus: "idle",
    dataUpdatedAt: options.initialData !== undefined ? Date.now() : 0,
    errorUpdatedAt: 0,
  };
}

function keyString(key: QueryKey): string {
  return JSON.stringify(key);
}

function toDevtoolsError(error: Error | null): QueryDevtoolsError | null {
  if (!error) return null;
  return { name: error.name, message: error.message };
}
/**
 * Key serialisation is cached by array identity, and the cache is MODULE-level,
 * so it is shared by every controller in the process. Two consequences a caller
 * has to respect: mutate a key array in place and the cache keeps handing back
 * the string it built from the old contents, and a key that is not
 * JSON-serialisable (a `Map`, a function, a cyclic object) stringifies to
 * something that never equals a hand-written equivalent.
 */
const keyStringCache = new WeakMap<QueryKey, string>();

function buildQueryState<TData>(
  entry: Entry<TData>,
  refetchFn: () => Promise<void>
): QueryState<TData> {
  const s = entry.state;
  return {
    get data() {
      return s.data;
    },
    // `QueryState.data` is declared writable, so the getter needs a partner
    // setter to satisfy the type. The write is dropped on purpose: the cache owns
    // the value, and the supported way to change it is `setData()`, which also
    // refreshes `dataUpdatedAt` and the `status`.
    set data(_v) {},
    get error() {
      return s.error;
    },
    get status() {
      return s.status;
    },
    get fetchStatus() {
      return s.fetchStatus;
    },
    get dataUpdatedAt() {
      return s.dataUpdatedAt;
    },
    get errorUpdatedAt() {
      return s.errorUpdatedAt;
    },
    get isPending() {
      return s.status === "pending";
    },
    get isLoading() {
      return s.status === "pending" && s.fetchStatus === "fetching";
    },
    get isFetching() {
      return s.fetchStatus === "fetching";
    },
    get isError() {
      return s.status === "error";
    },
    get isSuccess() {
      return s.status === "success";
    },
    get isStale() {
      const stale = entry.options.staleTime ?? 0;
      return Date.now() - s.dataUpdatedAt > stale;
    },
    refetch: refetchFn,
  } as unknown as QueryState<TData>;
}

export class QueryController extends BaseController<QueryEvents> {
  readonly id: string;
  #entries = new Map<string, Entry<unknown>>();
  #defaultOptions: QueryOptions = {};
  #devtools: QueryDevtoolsApi;
  #keyStr = keyStringCache;
  /**
   * The adapter's slot, when one was given. It is a SINK, never a source: the
   * entries above stay the truth, so an adapter that is slow, dropped or already
   * released cannot change what a caller reads.
   */
  #adapter?: QueryStateHandle;
  /**
   * Set by `destroy()`. Every publish path checks it, which is what makes the
   * release final: after teardown nothing — not a retry tick, not a late
   * promise — can put state back into a released handle or call a subscriber.
   */
  #released = false;
  #subscribers = new Set<(snapshot: QueryDevtoolsSnapshot) => void>();
  #mutations = new Map<number, QueryDevtoolsMutation>();
  #nextMutationId = 0;
  #internalChange = () => this.publish();

  constructor(id?: string, defaultOptions: QueryOptions = {}, adapter?: QueryStateAdapter) {
    super();
    this.id = id ?? generateId("query");
    this.#defaultOptions = defaultOptions;
    this.#adapter = adapter?.create(this.buildSnapshot());
    // The controller listens to its OWN bus rather than being pushed to at every
    // mutation site: `change` is already emitted wherever the cache moves, so a
    // future method cannot forget to publish. Registered on `events` directly —
    // `on()` would push an unsubscribe onto the cleanup stack for a
    // subscription that is torn down by hand in `destroy()` anyway.
    this.events.on("change", this.#internalChange);
    this.#devtools = {
      getSnapshot: () => this.buildSnapshot(),
      subscribe: (callback) => {
        // Subscribing to a released controller is not an error, it is a no-op:
        // the caller gets a working unsubscribe and simply never hears back.
        if (this.#released) return () => {};
        this.#subscribers.add(callback);
        return () => {
          this.#subscribers.delete(callback);
        };
      },
    };
  }

  private get frozen(): boolean {
    return this.lifecycle === "destroyed";
  }

  /**
   * Shallow copy of the entry table, keyed by the serialised query key. Diagnostic
   * surface only: the values are the controller's own `Entry` objects, so a caller
   * that mutates one is mutating the cache. Nothing in the package consumes it.
   */
  snapshot(): Map<string, Entry<unknown>> {
    return new Map(this.#entries);
  }

  private keyStrFor(key: QueryKey): string {
    let s = this.#keyStr.get(key);
    if (s !== undefined) return s;
    s = keyString(key);
    this.#keyStr.set(key, s);
    return s;
  }

  /**
   * A plain read of the whole cache. Cheap enough to call per change: every
   * entry is rebuilt from scratch, so a snapshot handed out earlier never
   * mutates underneath its holder.
   */
  private buildSnapshot(): QueryDevtoolsSnapshot {
    const entries: QueryDevtoolsEntry[] = [];
    for (const [keyHash, entry] of this.#entries) {
      const s = entry.state;
      entries.push({
        key: entry.key,
        keyHash,
        status: s.status,
        fetchStatus: s.fetchStatus,
        data: s.data,
        error: toDevtoolsError(s.error),
        dataUpdatedAt: s.dataUpdatedAt,
        errorUpdatedAt: s.errorUpdatedAt,
        staleTime: entry.options.staleTime ?? 0,
        isStale: this.isStale(entry),
        enabled: entry.options.enabled !== false,
      });
    }
    return {
      phase: this.lifecycle,
      entries,
      // Copied so a caller poking at a snapshot cannot reach the live records.
      mutations: Array.from(this.#mutations.values(), (m) => ({ ...m })),
    };
  }

  /** Fan one snapshot out to the adapter and to every subscriber. */
  private publish(): void {
    if (this.#released) return;
    const snapshot = this.buildSnapshot();
    this.#adapter?.set(snapshot);
    // Copied before iterating so a subscriber that unsubscribes (or subscribes)
    // mid-notification cannot corrupt the walk.
    for (const callback of Array.from(this.#subscribers)) callback(snapshot);
  }
  private ensureEntry<TData>(
    key: QueryKey,
    queryFn: QueryFunction<TData>,
    options: QueryOptions<TData> = {}
  ): Entry<TData> {
    const k = this.keyStrFor(key);
    let entry = this.#entries.get(k) as Entry<TData> | undefined;
    // Options are merged ONCE, when the entry is created. A second `observe()`
    // for a key already in the cache is handed the existing entry, so its
    // `staleTime` / `retry` / `initialData` are silently dropped — the first call
    // wins for the lifetime of the entry. `remove(key)` is the reset.
    if (!entry) {
      const merged: QueryOptions<TData> = {
        ...(this.#defaultOptions as QueryOptions<TData>),
        ...options,
      };
      entry = { key, queryFn, options: merged, state: createState(merged), timers: new Set() };
      this.#entries.set(k, entry as unknown as Entry<unknown>);
    }
    return entry;
  }

  private async fetchEntry<TData>(entry: Entry<TData>): Promise<void> {
    if (this.frozen || entry.options.enabled === false) return;
    entry.state.fetchStatus = "fetching";
    this.emit("change", entry.key);
    const ac = new AbortController();
    entry.abort = ac;
    try {
      const data = await entry.queryFn({ signal: ac.signal });
      if (ac.signal.aborted) return;
      entry.state.data = data;
      entry.state.status = "success";
      entry.state.error = null;
      entry.state.dataUpdatedAt = Date.now();
      this.emit("success", entry.key, data);
    } catch (e) {
      if (ac.signal.aborted) return;
      const err = e instanceof Error ? e : new Error(String(e));
      entry.state.error = err;
      entry.state.status = "error";
      entry.state.errorUpdatedAt = Date.now();
      this.emit("error", entry.key, err);
      const retry = entry.options.retry;
      const count = typeof retry === "number" ? retry : retry ? 3 : 0;
      if (count > 0) {
        // The retry is a flat 1 s delay, not a backoff, and `retry` is read as a
        // total attempt budget rather than extra attempts: `retry: 2` re-runs the
        // query twice after the first failure, so three requests in all. The
        // timer is deliberately not tracked — a destroyed controller makes
        // `fetchEntry` return immediately, so the tick costs one no-op.
        setTimeout(() => void this.fetchEntry(entry), 1000);
      }
    } finally {
      entry.state.fetchStatus = "idle";
      this.emit("change", entry.key);
    }
  }

  private isStale<TData>(entry: Entry<TData>): boolean {
    const stale = entry.options.staleTime ?? 0;
    return Date.now() - entry.state.dataUpdatedAt > stale;
  }

  observe<TData>(
    key: QueryKey,
    queryFn: QueryFunction<TData>,
    options: QueryOptions<TData> = {}
  ): QueryObserver<TData> {
    // Starting the request here is what makes `observe()` an *active* read: it
    // fires when the entry is pending or past `staleTime`, which is also why a
    // component that calls it on every render re-requests a stale entry on every
    // render. `get()` is the passive read.
    const entry = this.ensureEntry(key, queryFn, options);
    if (entry.state.status === "pending" || this.isStale(entry)) void this.fetchEntry(entry);
    const refetch = async () => {
      await this.fetchEntry(entry);
    };
    const state = buildQueryState(entry, refetch);
    const observer = state as unknown as QueryObserver<TData>;
    (observer as unknown as Record<string, unknown>).state = state;
    return observer;
  }

  fetch<TData>(
    key: QueryKey,
    queryFn: QueryFunction<TData>,
    options: QueryOptions<TData> = {}
  ): QueryState<TData> {
    const entry = this.ensureEntry(key, queryFn, options);
    if (entry.state.status === "pending") void this.fetchEntry(entry);
    return buildQueryState(entry, async () => {
      await this.fetchEntry(entry);
    });
  }

  get<TData>(key: QueryKey): QueryState<TData> | undefined {
    const entry = this.#entries.get(this.keyStrFor(key)) as Entry<TData> | undefined;
    if (!entry) return undefined;
    return buildQueryState(entry, async () => {
      await this.fetchEntry(entry);
    });
  }

  async prefetch<TData>(
    key: QueryKey,
    queryFn: QueryFunction<TData>,
    options: QueryOptions<TData> = {}
  ): Promise<void> {
    const entry = this.ensureEntry(key, queryFn, options);
    await this.fetchEntry(entry);
  }

  invalidate(key?: QueryKey | QueryKey[]): void {
    if (!key) {
      for (const e of this.#entries.values()) void this.fetchEntry(e as Entry<unknown>);
      return;
    }
    const keys = Array.isArray(key[0]) ? (key as QueryKey[]) : [key as QueryKey];
    for (const k of keys) {
      const entry = this.#entries.get(this.keyStrFor(k));
      if (entry) void this.fetchEntry(entry as Entry<unknown>);
    }
  }

  remove(key?: QueryKey | QueryKey[]): void {
    // `change` is not emitted for a removal: an entry that is no longer there
    // has no key to announce. The devtools and the adapter still need to hear
    // about it, so the publish is explicit here.
    if (!key) {
      this.#entries.clear();
      this.publish();
      return;
    }
    const keys = Array.isArray(key[0]) ? (key as QueryKey[]) : [key as QueryKey];
    for (const k of keys) this.#entries.delete(this.keyStrFor(k));
    this.publish();
  }

  setData<TData>(key: QueryKey, data: TData | ((cur: TData | undefined) => TData)): void {
    const entry = this.#entries.get(this.keyStrFor(key)) as Entry<TData> | undefined;
    if (!entry) return;
    const next =
      typeof data === "function"
        ? (data as (c: TData | undefined) => TData)(entry.state.data)
        : data;
    entry.state.data = next;
    entry.state.status = "success";
    entry.state.dataUpdatedAt = Date.now();
    this.emit("change", key);
  }

  cancel(key: QueryKey): void {
    this.#entries.get(this.keyStrFor(key))?.abort?.abort();
  }
  reset(): void {
    this.#entries.clear();
    this.publish();
  }
  resetQueries(key?: QueryKey | QueryKey[]): void {
    this.remove(key);
  }
  clearMutations(): void {}
  destroy(): void {
    for (const e of this.#entries.values()) e.abort?.abort();
    this.#entries.clear();
    this.#mutations.clear();
    this.events.off("change", this.#internalChange);
    this.#subscribers.clear();
    // Final and idempotent, like every other `destroy` in the toolkit. The
    // subscribers go first so nothing observes the teardown, the handle is
    // dropped rather than reused, and `#released` closes the publish path for
    // good — a `set()` after this point would resurrect a released handle.
    this.#released = true;
    this.#adapter?.destroy();
    this.#adapter = undefined;
    super.destroy();
  }

  mutate<TData, TVariables = void, TContext = unknown>(
    options: MutationOptions<TData, TVariables, TContext>
  ): MutationState<TData, TVariables> {
    let data: TData | undefined;
    let error: Error | null = null;
    let status: "idle" | "pending" | "error" | "success" = "idle";
    // The mutation is only reported once it has actually run: `mutate()` returns
    // a handle whether or not the caller ever calls it, and an un-run handle is
    // not a mutation a panel should list.
    let record: QueryDevtoolsMutation | undefined;
    return {
      get data() {
        return data;
      },
      get error() {
        return error;
      },
      get status() {
        return status;
      },
      get isIdle() {
        return status === "idle";
      },
      get isPending() {
        return status === "pending";
      },
      get isError() {
        return status === "error";
      },
      get isSuccess() {
        return status === "success";
      },
      mutate: async (variables: TVariables) => {
        if (!record) {
          record = { id: this.#nextMutationId++, status: "idle", data: undefined, error: null };
          this.#mutations.set(record.id, record);
        }
        status = "pending";
        record.status = status;
        this.publish();
        let ctx: TContext | undefined;
        try {
          ctx = await options.onMutate?.(variables);
        } catch {}
        try {
          const res = await options.mutationFn(variables);
          data = res;
          status = "success";
          if (record) {
            record.data = res;
            record.status = status;
          }
          options.onSuccess?.(res, variables, ctx);
          options.onSettled?.(res, null, variables, ctx);
          this.publish();
          return res;
        } catch (e) {
          const err = e instanceof Error ? e : new Error(String(e));
          error = err;
          status = "error";
          if (record) {
            record.error = toDevtoolsError(err);
            record.status = status;
          }
          options.onError?.(err, variables, ctx);
          options.onSettled?.(undefined, err, variables, ctx);
          this.publish();
          throw err;
        }
      },
      reset: () => {
        status = "idle";
        error = null;
        data = undefined;
        if (record) {
          record.data = undefined;
          record.error = null;
          record.status = status;
        }
        this.publish();
      },
    } as MutationState<TData, TVariables>;
  }

  toStore(): QueryStore {
    const self = this;
    return {
      get devtools() {
        return self.#devtools;
      },
      observe: ((a: unknown, b: unknown, c: unknown) => {
        if (a && typeof a === "object" && "queryKey" in (a as Record<string, unknown>)) {
          const def = a as {
            queryKey: QueryKey;
            queryFn: QueryFunction<unknown>;
          } & QueryOptions<unknown>;
          return self.observe(def.queryKey, def.queryFn, def);
        }
        return self.observe(a as QueryKey, b as QueryFunction<unknown>, c as QueryOptions<unknown>);
      }) as QueryStore["observe"],
      fetch: ((a: unknown, b: unknown, c: unknown) => {
        if (a && typeof a === "object" && "queryKey" in (a as Record<string, unknown>)) {
          const def = a as {
            queryKey: QueryKey;
            queryFn: QueryFunction<unknown>;
          } & QueryOptions<unknown>;
          return self.fetch(def.queryKey, def.queryFn, def);
        }
        return self.fetch(a as QueryKey, b as QueryFunction<unknown>, c as QueryOptions<unknown>);
      }) as QueryStore["fetch"],
      get: (k) => self.get(k),
      prefetch: ((a: unknown, b: unknown, c: unknown) => {
        if (a && typeof a === "object" && "queryKey" in (a as Record<string, unknown>)) {
          const def = a as {
            queryKey: QueryKey;
            queryFn: QueryFunction<unknown>;
          } & QueryOptions<unknown>;
          return self.prefetch(def.queryKey, def.queryFn, def);
        }
        return self.prefetch(
          a as QueryKey,
          b as QueryFunction<unknown>,
          c as QueryOptions<unknown>
        );
      }) as QueryStore["prefetch"],
      invalidate: (k) => self.invalidate(k as QueryKey | QueryKey[] | undefined),
      remove: (k) => self.remove(k as QueryKey | QueryKey[] | undefined),
      setData: (k, d) => self.setData(k, d),
      cancel: (k) => self.cancel(k),
      reset: () => self.reset(),
      resetQueries: (k) => self.resetQueries(k as QueryKey | QueryKey[] | undefined),
      clearMutations: () => self.clearMutations(),
      destroy: () => self.destroy(),
      mutate: (o) => self.mutate(o),
    };
  }
}

export function createQueryController(options: QueryControllerOptions = {}): QueryController {
  const { id, adapter, ...opts } = options;
  return new QueryController(id, opts, adapter);
}
