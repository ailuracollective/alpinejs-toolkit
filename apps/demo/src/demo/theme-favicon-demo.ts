/**
 * The Alpine data component behind the favicon part of `ThemeDemo`.
 *
 * The favicon is the one feature on this page that is **not** a store: it lives
 * in `<head>`, nothing on the page renders it, and a demo that only showed
 * code samples would prove nothing. So this calls the real
 * `createThemeFaviconController` and then *reads the DOM back* — the href on
 * the link the controller owns is the output, not a claim about it.
 *
 * No `theme` option is passed. `createThemeFaviconController` falls back to
 * `createThemeController()`, which is the same document-scoped singleton the
 * theme plugin registered — so these buttons and the three preference buttons
 * at the top of the page drive one controller between them, with no wiring.
 *
 * The controller lives in module scope, not on `this`, on purpose: Alpine
 * proxies anything it stores reactively, and wrapping a controller in a
 * reactive proxy would put a `Proxy` between the DOM and the thing that owns
 * it.
 */

import { createThemeFaviconController, type ThemeFaviconController } from "@ailura/alpinejs-theme";

import type { AlpineInstance } from "../types/alpine.js";

/**
 * Inline `data:` SVG icons rather than files in `public/`. The point of the
 * demo is that the href *changes*, and a data URI keeps the two states
 * unmistakable in devtools without adding assets to the repository.
 */
const LIGHT_ICON =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Crect width='32' height='32' rx='7' fill='%23fafaf9'/%3E%3Ccircle cx='16' cy='16' r='6.5' fill='%23f59e0b'/%3E%3C/svg%3E";
const DARK_ICON =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Crect width='32' height='32' rx='7' fill='%231c1917'/%3E%3Ccircle cx='16' cy='16' r='6.5' fill='%2338bdf8'/%3E%3C/svg%3E";

let favicon: ThemeFaviconController | null = null;
const teardown: Array<() => void> = [];

/** Shorten a data URI so it fits in a readout without wrapping the layout. */
function describeHref(href: string | null): string {
  if (!href) return "—";
  const fill = /fill='(%23[0-9a-f]{6})'/i.exec(href);
  return fill && href.startsWith("data:") ? `data:image/svg+xml (${fill[1]})` : href;
}

/** Read the DOM back, so the readout is the element's own href. */
function ownedLinks(): HTMLLinkElement[] {
  return Array.from(document.head.querySelectorAll<HTMLLinkElement>("link[data-theme-favicon]"));
}

type ThemeFaviconDemoData = {
  /** Whether a controller is alive right now. */
  active: boolean;
  /** What `favicon.resolved` reports. */
  resolved: string;
  /** The href on the link the controller owns. */
  href: string;
  /** How many `<link rel="icon">` the controller added — one under 'theme'. */
  owned: number;
  /** Re-read the DOM into the readouts. */
  sync(): void;
  attach(): void;
  release(): void;
};

export function registerThemeFaviconDemo(Alpine: AlpineInstance): void {
  Alpine.data("themeFaviconDemo", (): ThemeFaviconDemoData => ({
    active: false,
    resolved: "—",
    href: "—",
    owned: 0,

    sync() {
      const links = ownedLinks();
      this.href = describeHref(links[0]?.getAttribute("href") ?? null);
      this.owned = links.length;
      this.resolved = favicon?.resolved ?? "—";
    },

    attach() {
      // One controller at a time: attaching twice would append a second owned
      // link and the readout would have to explain which of them won.
      this.release();
      favicon = createThemeFaviconController({
        light: LIGHT_ICON,
        dark: DARK_ICON,
        type: "image/svg+xml",
      });

      // The playground swaps <html> on every navigation, which takes the link
      // with it. This is the same event the theme plugin re-applies on, and
      // apply() is the recovery hook that puts a fresh link back.
      const onSwap = (): void => {
        favicon?.apply();
        queueMicrotask(() => this.sync());
      };
      document.addEventListener("astro:after-swap", onSwap);
      teardown.push(() => document.removeEventListener("astro:after-swap", onSwap));

      this.active = true;
      this.sync();
    },

    release() {
      // Host-owned teardown, exactly as the package documents it: nothing
      // calls destroy() for you.
      for (const off of teardown.splice(0)) off();
      favicon?.destroy();
      favicon = null;
      this.active = false;
      this.sync();
    },
  }));
}
