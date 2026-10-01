import { describe, expect, it } from "vitest";

import {
  buildPlaygroundFamilyGroups,
  buildPlaygroundSidebar,
  buildPlaygroundSidebarSections,
  getAdjacentPlaygroundEntries,
  getPlaygroundBreadcrumbs,
  getPlaygroundDemoCount,
  playgroundCategoryPath,
  playgroundFamilyPath,
  playgroundPackagePath,
} from "../src/catalog/playground-navigation.js";

describe("playground navigation", () => {
  it("builds layer groups from the families that have a member in each layer", () => {
    const ids = buildPlaygroundSidebar().map((group) => group.id);
    expect(ids).toEqual(["foundation", "primitives", "features", "data"]);

    const primitives = buildPlaygroundSidebar().find((group) => group.id === "primitives");
    const features = buildPlaygroundSidebar().find((group) => group.id === "features");

    const primitiveIds = primitives?.families.flatMap((f) => f.entries.map((e) => e.id)) ?? [];
    expect(primitiveIds).toContain("env");
    // `toast` is a Primitives package but a member of the `surfaces` family, so
    // the layer page shows it under that family — it is not a layer of its own
    // and not a card outside any family.
    expect(primitives?.families.map((f) => f.id)).toContain("surfaces");
    expect(primitiveIds).toContain("toast");
    // A family that spans layers appears in both, but each layer page shows only
    // its own members. Without the filter in `buildPlaygroundSidebar`, the
    // Features page listed `permissions`, `notify` and `geo` as Features
    // members, which they are not.
    expect(features?.families.map((f) => f.id)).toContain("permissions");
    expect(
      features?.families.find((f) => f.id === "permissions")?.entries.map((e) => e.id)
    ).toEqual(["attention"]);

    for (const group of buildPlaygroundSidebar()) {
      const entries = group.families.flatMap((f) => f.entries);
      expect(entries.length).toBeGreaterThan(0);
      expect(entries.every((entry) => entry.category === group.id)).toBe(true);
    }
  });

  it("builds root-level family groups with every demo-backed member", () => {
    const groups = buildPlaygroundFamilyGroups();

    // Families are the primary grouping now, so this is the whole navigation.
    expect(groups.map((group) => group.id)).toContain("permissions");
    expect(groups.map((group) => group.id)).toContain("query-stack");

    const permissions = groups.find((group) => group.id === "permissions");
    expect(permissions?.entries.map((entry) => entry.id)).toEqual([
      "permissions",
      "notify",
      "geo",
      "attention",
    ]);
    // A cross-layer family keeps members from both layers.
    expect(new Set(permissions?.entries.map((entry) => entry.category))).toEqual(
      new Set(["primitives", "features"])
    );
    // Every member of the query-stack family has a demo now, and a demo-backed
    // family member is exactly a playground entry — so this list is the family
    // itself, and the alpine adapter joins its two siblings here.
    const queryStack = groups.find((group) => group.id === "query-stack");
    expect(queryStack?.entries.map((entry) => entry.id)).toEqual([
      "query",
      "json-api",
      "query-adapter-alpine",
      "query-adapter-zustand",
      "query-adapter-nanostores",
    ]);
  });

  it("renders families in an order that still opens on core", () => {
    // The ordering claim is the whole point of this file having been wrong once.
    // It asserted which entries land in which group and never which group comes
    // first, so families rendered above the layers — the sidebar opened on
    // `permissions`, `notify`, `geo` and `attention`, four capability packages
    // that need `core` to exist, and `core` (order 1, first category) appeared
    // after them. Nothing caught it because nothing read the rendered order.
    //
    // Dependency order did not get dropped when families became primary: `core`
    // is still the first thing a reader meets, now because `runtime` leads the
    // families and `core` leads `runtime`.
    const sections = buildPlaygroundSidebarSections();

    expect(sections.every((section) => section.kind === "family")).toBe(true);
    expect(sections[0]?.id).toBe("runtime");
    expect(sections[0]?.entries[0]?.id).toBe("core");

    // And the same holds inside a family that crosses layers: the Primitives
    // registry precedes the Features package built on it.
    const permissions = sections.find((section) => section.id === "permissions");
    expect(permissions?.entries[0]?.id).toBe("permissions");
    expect(permissions?.entries.at(-1)?.id).toBe("attention");
  });

  it("gives the overview and the sidebar the same order, from one source", () => {
    // Two surfaces used to disagree: the sidebar rendered layers after families,
    // the overview rendered families first and layers after. Both read
    // `buildPlaygroundSidebarSections()` now, so this is one assertion about a
    // single ordered list rather than two about duplicated templates.
    const sections = buildPlaygroundSidebarSections();

    expect(sections.map((section) => section.id)).toEqual(
      buildPlaygroundFamilyGroups().map((group) => group.id)
    );
    // The layer groups are a cross-section of those same families, not a
    // separate partition, so every one of them is covered.
    expect(sections).toHaveLength(buildPlaygroundFamilyGroups().length);
  });

  it("keeps every entry reachable exactly once from the rendered sections", () => {
    // The old template rendered two independent lists; a section list that
    // dropped an entry would silently lose it from the nav, so this counts.
    const ids = buildPlaygroundSidebarSections().flatMap((section) =>
      section.entries.map((entry) => entry.id)
    );

    expect(ids).toHaveLength(getPlaygroundDemoCount());
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("hangs every page off the root, with no /playground prefix", () => {
    expect(playgroundFamilyPath("permissions")).toBe("/families/permissions/");
    expect(playgroundFamilyPath("query-stack")).toBe("/families/query-stack/");

    expect(playgroundPackagePath("toast")).toBe("/toast/");
    expect(playgroundPackagePath("attention")).toBe("/attention/");

    expect(playgroundCategoryPath("primitives")).toBe("/primitives/");
  });

  it("counts every demo exactly once across layer groups and family groups", () => {
    // This used to sum layer groups and family groups together, because the two
    // partitioned the catalogue: standalone packages under their layer, family
    // members under their family. Families now own every package, so summing the
    // two would double-count — and a cross-layer family appears in two layer
    // groups, so the sum is no longer the catalogue at all. The layer pages are
    // a cross-section, not a partition.
    const familyIds = buildPlaygroundFamilyGroups().flatMap((family) =>
      family.entries.map((entry) => entry.id)
    );

    expect(familyIds).toHaveLength(getPlaygroundDemoCount());
    expect(new Set(familyIds).size).toBe(familyIds.length);
  });

  it("paginates within a family", () => {
    const { prev, next } = getAdjacentPlaygroundEntries("geo");

    expect(prev?.id).toBe("notify");
    expect(next?.id).toBe("attention");
  });

  it("paginates within a family, not across a layer", () => {
    // Pagination used to fall back to "the other standalone packages in my
    // layer", so the same package had two different sets depending on whether
    // it had a family. Now it is always its family: `gesture` pages within
    // `input` (gesture, keyboard, child), where it used to page across whatever
    // Primitives happened not to be in a family.
    const { prev, next } = getAdjacentPlaygroundEntries("gesture");

    expect(prev).toBeUndefined();
    expect(next?.id).toBe("keyboard");

    const { next: afterKeyboard } = getAdjacentPlaygroundEntries("keyboard");
    expect(afterKeyboard?.id).toBe("child");
  });

  it("pages within the family even when the family spans layers", () => {
    // `disclosure` is Features-only, but the rule is the general one and this
    // pins it on a family that could regress into layer-ordering.
    const { prev, next } = getAdjacentPlaygroundEntries("tabs");

    expect(prev).toBeUndefined();
    expect(next?.id).toBe("accordion");
  });

  it("gives a family member a family breadcrumb and no layer crumb", () => {
    const crumbs = getPlaygroundBreadcrumbs("notify");

    expect(crumbs.map((crumb) => crumb.label)).toEqual(["Playground", "Permissions", "Notify"]);
    expect(crumbs[1]?.href).toBe(playgroundFamilyPath("permissions"));
  });

  it("gives a family member that lives in another layer the same family breadcrumb", () => {
    const crumbs = getPlaygroundBreadcrumbs("attention");

    expect(crumbs.map((crumb) => crumb.label)).toEqual(["Playground", "Permissions", "Attention"]);
    expect(crumbs.map((crumb) => crumb.href)).not.toContain("/features/");
  });

  it("gives every package a family breadcrumb, since every package has a family", () => {
    // `toast` is the package this used to be the counter-example for: a
    // Primitives package with no family, so it got a layer crumb instead. It
    // belongs to `surfaces` now, and so does every other package.
    const crumbs = getPlaygroundBreadcrumbs("toast");

    expect(crumbs.map((crumb) => crumb.label)).toEqual(["Playground", "Surfaces", "Toast"]);
    expect(crumbs[1]?.href).toBe(playgroundFamilyPath("surfaces"));
    expect(crumbs[0]?.href).toBe("/");
  });

  it("gives a family breadcrumb to every demo-backed package", () => {
    // The general form of the previous assertion: no package falls back to a
    // layer crumb, so a reader entering by any package lands in its story.
    for (const entry of buildPlaygroundFamilyGroups().flatMap((family) => family.entries)) {
      const crumbs = getPlaygroundBreadcrumbs(entry.id);
      expect(crumbs).toHaveLength(3);
      expect(crumbs[1]?.href.startsWith("/families/")).toBe(true);
    }
  });
});
