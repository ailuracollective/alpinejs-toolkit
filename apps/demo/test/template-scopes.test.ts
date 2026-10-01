/**
 * A frontmatter constant that a template reads must actually reach the scope.
 *
 * `PermissionsDemo` shipped `x-data={JSON.stringify(capabilityLinks)}` and then
 * read `capabilityLinks[name]` below it. Spreading the registry as the data
 * object put `notifications`, `geolocation` and `screen-wake-lock` in the scope
 * as top-level keys; there was no `capabilityLinks` key, so every row threw
 * "capabilityLinks is not defined". The permissions section is on the
 * playground index, so it fired on every page load of the site.
 *
 * Nothing caught it because the registry is a build-time constant and no test
 * ever evaluated the markup. This checks the wiring statically instead, and
 * only for this shape: a frontmatter constant read by a binding, which is
 * neither interpolated into the markup nor named as a key of any `x-data` in
 * the same file. Identifiers a file's own `x-data` introduces are out of scope
 * — checking those would mean reimplementing Alpine's evaluator.
 *
 * The parsing lives in `helpers/demo-source.ts`, shared with the page-contract
 * test. Two copies of "what counts as a binding" drift apart, and the weaker
 * one silently stops catching things.
 */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  bindingExpressions,
  DEMOS_DIR as demosDir,
  dataExpressions,
  frontmatterConsts,
  identifiers,
  splitAstro,
} from "./helpers/demo-source.js";

describe("demo template scopes", () => {
  it("exposes every frontmatter constant a binding reads", () => {
    const offenders: string[] = [];

    for (const file of readdirSync(demosDir).filter((f) => f.endsWith(".astro"))) {
      const { frontmatter, body } = splitAstro(readFileSync(join(demosDir, file), "utf8"));
      const constants = frontmatterConsts(frontmatter);
      if (constants.size === 0) continue;

      // Names this file's own `x-data` puts in scope, and names interpolated
      // into the markup, both reach the template.
      const inScope = new Set<string>();
      for (const expression of dataExpressions(body)) {
        for (const name of identifiers(expression)) inScope.add(name);
        // `x-data={JSON.stringify({ capabilityLinks })}` names the key inside
        // an object literal, so the constant reaches the scope under its own
        // name. `x-data={JSON.stringify(capabilityLinks)}` passes the registry
        // AS the data object, so the scope holds the registry's keys
        // (`notifications`, `geolocation`, ...) and the constant does not
        // appear at all. Presence alone cannot tell the two apart.
        const wrapper = expression.match(/JSON\.stringify\(\s*\{/);
        for (const name of constants) {
          if (!new RegExp(`\\b${name}\\b`).test(expression)) continue;
          if (wrapper) inScope.add(name);
        }
      }
      for (const name of constants) {
        if (new RegExp(`\\{${name}\\}`).test(body)) inScope.add(name);
      }

      for (const expression of bindingExpressions(body)) {
        for (const name of identifiers(expression)) {
          if (!constants.has(name)) continue;
          if (inScope.has(name)) continue;
          offenders.push(`${file}: reads "${name}", which no x-data or interpolation provides`);
        }
      }
    }

    expect(offenders).toEqual([]);
  });

  it("regression: the permissions registry is a named key, not the scope", () => {
    const { body } = splitAstro(readFileSync(join(demosDir, "PermissionsDemo.astro"), "utf8"));
    // Spreading the registry as the data object is the bug: the scope would
    // hold the permission names, and `capabilityLinks` would not exist.
    expect(body).not.toMatch(/x-data=\{JSON\.stringify\(capabilityLinks\)\}/);
    expect(body).toMatch(/x-data=\{JSON\.stringify\(\{\s*capabilityLinks\s*\}\)\}/);
  });
});
