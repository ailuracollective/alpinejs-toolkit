import { REPO_URL, repoFileUrl } from "../config/urls.js";
import { PACKAGE_CATALOG } from "./entries.js";
import { PACKAGE_CATEGORIES, PACKAGE_FAMILIES } from "./metadata.js";
import type {
  PackageCatalogEntry,
  PackageCategory,
  PackageCategoryId,
  PackageFamily,
  PackageFamilyId,
} from "./types.js";

export type {
  PackageBadge,
  PackageCatalogEntry,
  PackageCategory,
  PackageCategoryId,
  PackageFamily,
  PackageFamilyId,
  PackageRole,
  PackageSurface,
} from "./types.js";
export { PACKAGE_CATALOG, PACKAGE_CATEGORIES, PACKAGE_FAMILIES };

const catalogById = new Map(PACKAGE_CATALOG.map((item) => [item.id, item]));

export function getCatalogEntry(id: string): PackageCatalogEntry | undefined {
  return catalogById.get(id);
}

export function getCatalogEntries(): readonly PackageCatalogEntry[] {
  return PACKAGE_CATALOG;
}

export function getCatalogEntriesByCategory(category: PackageCategoryId): PackageCatalogEntry[] {
  return PACKAGE_CATALOG.filter((item) => item.category === category).sort(
    (a, b) => a.order - b.order
  );
}

/**
 * A family's members, in the order a reader should meet them.
 *
 * `order` numbers a `category:family` bucket, so it is only meaningful within
 * one layer — the permissions family spans `primitives` and `features`, and
 * sorting it by `order` alone compared a primitives entry's position against a
 * features entry's. That is why `attention` used to sort last by accident
 * rather than by decision, and why renumbering either bucket moved it.
 *
 * A family is a story, so the story runs foundation-first: the registry and its
 * capability adapters, then the feature built on them. Layer order is the
 * catalogue's own, so this needs no new field. This is what makes a family a
 * usable reading order now that families, not layers, are the primary grouping.
 */
export function getCatalogEntriesByFamily(family: PackageFamilyId): PackageCatalogEntry[] {
  const layerOrder = new Map(PACKAGE_CATEGORIES.map((category) => [category.id, category.order]));
  return PACKAGE_CATALOG.filter((item) => item.family === family).sort(
    (a, b) =>
      (layerOrder.get(a.category) ?? 0) - (layerOrder.get(b.category) ?? 0) || a.order - b.order
  );
}

export function getCategory(id: PackageCategoryId): PackageCategory | undefined {
  return PACKAGE_CATEGORIES.find((category) => category.id === id);
}

export function getFamily(id: PackageFamilyId): PackageFamily | undefined {
  return PACKAGE_FAMILIES.find((family) => family.id === id);
}

/** Every family, ordered by its own `order` — families are layer-agnostic. */
export function getFamilies(): PackageFamily[] {
  return [...PACKAGE_FAMILIES].sort((a, b) => a.order - b.order);
}

export function getPlaygroundCatalogEntries(): PackageCatalogEntry[] {
  return PACKAGE_CATALOG.filter((item) => item.demo?.available === true);
}

/**
 * The one place a demo URL is written.
 *
 * The demos *are* the app: the overview lives at `/` and every package page
 * hangs off the root, so there is no `/playground` prefix. A previous shape did
 * have one, and `/` only 302'd to it — one extra hop on the first paint of
 * every visit, and a second URL for the same page.
 *
 * This shape appeared three times — here, in `playground-navigation.ts` as
 * `playgroundPackagePath`, and in `plugin-nav.ts` as `playgroundPath` — and all
 * three had to agree with `astro.config.ts`'s `trailingSlash: "always"`. The
 * other two now delegate here.
 */
export function playgroundPath(entry: PackageCatalogEntry | string): string {
  const id = typeof entry === "string" ? entry : entry.id;
  return `/${id}/`;
}

/** Source of truth for the package docs lives in each package README. */
export function packageReadmeUrl(entry: PackageCatalogEntry | string): string {
  const item = typeof entry === "string" ? catalogById.get(entry) : entry;
  if (!item) {
    return REPO_URL;
  }
  return repoFileUrl(item.readmePath);
}

function validateEntryRelations(entry: PackageCatalogEntry, ids: ReadonlySet<string>): string[] {
  const errors: string[] = [];

  for (const relatedId of entry.related ?? []) {
    if (!ids.has(relatedId)) {
      errors.push(`${entry.id}: unknown related package "${relatedId}"`);
    }
  }

  for (const requiredId of entry.requires ?? []) {
    if (!(ids.has(requiredId) || requiredId.startsWith("@"))) {
      errors.push(`${entry.id}: unknown required package "${requiredId}"`);
    }
  }

  // Required, so this is an unconditional check rather than a guarded one. The
  // type makes it a compile error, but the catalog is data and `validateCatalogRelations()`
  // is what a test reads: a family that is missing or misspelled must surface here,
  // not as a package that silently vanishes from the navigation.
  if (!getFamily(entry.family)) {
    errors.push(`${entry.id}: unknown or missing family "${entry.family}"`);
  }

  if (!getCategory(entry.category)) {
    errors.push(`${entry.id}: unknown category "${entry.category}"`);
  }

  return errors;
}

/**
 * `order` is scoped to a `category:family` bucket and must number that bucket
 * from 1 with no gaps.
 *
 * Duplicates were the only failure this caught, and they were also the least
 * likely: the buckets are small, so a collision needed deliberate effort. What
 * actually accumulated was the opposite — numbers carried over from a global
 * sequence, leaving `features` skipping 5, `data` starting at 5, and `attention`
 * at 18 inside a 1–12 layer. None of that broke anything, which is the problem:
 * a gap reads as intentional, so nobody renumbers, and the next person to add
 * an entry picks a number from the hole and makes it worse.
 */
function validateEntryOrdering(): string[] {
  const errors: string[] = [];
  const positions = new Map<string, string>();
  const buckets = new Map<string, number[]>();

  for (const entry of PACKAGE_CATALOG) {
    const bucket = `${entry.category}:${entry.family ?? "_"}`;
    const key = `${bucket}:${entry.order}`;
    const existing = positions.get(key);
    if (existing) {
      errors.push(
        `${entry.id}: duplicate order ${entry.order} in ${bucket} (also used by ${existing})`
      );
    }
    positions.set(key, entry.id);
    const orders = buckets.get(bucket) ?? [];
    orders.push(entry.order);
    buckets.set(bucket, orders);
  }

  for (const [bucket, orders] of buckets) {
    const sorted = [...orders].sort((a, b) => a - b);
    const expected = sorted.map((_, index) => index + 1);
    if (sorted.join(",") !== expected.join(",")) {
      errors.push(
        `${bucket}: order must number the bucket from 1 with no gaps, got [${sorted.join(", ")}]`
      );
    }
  }

  return errors;
}

/**
 * Every declared family has at least one member, and every entry is a member.
 *
 * The second half is the guarantee this whole change exists to make, so it is
 * asserted in data rather than left to the type: `family` is required, but a
 * hand-edited catalog that sets it to a family declared with no members would
 * still typecheck, and the family would render as an empty page reachable from
 * the sidebar. The first half catches the empty family from the other side.
 */
function validateFamilyCoverage(): string[] {
  const errors: string[] = [];
  const counts = new Map<PackageFamilyId, number>();
  for (const entry of PACKAGE_CATALOG) {
    counts.set(entry.family, (counts.get(entry.family) ?? 0) + 1);
  }

  for (const family of PACKAGE_FAMILIES) {
    if (!counts.get(family.id)) {
      errors.push(`family "${family.id}" is declared but no package belongs to it`);
    }
  }
  for (const [family, count] of counts) {
    if (!getFamily(family)) {
      errors.push(`${count} package(s) claim undeclared family "${family}"`);
    }
  }

  return errors;
}

export function validateCatalogRelations(): string[] {
  const ids = new Set(PACKAGE_CATALOG.map((item) => item.id));
  const relationErrors = PACKAGE_CATALOG.flatMap((entry) => validateEntryRelations(entry, ids));
  return [...relationErrors, ...validateEntryOrdering(), ...validateFamilyCoverage()];
}
