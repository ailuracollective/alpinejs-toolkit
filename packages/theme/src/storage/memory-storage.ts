import { createMemoryAdapter } from "@ailura/alpinejs-ui";

import type { ThemePreference, ThemeStorage } from "../types";

export function createMemoryThemeStorage(initial: ThemePreference | null = null): ThemeStorage {
  return createMemoryAdapter<ThemePreference>({ initial });
}
