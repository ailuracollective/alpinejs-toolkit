import type { HistoryChangeSource } from "./types";

export interface HistoryChangeDetail<T = unknown> {
  readonly source: HistoryChangeSource;
  readonly value: T | undefined;
}

export interface HistoryEvents<T = unknown> extends Record<string, unknown[]> {
  change: [HistoryChangeDetail<T>];
}
