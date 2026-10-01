import type { Alpine } from "alpinejs";

export type CloneStrategy<T> = (value: T) => T;
export type EqualityStrategy<T> = (a: T, b: T) => boolean;

export type HistoryEntryMeta<TMeta = unknown> = {
  readonly id: string;
  readonly timestamp: number;
  readonly label?: string;
  readonly group?: string;
  readonly estimatedSize?: number;
  readonly meta?: TMeta;
};

export type HistoryEntry<T, TMeta = unknown> = {
  readonly value: T;
  readonly meta: HistoryEntryMeta<TMeta>;
};

export type HistoryChangeSource =
  | "commit"
  | "undo"
  | "redo"
  | "reset"
  | "checkpoint"
  | "clear"
  | "push"
  | "initialization";

/** Task-required: HistoryState generic. */
export interface HistoryState<T> {
  readonly value: T | undefined;
  readonly canUndo: boolean;
  readonly canRedo: boolean;
  readonly undoStack: readonly HistoryEntry<T>[];
  readonly redoStack: readonly HistoryEntry<T>[];
}

/** Task-required: HistoryOptions generic <T>. */
export type HistoryOptions<T> = CreateHistoryControllerOptions<T>;
export type CreateHistoryOptions<T> = CreateHistoryControllerOptions<T>;

export type CreateHistoryControllerOptions<T> = {
  readonly id?: string;
  readonly initialValue?: T;
  readonly limit?: number;
  readonly clone?: CloneStrategy<T>;
  readonly equality?: EqualityStrategy<T>;
  readonly storeKey?: string;
};

export type TransactionHandle<T> = { readonly value: T; commit(): void; rollback(): void };

export type HistoryManager<T, TMeta = unknown> = {
  readonly value: T | undefined;
  readonly canUndo: boolean;
  readonly canRedo: boolean;
  readonly undoStack: readonly HistoryEntry<T, TMeta>[];
  readonly redoStack: readonly HistoryEntry<T, TMeta>[];
  readonly transactionDepth: number;
  readonly limit: number;
  commit(value: T, meta?: { label?: string; group?: string; meta?: TMeta }): void;
  push(value: T, meta?: { label?: string; group?: string; meta?: TMeta }): void;
  undo(): T | undefined;
  redo(): T | undefined;
  clear(): void;
  reset(value: T, meta?: { label?: string; group?: string; meta?: TMeta }): void;
  checkpoint(meta?: { label?: string; group?: string; meta?: TMeta }): void;
  transaction(initialValue: T): TransactionHandle<T>;
};

export type HistoryStore<T, TMeta = unknown> = {
  value: T | undefined;
  canUndo: boolean;
  canRedo: boolean;
  undoStack: readonly HistoryEntry<T, TMeta>[];
  redoStack: readonly HistoryEntry<T, TMeta>[];
  transactionDepth: number;
  commit(value: T, meta?: { label?: string; group?: string; meta?: TMeta }): void;
  push(value: T, meta?: { label?: string; group?: string; meta?: TMeta }): void;
  undo(): T | undefined;
  redo(): T | undefined;
  clear(): void;
  reset(value: T, meta?: { label?: string; group?: string; meta?: TMeta }): void;
  checkpoint(meta?: { label?: string; group?: string; meta?: TMeta }): void;
  transaction(initialValue: T): TransactionHandle<T>;
  destroy(): void;
};

export type HistoryAlpine = Alpine;
export type HistoryPluginCallback = (alpine: Alpine) => void;
export const DEFAULT_HISTORY_STORE_KEY = "history";
