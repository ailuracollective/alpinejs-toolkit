/**
 * Value formatting, search and ordering.
 *
 * These are pure functions over the snapshot shape: no DOM, no globals, nothing
 * to tear down. Keeping them out of the render pass is also what makes the
 * ordering rules testable on their own.
 */
import type { QueryDevtoolsEntry, QueryKey } from "../types";

/** An em dash stands in for "nothing to report", the old panel's convention. */
export const EMPTY_VALUE = "—";

/** `—`, `123ms`, or `1.23s`. */
export function formatDuration(ms: number | null | undefined): string {
  if (ms === null || ms === undefined || ms < 0) return EMPTY_VALUE;
  if (ms < 1000) return `${Math.round(ms)}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

/** Locale clock time, or `—` for a zero/absent timestamp. */
export function formatTime(timestamp: number | null | undefined): string {
  return timestamp ? new Date(timestamp).toLocaleTimeString() : EMPTY_VALUE;
}

export function stableJson(value: unknown): string {
  return JSON.stringify(value);
}

/** Indented JSON, with a fallback for values `JSON.stringify` refuses. */
export function prettyJson(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2) ?? "undefined";
  } catch {
    return String(value);
  }
}

/** One-line, human-readable rendering of any value. */
export function displayValue(value: unknown): string {
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (value === null) return "null";
  if (value === undefined) return "undefined";
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

/** Leaf rendering inside the tree: strings keep their quotes, everything else does not. */
export function treeLeafValue(value: unknown): string {
  if (value === null) return "null";
  if (typeof value === "string") return JSON.stringify(value);
  return String(value);
}

/** `foo.bar-baz qux` -> a lower-cased token set, for the "drop the label" pass. */
function tokens(value: string): Set<string> {
  const normalized = value
    .replace(/\s+#\d+$/, "")
    .trim()
    .toLowerCase();
  const set = new Set([normalized]);
  for (const token of normalized.split(/[.\-_/ ]+/)) if (token) set.add(token);
  return set;
}

/**
 * With more than one source, the source label is a prefix of the visible text;
 * it is dropped from the key so the search box does not have to match it twice.
 */
function matchesLabel(value: unknown, label: string): boolean {
  return tokens(label).has(displayValue(value).toLowerCase());
}

/** `["user", 7]` -> `user › 7`; an empty key renders as the empty-set glyph. */
export function formatKey(key: QueryKey, options: { omitAdapterName?: string } = {}): string {
  if (!Array.isArray(key)) return displayValue(key);
  if (key.length === 0) return "∅";
  const parts = [...key];
  if (options.omitAdapterName) {
    const kept = parts.filter((part) => !matchesLabel(part, options.omitAdapterName as string));
    if (kept.length > 0) return kept.map(displayValue).join(" › ");
  }
  return parts.map(displayValue).join(" › ");
}

export function searchMatches(haystack: string, needle: string): boolean {
  return haystack.toLowerCase().includes(needle.trim().toLowerCase());
}

/** The stable hue source for a source label: a 31-multiplier string hash. */
export function labelHash(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i++) hash = (hash * 31 + value.charCodeAt(i)) >>> 0;
  return hash;
}

export function labelHue(value: string): number {
  return Math.floor((labelHash(value) * 137.508) % 360);
}

/** Per-source label colours, derived from the label so they are stable. */
export function labelColors(label: string, theme: "light" | "dark"): Record<string, string> {
  const hue = labelHue(label);
  return theme === "dark"
    ? {
        borderColor: `hsl(${hue}, 38%, 48%)`,
        background: `hsl(${hue}, 32%, 24%)`,
        color: `hsl(${hue}, 60%, 78%)`,
      }
    : {
        borderColor: `hsl(${hue}, 48%, 68%)`,
        background: `hsl(${hue}, 42%, 90%)`,
        color: `hsl(${hue}, 55%, 28%)`,
      };
}

export function yesNo(value: boolean): string {
  return value ? "Yes" : "No";
}

export function booleanTone(value: boolean): string {
  return value ? "success" : "muted";
}

export function statusTone(status: string): string {
  if (status === "success") return "success";
  if (status === "error") return "error";
  if (status === "pending") return "warning";
  return "muted";
}

export function fetchTone(status: string): string {
  return status === "fetching" || status === "paused" ? "warning" : "muted";
}

/** A badge tone for a `status` or `fetchStatus` value. */
export function stateTone(value: string): "success" | "error" | "pending" | "fetching" | "muted" {
  if (value === "success") return "success";
  if (value === "error") return "error";
  if (value === "fetching") return "fetching";
  if (value === "pending" || value === "paused") return "pending";
  return "muted";
}

export const QUERY_SORTS = ["updated-desc", "updated-asc", "key-asc", "status"] as const;
export type QuerySort = (typeof QUERY_SORTS)[number];

/**
 * The contract carries no mutation timestamp, so mutations have no "updated"
 * order at all: they are ordered by their monotonic `id`. The two sorts are
 * kept so the preference shape and the toolbar stay the same, and the option
 * labels say `by id` rather than pretending a recency exists.
 */
export const MUTATION_SORTS = ["id-desc", "id-asc", "status"] as const;
export type MutationSort = (typeof MUTATION_SORTS)[number];

export function querySortLabel(sort: QuerySort): string {
  switch (sort) {
    case "updated-asc":
      return "Oldest first";
    case "key-asc":
      return "Query key";
    case "status":
      return "Status";
    default:
      return "Last updated";
  }
}

export function mutationSortLabel(sort: MutationSort): string {
  switch (sort) {
    case "id-asc":
      return "Oldest first (by id)";
    case "status":
      return "Status";
    default:
      return "Newest first (by id)";
  }
}

const STATUS_RANK: Record<string, number> = { pending: 0, error: 1, success: 2, idle: 3 };

/** Is this entry mid-flight, by the only signal the snapshot carries? */
export function isBusy(entry: Pick<QueryDevtoolsEntry, "status" | "fetchStatus">): boolean {
  return entry.fetchStatus === "fetching" || entry.status === "pending";
}

/**
 * Recency rank of an entry. A pending entry with no timestamp yet sorts as the
 * most recent, which is what "follow the newest work" means.
 */
export function entryRank(entry: QueryDevtoolsEntry): number {
  const stamp = Math.max(entry.dataUpdatedAt, entry.errorUpdatedAt);
  if (stamp > 0) return stamp;
  return isBusy(entry) ? Number.MAX_SAFE_INTEGER : 0;
}

export type OrderedEntry = QueryDevtoolsEntry & { entryId: string };

export function sortEntries<T extends OrderedEntry>(entries: readonly T[], sort: QuerySort): T[] {
  const sorted = [...entries];
  switch (sort) {
    case "updated-asc":
      return sorted.sort(
        (a, b) => entryRank(a) - entryRank(b) || a.entryId.localeCompare(b.entryId)
      );
    case "key-asc":
      return sorted.sort((a, b) => stableJson(a.key).localeCompare(stableJson(b.key)));
    case "status":
      return sorted.sort(
        (a, b) =>
          (STATUS_RANK[a.status] ?? 99) - (STATUS_RANK[b.status] ?? 99) ||
          stableJson(a.key).localeCompare(stableJson(b.key))
      );
    default:
      return sorted.sort(
        (a, b) => entryRank(b) - entryRank(a) || b.entryId.localeCompare(a.entryId)
      );
  }
}

export type OrderedMutation = { entryId: string; id: number; status: string };

export function sortMutations<T extends OrderedMutation>(
  mutations: readonly T[],
  sort: MutationSort
): T[] {
  const sorted = [...mutations];
  switch (sort) {
    case "id-asc":
      return sorted.sort((a, b) => a.id - b.id || a.entryId.localeCompare(b.entryId));
    case "status":
      return sorted.sort(
        (a, b) => (STATUS_RANK[a.status] ?? 99) - (STATUS_RANK[b.status] ?? 99) || b.id - a.id
      );
    default:
      return sorted.sort((a, b) => b.id - a.id || b.entryId.localeCompare(a.entryId));
  }
}

export function isQuerySort(value: unknown): value is QuerySort {
  return typeof value === "string" && (QUERY_SORTS as readonly string[]).includes(value);
}

export function isMutationSort(value: unknown): value is MutationSort {
  return typeof value === "string" && (MUTATION_SORTS as readonly string[]).includes(value);
}

export function isActiveTab(value: unknown): value is "queries" | "mutations" {
  return value === "queries" || value === "mutations";
}

export function parseJson(
  value: string
): { ok: true; value: unknown } | { ok: false; error: string } {
  try {
    return { ok: true, value: JSON.parse(value) };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Invalid JSON" };
  }
}
