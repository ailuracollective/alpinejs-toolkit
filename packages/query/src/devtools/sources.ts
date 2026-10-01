/**
 * Multi-source aggregation.
 *
 * The panel can inspect one source or several. Each source keeps its own
 * identity in the merged view — a `storeId` for scoping, a `sourceLabel` for
 * the list, and an `entryId` (`storeId::keyHash` / `storeId::mutationId`) that
 * stays stable across renders, so a selection survives a repaint.
 *
 * The old panel read an `adapterName` off every snapshot. The current
 * `QueryDevtoolsSnapshot` has no such field, so labels come from the mount
 * options instead: the primary source is named by `storeName` (default
 * `query`) and any extra source is numbered. Duplicates are disambiguated with
 * the old `label #n` suffix.
 */
import type { QueryDevtoolsEntry, QueryDevtoolsMutation, QueryDevtoolsSnapshot } from "../types";
import { ALL_SOURCES } from "./preferences";
import type { QueryDevtoolsOptions, QueryDevtoolsSource } from "./types";

export type PanelEntry = QueryDevtoolsEntry & {
  storeId: string;
  sourceLabel: string;
  entryId: string;
};

export type PanelMutation = QueryDevtoolsMutation & {
  storeId: string;
  sourceLabel: string;
  entryId: string;
};

export type PanelSnapshot = {
  /** The controller phase, for the sources that report one. */
  phase: QueryDevtoolsSnapshot["phase"];
  sourceLabel: string;
  entries: PanelEntry[];
  mutations: PanelMutation[];
};

type LabelledSource = { storeId: string; sourceLabel: string; source: QueryDevtoolsSource };

export type SourceAggregator = {
  /** One unsubscribe for every source; calling it releases all of them. */
  subscribe(callback: () => void): () => void;
  getSnapshotView(): PanelSnapshot;
  getSourceOptions(): { id: string; label: string }[];
  getSourcesForScope(scopeId: string): QueryDevtoolsSource[];
  getSourceForEntry(storeId: string): QueryDevtoolsSource;
  getSourceCount(): number;
};

function assertDevtools(source: QueryDevtoolsSource): void {
  if (!source?.devtools) {
    throw new Error(
      "@ailura/alpinejs-query/devtools requires a source exposing devtools.getSnapshot() and devtools.subscribe()"
    );
  }
}

/** `stores` wins; otherwise the primary `store` plus `additionalStores`. */
export function resolveSources(options: QueryDevtoolsOptions): QueryDevtoolsSource[] {
  if (options.stores?.length) return [...new Set(options.stores)];
  const combined = [...(options.store ? [options.store] : []), ...(options.additionalStores ?? [])];
  const unique = [...new Set(combined)];
  if (unique.length === 0) {
    throw new Error("@ailura/alpinejs-query/devtools requires at least one query source");
  }
  return unique;
}

function labelSources(
  sources: readonly QueryDevtoolsSource[],
  options: QueryDevtoolsOptions
): LabelledSource[] {
  const primary = options.storeName ?? "query";
  const used = new Map<string, number>();
  return sources.map((source, index) => {
    const base = index === 0 ? primary : `Store ${index + 1}`;
    const seen = (used.get(base) ?? 0) + 1;
    used.set(base, seen);
    return { storeId: String(index), sourceLabel: seen > 1 ? `${base} #${seen}` : base, source };
  });
}

export function createSourceAggregator(options: QueryDevtoolsOptions): SourceAggregator {
  const sources = resolveSources(options);
  for (const source of sources) assertDevtools(source);
  const labelled = labelSources(sources, options);
  const byId = new Map(labelled.map((entry) => [entry.storeId, entry.source]));

  const getSnapshotView = (): PanelSnapshot => {
    const entries: PanelEntry[] = [];
    const mutations: PanelMutation[] = [];
    let phase: QueryDevtoolsSnapshot["phase"] = "idle";
    for (const { storeId, sourceLabel, source } of labelled) {
      const snapshot = source.devtools.getSnapshot();
      phase = snapshot.phase;
      for (const entry of snapshot.entries) {
        entries.push({ ...entry, storeId, sourceLabel, entryId: `${storeId}::${entry.keyHash}` });
      }
      for (const mutation of snapshot.mutations) {
        mutations.push({
          ...mutation,
          storeId,
          sourceLabel,
          entryId: `${storeId}::${mutation.id}`,
        });
      }
    }
    const names = labelled.map((entry) => entry.sourceLabel);
    return {
      phase,
      sourceLabel: names.length === 1 ? (names[0] ?? "") : names.join(" · "),
      entries,
      mutations,
    };
  };

  return {
    subscribe(callback) {
      const unsubscribes = labelled.map((entry) => entry.source.devtools.subscribe(callback));
      return () => {
        for (const unsubscribe of unsubscribes) unsubscribe();
      };
    },
    getSnapshotView,
    getSourceOptions: () =>
      labelled.map(({ storeId, sourceLabel }) => ({ id: storeId, label: sourceLabel })),
    getSourcesForScope(scopeId) {
      if (scopeId === ALL_SOURCES) return labelled.map((entry) => entry.source);
      const source = byId.get(scopeId);
      return source ? [source] : [];
    },
    getSourceForEntry(storeId) {
      const source = byId.get(storeId);
      if (!source) throw new Error(`No query source registered for store id "${storeId}"`);
      return source;
    },
    getSourceCount: () => labelled.length,
  };
}
