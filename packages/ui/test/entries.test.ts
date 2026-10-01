import { readFileSync, readdirSync } from "node:fs";

import { describe, expect, test } from "vite-plus/test";

describe("entry points", () => {
  test("every source module is a pack entry", () => {
    // Read the real `entry` array out of the package's build config instead of
    // restating it: a module missing from `pack.entry` still builds, still
    // typechecks locally, and only surfaces as `publint`/`attw` noise at the
    // end of the build plus `TS2307` / "Cannot find package" in every consumer
    // — an error that points at the consumers, not at this config.
    const config = readFileSync(new URL("../vite.config.ts", import.meta.url), "utf8");
    const declared = config.match(/entry:\s*\[([^\]]*)\]/);
    expect(declared, "could not read pack.entry from vite.config.ts").not.toBeNull();
    const entries = new Set([...(declared?.[1] ?? "").matchAll(/"([^"]+)"/g)].map((m) => m[1]));

    // Parse the literal, never assert the shape by hand: a config that stopped
    // being a plain array of strings must fail here, not pass vacuously.
    expect(entries, "pack.entry did not parse to any entry").toContain("src/index.ts");

    // Every module in `src` is public here: the docs site and consumers
    // import `@ailura/alpinejs-ui/storage`, `/portal` and `/media` by
    // subpath, and `src/types.ts` is a real entry in its own right. There is
    // no private-by-design module (no `src/internal.ts`) to carve out.
    const modules = readdirSync(new URL("../src", import.meta.url))
      .filter((name) => name.endsWith(".ts"))
      .map((name) => `src/${name}`); // like for like: `pack.entry` names files

    expect(modules.filter((path) => !entries.has(path))).toEqual([]);
  });
});
