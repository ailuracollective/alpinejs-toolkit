/**
 * The zustand state adapter, demonstrated.
 *
 * `QueryController` publishes a `QueryDevtoolsSnapshot` into its adapter on
 * every change. Both adapters are sinks, and the difference between them is
 * entirely about whether anyone can watch: the Alpine adapter wraps the value
 * in `Alpine.reactive`, so a component that reads `get()` re-renders, while the
 * ready-made `zustandStoreAdapter` singleton has no injected `create`, so its
 * stores are unreachable and a snapshot published into one is silent.
 *
 * That is what this module exists to show. It builds the adapter with an
 * injected store creator, keeps the `zustand/vanilla` stores the creator hands
 * back, subscribes to the newest one, and republishes each snapshot into Alpine
 * state — so the page renders a table that changes while the cache changes,
 * which is the whole point of the package. `zustand` is a peer of the adapter
 * and a dependency of this app, and the adapter ships zero bytes of it.
 *
 * Nothing here touches `window` or `document` at import time: `createStore`
 * comes from `zustand/vanilla`, which carries neither React nor the DOM.
 */

import type { QueryDevtoolsEntry, QueryDevtoolsSnapshot, QueryStore } from "@ailura/alpinejs-query";
import { createZustandStoreAdapter } from "@ailura/alpinejs-query-adapter-zustand";
import { createStore } from "zustand/vanilla";
import type { StoreApi } from "zustand/vanilla";

import type { AlpineInstance } from "../types/alpine.js";

/**
 * The key this demo registers the zustand-backed cache under.
 *
 * Deliberately not `"query"`. The Alpine adapter already holds that name in
 * this app, `guardStore()` throws on a second registration of a key rather than
 * replacing it, and the plugin takes no `override` — so the demo asks for its
 * own key and both caches coexist. A host running only this adapter would
 * register `"query"` and see `$store.query` like any other.
 */
export const QUERY_ZUSTAND_STORE_KEY = "queryZustand";

type SnapshotSlot = { value: unknown };

/**
 * Every store the injected creator handed back, oldest first.
 *
 * Module scope on purpose: the adapter is created once, when the plugin is
 * registered, and the creator is resolved once per adapter, so this is the one
 * place the stores can be kept.
 */
const snapshotStores: StoreApi<SnapshotSlot>[] = [];

/** The adapter the playground registers, with its stores kept. */
export function createZustandDemoAdapter() {
  return createZustandStoreAdapter({
    create: (initializer) => {
      const store = createStore(initializer);
      snapshotStores.push(store);
      return store;
    },
  });
}

/** The controller calls `create()` once, so the newest store is the live one. */
function liveStore(): StoreApi<SnapshotSlot> | undefined {
  return snapshotStores.at(-1);
}

type Article = { id: number; title: string; author: string };

const ARTICLES: readonly Article[] = [
  { id: 1, title: "Headless Alpine", author: "ailura" },
  { id: 2, title: "Controllers & Reactivity", author: "ailura" },
  { id: 3, title: "Accessible Dialogs", author: "community" },
];

const LIST_KEY = ["playground", "zustand", "articles"] as const;

const LATENCY = 400;

function delay<T>(value: T, ms = LATENCY): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), ms));
}

/** The snapshot fields the table below renders, and nothing more. */
export type ZustandDemoRow = Pick<
  QueryDevtoolsEntry,
  "keyHash" | "status" | "fetchStatus" | "isStale"
>;

export type QueryZustandDemoData = {
  phase: string;
  rows: ZustandDemoRow[];
  mutations: number;
  publishes: number;
  titles: string[];
  lastPublishAt: string;
  synced: boolean;
  /** Subscribes to the store; Alpine calls it when the `x-data` scope mounts. */
  init(): void;
  /** Called when the scope is torn down — see the view-transition note in `init`. */
  destroy(): void;
  load(): Promise<void>;
  addTitle(): Promise<void>;
  forget(): void;
};

export function registerQueryZustandDemo(Alpine: AlpineInstance): void {
  // One unsubscribe per component instance: the factory runs once per `x-data`,
  // so the closure is the instance's, not the module's.
  let unsubscribe: (() => void) | undefined;

  /**
   * The registered cache. Typed by the ambient `Stores` augmentation in
   * `src/env.d.ts`, the same way every other demo store is.
   */
  const zustandCache = (): QueryStore => Alpine.store(QUERY_ZUSTAND_STORE_KEY);

  Alpine.data("queryZustandDemo", (): QueryZustandDemoData => ({
    phase: "—",
    rows: [],
    mutations: 0,
    publishes: 0,
    titles: [],
    lastPublishAt: "—",
    synced: false,

    /**
     * Subscribe to the store the adapter allocated, once, and let every publish
     * the controller makes repaint the page.
     *
     * `subscribe` hands back its own unsubscribe, and Astro view transitions
     * re-run `x-data`, so the subscription is dropped in `destroy()` rather
     * than leaked into the next visit.
     */
    init() {
      const store = liveStore();
      if (!store) return;

      unsubscribe = store.subscribe((state) => {
        const snapshot = state.value as QueryDevtoolsSnapshot | undefined;
        if (!snapshot) return;
        this.publishes++;
        this.phase = snapshot.phase;
        this.rows = snapshot.entries.map((entry) => ({
          keyHash: entry.keyHash,
          status: entry.status,
          fetchStatus: entry.fetchStatus,
          isStale: entry.isStale,
        }));
        this.mutations = snapshot.mutations.length;
        this.titles = snapshot.entries.flatMap((entry) =>
          Array.isArray(entry.data) ? (entry.data as Article[]).map((article) => article.title) : []
        );
        this.lastPublishAt = new Date().toLocaleTimeString();
        this.synced = true;
      });
    },

    destroy() {
      // Astro view transitions re-run `x-data` on every visit to the page, so
      // the listener has to go with the instance. The store stays allocated:
      // its handle belongs to the controller, not to this component.
      unsubscribe?.();
      unsubscribe = undefined;
    },

    async load() {
      const store = zustandCache();
      const observer = store.observe(LIST_KEY, () => delay([...ARTICLES]), { staleTime: 30_000 });
      await observer.refetch();
    },

    async addTitle() {
      const store = zustandCache();
      const mutation = store.mutate<Article, string>({
        mutationFn: (title) => delay({ id: 4, title, author: "mutation" }, 200),
      });
      await mutation.mutate("Added through a mutation");
      mutation.reset();
    },

    forget() {
      const store = zustandCache();
      store.remove(LIST_KEY);
    },
  }));
}
