import {
  getCatalogEntry,
  getCatalogEntriesByFamily,
  getFamilies,
  getPlaygroundCatalogEntries,
  PACKAGE_CATEGORIES,
  playgroundPath,
  type PackageCatalogEntry,
  type PackageCategoryId,
  type PackageFamilyId,
} from "./index.js";

export type PlaygroundSidebarFamily = {
  id: PackageFamilyId;
  title: string;
  summary: string;
  entries: PackageCatalogEntry[];
  /**
   * The layers this family spans, in catalogue order. A family carries no layer
   * anchor, so this is what tells a reader whether a story crosses a boundary —
   * and it is how the layer stays visible now that families, not layers, are
   * the primary grouping.
   */
  layers: PackageCategoryId[];
};

export type PlaygroundSidebarCategory = {
  id: PackageCategoryId;
  title: string;
  summary: string;
  /** The families that have at least one member in this layer. */
  families: PlaygroundSidebarFamily[];
};

function hasDemo(entry: PackageCatalogEntry): boolean {
  return entry.demo?.available === true;
}

/** The layers a family spans, in catalogue order. Derived, never declared twice. */
function familyLayers(family: PackageFamilyId): PackageCategoryId[] {
  const order = new Map(PACKAGE_CATEGORIES.map((category) => [category.id, category.order]));
  return [...new Set(getCatalogEntriesByFamily(family).map((entry) => entry.category))].sort(
    (a, b) => (order.get(a) ?? 0) - (order.get(b) ?? 0)
  );
}

export function playgroundCategoryPath(categoryId: PackageCategoryId): string {
  return `/${categoryId}/`;
}

/** Families hang off the root: they are not anchored to a layer. */
export function playgroundFamilyPath(familyId: PackageFamilyId): string {
  return `/families/${familyId}/`;
}

export function playgroundPackagePath(entry: PackageCatalogEntry | string): string {
  return playgroundPath(entry);
}

/**
 * Every family with its demo-backed entries, in family `order`.
 *
 * This is the primary navigation now. It used to be the secondary one: almost
 * every package had no family, appeared under their layer, and only
 * `permissions` and `query-stack` were grouped — so the grouping a reader
 * actually thinks in ("show me the packages that do this") was the minority
 * case, and the two families that existed read as a special case rather than
 * the rule.
 */
export function buildPlaygroundFamilyGroups(): PlaygroundSidebarFamily[] {
  return getFamilies()
    .map((family) => ({
      id: family.id,
      title: family.title,
      summary: family.summary,
      entries: getCatalogEntriesByFamily(family.id).filter(hasDemo),
      layers: familyLayers(family.id),
    }))
    .filter((family) => family.entries.length > 0);
}

/**
 * Layer groups, each carrying the families that have a member in it.
 *
 * The layer is the secondary view and a family's members are *not* repeated
 * here: a family that spans two layers appears under both, but each package is
 * rendered once per layer it belongs to, and a package belongs to exactly one
 * family. So the layer pages are a cross-section of the families, not a second
 * partition of the packages.
 */
export function buildPlaygroundSidebar(): PlaygroundSidebarCategory[] {
  const families = buildPlaygroundFamilyGroups();
  // `get(default)` rather than `!`: every id here came from `families`, so the
  // lookup cannot miss, and a non-null assertion would only hide it if it did.
  const familyOrder = new Map<PackageFamilyId, number>(
    families.map((family, index) => [family.id, index])
  );
  return PACKAGE_CATEGORIES.map((category) => {
    const own = families
      .filter((family) => family.layers.includes(category.id))
      // Keep only this layer's members. Without this the layer page listed a
      // cross-layer family in full — the Features page would show `permissions`,
      // `notify` and `geo`, which are Primitives packages, and would claim them
      // as Features members. The family page still shows all of them.
      .map((family) => ({
        ...family,
        entries: family.entries.filter((entry) => entry.category === category.id),
      }))
      .filter((family) => family.entries.length > 0)
      // Within a layer, families keep their global order, so the same family
      // does not jump around between the sidebar and a layer page.
      .sort((a, b) => (familyOrder.get(a.id) ?? 0) - (familyOrder.get(b.id) ?? 0));
    return {
      id: category.id,
      title: category.title,
      summary: category.summary,
      families: own,
    };
  }).filter((category) => category.families.length > 0);
}

/** One block of the sidebar: a heading, an href, and the entries under it. */
export type PlaygroundSidebarSection = {
  kind: "family";
  id: PackageFamilyId;
  title: string;
  summary: string;
  entries: PackageCatalogEntry[];
  layers: PackageCategoryId[];
};

/**
 * The sidebar's blocks, in the order they are rendered.
 *
 * Families, and only families. This inverts the previous model, which put layers
 * first on the grounds that a reader working downwards should meet `core`
 * before anything built on it. That reasoning still holds, so it moved rather
 * than disappeared: `Runtime` is family `order: 1` and leads with `core`, and
 * every family lists its members foundation-first (see
 * `getCatalogEntriesByFamily`). Dependency order is now a property of the
 * ordering *within* a family, not of the top level.
 *
 * What is lost is the layer as a visible axis. That is deliberate — with every
 * package in a family, a layer heading would be a heading over a slice of
 * several stories, and the reader would have to reassemble the story from pieces
 * spread across four pages. The layer survives in `entry.category`, in
 * `ARCHITECTURE.md`, and as the subtitle on each family.
 */
export function buildPlaygroundSidebarSections(): PlaygroundSidebarSection[] {
  return buildPlaygroundFamilyGroups().map((family) => ({ kind: "family" as const, ...family }));
}

/**
 * The entries a reader pages through from this one: its family, in family order.
 *
 * This used to fall back to the layer's standalone packages, so a reader walking
 * a family and a reader walking a layer got two different sets. With every
 * package in a family there is no fallback left, which is the point: pagination
 * now always follows the story the reader chose to enter by.
 */
export function getPlaygroundPeers(id: string): PackageCatalogEntry[] {
  const entry = getCatalogEntry(id);
  if (!(entry && hasDemo(entry))) {
    return [];
  }

  return getCatalogEntriesByFamily(entry.family).filter(hasDemo);
}

export function getAdjacentPlaygroundEntries(id: string): {
  prev?: PackageCatalogEntry;
  next?: PackageCatalogEntry;
} {
  const peers = getPlaygroundPeers(id);
  const index = peers.findIndex((entry) => entry.id === id);
  if (index === -1) {
    return {};
  }

  return {
    prev: index > 0 ? peers[index - 1] : undefined,
    next: index < peers.length - 1 ? peers[index + 1] : undefined,
  };
}

export function getPlaygroundBreadcrumbs(id: string): Array<{ label: string; href: string }> {
  const entry = getCatalogEntry(id);
  if (!entry) {
    return [{ label: "Playground", href: "/" }];
  }

  // Every package has a family, so the family crumb is now unconditional and the
  // old "layer crumb for standalone entries" branch is gone. The layer is still
  // reachable from the family page and the sidebar, where it reads as a subtitle.
  const crumbs: Array<{ label: string; href: string }> = [{ label: "Playground", href: "/" }];

  const family = getFamilies().find((item) => item.id === entry.family);
  if (family) {
    crumbs.push({ label: family.title, href: playgroundFamilyPath(family.id) });
  }

  crumbs.push({ label: entry.title, href: playgroundPackagePath(entry) });
  return crumbs;
}

export function getPlaygroundCategoryGroups(): PlaygroundSidebarCategory[] {
  return buildPlaygroundSidebar();
}

export function getPlaygroundFamilyGroups(): PlaygroundSidebarFamily[] {
  return buildPlaygroundFamilyGroups();
}

export function getPlaygroundDemoCount(): number {
  return getPlaygroundCatalogEntries().length;
}
