import type { Alpine } from "alpinejs";

export type CommandAction = () => void | Promise<void>;
export type CommandPredicate = boolean | (() => boolean);
export type CommandLoader = () => void | Promise<void>;
export type CommandRankFn = (item: CommandItem, search: string) => number | null;

export type CommandPersistence = {
  readonly maxRecent?: number;
};

export type CommandPage = {
  readonly id: string;
  readonly title: string;
  readonly parentId?: string;
  readonly load?: CommandLoader;
};

export type CommandItem = {
  readonly id: string;
  readonly label: string;
  readonly group?: string;
  readonly shortcut?: string;
  readonly keywords?: string[];
  readonly aliases?: string[];
  readonly disabled?: CommandPredicate;
  readonly hidden?: CommandPredicate;
  readonly enabled?: CommandPredicate;
  readonly pinned?: boolean;
  readonly page?: string;
  readonly load?: CommandLoader;
  readonly action: CommandAction;
};

export type CommandItemState = {
  readonly id: string;
  readonly item: CommandItem;
  readonly disabled: boolean;
  readonly loading: boolean;
  readonly pinned: boolean;
  readonly recent: boolean;
  readonly rank: number;
  readonly selectable: boolean;
};

export type CommandExecutionState = "idle" | "loading" | "running";

export type CommandStoreConfig = {
  readonly onOpen?: () => void;
  readonly onClose?: () => void;
  readonly onRun?: (item: CommandItem) => void;
  readonly rank?: CommandRankFn;
  readonly persistence?: CommandPersistence;
  readonly closeOnRun?: boolean;
};

export interface CommandPluginOptions extends CommandStoreConfig {
  readonly id?: string;
  readonly storeKey?: string;
}

export const DEFAULT_COMMAND_STORE_KEY = "command";

export interface CommandStore {
  search: string;
  activeIndex: number;
  visible: boolean;
  items: Record<string, CommandItem>;
  isOpen: boolean;
  executionState: CommandExecutionState;
  runningId: string | null;
  currentPageId: string;
  pageStack: string[];
  pages: Record<string, CommandPage>;
  loadingIds: string[];
  pinnedIds: string[];
  recentIds: string[];
  open(): void;
  close(): void;
  toggle(): void;
  register(item: CommandItem): () => void;
  unregister(id: string): void;
  run(id: string): Promise<void>;
  cancelRun(): void;
  handleKeydown(event: KeyboardEvent): void;
  pushPage(page: CommandPage): Promise<void>;
  popPage(): void;
  goBack(): void;
  itemState(id: string): CommandItemState | null;
  inputProps(): Record<string, string | boolean | undefined>;
  listboxProps(): Record<string, string | boolean | undefined>;
  optionProps(id: string): Record<string, string | number | boolean | undefined>;
  filteredItems: CommandItem[];
  visibleItems: CommandItemState[];
  groupedItems: Record<string, CommandItem[]>;
  destroy(): void;
}

export type CommandAlpine = Alpine;
export type CommandPluginCallback = (alpine: Alpine) => void;

/**
 * Options for `createCommandController`.
 *
 * One bag rather than `createCommandController(id, config)`: the id was
 * positional and the config was second, so a caller wanting only the config had
 * to pass `undefined` in the first slot.
 */
export type CommandControllerOptions = {
  /** Controller id. Generated when absent. */
  readonly id?: string;
} & CommandStoreConfig;
