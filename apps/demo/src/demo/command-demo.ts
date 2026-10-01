/**
 * Alpine.data factory for the command palette demo.
 */
import type { AlpineInstance } from "../types/alpine.js";

type CommandStore = {
  items: Record<string, { id: string }>;
  register(action: {
    id: string;
    label: string;
    group: string;
    shortcut?: string;
    keywords?: string[];
    aliases?: string[];
    disabled?: boolean;
    pinned?: boolean;
    page?: string;
    action: () => void | Promise<void>;
  }): () => void;
  pushPage(page: { id: string; title: string; load?: () => Promise<void> }): Promise<void>;
  toggle(): void;
  isOpen: boolean;
  currentPageId: string;
  handleKeydown(event: KeyboardEvent): void;
  inputProps(): Record<string, string | boolean | undefined>;
  listboxProps(): Record<string, string | boolean | undefined>;
  optionProps(id: string): Record<string, string | number | boolean | undefined>;
  itemState(id: string): { disabled: boolean; loading: boolean } | null;
};

type ToastStore = {
  push(payload: { title?: string; variant?: string }): string;
};

type CommandDemoComponent = {
  handleGlobalKey(event: KeyboardEvent): void;
  init(): void;
};

export function registerCommandDemo(Alpine: AlpineInstance): void {
  Alpine.data("commandDemo", (): CommandDemoComponent => ({
    init() {
      const command = Alpine.store("command") as unknown as CommandStore;
      const registerDemo = (item: Parameters<CommandStore["register"]>[0]): void => {
        if (item.id in command.items) {
          return;
        }
        command.register(item);
      };

      registerDemo({
        id: "toggle-theme",
        label: "Toggle theme",
        group: "Appearance",
        shortcut: "⌘K",
        // `pinned` only seeds pinnedIds at register time: there is no
        // pin()/unpin() afterwards, so it is a registration decision, not a
        // toggle in the UI.
        pinned: true,
        // Careful: nothing reads `aliases`. defaultRank only looks at label and
        // keywords — a rank of your own is what makes an alias count.
        aliases: ["spotlight"],
        action: () => (Alpine.store("theme") as { toggle(): void }).toggle(),
      });
      registerDemo({
        id: "toast-demo",
        label: "Show toast",
        group: "Actions",
        keywords: ["notify"],
        // The store's `push()` returns the new id, but `run()` awaits the
        // action and drops what it returns, so this hands back nothing: the
        // action slot is `void | Promise<void>`, not "any value".
        action: () => {
          (Alpine.store("toast") as unknown as ToastStore).push({
            title: "Command executed",
            variant: "success",
          });
        },
      });
      // An async action: run() awaits it, so the palette stays open with the
      // row in loading until it resolves.
      registerDemo({
        id: "export-report",
        label: "Export report (async)",
        group: "Actions",
        keywords: ["csv", "download"],
        action: async () => {
          await new Promise((resolve) => setTimeout(resolve, 1500));
          (Alpine.store("toast") as unknown as ToastStore).push({
            title: "Report exported",
            variant: "success",
          });
        },
      });
      registerDemo({
        id: "open-settings-page",
        label: "Open settings page",
        group: "Navigation",
        action: () => {
          void command.pushPage({
            id: "settings",
            title: "Settings",
            load: () => {
              // Re-entering the page re-runs `load`, so go through the same
              // dedupe guard: `register` throws on a duplicate id.
              registerDemo({
                id: "settings-theme",
                label: "Theme settings",
                group: "Settings",
                page: "settings",
                action: () => (Alpine.store("theme") as { toggle(): void }).toggle(),
              });
              return Promise.resolve();
            },
          });
        },
      });
      registerDemo({
        id: "disabled-demo",
        label: "Disabled action",
        group: "Actions",
        disabled: true,
        action: () => undefined,
      });
    },
    handleGlobalKey(event) {
      const command = Alpine.store("command") as unknown as CommandStore;
      const isMod = event.metaKey || event.ctrlKey;
      if (isMod && event.key.toLowerCase() === "k") {
        event.preventDefault();
        command.toggle();
        return;
      }
      if (command.isOpen) {
        command.handleKeydown(event);
      }
    },
  }));
}
