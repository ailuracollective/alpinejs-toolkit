import {
  getCatalogEntry,
  getPlaygroundCatalogEntries,
  packageReadmeUrl,
  playgroundPath as catalogPlaygroundPath,
  type PackageCatalogEntry,
} from "./catalog/index.js";
import { getAdjacentPlaygroundEntries } from "./catalog/playground-navigation.js";

export type PluginKind = PackageCatalogEntry["surface"];

export type PluginNavItem = {
  id: string;
  title: string;
  package: string;
  api: string;
  kind: PluginKind;
  description: string;
};

function toNavItem(entry: PackageCatalogEntry): PluginNavItem {
  return {
    id: entry.id,
    title: entry.title,
    package: entry.npmPackage,
    api: entry.api,
    kind: entry.surface,
    description: entry.summary,
  };
}

/**
 * The flat list every generated page is built from: one entry per package with
 * a demo, in catalog order. This set *is* the set of `/<id>/` pages.
 *
 * There is deliberately no layer-grouped variant here. One existed, and it was
 * both unused and wrong: it filtered on `demo.available` without excluding
 * family members, so it listed `permissions`, `notify`, `geo` and `attention`
 * under their layers while `buildPlaygroundSidebar()` listed them under their
 * family. Two groupings of the same data, disagreeing, with nothing reading
 * either. `buildPlaygroundSidebar()` is the only one now.
 */
export const PLUGIN_NAV_ITEMS: PluginNavItem[] = getPlaygroundCatalogEntries().map(toNavItem);

export function getPluginNavItem(id: string): PluginNavItem | undefined {
  const entry = getCatalogEntry(id);
  return entry ? toNavItem(entry) : undefined;
}

export function getAdjacentPlugins(id: string): {
  prev?: PluginNavItem;
  next?: PluginNavItem;
} {
  const { prev, next } = getAdjacentPlaygroundEntries(id);
  return {
    prev: prev ? toNavItem(prev) : undefined,
    next: next ? toNavItem(next) : undefined,
  };
}

/**
 * The nav-facing spelling of the catalog's own path builder. The URL shape
 * lives in `catalog/index.ts`; this exists so components import one module.
 */
export function playgroundPath(id: string): string {
  return catalogPlaygroundPath(id);
}

/** The package README is the documentation surface — this app is demos only. */
export function pluginReadmeUrl(id: string): string {
  return packageReadmeUrl(id);
}

export type {
  PackageBadge,
  PackageCatalogEntry,
  PackageCategory,
  PackageCategoryId,
  PackageFamily,
  PackageFamilyId,
  PackageRole,
} from "./catalog/index.js";
export {
  getCatalogEntriesByCategory,
  getCatalogEntriesByFamily,
  getCatalogEntry,
  getFamilies,
  PACKAGE_CATALOG,
  PACKAGE_CATEGORIES,
  PACKAGE_FAMILIES,
  validateCatalogRelations,
} from "./catalog/index.js";
