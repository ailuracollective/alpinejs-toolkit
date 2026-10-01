import { describe, expect, it } from "vitest";

import {
  getCatalogEntriesByCategory,
  getCatalogEntriesByFamily,
  getFamilies,
  PACKAGE_CATALOG,
  PACKAGE_CATEGORIES,
  PACKAGE_FAMILIES,
  validateCatalogRelations,
} from "../src/catalog/index.js";

describe("package catalog", () => {
  it("covers every package folder that ships an Alpine plugin", () => {
    const ids = PACKAGE_CATALOG.map((entry) => entry.id);

    // 40 workspace folders, minus the three that are not browser plugins
    // (`ui` framework-agnostic helpers, `testing` test harness,
    // `plugin-template` scaffold).
    expect(ids).toHaveLength(37);
    expect(new Set(ids).size).toBe(37);
    expect(PACKAGE_CATALOG.every((entry) => entry.readmePath.startsWith("packages/"))).toBe(true);
  });

  it("names every package with its published npm name", () => {
    for (const entry of PACKAGE_CATALOG) {
      expect(entry.npmPackage).toBe(`@ailura/alpinejs-${entry.folder}`);
      expect(entry.readmePath).toBe(`packages/${entry.folder}/README.md`);
    }
  });

  it("uses every layer and every family", () => {
    expect(new Set(PACKAGE_CATALOG.map((entry) => entry.category)).size).toBe(
      PACKAGE_CATEGORIES.length
    );

    // Total, not partial: every family is used, and `family` is required, so
    // "used" and "assigned" are the same set. The old assertion filtered out
    // `undefined` before counting, which is what let 32 entries go unassigned
    // while this test stayed green.
    const families = new Set(PACKAGE_CATALOG.map((entry) => entry.family));
    expect(families.size).toBe(PACKAGE_FAMILIES.length);
  });

  it("puts every package in a family, with no unassigned entries", () => {
    // The guarantee this change exists to make. `family` is required in the
    // type, so this cannot fail to compile — but the catalog is data, and an
    // entry could still be dropped from a family at runtime. Asserting the
    // partition directly is what makes the invariant checkable rather than
    // merely typed.
    const unassigned = PACKAGE_CATALOG.filter((entry) => entry.family === undefined);
    expect(unassigned.map((entry) => entry.id)).toEqual([]);

    for (const entry of PACKAGE_CATALOG) {
      expect(PACKAGE_FAMILIES.map((family) => family.id)).toContain(entry.family);
    }
  });

  it("declares no empty family", () => {
    // A family with no members renders as an empty page still linked from the
    // sidebar, so `validateCatalogRelations` rejects it. Asserted here as well
    // because the failure is a silent blank page, not an error.
    for (const family of PACKAGE_FAMILIES) {
      expect(PACKAGE_CATALOG.filter((entry) => entry.family === family.id).length).toBeGreaterThan(
        0
      );
    }
  });

  it("groups the permission and query stacks as families", () => {
    expect(getCatalogEntriesByFamily("permissions").map((entry) => entry.id)).toEqual([
      "permissions",
      "notify",
      "geo",
      "attention",
    ]);

    // `json-api` is here now, and sits second: the query cache is the
    // substrate, the JSON:API client consumes it, and the three adapters plug
    // the cache into a state container. Its own summary promised this ("feeding
    // the typed JSON:API client") while the family excluded it.
    expect(getCatalogEntriesByFamily("query-stack").map((entry) => entry.id)).toEqual([
      "query",
      "json-api",
      "query-adapter-alpine",
      "query-adapter-zustand",
      "query-adapter-nanostores",
    ]);
  });

  it("keeps families layer-agnostic and returns every member in family order", () => {
    expect(
      getFamilies()
        .map((family) => family.id)
        .sort()
    ).toEqual(PACKAGE_FAMILIES.map((family) => family.id).sort());

    // The permissions family spans two layers on purpose: the registry and its
    // adapters are Primitives, attention is a Feature (ARCHITECTURE.md §11).
    const members = getCatalogEntriesByFamily("permissions");
    expect(members.map((entry) => entry.id)).toEqual(["permissions", "notify", "geo", "attention"]);
    expect(new Set(members.map((entry) => entry.category))).toEqual(
      new Set(["primitives", "features"])
    );
  });

  it("spans layers in more than one family, not just permissions", () => {
    // `permissions` was the only cross-layer family, and it was pinned as such.
    // Families are the primary grouping now, so a family that cannot cross a
    // layer boundary would force a story to be split — which is what the layer
    // axis used to do to 32 packages. These are the deliberate crossings.
    // `data-entry` and `query-stack` are single-layer by nature — a form story
    // and a data story are each self-contained — so they are deliberately absent.
    const spanning = PACKAGE_FAMILIES.map((family) => ({
      id: family.id,
      layers: new Set(getCatalogEntriesByFamily(family.id).map((entry) => entry.category)),
    })).filter((family) => family.layers.size > 1);

    expect(spanning.map((family) => family.id).sort()).toEqual([
      "permissions",
      "preferences",
      "shell",
      "surfaces",
    ]);
  });

  it("places toast in primitives and attention in features, as the canon does", () => {
    const layers = new Map(PACKAGE_CATALOG.map((entry) => [entry.id, entry.category]));

    expect(layers.get("toast")).toBe("primitives");
    expect(layers.get("attention")).toBe("features");

    const primitives = getCatalogEntriesByCategory("primitives").map((entry) => entry.id);
    const features = getCatalogEntriesByCategory("features").map((entry) => entry.id);

    expect(primitives).toContain("toast");
    expect(primitives).not.toContain("attention");
    expect(features).toContain("attention");
    expect(features).not.toContain("toast");
  });

  it("has valid relations and ordering metadata", () => {
    expect(validateCatalogRelations()).toEqual([]);
  });

  it("numbers every ordering bucket from 1 with no gaps", () => {
    // A gap in `order` reads as deliberate, so it survives: `features` skipped
    // 5 and `data` started at 5 for as long as the catalogue existed, and
    // `attention` sat at 18 inside a 1–12 layer. Nothing broke, which is the
    // problem. `validateEntryOrdering` now rejects a gap as well as a
    // duplicate, so the next package added cannot land in a hole.
    const buckets = new Map<string, number[]>();
    for (const entry of PACKAGE_CATALOG) {
      const bucket = `${entry.category}:${entry.family ?? "-"}`;
      buckets.set(bucket, [...(buckets.get(bucket) ?? []), entry.order]);
    }
    for (const [bucket, orders] of buckets) {
      const sorted = orders.sort((a, b) => a - b);
      // The bucket name rides along in the message so a failure says which one.
      expect(`${bucket}: ${sorted.join(",")}`).toBe(
        `${bucket}: ${sorted.map((_, index) => index + 1).join(",")}`
      );
    }
    expect(validateCatalogRelations()).toEqual([]);
  });

  it("orders a cross-layer family foundation-first", () => {
    // `order` numbers a `category:family` bucket, so it cannot order a family
    // that spans layers on its own. The permissions family spans `primitives`
    // and `features`, and sorting by `order` alone put `attention` wherever its
    // number happened to land. A family is a story, so it reads registry,
    // adapters, then the feature built on them.
    expect(getCatalogEntriesByFamily("permissions").map((entry) => entry.id)).toEqual([
      "permissions",
      "notify",
      "geo",
      "attention",
    ]);
    const layers = getCatalogEntriesByFamily("permissions").map((entry) => entry.category);
    expect(new Set(layers).size).toBe(2);
  });

  it("orders `surfaces` with the Primitives toast before the Features surfaces", () => {
    // `surfaces` is the largest cross-layer family and the one that most needed
    // a story: a toast queue is a surface, so it belongs with dialog, menu and
    // tooltip rather than being filed as a lone Primitives package. The
    // foundation-first sort puts it first, ahead of the Features members.
    //
    // This is what makes families usable as the primary grouping: the layer is
    // the sort key, so a reader meets the substrate inside a family without the
    // top level having to be layers.
    const members = getCatalogEntriesByFamily("surfaces");

    expect(members.map((entry) => entry.id)).toEqual([
      "toast",
      "overlay",
      "dialog",
      "menu",
      "tooltip",
      "command",
    ]);
    expect(members[0]?.category).toBe("primitives");
    expect(new Set(members.map((entry) => entry.category)).size).toBe(2);
  });
});
