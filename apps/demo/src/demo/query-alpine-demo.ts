/**
 * The Alpine state adapter, demonstrated.
 *
 * `QueryController` publishes a `QueryDevtoolsSnapshot` into its adapter on
 * every change, and this package's adapter holds that snapshot in one
 * `Alpine.reactive` box. That is the whole difference from its two siblings,
 * and it cuts both ways:
 *
 * - The box lives in Alpine's own graph, so a template bound to it re-renders
 *   by itself. There is no subscription to write, no callback to unsubscribe,
 *   and no copy of the snapshot to keep in step — which is what the zustand and
 *   nanostores pages have to do and what this page deliberately does not.
 * - And because the box *is* Alpine's graph, nothing outside Alpine can
 *   subscribe to it. There is no `subscribe` on the handle `create()` returns,
 *   which is exactly the gap a devtools panel, a persistence layer or a test
 *   has to fill — and the reason the other two adapters exist.
 *
 * So this module does the smallest honest version of each: it wraps the real
 * factory to keep the handle the controller allocates, hands that handle
 * straight to the component, and lets the template read it. The page's example
 * one binds every cell to `box.get()`, with no `publishes` counter and no
 * unsubscribe, because there is nothing to subscribe with.
 *
 * The wiring is the README's, not a shortcut: this package's own plugin cannot
 * produce the box, because `createQueryPlugin()` builds its controller with no
 * adapter and never receives the Alpine instance at factory time. The box only
 * appears when `queryPlugin({ adapter: createAlpineStoreAdapter(Alpine) })`
 * comes from `@ailura/alpinejs-query` — so the demo cache is registered that
 * way, under its own `$store` key, and the package's plugin keeps `"query"`.
 *
 * Nothing here touches `window` or `document` at import time:
 * `createAlpineStoreAdapter` takes the Alpine instance as a parameter and has
 * no side effect outside the calls this module makes with it.
 */

import type { QueryDevtoolsSnapshot, QueryStore } from "@ailura/alpinejs-query";
import { createAlpineStoreAdapter } from "@ailura/alpinejs-query-adapter-alpine";
import type { QueryStateAdapter } from "@ailura/alpinejs-query-adapter-alpine";

import type { AlpineInstance } from "../types/alpine.js";

/**
 * The key this demo registers the reactive-box-backed cache under.
 *
 * Deliberately not `"query"`. The package's own plugin already holds that name
 * in this app, `guardStore()` throws on a second registration of a key rather
 * than replacing it, and the plugin takes no `override` of its own on this
 * path — so the demo asks for its own key and both caches coexist, exactly as
 * the zustand and nanostores demos do.
 */
export const QUERY_ALPINE_STORE_KEY = "queryAlpine";

/** The handle `create()` returns: one value, read and written by hand. */
type SnapshotBox = ReturnType<QueryStateAdapter["create"]>;

/**
 * Every box the injected creator handed back, oldest first.
 *
 * Module scope on purpose: the adapter is created once, when the plugin is
 * registered, and the controller calls `create()` exactly once, so this is the
 * one place the handle can be kept. It is also the only place it can be kept —
 * the real adapter does not expose the box it made, and neither do its
 * siblings, which is the honest shape of this package.
 */
const snapshotBoxes: SnapshotBox[] = [];

/**
 * The adapter the playground registers, with its boxes kept.
 *
 * The wrapping is the demo's only addition and it is deliberately thin: it
 * delegates `create()` to `createAlpineStoreAdapter(Alpine)` and remembers the
 * handle. No publish logic, no projection, no cache of its own — a template
 * still reads the box, which is the one thing the box does for free.
 */
export function createAlpineDemoAdapter(Alpine: AlpineInstance): QueryStateAdapter {
  const adapter = createAlpineStoreAdapter(Alpine);
  return {
    create: (initial: unknown) => {
      const box = adapter.create(initial);
      snapshotBoxes.push(box);
      return box;
    },
  };
}

/** The controller calls `create()` once, so the newest box is the live one. */
function liveBox(): SnapshotBox | undefined {
  return snapshotBoxes.at(-1);
}

type Article = { id: number; title: string; author: string };

const ARTICLES: readonly Article[] = [
  { id: 1, title: "Headless Alpine", author: "ailura" },
  { id: 2, title: "Controllers & Reactivity", author: "ailura" },
  { id: 3, title: "Accessible Dialogs", author: "community" },
];

const LIST_KEY = ["playground", "alpine", "articles"] as const;

const LATENCY = 400;

function delay<T>(value: T, ms = LATENCY): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), ms));
}

export type QueryAlpineDemoData = {
  /**
   * The box the controller publishes into, exactly as `createAlpineStoreAdapter`
   * handed it over: `get`, `set`, `destroy` and nothing else.
   *
   * No `subscribe` — read it from a binding and Alpine's own graph tracks it.
   */
  box: SnapshotBox | undefined;
  /**
   * What is in the box right now.
   *
   * A getter, not a copy: the component holds no snapshot of its own, so there
   * is nothing to fall out of step with the cache. Reading it inside an Alpine
   * binding is what registers the dependency — do that from outside Alpine and
   * the read is a plain value with no way to be told it changed.
   */
  readonly snapshot: QueryDevtoolsSnapshot | undefined;
  /**
   * A second box, made by the same factory and owned by nobody but this
   * component: the factory is a general one-value reactive box, and this is the
   * whole of what it is for when no cache is involved.
   */
  counterBox: SnapshotBox;
  readonly counter: number | undefined;
  /** Called when the scope is torn down by an Astro view transition. */
  destroy(): void;
  load(): Promise<void>;
  addTitle(): Promise<void>;
  forget(): void;
  bump(): void;
  releaseCounter(): void;
  titlesOf(entry: { data?: unknown }): string;
};

export function registerQueryAlpineDemo(Alpine: AlpineInstance): void {
  Alpine.data("queryAlpineDemo", (): QueryAlpineDemoData => {
    /**
     * The registered cache. Typed by the ambient `Stores` augmentation in
     * `src/env.d.ts`, the same way every other demo store is.
     */
    const alpineCache = (): QueryStore => Alpine.store(QUERY_ALPINE_STORE_KEY);

    // One box per component instance, from a fresh adapter each time: the
    // handles are independent, so nothing here can disturb the cache's box.
    const counterBox = createAlpineStoreAdapter(Alpine).create({ count: 0 });

    return {
      box: liveBox(),
      counterBox,

      get snapshot(): QueryDevtoolsSnapshot | undefined {
        return this.box?.get() as QueryDevtoolsSnapshot | undefined;
      },

      get counter(): number | undefined {
        return (this.counterBox.get() as { count: number } | undefined)?.count;
      },

      /**
       * Releases the counter box on the way out.
       *
       * Astro view transitions re-run `x-data` on every visit, so a box made
       * per instance has to go with it. `destroy()` empties the box and is
       * final: afterwards `get()` reports `undefined` and `set()` is inert.
       */
      destroy() {
        this.counterBox.destroy();
      },

      async load() {
        const store = alpineCache();
        const observer = store.observe(LIST_KEY, () => delay([...ARTICLES]), { staleTime: 30_000 });
        await observer.refetch();
      },

      async addTitle() {
        const store = alpineCache();
        const mutation = store.mutate<Article, string>({
          mutationFn: (title) => delay({ id: 4, title, author: "mutation" }, 200),
        });
        await mutation.mutate("Added through a mutation");
        mutation.reset();
      },

      forget() {
        const store = alpineCache();
        store.remove(LIST_KEY);
      },

      bump() {
        const current = (this.counterBox.get() as { count: number } | undefined)?.count ?? 0;
        this.counterBox.set({ count: current + 1 });
      },

      releaseCounter() {
        this.counterBox.destroy();
      },

      /**
       * A projection, not a copy.
       *
       * The titles shown in a cell are read out of the entry the box published
       * at that moment, on every repaint — there is no list of titles held
       * anywhere, which is why nothing here can go stale while the cache moves.
       */
      titlesOf(entry: { data?: unknown }): string {
        return Array.isArray(entry.data)
          ? entry.data.map((article) => (article as Article).title).join(", ")
          : "—";
      },
    };
  });
}
