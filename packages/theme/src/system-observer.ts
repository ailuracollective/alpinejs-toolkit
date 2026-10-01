/**
 * System `prefers-color-scheme`, read once and observed thereafter.
 *
 * SSR-safe: `matchMedia` access goes through `core/env` guards, so a server
 * caller gets `"light"` and a no-op unsubscribe rather than a throw.
 */

import { safeMatchMedia } from "@ailura/alpinejs-core/env";
import { createMediaQueryListener } from "@ailura/alpinejs-ui";

import type { ResolvedTheme } from "./types";

const PREFERS_COLOR_SCHEME_DARK_QUERY = "(prefers-color-scheme: dark)";

export function readSystemTheme(): ResolvedTheme {
  try {
    return safeMatchMedia(PREFERS_COLOR_SCHEME_DARK_QUERY)?.matches ? "dark" : "light";
  } catch {
    return "light";
  }
}

/**
 * @returns an unsubscribe function. On the server it is a no-op, so a caller
 *   can always call it without branching.
 */
export function createSystemObserver(listener: (next: ResolvedTheme) => void): () => void {
  return createMediaQueryListener(PREFERS_COLOR_SCHEME_DARK_QUERY, (event) => {
    listener(event.matches ? "dark" : "light");
  });
}
