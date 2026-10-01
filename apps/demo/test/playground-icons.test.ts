/**
 * Every playground icon has to be a real `@lucide/astro` export, and no two
 * packages should wear the same one.
 *
 * `plugin-nav-icons.ts` resolves a name with `components[name] ?? Puzzle`, so a
 * typo does not fail — it renders a puzzle piece on that page's sidebar, header
 * and card, and nothing anywhere reports it. The name list is kept as plain data
 * precisely so it can be tested, but until now only its *presence* was checked,
 * never whether the string it holds exists.
 *
 * The names are checked against the package's own source on disk rather than by
 * importing `@lucide/astro/icons`. That import is the obvious way and it does
 * not work: the barrel re-exports `Icon.astro`, and Vitest cannot transform
 * `.astro`. `plugin-nav-icon-names.ts` exists as data for the same reason.
 *
 * Both halves of the barrel are read, because a name can come from either: the
 * icon files in `src/icons/`, and the aliases in `src/aliases/aliases.ts` —
 * `History` is one of the latter, with no `history.ts` behind it.
 */
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";

import { describe, expect, it } from "vitest";

import { getPlaygroundCatalogEntries } from "../src/catalog/index.js";
import { FALLBACK_ICON_NAME, PLUGIN_NAV_ICON_NAMES } from "../src/plugin-nav-icon-names.js";

/**
 * Where `@lucide/astro` keeps its source.
 *
 * Found by walking up rather than by resolving, because the package's `exports`
 * map has no `main`, does not expose its own `package.json`, and only offers
 * its icons under the `import` condition — which `require.resolve` ignores.
 * Throws rather than returning an empty set: a test that found no icons would
 * pass every name as missing, or worse, pass vacuously.
 */
function findLucideSrc(): string {
  let directory = import.meta.dirname;
  for (;;) {
    const candidate = join(directory, "node_modules/@lucide/astro/src");
    if (existsSync(candidate)) return candidate;
    const parent = dirname(directory);
    if (parent === directory) {
      throw new Error(`Could not find node_modules/@lucide/astro/src above ${import.meta.dirname}`);
    }
    directory = parent;
  }
}

function availableIconExports(): Set<string> {
  const src = findLucideSrc();
  const names = new Set<string>();

  for (const file of readdirSync(join(src, "icons"))) {
    if (!file.endsWith(".ts")) continue;
    // `layout-panel-top.ts` exports `LayoutPanelTop`.
    const pascal = file
      .replace(/\.ts$/, "")
      .split("-")
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join("");
    names.add(pascal);
  }

  // The aliases: `export { default as History } from "../icons/rotate-ccw"`.
  const aliases = readFileSync(join(src, "aliases/aliases.ts"), "utf8");
  for (const [, name] of aliases.matchAll(/\bas\s+([A-Z][\w$]*)/g)) names.add(name as string);

  return names;
}

const availableIcons = availableIconExports();

describe("playground icons", () => {
  it("finds the lucide icon set at all", () => {
    // If the package layout moves, the checks below pass vacuously — an empty
    // set makes every name "missing", and a fix would be to weaken the test.
    expect(availableIcons.size).toBeGreaterThan(1000);
    expect(availableIcons.has("LayoutPanelTop")).toBe(true);
  });

  it("names a real lucide icon for every package that has a page", () => {
    const missing: string[] = [];
    for (const entry of getPlaygroundCatalogEntries()) {
      const name = PLUGIN_NAV_ICON_NAMES[entry.id];
      if (name === undefined) {
        missing.push(`${entry.id}: no icon`);
        continue;
      }
      if (!availableIcons.has(name)) {
        missing.push(`${entry.id}: "${name}" is not exported by @lucide/astro`);
      }
    }
    expect(missing).toEqual([]);
  });

  it("never falls back to the placeholder", () => {
    // A page wearing `Puzzle` is indistinguishable from a package the author
    // forgot to give an icon, which is why the fallback the resolver offers has
    // to be forbidden here.
    const fallbacks = Object.entries(PLUGIN_NAV_ICON_NAMES)
      .filter(([, name]) => name === FALLBACK_ICON_NAME)
      .map(([id]) => id);
    expect(fallbacks).toEqual([]);
  });

  it("gives each package its own icon", () => {
    // Two packages sharing an icon is not a bug on its own, but it is how a
    // sidebar stops being scannable, and it is invisible until someone counts.
    // `overlay` and `tabs` both wore `LayoutPanelTop`.
    const byIcon = new Map<string, string[]>();
    for (const entry of getPlaygroundCatalogEntries()) {
      const name = PLUGIN_NAV_ICON_NAMES[entry.id];
      if (name === undefined) continue;
      byIcon.set(name, [...(byIcon.get(name) ?? []), entry.id]);
    }
    const shared = [...byIcon.entries()]
      .filter(([, ids]) => ids.length > 1)
      .map(([name, ids]) => `${name}: ${ids.join(", ")}`);
    expect(shared).toEqual([]);
  });

  it("names icons the way lucide does", () => {
    // `HistoryIcon` sat next to thirty-odd `History`-shaped names. The suffixed
    // aliases exist too (`AArrowDownIcon`), so it is not an invented word — but
    // it was the only suffixed name on the list and read as a typo to anyone
    // editing the file.
    const odd = Object.entries(PLUGIN_NAV_ICON_NAMES)
      .filter(([, name]) => name.endsWith("Icon"))
      .map(([id, name]) => `${id}: ${name}`);
    expect(odd).toEqual([]);
  });
});
