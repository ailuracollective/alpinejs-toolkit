/**
 * SSR-safe environment helpers.
 *
 * This module never touches `window` or `document` at import time. Every
 * access goes through a `typeof` check so server-side rendering and plain
 * Node processes get `undefined`/fallbacks instead of a `ReferenceError`.
 */

/** True when both `window` and `document` exist (browser-like environment). */
export function isBrowser(): boolean {
  return typeof window !== "undefined" && typeof document !== "undefined";
}

/** The global `window`, or `undefined` outside a browser-like environment. */
export function safeWindow(): Window | undefined {
  return typeof window !== "undefined" ? window : undefined;
}

/** The global `document`, or `undefined` outside a browser-like environment. */
export function safeDocument(): Document | undefined {
  return typeof document !== "undefined" ? document : undefined;
}

/**
 * Evaluate a media query without throwing on the server.
 *
 * @param query - Media query string, e.g. `"(prefers-reduced-motion: reduce)"`.
 * @returns The `MediaQueryList`, or `undefined` when `matchMedia` is unavailable.
 */
export function safeMatchMedia(query: string): MediaQueryList | undefined {
  const win = safeWindow();
  if (!win || typeof win.matchMedia !== "function") return undefined;
  return win.matchMedia(query);
}
