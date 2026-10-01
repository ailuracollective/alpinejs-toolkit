/**
 * The nanostores state adapter, demonstrated.
 *
 * `QueryController` publishes a `QueryDevtoolsSnapshot` into its adapter on
 * every change. This package's adapter keeps each snapshot in a nanostores
 * `atom` — and the atom holds the snapshot itself, not a `{ value }` wrapper
 * like the zustand sibling's store. So a subscriber here receives the snapshot
 * as its only argument, and `atom.get()` returns the snapshot with nothing to
 * unwrap. That is the whole difference between the two adapters, and it is
 * what this page is here to show rather than assert.
 *
 * The atom is unreachable through the handle `QueryStateAdapter.create()`
 * returns (`{ get, set, destroy }` has no `subscribe`), so the adapter is built
 * with an injected `create` that keeps the atoms the controller allocated.
 * That injected creator is the package's real API: the ready-made
 * `nanostoresStoreAdapter` singleton publishes snapshots nobody can read.
 *
 * Nothing here touches `window` or `document` at import time. `atom` comes from
 * `nanostores`, which is framework-free and DOM-free, so this module loads the
 * same way on the server as the rest of the demo app.
 */

import type { QueryDevtoolsEntry, QueryDevtoolsSnapshot, QueryStore } from "@ailura/alpinejs-query";
import { createNanostoresStoreAdapter } from "@ailura/alpinejs-query-adapter-nanostores";
import { atom } from "nanostores";
import type { WritableAtom } from "nanostores";

import type { AlpineInstance } from "../types/alpine.js";

/**
 * The key this demo registers the nanostores-backed cache under.
 *
 * Deliberately not `"query"`. The alpine adapter already holds that name in
 * this app, `guardStore()` throws on a second registration of a key rather than
 * replacing it, and the plugin takes no `override` — so the demo asks for its
 * own key and both caches coexist, exactly as the zustand demo does with
 * `queryZustand`. A host running only this adapter would register `"query"`.
 */
export const QUERY_NANOSTORES_STORE_KEY = "queryNanostores";

/**
 * Every atom the injected creator handed back, oldest first.
 *
 * Module scope on purpose: the adapter is created once, when the plugin is
 * registered, and the creator is resolved once per adapter, so this is the one
 * place the atoms can be kept. A nanostores store with no listeners may read
 * back `undefined`, and the handle holds one `listen` of its own precisely so
 * the atom stays mounted for as long as the controller holds it.
 */
const snapshotAtoms: WritableAtom<unknown>[] = [];

/** The adapter the playground registers, with its atoms kept. */
export function createNanostoresDemoAdapter() {
  return createNanostoresStoreAdapter({
    create: (initial) => {
      const store = atom(initial);
      snapshotAtoms.push(store);
      return store;
    },
  });
}

/** The controller calls `create()` once, so the newest atom is the live one. */
function liveAtom(): WritableAtom<unknown> | undefined {
  return snapshotAtoms.at(-1);
}

type Article = { id: number; title: string; author: string };

const ARTICLES: readonly Article[] = [
  { id: 1, title: "Headless Alpine", author: "ailura" },
  { id: 2, title: "Controllers & Reactivity", author: "ailura" },
  { id: 3, title: "Accessible Dialogs", author: "community" },
];

const LIST_KEY = ["playground", "nanostores", "articles"] as const;

const LATENCY = 400;

function delay<T>(value: T, ms = LATENCY): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), ms));
}

/** The snapshot fields the table below renders, and nothing more. */
export type NanostoresDemoRow = Pick<
  QueryDevtoolsEntry,
  "keyHash" | "status" | "fetchStatus" | "isStale"
>;

export type QueryNanostoresDemoData = {
  phase: string;
  rows: NanostoresDemoRow[];
  mutations: number;
  publishes: number;
  titles: string[];
  lastPublishAt: string;
  synced: boolean;
  /**
   * What `atom.get()` reports, read on demand with no Alpine and no
   * subscriber. A nanostores atom is the snapshot, so there is no `.value` to
   * unwrap before `entries` exists.
   */
  atomRead: string;
  init(): void;
  /** Called when the scope is torn down — see the view-transition note in `init`. */
  destroy(): void;
  load(): Promise<void>;
  addTitle(): Promise<void>;
  forget(): void;
  /** Reads the live atom directly, outside any subscription. */
  readAtom(): void;
};

export function registerQueryNanostoresDemo(Alpine: AlpineInstance): void {
  // One unsubscribe per component instance: the factory runs once per `x-data`,
  // so the closure is the instance's, not the module's.
  let unsubscribe: (() => void) | undefined;

  /**
   * The registered cache. Typed by the ambient `Stores` augmentation in
   * `src/env.d.ts`, the same way every other demo store is.
   */
  const nanostoresCache = (): QueryStore => Alpine.store(QUERY_NANOSTORES_STORE_KEY);

  /** One publish, projected onto Alpine state. */
  const applySnapshot = function (this: QueryNanostoresDemoData, value: unknown): void {
    // THE difference, on one line: the callback argument IS the snapshot. The
    // zustand adapter's `subscribe` hands over the store state, so its reader
    // starts with `state.value` before it reaches `entries`. Here there is
    // nothing between the subscriber and the cache.
    const snapshot = value as QueryDevtoolsSnapshot | undefined;
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
  };

  Alpine.data("queryNanostoresDemo", (): QueryNanostoresDemoData => ({
    phase: "—",
    rows: [],
    mutations: 0,
    publishes: 0,
    titles: [],
    lastPublishAt: "—",
    synced: false,
    atomRead: "—",

    /**
     * Subscribe to the atom the adapter allocated, once, and let every publish
     * the controller makes repaint the page.
     *
     * nanostores' `subscribe` fires once on attach with the value the handle
     * was created with, so the first call is the initial snapshot rather than a
     * cache change — the count starts at 1 for that reason.
     *
     * `subscribe` hands back its own unsubscribe, and Astro view transitions
     * re-run `x-data`, so the subscription is dropped in `destroy()` rather
     * than leaked into the next visit.
     */
    init() {
      const store = liveAtom();
      if (!store) return;

      unsubscribe = store.subscribe((value) => {
        applySnapshot.call(this, value);
      });
    },

    destroy() {
      // Astro view transitions re-run `x-data` on every visit to the page, so
      // the listener has to go with the instance. The atom stays allocated: its
      // handle belongs to the controller, not to this component.
      unsubscribe?.();
      unsubscribe = undefined;
    },

    readAtom() {
      const store = liveAtom();
      // `get()` returns the published snapshot itself. The zustand sibling
      // would need `store.getState().value` first; the atom needs nothing.
      const snapshot = store?.get() as QueryDevtoolsSnapshot | undefined;
      if (!snapshot) {
        this.atomRead = "no snapshot yet";
        return;
      }
      this.atomRead = `phase ${snapshot.phase} · ${snapshot.entries.length} entries · ${snapshot.mutations.length} mutations`;
    },

    async load() {
      const store = nanostoresCache();
      const observer = store.observe(LIST_KEY, () => delay([...ARTICLES]), { staleTime: 30_000 });
      await observer.refetch();
    },

    async addTitle() {
      const store = nanostoresCache();
      const mutation = store.mutate<Article, string>({
        mutationFn: (title) => delay({ id: 4, title, author: "mutation" }, 200),
      });
      await mutation.mutate("Added through a mutation");
      mutation.reset();
    },

    forget() {
      const store = nanostoresCache();
      store.remove(LIST_KEY);
    },
  }));
}
