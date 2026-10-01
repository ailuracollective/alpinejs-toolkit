/**
 * Which file each `@ailura/alpinejs-*` specifier resolves to.
 *
 * Every toolkit package resolves to its source entry, so the playground always
 * runs the working tree and never a stale `dist/`. The map is derived from each
 * package's own `exports` keys rather than written out, because a sub-path
 * export is the thing most likely to be forgotten: a package adds
 * `./guards`, the demo uses it, and a hand-maintained list does not have it.
 *
 * This lives in `src/` rather than in `astro.config.ts` because three things
 * need the same answer and two of them are not the bundler:
 *
 * - `astro.config.ts`, as Vite aliases.
 * - `tsconfig.json`, so `tsc` and `astro check` agree with the bundler.
 * - `test/module-resolution.test.ts`, which fails when `tsconfig.json` and this
 *   map disagree. `tsconfig.json` has to be a real file, so it cannot import
 *   anything, which is exactly why it needs checking rather than deriving.
 */

import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const PACKAGES_ROOT = join(import.meta.dirname, "../../../packages");

/** `@ailura/alpinejs-core/guards` → absolute path, and every package's entry. */
export function buildSourceAliases(
  packagesRoot: string = PACKAGES_ROOT,
  warn: (message: string) => void = () => {}
): Record<string, string> {
  const aliases: Record<string, string> = {};

  for (const dir of readdirSync(packagesRoot)) {
    const packageDir = join(packagesRoot, dir);
    const manifest = join(packageDir, "package.json");

    // A build environment can expose a `packages/*` entry without its manifest
    // (partial checkout, stale cache directory, non-package folder). Skip it
    // instead of failing the whole playground build on one stray entry.
    if (!existsSync(manifest)) {
      warn(`skipping "${dir}": no package.json in ${packageDir}`);
      continue;
    }

    const { name, exports: subpaths } = JSON.parse(readFileSync(manifest, "utf8")) as {
      name?: string;
      exports?: Record<string, unknown>;
    };

    if (typeof name !== "string" || !subpaths) {
      warn(`skipping "${dir}": package.json is not a toolkit package`);
      continue;
    }

    // Sub-paths first: an alias is a plain string prefix match, so the bare
    // package name would otherwise swallow every `@scope/pkg/<module>`
    // specifier — the bare alias has to be written last to win.
    for (const subpath of Object.keys(subpaths).filter((key) => key !== ".")) {
      const module = subpath.slice(2);
      aliases[`${name}/${module}`] = join(packagesRoot, dir, "src", `${module}.ts`);
    }
    aliases[name] = join(packagesRoot, dir, "src/index.ts");
  }

  return aliases;
}
