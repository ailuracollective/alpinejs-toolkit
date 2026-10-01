/**
 * `@ailura/alpinejs-query/devtools` — the development panel.
 *
 * A separate subpath on purpose: the panel is CSS-in-JS, DOM-only and larger
 * than the cache itself, so a production bundle that never imports it does not
 * carry a byte of it. The main barrel stays a pure barrel and does not
 * re-export anything from here.
 *
 * This file is the subpath's public surface and lives flat, next to
 * `src/index.ts`, because that is how a subpath resolves in this repo: core
 * publishes `./guards` and `./bridge` from flat `src/guards.ts` and
 * `src/bridge.ts`. The implementation lives in `./devtools/` and is private to
 * this entry.
 */
export { mountQueryDevtools } from "./devtools/panel";
export { getQueryStore, queryDevtoolsPlugin } from "./devtools/plugin";
export {
  TOGGLE_CORNERS,
  DEFAULT_TOGGLE_CORNER,
  DEFAULT_TOGGLE_CORNER_STORAGE_KEY,
  DEFAULT_PREFERENCES_STORAGE_KEY,
} from "./devtools/types";
export type {
  QueryDevtoolsController,
  QueryDevtoolsMountOptions,
  QueryDevtoolsOptions,
  QueryDevtoolsPluginOptions,
  QueryDevtoolsPosition,
  QueryDevtoolsSource,
  QueryDevtoolsTheme,
  ToggleCorner,
} from "./devtools/types";
