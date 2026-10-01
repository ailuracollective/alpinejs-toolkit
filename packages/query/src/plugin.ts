import { guardMagic, guardStore } from "@ailura/alpinejs-core/guards";
import { readAlpineStore, resolvePluginKeys } from "@ailura/alpinejs-core/registration";
import type { Alpine } from "alpinejs";

import { QueryController } from "./controller";
import type { QueryClientOptions, QueryPluginCallback } from "./types";
import { DEFAULT_QUERY_MAGIC_KEY, DEFAULT_QUERY_STORE_KEY } from "./types";

const packageName = "@ailura/alpinejs-query";

export function queryPlugin(options: QueryClientOptions = {}): QueryPluginCallback {
  const { storeKey, magicKey } = resolvePluginKeys(
    options,
    DEFAULT_QUERY_STORE_KEY,
    DEFAULT_QUERY_MAGIC_KEY
  );
  return function registerQuery(alpine: unknown): void {
    const Alpine = alpine as Alpine;
    const controller = new QueryController(
      undefined,
      options.defaultOptions?.queries as never,
      options.adapter
    );
    // The store is a command surface: it holds no query data of its own, only
    // `devtools` and methods. There is nothing here to project on `change`,
    // so the plugin registers no listener — observable per-query state comes
    // from the entry returned by `get()`/`observe()`.
    //
    // `options.adapter` is forwarded to the controller, which publishes a
    // snapshot into it; it is a sink, not a source, so the store is identical
    // with or without one. `defaultOptions.mutations` is the one option here
    // that is accepted and never read: mutations are per-`mutate()` objects
    // rather than cache state.
    const store = controller.toStore();
    guardStore(Alpine, storeKey, store, packageName);
    if (magicKey)
      guardMagic(Alpine, magicKey, () => readAlpineStore(Alpine, storeKey), packageName);
  };
}

export default queryPlugin;
