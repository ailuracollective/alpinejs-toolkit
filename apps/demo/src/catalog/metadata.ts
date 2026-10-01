import type { PackageCategory, PackageFamily } from "./types.js";

/** Toolkit layers, in dependency order: every layer only depends on the previous ones. */
export const PACKAGE_CATEGORIES: readonly PackageCategory[] = [
  {
    id: "foundation",
    title: "Foundation",
    summary:
      "Zero-peer building blocks: registration guards, storage adapters, and the state machine primitive every controller shares.",
    order: 1,
  },
  {
    id: "primitives",
    title: "Primitives",
    summary:
      "Headless building blocks with no or minimal peers — environment, interaction, time, and device capabilities.",
    order: 2,
  },
  {
    id: "features",
    title: "Features",
    summary:
      "Headless UI state machines: overlays, dialogs, menus, tooltips, toasts, navigation, and theming.",
    order: 3,
  },
  {
    id: "data",
    title: "Data",
    summary: "Query cache, state adapters, and the typed JSON:API client.",
    order: 4,
  },
] as const;

/**
 * Cross-layer groups that ship several packages as one story.
 *
 * Every package belongs to exactly one of these, so the list is total rather
 * than a special case for a few cross-layer clusters. That is a reversal of the
 * previous model, where a family was an exception: almost every entry was
 * "standalone" and appeared under its layer, and only `permissions` and
 * `query-stack` were grouped. Two groupings partitioned the catalogue, and the
 * one that matched the reader's mental model — "show me the packages that do
 * this" — was the minority case.
 *
 * A family may span layers. `surfaces` deliberately holds `toast` (a Primitive)
 * beside the five Features surfaces, because a toast is a surface; anchoring it
 * to its layer would split one story across two pages for no gain.
 */
export const PACKAGE_FAMILIES: readonly PackageFamily[] = [
  {
    id: "runtime",
    title: "Runtime",
    summary:
      "The substrate every other package sits on: registration guards, SSR-safe environment access, and the state machine that theme, form and command are all built from.",
    order: 1,
  },
  {
    id: "environment",
    title: "Environment",
    summary:
      "What the device and the browser can do right now: network state, page visibility, battery, platform, and reactive viewport breakpoints.",
    order: 2,
  },
  {
    id: "input",
    title: "Input",
    summary:
      "Turning raw events into app intent — pointer gestures, scoped keyboard shortcuts with conflict resolution, and attribute forwarding to a single child.",
    order: 3,
  },
  {
    id: "data-entry",
    title: "Data entry",
    summary:
      "Reading a user's input as structured data: form state and validation, selection across single/multiple/range modes, keyed collections to filter and paginate, and date ranges.",
    order: 4,
  },
  {
    id: "time",
    title: "Time",
    summary:
      "Elapsed and reversible time: drift-resistant countdowns, countups and stopwatches, plus an undo/redo controller with transactions.",
    order: 5,
  },
  {
    id: "permissions",
    title: "Permissions",
    summary:
      "One browser permission story across layers: the unified permission registry, its capability adapters (notify, geo), and the attention magics it guards.",
    order: 6,
  },
  {
    id: "surfaces",
    title: "Surfaces",
    summary:
      "Everything that puts content in front of the user: the portal root and z-index stack that anchors them all, then dialog, menu, tooltip, command palette and toast.",
    order: 7,
  },
  {
    id: "disclosure",
    title: "Disclosure",
    summary:
      "Showing part of a page at a time: tabs with roving tabindex and single or multi-open accordions, both with arrow-key navigation and ARIA wiring.",
    order: 8,
  },
  {
    id: "media-display",
    title: "Media & display",
    summary:
      "Presenting a lot of items: an accessible carousel and a headless virtual list that keeps fixed and variable item sizes.",
    order: 9,
  },
  {
    id: "shell",
    title: "App shell",
    summary:
      "The frame around a page: sidebar visibility, overlay, keyboard and responsive state, with scroll position and body lock to match.",
    order: 10,
  },
  {
    id: "preferences",
    title: "Preferences",
    summary:
      "What the user chose and expects to persist: light/dark/system color modes with cross-tab sync, and the current application language.",
    order: 11,
  },
  {
    id: "query-stack",
    title: "Query Stack",
    summary:
      "Store-agnostic query cache with an Alpine.reactive adapter and a zustand/vanilla adapter, feeding the typed JSON:API client.",
    // query-stack is the Data layer's whole story, so it follows the eleven
    // families that span the other three layers.
    order: 12,
  },
] as const;
