/**
 * The one place the resolved theme reaches the DOM.
 *
 * SSR-safe: never touches `window`/`document` at import time, and the target
 * is resolved lazily through `safeDocument()` — so server-side rendering gets
 * a no-op handle instead of a `ReferenceError`, and a document that arrives
 * later (a client-side mount) is still found.
 */

import { safeDocument } from "@ailura/alpinejs-core/env";

import type { CreateThemeOptions, ResolvedTheme } from "../types";

export interface DomApplyHandle {
  /**
   * @param force Write even when `resolved` is the value this handle last
   *   wrote. That is what recovers a theme after the host replaced `<html>`,
   *   where the attribute is gone but the handle still believes it applied.
   */
  apply(resolved: ResolvedTheme, force?: boolean): void;
  /** Remove whatever this handle added. A no-op under `strategy: 'none'`. */
  destroy(): void;
}

export function createDomHandle(options: CreateThemeOptions): DomApplyHandle {
  const {
    strategy = "class",
    target: configuredTarget,
    darkClass = "dark",
    lightClass = "light",
    attribute = "data-theme",
  } = options;

  let current: ResolvedTheme | null = null;
  let resolvedTarget: HTMLElement | null | undefined;

  const targetFor = (): HTMLElement | null => {
    if (configuredTarget !== undefined) return configuredTarget as HTMLElement | null;
    if (resolvedTarget === undefined) resolvedTarget = safeDocument()?.documentElement ?? null;
    return resolvedTarget;
  };

  // `class` is the default because it is what a Tailwind or CSS-variable
  // stylesheet keys off; `none` exists for hosts that read `resolved` and
  // paint it themselves, and it skips `targetFor()` entirely so a `target`
  // option costs nothing there.
  const apply =
    strategy === "none"
      ? (): void => {}
      : (resolved: ResolvedTheme, force?: boolean): void => {
          if (!force && resolved === current) return;
          const target = targetFor();
          if (!target) return;
          if (strategy === "attribute") target.setAttribute(attribute, resolved);
          else {
            target.classList.remove(darkClass, lightClass);
            target.classList.add(resolved === "dark" ? darkClass : lightClass);
          }
          current = resolved;
        };

  const destroy = (): void => {
    const target = targetFor();
    if (!target || current === null) {
      current = null;
      return;
    }
    if (strategy === "class") target.classList.remove(darkClass, lightClass);
    else if (strategy === "attribute") target.removeAttribute(attribute);
    current = null;
  };

  return { apply, destroy };
}
