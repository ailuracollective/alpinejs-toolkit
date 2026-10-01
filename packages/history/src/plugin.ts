import { guardStore } from "@ailura/alpinejs-core/guards";
import { resolveStoreKey } from "@ailura/alpinejs-core/registration";
import type { Alpine } from "alpinejs";

import { HistoryController } from "./controller";
import type { CreateHistoryControllerOptions, HistoryEntry, HistoryStore } from "./types";
import { DEFAULT_HISTORY_STORE_KEY } from "./types";

const packageName = "@ailura/alpinejs-history";

/** The controller's getters, named to match the keys `sync()` writes. */
type HistoryView<T, TMeta> = Pick<
  HistoryStore<T, TMeta>,
  "value" | "canUndo" | "canRedo" | "undoStack" | "redoStack" | "transactionDepth"
>;

export function historyPlugin<T>(
  options: CreateHistoryControllerOptions<T> = {}
): (alpine: Alpine) => void {
  const storeKey = resolveStoreKey(options, DEFAULT_HISTORY_STORE_KEY);

  return function registerHistory(alpine: Alpine): void {
    const controller = new HistoryController<T>(options);

    // Every bound value is read and written through this one reactive object.
    //
    // The previous store snapshotted the controller's values into plain fields
    // at registration and rewrote them on `change`. That left `value` undefined
    // on first paint — a valid `0` rendered as "none" — because the first
    // `change` had not fired yet.
    const reactive = (alpine as unknown as { reactive?: (v: unknown) => unknown }).reactive;
    const raw: Record<string, unknown> = {};
    const view = (reactive ? reactive(raw) : raw) as Record<string, unknown>;
    const read = <K extends keyof HistoryView<T, unknown>>(key: K) =>
      view[key] as HistoryView<T, unknown>[K];

    // The stacks are copied, not aliased. The controller mutates them in place,
    // so assigning the same array would hand Alpine's `set` trap an identical
    // value, which it treats as a no-op: `undoStack.length` stayed frozen at
    // its first length while the controller grew the array underneath. A fresh
    // array each time makes the identity change the reactivity depends on.
    const sync = (): void => {
      view["value"] = controller.value;
      view["canUndo"] = controller.canUndo;
      view["canRedo"] = controller.canRedo;
      view["undoStack"] = [...controller.undoStack];
      view["redoStack"] = [...controller.redoStack];
      view["transactionDepth"] = controller.transactionDepth;
    };
    sync();
    controller.on("change", sync);

    const store: HistoryStore<T> = {
      get value() {
        return read("value") as T | undefined;
      },
      get canUndo() {
        return read("canUndo") as boolean;
      },
      get canRedo() {
        return read("canRedo") as boolean;
      },
      get undoStack() {
        return read("undoStack") as readonly HistoryEntry<T>[];
      },
      get redoStack() {
        return read("redoStack") as readonly HistoryEntry<T>[];
      },
      get transactionDepth() {
        return read("transactionDepth") as number;
      },
      commit: (v, m) => controller.commit(v, m),
      push: (v, m) => controller.push(v, m),
      undo: () => controller.undo(),
      redo: () => controller.redo(),
      clear: () => controller.clear(),
      reset: (v, m) => controller.reset(v, m),
      checkpoint: (m) => controller.checkpoint(m),
      transaction: (v) => controller.transaction(v),
      destroy: () => controller.destroy(),
    };

    guardStore(alpine, storeKey, store as unknown as HistoryStore<unknown>, packageName);
  };
}

export default historyPlugin;
