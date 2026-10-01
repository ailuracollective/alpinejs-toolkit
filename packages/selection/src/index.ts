/** Barrel only — nothing in this file may do anything but re-export. */

export { SelectionController, createSelectionController } from "./controller";
export type { SelectionEvents, SelectionChangeDetail, SelectionDestroyDetail } from "./events";
export { selectionPlugin, selectionPlugin as default } from "./plugin";
export type {
  SelectionControllerOptions,
  CreateSelectionOptions,
  SelectionAlpine,
  SelectionBehavior,
  SelectionInstance,
  SelectionKey,
  SelectionMode,
  SelectionOptions,
  SelectionPluginCallback,
  SelectionRange,
  SelectionSelectOptions,
  SelectionStore,
  SelectionValue,
} from "./types";
export { DEFAULT_SELECTION_MAGIC_KEY, DEFAULT_SELECTION_STORE_KEY } from "./types";
