/**
 * The Alpine data component behind `CoreDemo`.
 *
 * `core` is not an Alpine plugin, so the page cannot prove anything by reading
 * `$store` — the stores on the page were registered by the *other* packages,
 * and a page that only counted them would look identical with `core` removed.
 * So the page calls `core` directly and shows what came back.
 *
 * Everything here imports from the real package. That is the point: the
 * previous version of this page described `guardStore` and `safeWindow` in
 * prose and in code samples, and never once invoked either.
 */

import { safeDocument, safeWindow } from "@ailura/alpinejs-core/env";
import { guardStore } from "@ailura/alpinejs-core/guards";
import { generateId } from "@ailura/alpinejs-core/ids";

import type { AlpineInstance } from "../types/alpine.js";

type CoreDemoData = {
  /** A fresh id per click, from core's counter. */
  generate(): void;
  /** Ids generated so far. */
  ids: string[];
  /**
   * The real collision: two different package names claiming a store that is
   * already taken. The thrown `RegistrationError` message is the output.
   */
  collide(): void;
  collision: string;
  /** Same call with the same package name, which the guard allows. */
  reRegister(): void;
  reregistered: string;
};

export function registerCoreDemo(Alpine: AlpineInstance): void {
  Alpine.data("coreDemo", (): CoreDemoData => ({
    ids: [],
    collision: "",
    reregistered: "",

    generate() {
      this.ids = [generateId("demo"), ...this.ids].slice(0, 5);
    },

    collide() {
      try {
        // `scroll` is registered by @ailura/alpinejs-scroll, so a second
        // package claiming it is exactly the case the guard exists for.
        guardStore(Alpine as never, "scroll", { stub: true }, "@ailura/alpinejs-core-demo");
        this.collision = "no error — the guard let a second package take $store.scroll";
      } catch (error) {
        this.collision = error instanceof Error ? error.message : String(error);
      }
    },

    reRegister() {
      try {
        // Same owner, so this is allowed: a hot reload re-registers the
        // names its package already owns without tripping the guard.
        guardStore(Alpine as never, "scroll", Alpine.store("scroll"), "@ailura/alpinejs-scroll");
        this.reregistered = "allowed — the same package re-registered its own store";
      } catch (error) {
        this.reregistered = error instanceof Error ? error.message : String(error);
      }
    },
  }));
}

/**
 * What core's SSR-safe accessors return *on this page*. Rendered directly, so
 * the claim "these are safe to call at module scope" is a rendered value rather
 * than a sentence.
 */
export function coreEnvSnapshot(): { window: string; document: string } {
  return {
    window: safeWindow() ? "the real window" : "undefined",
    document: safeDocument() ? "the real document" : "undefined",
  };
}
