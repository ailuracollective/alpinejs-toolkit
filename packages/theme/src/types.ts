import type { SingletonScope } from "@ailura/alpinejs-core/singletons";
import type { SubscribableStorageAdapter } from "@ailura/alpinejs-ui";

/** Explicit user preference — light, dark, or follow system. */
export type ThemePreference = "light" | "dark" | "system";

/** Concrete resolved theme applied to the DOM. */
export type ResolvedTheme = "light" | "dark";

/** Where a theme change originated. */
export type ThemeChangeSource = "initialization" | "user" | "system" | "storage" | "reset";

/** Current theme snapshot derived from preference + system. */
export interface ThemeState {
  readonly current: ThemePreference;
  readonly system: ResolvedTheme;
  readonly resolved: ResolvedTheme;
}

/** Payload emitted with every `change` event. */
export interface ThemeChangeDetail extends ThemeState {
  readonly source: ThemeChangeSource;
  readonly previous: ThemeState | null;
}

/** Event map for {@link ThemeController}. */
export interface ThemeEvents extends Record<string, unknown[]> {
  change: [detail: ThemeChangeDetail];
}

export type ThemeListener = (detail: ThemeChangeDetail) => void;

/** How the resolved theme is reflected in the DOM. */
export type ThemeDomStrategy = "class" | "attribute" | "none";

/**
 * Persistence adapter contract — an alias of `ui`'s generic storage, so any
 * `SubscribableStorageAdapter<T>` is a valid theme storage.
 *
 * `subscribe` is optional. A storage without one still works; it just cannot
 * deliver `crossTab` updates, and `crossTab: true` will quietly deliver nothing.
 */
export type ThemeStorage = SubscribableStorageAdapter<ThemePreference>;

/**
 * The three events of the internal `MachineController`. They are not part of
 * any public API: `set()` chooses one for you, and `toggle()` is a resolver
 * over `SET_LIGHT` and `SET_DARK` rather than an event of its own.
 */
export type ThemeEvent = "SET_LIGHT" | "SET_DARK" | "SET_SYSTEM";

/**
 * Options for {@link createThemeController} and {@link themePlugin}.
 *
 * Defaults live in the controller constructor (`defaultTheme: 'system'`,
 * `strategy: 'class'`, `darkClass: 'dark'`, `lightClass: 'light'`,
 * `attribute: 'data-theme'`, `watchSystem: true`, `crossTab: true`) and in
 * `createDomHandle` for the DOM strategy, not here — the optional fields stay
 * optional so `CreateThemeOptions` can be spread from a partial config.
 */
export interface CreateThemeOptions {
  readonly id?: string;
  readonly defaultTheme?: ThemePreference;
  readonly storage?: ThemeStorage;
  readonly strategy?: ThemeDomStrategy;
  readonly darkClass?: string;
  readonly lightClass?: string;
  readonly attribute?: string;
  readonly target?: HTMLElement | null;
  readonly watchSystem?: boolean;
  readonly crossTab?: boolean;
  readonly scope?: SingletonScope;
  readonly storeKey?: string;
  readonly magicKey?: string;
  readonly reapplyEvents?: readonly string[];
}

/** Store shape registered on Alpine (typed convenience). */
export interface ThemeStore {
  current: ThemePreference;
  system: ResolvedTheme;
  resolved: ResolvedTheme;
  set(value: ThemePreference): void;
  toggle(): void;
  reset(): void;
  apply(): void;
  /**
   * Host-owned teardown: unsubscribes the system theme observer and the
   * cross-tab storage subscription. Nothing invokes it automatically — the
   * host that registered the plugin calls it.
   */
  destroy(): void;
}

/**
 * Both default keys are `"theme"`, and the magic follows the store: renaming
 * `storeKey` alone renames `$theme` with it unless `magicKey` is set
 * separately. See `resolvePluginKeys` in `@ailura/alpinejs-core/registration`.
 */
export const DEFAULT_THEME_STORE_KEY = "theme";
export const DEFAULT_THEME_MAGIC_KEY = DEFAULT_THEME_STORE_KEY;
