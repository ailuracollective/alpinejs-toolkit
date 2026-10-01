export { TabsController, createTabsController, createTabsStore } from "./controller";
export type { TabsEvents } from "./events";
export { createTabsStoreFromController } from "./store";
export { tabsPlugin, tabsPlugin as default } from "./plugin";
export type {
  TabsControllerOptions,
  CreateTabsOptions,
  TabItem,
  TabsAlpine,
  TabsChangeDetail,
  TabsChangeSource,
  TabsInstance,
  TabsOptions,
  TabsOrientation,
  TabsPluginCallback,
  TabsStore,
} from "./types";
export { DEFAULT_TABS_MAGIC_KEY, DEFAULT_TABS_STORE_KEY } from "./types";
