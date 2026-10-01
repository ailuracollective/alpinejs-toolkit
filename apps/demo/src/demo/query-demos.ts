/**
 * Query demos.
 *
 * The cache is exercised against a local fake API (no network, deterministic
 * latency) so every state — pending, success, error, retry, stale — is
 * reproducible in the playground.
 *
 * The store surface is not reactive on its own: `observe()` returns a live
 * view over the cache entry, and these components copy what they need into
 * Alpine data after each awaited call. That is exactly what an application
 * does today — wrap the store in an adapter, or bridge it into your own
 * reactive layer.
 */

import type { QueryStore } from "@ailura/alpinejs-query";

import type { AlpineInstance } from "../types/alpine.js";

type Article = { id: number; title: string; author: string; price: number };

const ARTICLES: readonly Article[] = [
  { id: 1, title: "Headless Alpine", author: "ailura", price: 29 },
  { id: 2, title: "Controllers & Reactivity", author: "ailura", price: 39 },
  { id: 3, title: "Accessible Dialogs", author: "community", price: 19 },
  { id: 4, title: "Query Cache Deep Dive", author: "ailura", price: 49 },
];

const LATENCY = 500;
const STALE_TIME = 30_000;

function delay<T>(value: T, ms = LATENCY): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), ms));
}

type QueryEntry = {
  data?: Article[];
  status?: string;
  error?: Error | null;
  dataUpdatedAt?: number;
  isStale?: boolean;
};

type QueryDemoData = {
  status: "idle" | "pending" | "success" | "error";
  data: Article[] | undefined;
  error: string | null;
  updatedAt: number | null;
  isStale: boolean;
  failNext: boolean;
  fetches: number;
  init(): void;
  fetchArticles(): Promise<Article[]>;
  sync(entry: QueryEntry | undefined): void;
  load(): Promise<void>;
  refetch(): Promise<void>;
  invalidate(): Promise<void>;
  optimisticRename(): void;
  addArticle(): Promise<void>;
  forget(): void;
  reloadCache(): Promise<void>;
  toggleFailure(): void;
};

const LIST_KEY = ["playground", "articles"] as const;

/**
 * The cache entries are plain objects of getters, so `isPending` / `isFetching`
 * read the live entry — polling them is how a component waits for a request the
 * plugin started on its own. The bound is a ceiling, not the normal exit: the
 * loop leaves as soon as the request settles.
 */
async function waitForSettled(observer: {
  readonly isPending: boolean;
  readonly isFetching: boolean;
}): Promise<void> {
  for (let i = 0; i < 200 && (observer.isPending || observer.isFetching); i++) {
    await delay(undefined, 50);
  }
}

export function registerQueryDemos(Alpine: AlpineInstance): void {
  Alpine.data("queryDemo", (): QueryDemoData => ({
    status: "idle",
    data: undefined,
    error: null,
    updatedAt: null,
    isStale: false,
    failNext: false,
    fetches: 0,

    init() {
      void this.load();
    },

    /**
     * `observe()` starts the request when the entry is pending or stale and
     * hands back a live view over the cache entry — one request, not two. The
     * view is a plain object of getters, so wait on the request itself and
     * then copy the fields the template renders.
     */
    async load() {
      const store = Alpine.store("query") as QueryStore;
      this.status = "pending";
      this.error = null;
      this.fetches++;

      const observer = store.observe(LIST_KEY, () => this.fetchArticles(), {
        staleTime: STALE_TIME,
      });

      await waitForSettled(observer);
      this.sync(observer);
    },

    async refetch() {
      const store = Alpine.store("query") as QueryStore;
      this.status = "pending";
      this.error = null;
      this.fetches++;

      const observer = store.observe(LIST_KEY, () => this.fetchArticles(), {
        staleTime: STALE_TIME,
      });

      // `refetch()` on the view always re-runs the fetcher, even while the
      // entry is still fresh — that is the difference from `load()`.
      await observer.refetch();
      this.sync(observer);
    },

    async invalidate() {
      const store = Alpine.store("query") as QueryStore;
      this.status = "pending";
      this.error = null;
      this.fetches++;
      store.invalidate(LIST_KEY);
      // `invalidate()` refetches in the background — give it a beat, then read.
      await delay(undefined, LATENCY + 100);
      await this.reloadCache();
    },

    // oxlint-disable-next-line require-await -- store read-back, kept async for the demo API
    async reloadCache() {
      const store = Alpine.store("query") as QueryStore;
      const entry = store.get<Article[]>(LIST_KEY);
      this.data = entry?.data;
      this.updatedAt = entry?.dataUpdatedAt ?? null;
      this.isStale = entry?.isStale ?? false;
      this.status = entry?.status === "error" ? "error" : (entry?.status ?? "idle");
      this.error = entry?.error?.message ?? null;
    },

    optimisticRename() {
      const store = Alpine.store("query") as QueryStore;
      store.setData<Article[]>(LIST_KEY, (current) =>
        (current ?? []).map((article) =>
          article.id === 1 ? { ...article, title: "Headless Alpine ✏️" } : article
        )
      );
      this.sync(store.get<Article[]>(LIST_KEY));
    },

    async addArticle() {
      const store = Alpine.store("query") as QueryStore;
      this.status = "pending";

      // Derived from the list, not from the frozen seed array: `ARTICLES.length`
      // is always 4, so every mutation minted `id: 5` and a second click put two
      // rows with the same key into the `x-for`. `get()` answers the cache
      // ENTRY, so the articles are its `data` — the same read every other
      // example here makes.
      const existing = store.get<Article[]>(LIST_KEY)?.data ?? [];
      const mutation = store.mutate<Article, Omit<Article, "id">>({
        mutationFn: (article) => delay({ ...article, id: existing.length + 1 }, 250),
      });

      try {
        const created = await mutation.mutate({
          title: "Added from a mutation",
          author: "ailura",
          price: 0,
        });
        store.setData<Article[]>(LIST_KEY, (current) => [...(current ?? []), created]);
        this.sync(store.get<Article[]>(LIST_KEY));
      } catch (error) {
        this.status = "error";
        this.error = (error as Error).message;
      } finally {
        mutation.reset();
      }
    },

    forget() {
      const store = Alpine.store("query") as QueryStore;
      store.remove(LIST_KEY);
      this.data = undefined;
      this.updatedAt = null;
      this.isStale = false;
      this.status = "idle";
      this.error = null;
    },

    toggleFailure() {
      this.failNext = !this.failNext;
    },

    // oxlint-disable-next-line require-await -- `delay()` already returns the promise
    async fetchArticles(): Promise<Article[]> {
      if (this.failNext) {
        this.failNext = false;
        throw new Error("Simulated network failure");
      }
      return delay([...ARTICLES]);
    },

    sync(entry: QueryEntry | undefined) {
      this.data = entry?.data;
      this.updatedAt = entry?.dataUpdatedAt ?? null;
      this.isStale = entry?.isStale ?? false;
      this.status = (entry?.status as QueryDemoData["status"]) ?? "idle";
      this.error = entry?.error?.message ?? null;
    },
  }));
}

type RetryDemoData = {
  status: string;
  data: { ok: boolean; attempts: number } | undefined;
  error: string | null;
  run(): Promise<void>;
  reset(): void;
};

export function registerQueryAdvancedDemo(Alpine: AlpineInstance): void {
  let attempt = 0;

  /** The retry loop re-runs the query in the background, so wait for it to settle. */
  async function waitForRetrySettled(observer: { readonly isPending: boolean }): Promise<void> {
    for (let i = 0; i < 60 && observer.isPending; i++) {
      await delay(undefined, 100);
    }
  }

  Alpine.data("queryRetryDemo", (): RetryDemoData => ({
    status: "idle",
    data: undefined,
    error: null,

    async run() {
      const store = Alpine.store("query") as QueryStore;
      const key = ["playground", "retry"];
      store.remove(key);
      attempt = 0;
      this.status = "pending";
      this.error = null;

      // `retry: 2` makes the controller re-run the failing query before it
      // settles on a result: attempt 1 and 2 reject, attempt 3 resolves.
      const observer = store.observe(
        key,
        // oxlint-disable-next-line require-await -- a query function must return a promise
        async () => {
          attempt++;
          if (attempt < 3) {
            throw new Error(`Attempt ${attempt} rejected`);
          }
          return { ok: true, attempts: attempt };
        },
        { retry: 2 }
      );

      await waitForRetrySettled(observer);

      this.data = observer.data;
      this.status = observer.status;
      this.error = observer.error?.message ?? null;
    },

    reset() {
      const store = Alpine.store("query") as QueryStore;
      store.remove(["playground", "retry"]);
      this.status = "idle";
      this.data = undefined;
      this.error = null;
    },
  }));
}
