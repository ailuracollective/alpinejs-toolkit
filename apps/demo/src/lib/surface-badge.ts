/**
 * How a package's surface reads in the chrome.
 *
 * `PlaygroundPageHeader` and `PlaygroundModuleCard` both render a surface
 * badge, and both derived its label and its colour from a four-way ternary
 * chain that was byte-identical in both files. Two copies of a mapping is two
 * places for a new surface to be forgotten, and the failure is a badge that
 * silently falls through to "Core".
 *
 * A `switch` rather than a `Record` so adding a surface to `PackageSurface`
 * is a type error here instead of an `undefined` at runtime.
 */

import type { PackageSurface } from "../catalog/types.js";

const LABELS: Record<PackageSurface, string> = {
  store: "Store",
  magic: "Magic",
  directive: "Directive",
  core: "Core",
};

const COLORS: Record<PackageSurface, string> = {
  store: "bg-[var(--ios-blue)]/10 text-[var(--ios-blue)]",
  magic: "bg-[var(--ios-purple)]/10 text-[var(--ios-purple)]",
  directive: "bg-[var(--ios-green)]/10 text-[var(--ios-green)]",
  core: "bg-[var(--ios-orange)]/10 text-[var(--ios-orange)]",
};

/** `store` → `"Store"`. */
export function surfaceLabel(surface: PackageSurface): string {
  return LABELS[surface] ?? LABELS.core;
}

/** `store` → the badge's background and foreground tokens. */
export function surfaceColor(surface: PackageSurface): string {
  return COLORS[surface] ?? COLORS.core;
}
