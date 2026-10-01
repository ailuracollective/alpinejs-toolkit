/**
 * Alpine integration for the devtools panel.
 *
 * The old implementation deferred to `document.addEventListener("alpine:initialized",
 * …, { once: true })` and never took the listener back: registering the plugin
 * twice in an HMR session leaked one listener per reload. The deferral is kept —
 * `$store.query` does not exist until Alpine boots — but the listener handle is
 * retained and the returned cleanup removes it, so a plugin callback that is
 * torn down before Alpine initializes leaves nothing behind.
 */
import type { Alpine } from "alpinejs";

import { safeDocument } from "./dom";
import { mountQueryDevtools } from "./panel";
import type {
  QueryDevtoolsController,
  QueryDevtoolsPluginOptions,
  QueryDevtoolsSource,
} from "./types";

const packageName = "@ailura/alpinejs-query";

/** At most one panel is mounted at a time, so re-registering replaces it. */
let mounted: QueryDevtoolsController | null = null;

function hasDevtools(value: unknown): value is QueryDevtoolsSource {
  const devtools = (value as QueryDevtoolsSource | undefined)?.devtools;
  return typeof devtools?.getSnapshot === "function" && typeof devtools?.subscribe === "function";
}

/**
 * Resolve the source to inspect: either a source that already exposes
 * `devtools`, or an Alpine instance (anything with `store(name)`) whose named
 * store does.
 */
export function getQueryStore(
  source: QueryDevtoolsSource | Alpine,
  storeName = "query"
): QueryDevtoolsSource {
  if (hasDevtools(source)) return source;
  const alpine = source as { store?: (name: string) => unknown };
  if (typeof alpine?.store !== "function") {
    throw new Error(
      `${packageName}/devtools needs an Alpine instance or a source exposing devtools.getSnapshot()`
    );
  }
  const store = alpine.store(storeName) as QueryDevtoolsSource | undefined;
  if (!hasDevtools(store)) {
    throw new Error(
      `${packageName}/devtools could not find $store.${storeName}. Register @ailura/alpinejs-query first.`
    );
  }
  return store;
}

/** Devtools panel only, for a page that already registers the query plugin. */
export function queryDevtoolsPlugin(
  options: QueryDevtoolsPluginOptions = {}
): (alpine: unknown) => () => void {
  return function registerQueryDevtools(alpine: unknown): () => void {
    const doc = safeDocument();
    // No DOM: nothing to defer to and nothing to mount. The cleanup is still a
    // function so the caller never has to branch.
    if (!doc) return () => {};

    let panel: QueryDevtoolsController | null = null;
    const onInitialized = () => {
      mounted?.destroy();
      const source = getQueryStore(alpine as Alpine, options.storeName ?? "query");
      panel = mountQueryDevtools({ ...options, store: options.store ?? source });
      mounted = panel;
    };
    doc.addEventListener("alpine:initialized", onInitialized, { once: true });

    return () => {
      doc.removeEventListener("alpine:initialized", onInitialized);
      panel?.destroy();
      if (mounted === panel) mounted = null;
    };
  };
}
