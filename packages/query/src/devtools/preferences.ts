/**
 * Panel preferences: defaults, validation, persistence and panel geometry.
 *
 * Everything read from `localStorage` is treated as untrusted input — a hand
 * edited or truncated value must never be able to produce an invalid sort key,
 * a `NaN` height or a panel that will not open.
 */
import { readStorage, safeWindow, writeStorage } from "./dom";
import {
  isActiveTab,
  isMutationSort,
  isQuerySort,
  type MutationSort,
  type QuerySort,
} from "./format";
import type { ToggleCorner } from "./types";

/** The synthetic id of the "every source" scope. */
export const ALL_SOURCES = "all";

export type PanelPreferences = {
  selectedSourceId: string;
  querySort: QuerySort;
  mutationSort: MutationSort;
  search: string;
  activeTab: "queries" | "mutations";
  followLatest: boolean;
  mobilePanelHeight: number | null;
  isOpen: boolean;
  rememberOpenState: boolean;
};

export const DEFAULT_PREFERENCES: PanelPreferences = {
  selectedSourceId: ALL_SOURCES,
  querySort: "updated-desc",
  mutationSort: "id-desc",
  search: "",
  activeTab: "queries",
  followLatest: false,
  mobilePanelHeight: null,
  isOpen: false,
  rememberOpenState: false,
};

/** The option-derived values a stored value may not override. */
export type PreferenceSeed = {
  filter?: string;
  followLatest?: boolean;
  initialOpen?: boolean;
  rememberOpenState?: boolean;
};

function bool(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function str(value: unknown, fallback: string): string {
  return typeof value === "string" ? value : fallback;
}

/** A stored height is honoured only when it is a finite positive number. */
function height(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) && value > 0
    ? value
    : DEFAULT_PREFERENCES.mobilePanelHeight;
}

export function normalizePreferences(raw: unknown, seed: PreferenceSeed = {}): PanelPreferences {
  const source = typeof raw === "object" && raw !== null ? (raw as Record<string, unknown>) : {};
  return {
    selectedSourceId:
      typeof source.selectedSourceId === "string" && source.selectedSourceId.length > 0
        ? source.selectedSourceId
        : DEFAULT_PREFERENCES.selectedSourceId,
    querySort: isQuerySort(source.querySort) ? source.querySort : DEFAULT_PREFERENCES.querySort,
    mutationSort: isMutationSort(source.mutationSort)
      ? source.mutationSort
      : DEFAULT_PREFERENCES.mutationSort,
    search: str(source.search, seed.filter ?? DEFAULT_PREFERENCES.search),
    activeTab: isActiveTab(source.activeTab) ? source.activeTab : DEFAULT_PREFERENCES.activeTab,
    followLatest: bool(source.followLatest, seed.followLatest ?? DEFAULT_PREFERENCES.followLatest),
    mobilePanelHeight: height(source.mobilePanelHeight),
    isOpen: bool(source.isOpen, seed.initialOpen ?? DEFAULT_PREFERENCES.isOpen),
    rememberOpenState: bool(
      source.rememberOpenState,
      seed.rememberOpenState ?? DEFAULT_PREFERENCES.rememberOpenState
    ),
  };
}

export function loadPreferences(key: string, seed: PreferenceSeed = {}): PanelPreferences {
  const stored = readStorage(key);
  if (!stored) return normalizePreferences(null, seed);
  try {
    return normalizePreferences(JSON.parse(stored), seed);
  } catch {
    // Corrupt JSON is not worth a console error: the defaults are correct.
    return normalizePreferences(null, seed);
  }
}

export function savePreferences(key: string, preferences: PanelPreferences): void {
  writeStorage(key, JSON.stringify(preferences));
}

export function isToggleCorner(value: unknown): value is ToggleCorner {
  return (
    value !== null &&
    (["top-left", "top-right", "bottom-left", "bottom-right"] as const).includes(
      value as ToggleCorner
    )
  );
}

export function loadToggleCorner(key: string, fallback: ToggleCorner): ToggleCorner {
  const stored = readStorage(key);
  return isToggleCorner(stored) ? stored : fallback;
}

/**
 * Panel height geometry. `min()` is a constant `MIN_PANEL_HEIGHT`, `max()` is
 * "as tall as the viewport allows", and every height the user drags to is
 * clamped between the two — on a short screen the panel never shrinks below the
 * floor and never grows past the ceiling.
 */
const MIN_PANEL_HEIGHT = 400;

function maxPanelHeight(): number {
  const win = safeWindow();
  if (!win) return MIN_PANEL_HEIGHT;
  return Math.min(win.innerHeight * 0.92, win.innerHeight - 16);
}

function heightCeiling(): number {
  return Math.max(MIN_PANEL_HEIGHT, maxPanelHeight());
}

export function clampPanelHeight(value: number): number {
  return Math.min(heightCeiling(), Math.max(MIN_PANEL_HEIGHT, Math.round(value)));
}

/** Applied once when the panel is dragged or restored on a small screen. */
export function preferredPanelHeight(stored: number | null): number {
  return typeof stored === "number" && Number.isFinite(stored) && stored > 0
    ? clampPanelHeight(stored)
    : clampPanelHeight(maxPanelHeight());
}
