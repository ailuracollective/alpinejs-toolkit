import { guardStore } from "@ailura/alpinejs-core/guards";
import { readAlpineStore, resolveStoreKey } from "@ailura/alpinejs-core/registration";
import type { Alpine } from "alpinejs";

import { CollectionController } from "./controller";
import {
  type CollectionCompareFn,
  type CollectionInstance,
  type CollectionKey,
  type CollectionOptions,
  type CollectionPluginCallback,
  type CollectionStore,
  DEFAULT_COLLECTION_STORE_KEY,
} from "./types";

const packageName = "@ailura/alpinejs-collection";

export function collectionPlugin<T = unknown, K extends string = string>(
  _options: CollectionOptions<T, K> = {}
): CollectionPluginCallback {
  const storeKey = resolveStoreKey(_options as { storeKey?: string }, DEFAULT_COLLECTION_STORE_KEY);

  return function registerCollection(alpine: Alpine): void {
    const instances = {} as Record<string, CollectionInstance<T, CollectionKey>>;
    // The live controllers, kept so `destroy()` can actually destroy them.
    // `create()` subscribes to `change`, and `BaseController.on` registers that
    // subscription as a cleanup — so without holding the instance, replacing an
    // id left the previous controller mounted and subscribed forever. The
    // playground rebuilds on every keystroke, which turned that into a growing
    // pile of controllers each still writing snapshots.
    const controllers: Record<string, CollectionController<unknown, CollectionKey>> = {};

    // Mutate through the reactive proxy so Alpine triggers re-renders.
    const write = (id: string, value: CollectionInstance<unknown, CollectionKey>): void => {
      const proxy = readAlpineStore<{ instances: Record<string, unknown> }>(
        alpine,
        storeKey,
        store
      );
      proxy.instances[id] = value;
    };
    const remove = (id: string): void => {
      const proxy = readAlpineStore<{ instances: Record<string, unknown> }>(
        alpine,
        storeKey,
        store
      );
      delete proxy.instances[id];
    };

    // The store keeps one controller per id, held as
    // `CollectionController<unknown, CollectionKey>` because each `create()` can
    // pick its own item type. The object is typed with the plugin's own `T`, so a
    // caller's `setSort` accepts a comparator for their item type instead of a
    // bare `unknown`; the cast is confined to the controller boundary.
    const store: CollectionStore<T, CollectionKey> = {
      instances,
      create<TItem>(id: string, options?: CollectionOptions<TItem, CollectionKey>): void {
        // Re-creating an id replaces it. Release the old controller first, or the
        // new snapshot competes with a live one still writing the same key.
        controllers[id]?.destroy();
        const c = new CollectionController<TItem, CollectionKey>(options);
        c.mount();
        controllers[id] = c as unknown as CollectionController<unknown, CollectionKey>;
        write(id, c.snapshot() as unknown as CollectionInstance<unknown, CollectionKey>);
        c.on("change", () => {
          write(id, c.snapshot() as unknown as CollectionInstance<unknown, CollectionKey>);
        });
      },
      // One key, both arities, argument forwarded: `destroy: () => …` would make
      // `store.destroy("files")` tear the whole store down instead of one
      // collection — the id would arrive and be dropped.
      destroy: (id?: string) => {
        if (id === undefined) {
          store.destroyAll();
          return;
        }
        controllers[id]?.destroy();
        delete controllers[id];
        remove(id);
      },
      destroyAll(): void {
        for (const id of Object.keys(controllers)) {
          controllers[id]?.destroy();
          delete controllers[id];
          remove(id);
        }
      },
      // Mutations on a live instance, rather than re-creating it.
      //
      // `create()` was the store's only mutator, so changing the query meant
      // rebuilding filtering, sorting, grouping and paging from scratch to
      // change one string — which is why the playground had a `rebuild()` that
      // every interaction called. The controller already had all of these; they
      // were simply never surfaced.
      setQuery(id: string, query: string): void {
        controllers[id]?.setQuery(query);
      },
      setSort(
        id: string,
        compare: CollectionCompareFn<T> | null,
        direction: "asc" | "desc" = "asc"
      ): void {
        controllers[id]?.setSort(compare as CollectionCompareFn<unknown> | null, direction);
      },
      setPage(id: string, page: number): void {
        controllers[id]?.setPage(page);
      },
      nextPage(id: string): void {
        controllers[id]?.nextPage();
      },
      prevPage(id: string): void {
        controllers[id]?.prevPage();
      },
      setActiveKey(id: string, key: CollectionKey | null): void {
        controllers[id]?.setActiveKey(key);
      },
      setItems(id: string, items: readonly unknown[]): void {
        controllers[id]?.setItems(items);
      },
    };

    guardStore(alpine, storeKey, store as unknown as Record<string, unknown>, packageName);
  };
}

export default collectionPlugin;
