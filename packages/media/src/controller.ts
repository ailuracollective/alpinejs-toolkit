import { BaseController } from "@ailura/alpinejs-core/controller";
import { safeWindow, safeMatchMedia } from "@ailura/alpinejs-core/env";
import { generateId } from "@ailura/alpinejs-core/ids";
import { createSingleton, releaseSingleton } from "@ailura/alpinejs-core/singletons";
import type { SingletonScope } from "@ailura/alpinejs-core/singletons";

import { resolveBreakpoint } from "./internal/breakpoint";
import type {
  CreateMediaOptions,
  MediaChangeDetail,
  MediaChangeSource,
  MediaEvents,
  MediaIntervals,
  MediaSnapshot,
} from "./types";
import { DEFAULT_MEDIA_INTERVALS } from "./types";

export function createMediaController(options: CreateMediaOptions = {}): MediaController {
  const { scope, ...factoryOptions } = options;
  return createSingleton(
    "@ailura/alpinejs-media/default",
    () => {
      const controller = new MediaController(factoryOptions, scope);
      controller.mount();
      return controller;
    },
    { scope }
  );
}

export class MediaController extends BaseController<MediaEvents> {
  readonly id: string;
  readonly #intervals: MediaIntervals;
  readonly #debounceMs: number;
  readonly #singletonScope: SingletonScope | undefined;

  #snapshot: MediaSnapshot;
  #initialized = false;

  constructor(options: CreateMediaOptions = {}, singletonScope?: SingletonScope) {
    super();
    this.id = options.id ?? generateId("media");
    this.#intervals = options.intervals ?? DEFAULT_MEDIA_INTERVALS;
    this.#debounceMs = options.debounceMs ?? 50;
    this.#singletonScope = singletonScope;
    this.#snapshot = this.#readSnapshot();
  }

  get width(): number {
    return this.#snapshot.width;
  }

  get height(): number {
    return this.#snapshot.height;
  }

  get breakpoint(): string {
    return this.#snapshot.breakpoint;
  }

  get prefersReducedMotion(): boolean {
    return this.#snapshot.prefersReducedMotion;
  }

  get isDark(): boolean {
    return this.#snapshot.isDark;
  }

  snapshot(): MediaSnapshot {
    return { ...this.#snapshot };
  }

  refresh(): void {
    if (this.lifecycle === "destroyed") return;
    this.#update("refresh");
  }

  override destroy(): void {
    if (this.lifecycle === "destroyed") return;
    super.destroy();
    releaseSingleton("@ailura/alpinejs-media/default", this.#singletonScope);
  }

  protected override setup(): void {
    const win = safeWindow();
    if (!win) {
      queueMicrotask(() => {
        if (this.lifecycle === "destroyed" || this.#initialized) return;
        this.#initialized = true;
        this.emit("change", { ...this.#snapshot, previous: null, source: "initialization" });
      });
      return;
    }

    let timer: ReturnType<typeof setTimeout> | null = null;
    const onResize = (): void => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        timer = null;
        this.#update("resize");
      }, this.#debounceMs);
    };

    win.addEventListener("resize", onResize);
    this.onCleanup(() => {
      win.removeEventListener("resize", onResize);
      if (timer) clearTimeout(timer);
    });

    // `addListener` is the pre-2021 Safari spelling; it still fires on the same
    // queries, so a browser that only has it stays in step rather than going
    // stale on a system preference change.
    const mqlMotion = safeMatchMedia("(prefers-reduced-motion: reduce)");
    const mqlDark = safeMatchMedia("(prefers-color-scheme: dark)");
    const onSystem = (): void => this.#update("system");
    if (mqlMotion?.addEventListener) {
      mqlMotion.addEventListener("change", onSystem);
      this.onCleanup(() => mqlMotion.removeEventListener("change", onSystem));
    } else if (mqlMotion?.addListener) {
      mqlMotion.addListener(onSystem as unknown as (ev: MediaQueryListEvent) => void);
      this.onCleanup(() =>
        (mqlMotion as unknown as { removeListener: (l: () => void) => void }).removeListener(
          onSystem
        )
      );
    }
    if (mqlDark?.addEventListener) {
      mqlDark.addEventListener("change", onSystem);
      this.onCleanup(() => mqlDark.removeEventListener("change", onSystem));
    } else if (mqlDark?.addListener) {
      mqlDark.addListener(onSystem as unknown as (ev: MediaQueryListEvent) => void);
      this.onCleanup(() =>
        (mqlDark as unknown as { removeListener: (l: () => void) => void }).removeListener(onSystem)
      );
    }

    queueMicrotask(() => {
      if (this.lifecycle === "destroyed" || this.#initialized) return;
      this.#initialized = true;
      this.emit("change", { ...this.#snapshot, previous: null, source: "initialization" });
    });
  }

  #readSnapshot(): MediaSnapshot {
    const win = safeWindow();
    if (!win) {
      const bp = resolveBreakpoint(1024, this.#intervals);
      return {
        width: 1024,
        height: 768,
        breakpoint: bp,
        prefersReducedMotion: false,
        prefersColorScheme: "no-preference",
        isDark: false,
      };
    }
    const width = win.innerWidth ?? 1024;
    const height = win.innerHeight ?? 768;
    const prefersReducedMotion =
      safeMatchMedia("(prefers-reduced-motion: reduce)")?.matches ?? false;
    const isDark = safeMatchMedia("(prefers-color-scheme: dark)")?.matches ?? false;
    const breakpoint = resolveBreakpoint(width, this.#intervals);
    // Deliberately binary, though `MediaSnapshot` also allows `"no-preference"`:
    // a bare `matchMedia("(prefers-color-scheme)")` probe answers `false` in
    // every browser, so there is nothing to tell `light` apart from
    // "no preference". Collapsing to two values is also what stops
    // `prefersColorScheme` and `isDark` from ever disagreeing.
    const prefersColorScheme: MediaSnapshot["prefersColorScheme"] = isDark ? "dark" : "light";
    return { width, height, breakpoint, prefersReducedMotion, prefersColorScheme, isDark };
  }

  #update(source: MediaChangeSource): void {
    const prev = this.#snapshot;
    const next = this.#readSnapshot();
    if (
      prev.width === next.width &&
      prev.height === next.height &&
      prev.breakpoint === next.breakpoint &&
      prev.prefersReducedMotion === next.prefersReducedMotion &&
      prev.isDark === next.isDark &&
      prev.prefersColorScheme === next.prefersColorScheme
    )
      return;
    this.#snapshot = next;
    const detail: MediaChangeDetail = { ...next, previous: prev, source };
    this.emit("change", detail);
  }
}
