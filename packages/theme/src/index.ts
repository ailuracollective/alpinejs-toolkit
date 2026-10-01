export { createThemeController, ThemeController } from "./controller";
export { createLocalStorageThemeStorage } from "./storage/local-storage";
export { createMemoryThemeStorage } from "./storage/memory-storage";
export { createSystemObserver, readSystemTheme } from "./system-observer";
export type { DomApplyHandle } from "./internal/dom-strategy";
export {
  coerceThemePreference,
  defaultThemePreference,
  isThemePreference,
  resolveTheme,
  toThemeEvent,
} from "./internal/validation";
export { createThemeStore, themePlugin } from "./plugin";
export { themePlugin as default } from "./plugin";
export type {
  CreateThemeOptions,
  ResolvedTheme,
  ThemeChangeDetail,
  ThemeChangeSource,
  ThemeDomStrategy,
  ThemeEvent,
  ThemeEvents,
  ThemeListener,
  ThemePreference,
  ThemeState,
  ThemeStorage,
  ThemeStore,
} from "./types";
export type { ThemePluginCallback } from "./plugin";
