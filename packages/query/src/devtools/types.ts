/**
 * Public types for the `query/devtools` subpath.
 *
 * The panel is a *reader*. Everything it displays comes from
 * {@link QueryDevtoolsApi} — `getSnapshot()` and `subscribe()` — so the minimum
 * a caller hands it is `{ devtools }`. Every mutating member below is OPTIONAL
 * and is a member of the real `QueryStore` surface, not an addition to the
 * devtools contract: a full `QueryStore` satisfies `QueryDevtoolsSource`
 * structurally, and a bare `{ devtools }` object satisfies it too. The panel
 * hides the affordances it cannot honour rather than pretending they work.
 */
import type { QueryDevtoolsApi, QueryKey } from "../types";

/** The four corners the floating toggle can be parked in. */
export const TOGGLE_CORNERS = ["top-left", "top-right", "bottom-left", "bottom-right"] as const;

export type ToggleCorner = (typeof TOGGLE_CORNERS)[number];

export const DEFAULT_TOGGLE_CORNER: ToggleCorner = "bottom-right";
export const DEFAULT_TOGGLE_CORNER_STORAGE_KEY = "alpine-query-devtools:toggle-corner";
export const DEFAULT_PREFERENCES_STORAGE_KEY = "alpine-query-devtools:preferences";

/** Where the panel docks itself. */
export type QueryDevtoolsPosition = "bottom" | "right";

/** `system` follows the host: `data-theme`, then `.dark`, then `prefers-color-scheme`. */
export type QueryDevtoolsTheme = "light" | "dark" | "system";

/** The read half is required; every writer is optional and probed at render time. */
export type QueryDevtoolsSource = {
  devtools: QueryDevtoolsApi;
  /** Read one entry back so the panel can offer Refetch. */
  get?(key: QueryKey): { refetch(): Promise<void> } | undefined;
  invalidate?(key?: QueryKey | QueryKey[]): void;
  /** Same drop as `resetQueries`, under its plain name. */
  remove?(key?: QueryKey | QueryKey[]): void;
  resetQueries?(key?: QueryKey | QueryKey[]): void;
  reset?(): void;
  clearMutations?(): void;
  /**
   * The ONLY write path the data editor has. It is not part of
   * {@link QueryDevtoolsApi}: a source that does not expose it gets a
   * read-only editor, stated in the panel, not a silently dead Apply button.
   */
  setData?<TData>(key: QueryKey, data: TData): void;
};

export type QueryDevtoolsOptions = {
  /** Panel position. Default: `bottom`. */
  position?: QueryDevtoolsPosition;
  /** Toggle button corner. Default: `bottom-right`. */
  toggleCorner?: ToggleCorner;
  /** Persist toggle corner in `localStorage`. Default: `true`. */
  persistToggleCorner?: boolean;
  /** `localStorage` key for the toggle corner. */
  toggleCornerStorageKey?: string;
  /** Persist panel filters, sort, tab and open state in `localStorage`. Default: `true`. */
  persistPreferences?: boolean;
  /** `localStorage` key for panel preferences. */
  preferencesStorageKey?: string;
  /** Start with follow-latest enabled. Default: `false`. */
  followLatest?: boolean;
  /** Start with remember-open-state enabled. Default: `false`. */
  rememberOpenState?: boolean;
  /** Start with the panel open. Default: `false`. */
  initialOpen?: boolean;
  /** Filter queries and mutations by search text. */
  filter?: string;
  /** Color theme. Default: `system`. */
  theme?: QueryDevtoolsTheme;
  /** Name of the inspected store, used as its label. Default: `query`. */
  storeName?: string;
  /** Extra sources to inspect alongside the primary one (e.g. a headless controller). */
  additionalStores?: QueryDevtoolsSource[];
  /**
   * Custom z-index for the panel and the toggle. Default: `60`.
   * Lower it when the panel overlaps other UI (a sidebar, a dialog).
   */
  zIndex?: number;
  /** Primary source. */
  store?: QueryDevtoolsSource;
  /** Replace `store` with an explicit list of sources. */
  stores?: QueryDevtoolsSource[];
};

export type QueryDevtoolsMountOptions = QueryDevtoolsOptions;

export type QueryDevtoolsController = {
  open(): void;
  close(): void;
  toggle(): void;
  setToggleCorner(corner: ToggleCorner): void;
  getToggleCorner(): ToggleCorner;
  destroy(): void;
};

export type QueryDevtoolsPluginOptions = QueryDevtoolsOptions;
