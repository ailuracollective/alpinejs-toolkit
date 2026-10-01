import { createLocalStorageAdapter } from "@ailura/alpinejs-ui";

import { isThemePreference } from "../internal/validation";
import type { ThemePreference, ThemeStorage } from "../types";

export function createLocalStorageThemeStorage(
  options: { readonly key?: string; readonly crossTab?: boolean } = {}
): ThemeStorage {
  return createLocalStorageAdapter<ThemePreference>({
    key: options.key ?? "theme",
    crossTab: options.crossTab !== false,
    parse: (raw) => (isThemePreference(raw) ? raw : null),
    serialize: (value) => value,
  });
}
