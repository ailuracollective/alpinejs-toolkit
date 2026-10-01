import { readFileSync, readdirSync } from "node:fs";

import { describe, expect, test } from "vite-plus/test";

import * as bridge from "../src/bridge";
import * as constants from "../src/constants";
import * as controller from "../src/controller";
import * as directives from "../src/directives";
import * as env from "../src/env";
import * as errors from "../src/errors";
import * as guards from "../src/guards";
import * as ids from "../src/ids";
import * as barrel from "../src/index";
import * as invariant from "../src/invariant";
import * as registration from "../src/registration";
import * as singletons from "../src/singletons";
import * as sync from "../src/sync";

const layers = {
  bridge,
  constants,
  controller,
  directives,
  env,
  errors,
  guards,
  ids,
  invariant,
  registration,
  singletons,
  sync,
};

describe("entry points", () => {
  test("barrel re-exports every layer module", () => {
    for (const [name, layer] of Object.entries(layers)) {
      for (const key of Object.keys(layer)) {
        expect(barrel, `${name}.${key} missing from barrel`).toHaveProperty(key);
      }
    }
  });

  test("barrel adds no private internals", () => {
    for (const key of Object.keys(barrel)) {
      const found = Object.values(layers).some((layer) => key in (layer as object));
      expect(found, `${key} is not from a public layer`).toBe(true);
    }
  });

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

    // Modules that are private by design and must never become entries.
    // `src/internal.ts` holds `runLifo`, shared by several layers and bundled
    // into whichever entry imports it (it ships as an `internal-*.mjs` chunk);
    // it is not re-exported by the barrel, so no consumer can import it.
    const privateModules = new Set(["src/internal.ts"]);

    const modules = readdirSync(new URL("../src", import.meta.url))
      .filter((name) => name.endsWith(".ts"))
      .map((name) => `src/${name}`) // like for like: `pack.entry` names files
      .filter((path) => !privateModules.has(path));

    expect(modules.filter((path) => !entries.has(path))).toEqual([]);
  });
});
