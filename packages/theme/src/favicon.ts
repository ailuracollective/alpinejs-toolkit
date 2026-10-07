/**
 * Theme-aware favicons.
 *
 * Two strategies, one owner, and the choice between them is a product decision
 * rather than an implementation detail:
 *
 * - `media` writes the two `<link rel="icon">` elements the browser already
 *   understands and then gets out of the way. Zero JavaScript, correct before
 *   the bundle parses, and the browser itself reacts to an OS change. This is
 *   the whole answer when the favicon should follow `prefers-color-scheme`.
 * - `theme` writes **one** link and keeps its `href` pointed at
 *   `ThemeController.resolved`. Needed whenever the application can override
 *   the OS: an explicit `light` preference has to keep the light icon on a
 *   dark OS, and `media` cannot express that.
 *
 * Binding to `prefers-color-scheme` when the app owns the theme is the bug this
 * module exists to avoid, so `theme` is the default: a favicon that silently
 * follows the OS while the page does not is worse than no favicon at all.
 *
 * Ownership: the controller appends its own links and remembers them by
 * reference. `destroy()` removes exactly those elements, and no unrelated
 * `<link rel="icon">` is read, rewritten or removed. Appending (rather than
 * replacing) is deliberate — browsers pick the last matching icon, so ours wins
 * without touching the host's other declarations.
 *
 * SSR-safe: no browser global is touched at import time or in the constructor,
 * and the document is resolved through `safeDocument()` at `mount()`. Without
 * a document the handle is inert rather than throwing, so a server render can
 * construct it and skip `destroy()` safely.
 */

import { BaseController } from "@ailura/alpinejs-core/controller";
import { safeDocument } from "@ailura/alpinejs-core/env";

import { createThemeController } from "./controller";
import type { ThemeController } from "./controller";
import type { ResolvedTheme } from "./types";

/**
 * Marks every `<link rel="icon">` this module creates.
 *
 * Ownership itself is by reference — `destroy()` removes the elements it
 * appended, not everything carrying this attribute — so a second controller
 * (or a host) can never have its icons swept up by the first one's teardown.
 * The attribute is for debugging and for host CSS, not for cleanup.
 */
export const THEME_FAVICON_ATTRIBUTE = "data-theme-favicon";

const LIGHT_MEDIA = "(prefers-color-scheme: light)";
const DARK_MEDIA = "(prefers-color-scheme: dark)";

/** Which source of truth decides the icon. */
export type ThemeFaviconStrategy = "theme" | "media";

export interface CreateThemeFaviconOptions {
  /** Icon used while `resolved` is `'light'`. Also the `'media'` strategy's light icon. */
  readonly light: string;
  /** Icon used while `resolved` is `'dark'`. Also the `'media'` strategy's dark icon. */
  readonly dark: string;
  /**
   * Default `'theme'`. `'media'` needs neither `theme` nor JavaScript once
   * the two links are written, so it also never constructs a controller.
   */
  readonly strategy?: ThemeFaviconStrategy;
  /** Source of `resolved` for the `'theme'` strategy. Defaults to the package's singleton controller. */
  readonly theme?: ThemeController;
  /** `type` attribute for both links — e.g. `"image/svg+xml"`. */
  readonly type?: string;
  /** `sizes` attribute for both links — e.g. `"any"`. */
  readonly sizes?: string;
  /** Where to append. Defaults to `document.head`; `null` makes the handle inert. */
  readonly target?: HTMLHeadElement | null;
}

export function createThemeFaviconController(
  options: CreateThemeFaviconOptions
): ThemeFaviconController {
  const controller = new ThemeFaviconController(options);
  // Applied here, not in the constructor, so the caller gets the icon in place
  // by the time this returns — the same reason `createThemeController` mounts.
  controller.mount();
  return controller;
}

export class ThemeFaviconController extends BaseController {
  readonly strategy: ThemeFaviconStrategy;

  readonly #light: string;
  readonly #dark: string;
  readonly #type: string | undefined;
  readonly #sizes: string | undefined;
  readonly #configuredTheme: ThemeController | undefined;
  readonly #configuredTarget: HTMLHeadElement | null | undefined;

  #head: HTMLHeadElement | null | undefined;
  #links: HTMLLinkElement[] = [];
  #theme: ThemeController | null = null;
  #resolved: ResolvedTheme | null = null;

  constructor(options: CreateThemeFaviconOptions) {
    super();
    this.strategy = options.strategy ?? "theme";
    this.#light = options.light;
    this.#dark = options.dark;
    this.#type = options.type;
    this.#sizes = options.sizes;
    this.#configuredTheme = options.theme;
    this.#configuredTarget = options.target;
  }

  /**
   * The theme the link currently points at, or `null` under the `'media'`
   * strategy — where the browser picks and this controller has no opinion to
   * report. Also `null` before `mount()` and after `destroy()`.
   */
  get resolved(): ResolvedTheme | null {
    return this.#resolved;
  }

  /** The links this controller appended. Empty before `mount()` and after `destroy()`. */
  get links(): readonly HTMLLinkElement[] {
    return this.#links;
  }

  /**
   * Re-point the link at `resolved` right now, forcing the write even when the
   * value has not changed — the recovery hook for a host that replaced
   * `<head>` (a client-side router, a view transition). If the element this
   * controller owns went with the old head, a new one is created and appended.
   * Mirrors `ThemeController.apply()`, and a no-op under `'media'`.
   */
  apply(): void {
    if (this.lifecycle === "destroyed" || this.strategy !== "theme") return;
    const theme = this.#theme;
    const head = this.#headFor();
    if (!theme || !head) return;

    this.#resolved = theme.resolved;
    const href = this.#hrefFor(theme.resolved);
    const link = this.#links[0];
    if (link && link.parentNode === head) {
      this.#write(href);
      return;
    }
    // Detached, or never created: the head we appended to is gone, so
    // re-pointing the old element would write into nothing.
    this.#links[0] = this.#append(head, href, "theme", null);
  }

  override destroy(): void {
    if (this.lifecycle === "destroyed") return;
    // Unsubscribes from the controller's `change` event.
    super.destroy();
    // By reference, so a host's own icon links are never candidates.
    for (const link of this.#links) link.remove();
    this.#links = [];
    this.#theme = null;
    this.#resolved = null;
  }

  protected override setup(): void {
    const head = this.#headFor();
    // No document (server render, or `target: null`). Everything below is
    // DOM work, so the handle stays inert instead of throwing.
    if (!head) return;

    if (this.strategy === "media") {
      // Both links, both at once: which one the browser uses is its own
      // decision, made on a media query it re-evaluates without us.
      this.#links = [
        this.#append(head, this.#light, "light", LIGHT_MEDIA),
        this.#append(head, this.#dark, "dark", DARK_MEDIA),
      ];
      return;
    }

    // Resolved inside `setup()` rather than the constructor so a bare
    // `new ThemeFaviconController()` that is never mounted does not mount a
    // theme controller as a side effect. `createThemeController()` is a
    // singleton, so an app that already has one pays nothing here.
    const theme = this.#configuredTheme ?? createThemeController();
    this.#theme = theme;
    this.#links = [this.#append(head, this.#hrefFor(theme.resolved), "theme", null)];
    this.#resolved = theme.resolved;
    this.onCleanup(theme.on("change", () => this.apply()));
  }

  /**
   * Appends last, on purpose: browsers prefer the last matching
   * `<link rel="icon">`, so a host's own icon declaration stays in the markup
   * and loses.
   */
  #append(
    head: HTMLHeadElement,
    href: string,
    role: string,
    media: string | null
  ): HTMLLinkElement {
    const link = head.ownerDocument.createElement("link");
    link.setAttribute("rel", "icon");
    link.setAttribute(THEME_FAVICON_ATTRIBUTE, role);
    if (media) link.setAttribute("media", media);
    if (this.#type) link.setAttribute("type", this.#type);
    if (this.#sizes) link.setAttribute("sizes", this.#sizes);
    // href before insertion: the fetch should not start twice.
    link.setAttribute("href", href);
    head.append(link);
    return link;
  }

  #write(href: string): void {
    this.#links[0]?.setAttribute("href", href);
  }

  #hrefFor(resolved: ResolvedTheme): string {
    return resolved === "dark" ? this.#dark : this.#light;
  }

  /**
   * `??=` on purpose: a cached `null` would pin a server-rendered controller to
   * "no document" forever, and the client-side mount that follows hydration is
   * exactly the case that must find it.
   */
  #headFor(): HTMLHeadElement | null {
    if (this.#configuredTarget !== undefined) return this.#configuredTarget;
    this.#head ??= safeDocument()?.head ?? null;
    return this.#head;
  }
}
