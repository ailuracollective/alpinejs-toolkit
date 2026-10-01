/**
 * The history demo's arithmetic must survive an empty history.
 *
 * The playground registers `history()` with no `initialValue`, so
 * `$store.history.value` is `undefined` on the first click. The demo used to
 * read it directly — `$store.history.value + this.step` — which is `NaN`, and
 * because `Object.is(NaN, NaN)` is true the controller then treated every
 * later commit as a duplicate and dropped it. The undo stack never grew, so the
 * whole section looked dead: +1 did nothing at all.
 *
 * The package tests cannot catch this: they exercise their own copy of this
 * markup, because Vitest does not transform `.astro`. This asserts the demo
 * itself coerces.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const source = readFileSync(
  fileURLToPath(new URL("../src/components/demos/HistoryDemo.astro", import.meta.url)),
  "utf8"
);

describe("history demo", () => {
  it("coerces the store value before doing arithmetic on it", () => {
    expect(source).toMatch(/current\(\)\s*\{\s*return\s+\$store\.history\.value\s*\?\?\s*0\s*\}/);
  });

  it("never adds to a possibly-undefined value directly", () => {
    // Any `$store.history.value <op>` outside the `current()` helper is the bug.
    const direct = source.match(/\$store\.history\.value\s*[-+*/]/g);
    expect(direct).toBeNull();
  });
});
