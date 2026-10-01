export { HistoryController, createHistoryController } from "./controller";
export type { HistoryEvents, HistoryChangeDetail } from "./events";
export { historyPlugin, historyPlugin as default } from "./plugin";
export type {
  CloneStrategy,
  CreateHistoryControllerOptions,
  CreateHistoryOptions,
  EqualityStrategy,
  HistoryAlpine,
  HistoryChangeSource,
  HistoryEntry,
  HistoryEntryMeta,
  HistoryManager,
  HistoryOptions,
  HistoryPluginCallback,
  HistoryState,
  HistoryStore,
  TransactionHandle,
} from "./types";
export { DEFAULT_HISTORY_STORE_KEY } from "./types";
