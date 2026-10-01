/** Layer identifiers — they mirror the layers declared in `ARCHITECTURE.md`. */
export type PackageCategoryId = "foundation" | "primitives" | "features" | "data";

/**
 * Every package belongs to exactly one family, so this is closed and total:
 * there is no "standalone" package left to describe. A family is a story a
 * reader can follow across layer boundaries — `permissions` holds a Primitives
 * registry, two Primitives adapters and a Features package built on them, and
 * `surfaces` holds a Primitives toast queue beside five Features surfaces.
 */
export type PackageFamilyId =
  | "runtime"
  | "environment"
  | "input"
  | "data-entry"
  | "time"
  | "permissions"
  | "surfaces"
  | "disclosure"
  | "media-display"
  | "shell"
  | "preferences"
  | "query-stack";

export type PackageRole =
  | "foundation"
  | "feature"
  | "capability"
  | "adapter"
  | "bundle"
  | "infrastructure";

export type PackageBadge =
  | "recommended"
  | "specialized"
  | "browser-only"
  | "infrastructure"
  | "adapter"
  | "bundle";

export type PackageSurface = "store" | "magic" | "directive" | "core";

export type PackageCatalogEntry = {
  id: string;
  title: string;
  npmPackage: string;
  folder: string;
  category: PackageCategoryId;
  /**
   * Required, and that is the point: a package with no family has nowhere to
   * appear in the navigation, so the field used to be optional and almost every
   * entry left it unset. The old shape treated a missing family as
   * "standalone" and rendered those packages under their layer, which meant the
   * two groupings partitioned the catalogue rather than describing it — and the
   * families that did exist read as a special case instead of the normal case.
   *
   * A family deliberately carries no layer anchor, so this crosses layers freely.
   */
  family: PackageFamilyId;
  role: PackageRole;
  surface: PackageSurface;
  api: string;
  summary: string;
  readmePath: string;
  order: number;
  badges?: readonly PackageBadge[];
  related?: readonly string[];
  requires?: readonly string[];
  /**
   * Whether this package has a playground page.
   *
   * This flag is the only thing that decides which `/<id>/` pages
   * exist. It used to carry a `componentId` as well, set on every demo
   * package and read by nothing — a second copy of the id that `entries.ts`
   * already keys on and that `demo/playground-demos.ts` maps separately. A typo
   * in it would have been invisible.
   */
  demo?: {
    available: boolean;
  };
};

export type PackageCategory = {
  id: PackageCategoryId;
  title: string;
  summary: string;
  order: number;
};

/**
 * Cross-layer story group. A family deliberately carries no layer anchor: its
 * members may live in different layers, and the family page hangs off the
 * site root instead of a layer page.
 */
export type PackageFamily = {
  id: PackageFamilyId;
  title: string;
  summary: string;
  order: number;
};
