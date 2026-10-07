// @vitest-environment node
/**
 * SSR safety for `controller.ts`, in both of its controllers.
 *
 * This file stays separate from `controller.test.ts` for one reason: it pins
 * the **node** environment, and a test file can only pin one. The package config
 * defaults every test to `happy-dom`, where a `document` exists and an SSR
 * assertion would pass without proving anything.
 *
 * The favicon tests merged into `controller.test.ts`; this one could not, and
 * that is the point of it — it is the only place in the package where a factory
 * is *called* with no DOM at all.
 *
 * Calling is stronger than importing: a bare import only proves the module body
 * is clean, while the interesting failure mode is a constructor or a `setup()`
 * that reads `document` on the way to deciding there is nothing to do.
 */
import { clearAllSingletons } from "@ailura/alpinejs-core/singletons";
import { afterEach, describe, expect, test } from "vite-plus/test";

import { createThemeFaviconController, ThemeFaviconController } from "../src/controller";

const LIGHT_ICON = "/favicon-light.svg";
const DARK_ICON = "/favicon-dark.svg";

afterEach(() => {
  clearAllSingletons();
});

describe("favicon without a document", () => {
  test("there is no document to begin with", () => {
    expect(typeof document).toBe("undefined");
    expect(typeof window).toBe("undefined");
  });

  test("the theme strategy constructs an inert handle instead of throwing", () => {
    const favicon = createThemeFaviconController({ light: LIGHT_ICON, dark: DARK_ICON });

    // A theme controller is still built — it resolves to "light" without
    // matchMedia — but there is no head to write to.
    expect(favicon.strategy).toBe("theme");
    expect(favicon.links).toEqual([]);
    expect(favicon.resolved).toBeNull();
    expect(favicon.lifecycle).toBe("mounted");
  });

  test("the media strategy is inert in exactly the same way", () => {
    const favicon = createThemeFaviconController({
      strategy: "media",
      light: LIGHT_ICON,
      dark: DARK_ICON,
    });

    expect(favicon.links).toEqual([]);
    expect(favicon.resolved).toBeNull();
  });

  test("target: null is inert even where a document would exist", () => {
    const favicon = createThemeFaviconController({
      light: LIGHT_ICON,
      dark: DARK_ICON,
      target: null,
    });

    expect(favicon.links).toEqual([]);
    expect(favicon.resolved).toBeNull();
  });

  test("apply() and destroy() are safe on a server render", () => {
    const favicon = createThemeFaviconController({ light: LIGHT_ICON, dark: DARK_ICON });

    expect(() => favicon.apply()).not.toThrow();
    expect(() => favicon.destroy()).not.toThrow();
    // Idempotent, like every other destroy() in this toolkit.
    expect(() => favicon.destroy()).not.toThrow();
    expect(favicon.lifecycle).toBe("destroyed");
  });

  test("a never-mounted controller touches nothing", () => {
    const favicon = new ThemeFaviconController({ light: LIGHT_ICON, dark: DARK_ICON });

    expect(favicon.lifecycle).toBe("idle");
    expect(favicon.links).toEqual([]);
    expect(() => favicon.destroy()).not.toThrow();
  });
});
