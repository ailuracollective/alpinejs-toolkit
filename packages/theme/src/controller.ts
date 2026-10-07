import { BaseController } from "@ailura/alpinejs-core/controller";
import { safeDocument } from "@ailura/alpinejs-core/env";
import { generateId } from "@ailura/alpinejs-core/ids";
import { createSingleton, releaseSingleton } from "@ailura/alpinejs-core/singletons";
import type { SingletonScope } from "@ailura/alpinejs-core/singletons";
import { MachineController } from "@ailura/alpinejs-state-machine";
import type { Transition } from "@ailura/alpinejs-state-machine";

import { createDomHandle } from "./internal/dom-strategy";
import { coerceThemePreference, resolveTheme, toThemeEvent } from "./internal/validation";
import { createLocalStorageThemeStorage } from "./storage/local-storage";
import { createSystemObserver, readSystemTheme } from "./system-observer";
import type {
  CreateThemeOptions,
  ResolvedTheme,
  ThemeChangeSource,
  ThemeEvent,
  ThemeEvents,
  ThemePreference,
  ThemeState,
  ThemeStorage,
} from "./types";

// ---------------------------------------------------------------------------
// Theme
// ---------------------------------------------------------------------------
/**
 * Machine shape:
 *  - States: `ThemePreference` = `'light' | 'dark' | 'system'`
 *  - Events: `ThemeEvent` = `'SET_LIGHT' | 'SET_DARK' | 'SET_SYSTEM'`
 *
 * `current` is machine-owned; `system` and `resolved` are derived, because both
 * depend on `prefers-color-scheme` rather than on the preference.
 *
 * Why `toggle` is not a machine event: `toggle` flips the *resolved* theme
 * (`dark` -> `light` else `dark`) and always writes an explicit preference,
 * never `system`. It is imperative selection of `SET_LIGHT` vs `SET_DARK`
 * based on `resolved`, not a distinct edge - adding a separate `TOGGLE` edge
 * would duplicate the two SET edges and hide the decision behind a name that
 * says nothing about which of the two it picked.
 *
 * No self-loops: `set()` short-circuits when the new value already equals
 * `machine.state` before calling `send()`, so a no-op never touches the graph
 * and never writes storage.
 */

const THEME_TRANSITIONS: ReadonlyArray<Transition<ThemePreference, ThemeEvent>> = [
  { name: "SET_LIGHT", from: "dark", to: "light" },
  { name: "SET_LIGHT", from: "system", to: "light" },
  { name: "SET_DARK", from: "light", to: "dark" },
  { name: "SET_DARK", from: "system", to: "dark" },
  { name: "SET_SYSTEM", from: "light", to: "system" },
  { name: "SET_SYSTEM", from: "dark", to: "system" },
];

/**
 * The default controller, one per scope.
 *
 * A singleton because two of them on one page would fight over the same
 * `localStorage` key and the same `<html>` class: the cross-tab listener of one
 * would keep undoing the other. `scope` (defaults to the document) is the
 * escape hatch for tests and for two independent roots.
 */
export function createThemeController(options: CreateThemeOptions = {}): ThemeController {
  const { scope, ...factoryOptions } = options;
  return createSingleton(
    "@ailura/alpinejs-theme/default",
    () => {
      const controller = new ThemeController(factoryOptions, scope);
      controller.mount();
      return controller;
    },
    { scope }
  );
}

export class ThemeController extends BaseController<ThemeEvents> {
  readonly id: string;

  readonly #defaultTheme: ThemePreference;
  readonly #storage: ThemeStorage;
  readonly #dom: ReturnType<typeof createDomHandle>;
  readonly #watchSystem: boolean;
  readonly #crossTab: boolean;
  readonly #singletonScope: SingletonScope | undefined;

  readonly #machine: MachineController<ThemePreference, ThemeEvent>;

  #system: ResolvedTheme;
  #resolved: ResolvedTheme;
  #lastWritten: ThemePreference | null = null;
  #pendingSource: ThemeChangeSource | null = null;

  constructor(options: CreateThemeOptions, singletonScope?: SingletonScope) {
    super();
    this.id = options.id ?? generateId("theme");
    this.#defaultTheme = coerceThemePreference(options.defaultTheme, "system");
    this.#storage = options.storage ?? createLocalStorageThemeStorage();
    this.#watchSystem = options.watchSystem !== false;
    this.#crossTab = options.crossTab !== false;
    this.#dom = createDomHandle(options);
    this.#singletonScope = singletonScope;

    this.#machine = new MachineController<ThemePreference, ThemeEvent>({
      initial: this.#defaultTheme,
      transitions: THEME_TRANSITIONS,
    });

    // Every preference change flows through the machine's `change` event, so the
    // transition graph stays the single gate for what a valid preference is.
    // `pendingSource` is how ThemeController overrides the machine's generic
    // `user`/`reset` labels with its own `ThemeChangeSource` union — the machine
    // cannot distinguish a cross-tab write from a local one.
    this.#machine.on("change", (detail) => {
      const previousResolved = this.#resolved;
      const newCurrent = detail.current;
      const newResolved = resolveTheme(newCurrent, this.#system);
      const source: ThemeChangeSource = this.#pendingSource ?? (detail.source as ThemeChangeSource);
      this.#pendingSource = null;

      if (newResolved !== previousResolved) {
        this.#dom.apply(newResolved);
      }
      this.#resolved = newResolved;

      if (source === "user") {
        this.#storage.set(newCurrent);
        // Remembered so the `storage` event this write provokes is recognised as
        // our own echo and skipped. `storage` fires in *other* tabs only, but a
        // same-tab adapter that does fire would otherwise loop.
        this.#lastWritten = newCurrent;
      }

      const previous: ThemeState | null =
        source === "initialization"
          ? null
          : {
              current: detail.previous as ThemePreference,
              system: this.#system,
              resolved: previousResolved,
            };

      this.emit("change", {
        current: newCurrent,
        system: this.#system,
        resolved: newResolved,
        source,
        previous,
      });
    });

    this.#system = "light";
    this.#resolved = resolveTheme(this.#machine.state, this.#system);
  }

  get current(): ThemePreference {
    return this.#machine.state;
  }

  get system(): ResolvedTheme {
    return this.#system;
  }

  get resolved(): ResolvedTheme {
    return this.#resolved;
  }

  get(): ThemeState {
    return {
      current: this.current,
      system: this.#system,
      resolved: this.#resolved,
    };
  }

  /**
   * `value` is coerced, not validated: an unrecognised string falls back to
   * `defaultTheme` instead of throwing, so a bad value from a URL parameter or
   * a stale `localStorage` entry degrades to the default rather than breaking
   * the page.
   */
  set(value: ThemePreference): void {
    if (this.lifecycle === "destroyed") return;
    const safe = coerceThemePreference(value, this.#defaultTheme);
    if (safe === this.#machine.state) return;
    this.#pendingSource = "user";
    const event = toThemeEvent(safe);
    const committed = this.#machine.send(event);
    if (!committed) this.#pendingSource = null;
  }

  toggle(): void {
    if (this.lifecycle === "destroyed") return;
    const next: ThemePreference = this.#resolved === "dark" ? "light" : "dark";
    if (next === this.#machine.state) return;
    this.#pendingSource = "user";
    const event = toThemeEvent(next);
    const committed = this.#machine.send(event);
    if (!committed) this.#pendingSource = null;
  }

  /**
   * Return to `defaultTheme` and clear the stored value.
   *
   * Already being at the default still removes the key: the point is to stop
   * the stored preference from outliving the session, not to change state.
   */
  reset(): void {
    if (this.lifecycle === "destroyed") return;
    if (this.#machine.state === this.#defaultTheme) {
      this.#storage.remove();
      return;
    }
    this.#pendingSource = "reset";
    const event = toThemeEvent(this.#defaultTheme);
    const committed = this.#machine.send(event);
    if (!committed) {
      this.#pendingSource = null;
      return;
    }
    this.#storage.remove();
  }

  /**
   * Re-write the resolved theme to the DOM, bypassing the "already applied"
   * short-circuit in the handle. This is the recovery hook for a host that
   * replaced `<html>` — a view transition, a client-side router, a full
   * re-render — and the reason `reapplyEvents` exists.
   */
  apply(): void {
    if (this.lifecycle === "destroyed") return;
    this.#dom.apply(this.#resolved, true);
  }

  override destroy(): void {
    if (this.lifecycle === "destroyed") return;
    // `super.destroy()` drains the cleanups — the system observer and the
    // cross-tab subscription, both registered with `onCleanup` in `setup()`.
    super.destroy();
    // The DOM handle's `destroy()` also *removes* the class or attribute it
    // added, so a torn-down controller leaves the page as it found it.
    this.#dom.destroy();
    this.#machine.destroy();
    releaseSingleton("@ailura/alpinejs-theme/default", this.#singletonScope);
  }

  /**
   * Order matters here and it is not obvious from the code.
   *
   * 1. Hydrate from storage **before** anything can emit, so the very first
   *    applied theme is the persisted one and there is no light flash to undo.
   * 2. Read the system theme and apply, *before* `machine.mount()`. The machine
   *    queues one microtask on mount that emits `change` with source
   *    `initialization`; `setSilently` has already marked it hydrated, so that
   *    microtask no-ops and this controller owns the one `initialization` emit
   *    at the end of `setup()`.
   */
  protected override setup(): void {
    const persisted = this.#storage.get();
    const safe = coerceThemePreference(persisted ?? this.#defaultTheme, this.#defaultTheme);
    this.#machine.setSilently(safe);

    this.#system = readSystemTheme();
    this.#resolved = resolveTheme(this.#machine.state, this.#system);
    this.#dom.apply(this.#resolved);

    // Mount the machine now that hydration is done — its pending
    // initialization microtask sees `hydrated` and no-ops.
    this.#machine.mount();

    if (this.#watchSystem) {
      const stop = createSystemObserver((next) => this.#handleSystemChange(next));
      this.onCleanup(stop);
    }

    // Optional on the adapter, not on the option: a memory-backed storage has
    // no `storage` event to listen to, so `crossTab: true` is a request, not a
    // guarantee that anything will be delivered.
    if (this.#crossTab && this.#storage.subscribe) {
      const subscribe = this.#storage.subscribe.bind(this.#storage);
      const stop = subscribe((next) => this.#handleCrossTabUpdate(next));
      this.onCleanup(stop);
    }

    // One microtask, so a listener registered right after `createThemeController`
    // returns still sees the initialization emit. `previous: null` distinguishes
    // it from every later change.
    queueMicrotask(() => {
      if (this.lifecycle === "destroyed") return;
      this.emit("change", {
        current: this.#machine.state,
        system: this.#system,
        resolved: this.#resolved,
        source: "initialization",
        previous: null,
      });
    });
  }

  /**
   * A system change only moves the page when the user has actually deferred to
   * the system. On an explicit `light` or `dark` the OS flipping is recorded
   * in `system` and nothing else happens — that is the whole contract of an
   * explicit preference, and getting it wrong makes the OS override a choice
   * the user made on purpose.
   */
  #handleSystemChange(next: ResolvedTheme): void {
    if (this.lifecycle === "destroyed") return;
    this.#system = next;
    if (this.#machine.state !== "system" || next === this.#resolved) return;

    const previousResolved = this.#resolved;
    this.#resolved = next;
    this.#dom.apply(next);
    this.emit("change", {
      current: "system",
      system: next,
      resolved: next,
      source: "system",
      previous: {
        current: "system",
        system: next,
        resolved: previousResolved,
      },
    });
  }

  /**
   * A write from another tab. Unlike a system change this one **does** go
   * through the machine, with source `storage`, so an explicit choice in tab A
   * silently becomes the explicit choice in tab B — including overwriting a
   * `system` preference there.
   *
   * The `#lastWritten` check drops the echo of our own write; see the machine
   * `change` listener in the constructor.
   */
  #handleCrossTabUpdate(next: ThemePreference | null): void {
    if (this.lifecycle === "destroyed") return;
    if (next !== null && this.#lastWritten === next) {
      this.#lastWritten = null;
      return;
    }
    const safe = coerceThemePreference(next ?? this.#defaultTheme, this.#defaultTheme);
    if (safe === this.#machine.state) return;
    this.#pendingSource = "storage";
    const event = toThemeEvent(safe);
    const committed = this.#machine.send(event);
    if (!committed) this.#pendingSource = null;
  }
}

// ---------------------------------------------------------------------------
// Favicon
// ---------------------------------------------------------------------------
/**
 * Theme-aware favicons, the second controller in this file.
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
 * controller exists to avoid, so `theme` is the default: a favicon that silently
 * follows the OS while the page does not is worse than no favicon at all.
 *
 * Ownership: it appends its own links and remembers them by reference.
 * `destroy()` removes exactly those elements, and no unrelated
 * `<link rel="icon">` is read, rewritten or removed. Appending (rather than
 * replacing) is deliberate — browsers pick the last matching icon, so ours wins
 * without touching the host's other declarations.
 *
 * SSR-safe like the rest of this file: no browser global is touched at import
 * time or in the constructor, and the document is resolved through
 * `safeDocument()` at `mount()`. Without a document the handle is inert rather
 * than throwing, so a server render can construct it and skip `destroy()`.
 */
/**
 * Marks every `<link rel="icon">` the favicon controller creates.
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
