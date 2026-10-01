import { readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { getPlaygroundCatalogEntries } from "../src/catalog/index.js";
import { FALLBACK_ICON_NAME, PLUGIN_NAV_ICON_NAMES } from "../src/plugin-nav-icon-names.js";

const demosDir = fileURLToPath(new URL("../src/components/demos/", import.meta.url));

/**
 * `playground-demos.ts` and `plugin-nav-icons.ts` cannot be imported here:
 * both pull in `.astro` components, which Vitest does not transform. The demo
 * components and the icon names are asserted as data instead — the same
 * mapping the runtime builds.
 */
function demoFileFor(id: string): string | undefined {
  const pascal = id
    .split("-")
    .map((part) => part[0].toUpperCase() + part.slice(1))
    .join("");
  return readdirSync(demosDir).find((file) => file === `${pascal}Demo.astro`);
}

describe("playground demos", () => {
  it("ships a demo component for every catalog entry that claims one", () => {
    const missing = getPlaygroundCatalogEntries()
      .filter((entry) => entry.demo?.available)
      .filter((entry) => !demoFileFor(entry.id))
      .map((entry) => entry.id);

    expect(missing).toEqual([]);
  });

  it("gives every plugin its own nav icon", () => {
    const aliased = getPlaygroundCatalogEntries()
      .map((entry) => entry.id)
      .filter(
        (id) => !PLUGIN_NAV_ICON_NAMES[id] || PLUGIN_NAV_ICON_NAMES[id] === FALLBACK_ICON_NAME
      );

    expect(aliased).toEqual([]);
  });
});
