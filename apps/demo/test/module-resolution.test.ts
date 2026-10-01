/**
 * `tsconfig.json`'s `paths` has to agree with the bundler's aliases.
 *
 * The playground resolves `@ailura/alpinejs-*` to each package's *source*, not
 * its `dist/`, so a demo always runs the working tree. That map is derived from
 * each package's own `exports` keys (`src/lib/package-aliases.ts`), which is why
 * a package adding a sub-path export cannot drift out of sync with the demo.
 *
 * `tsconfig.json` cannot be derived, though — it has to be a real JSON file that
 * `tsc` and `astro check` read, and JSON cannot import anything. So it carries a
 * hand-maintained copy, and a hand-maintained copy of a derived list is exactly
 * the thing the derivation was supposed to remove. It had 36 entries, one per
 * specifier, with nothing checking it.
 *
 * This is the check. A package adds `./guards`, a demo imports it, the bundler
 * resolves it, and if `tsconfig.json` does not know about it then `astro check`
 * reports a module-not-found for a module that exists — in the editor, not in
 * the build.
 */
import { readFileSync } from "node:fs";
import { join, relative } from "node:path";

import { describe, expect, it } from "vitest";

import { buildSourceAliases } from "../src/lib/package-aliases.js";

const APP_ROOT = join(import.meta.dirname, "..");

/** `tsconfig.json` is JSONC in practice; it has no comments today, so JSON is enough. */
function readTsconfigPaths(): Record<string, string[]> {
  const raw = readFileSync(join(APP_ROOT, "tsconfig.json"), "utf8");
  const parsed = JSON.parse(raw) as {
    compilerOptions?: { paths?: Record<string, string[]> };
  };
  return parsed.compilerOptions?.paths ?? {};
}

function toRelative(target: string): string {
  return relative(APP_ROOT, target).split("\\").join("/");
}

describe("module resolution", () => {
  const derived = buildSourceAliases(join(APP_ROOT, "../../packages"));
  const configured = readTsconfigPaths();

  it("derives an alias for every package entry", () => {
    // A guard on the derivation itself: if this ever produced an empty map,
    // every comparison below would pass by comparing nothing to nothing.
    expect(Object.keys(derived).length).toBeGreaterThan(30);
  });

  it("resolves every specifier tsconfig declares, the same way the bundler does", () => {
    const wrong: string[] = [];
    for (const [specifier, targets] of Object.entries(configured)) {
      if (specifier.startsWith("@/")) continue; // the app's own `@/*` alias
      const expected = derived[specifier];
      if (expected === undefined) {
        wrong.push(`${specifier}: no package exports this sub-path`);
        continue;
      }
      const got = targets.map((target) => toRelative(join(APP_ROOT, target)));
      if (got.length !== 1 || got[0] !== toRelative(expected)) {
        wrong.push(
          `${specifier}: tsconfig says ${got.join(", ")}, bundler says ${toRelative(expected)}`
        );
      }
    }
    expect(wrong).toEqual([]);
  });

  it("declares every specifier the bundler resolves", () => {
    // The other direction. A missing entry means `tsc` cannot see a sub-path the
    // bundler will happily resolve, so `astro check` fails on a file that builds.
    const missing = Object.keys(derived)
      .filter((specifier) => !(specifier in configured))
      .sort();
    expect(missing).toEqual([]);
  });

  it("points every alias at a file that exists", () => {
    const missing: string[] = [];
    for (const [specifier, target] of Object.entries(derived)) {
      try {
        readFileSync(target, "utf8");
      } catch {
        missing.push(`${specifier} → ${toRelative(target)}`);
      }
    }
    expect(missing).toEqual([]);
  });
});
