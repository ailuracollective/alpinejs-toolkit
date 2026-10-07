import type { AlpineInstance } from "../types/alpine.js";
import { registerCalendarDemo } from "./calendar-demo.js";
import { registerCollectionDemo } from "./collection-demo.js";
import { registerCommandDemo } from "./command-demo.js";
import { registerCoreDemo } from "./core-demo.js";
import { registerDemoShell, registerToastDemoHandlers } from "./demo-shell.js";
import { registerJsonApiDemo } from "./json-api-demo.js";
import { registerQueryAlpineDemo } from "./query-alpine-demo.js";
import { registerQueryAdvancedDemo, registerQueryDemos } from "./query-demos.js";
import { registerQueryNanostoresDemo } from "./query-nanostores-demo.js";
import { registerQueryZustandDemo } from "./query-zustand-demo.js";
import { registerSelectionDemo } from "./selection-demo.js";
import { registerToastSonner } from "./sonner-demo.js";
import { registerThemeFaviconDemo } from "./theme-favicon-demo.js";

/** Registers the Alpine.data modules and window handlers used by the demos. */
export function registerDemoDataModules(Alpine: AlpineInstance): void {
  registerQueryDemos(Alpine);
  registerQueryAdvancedDemo(Alpine);
  registerQueryAlpineDemo(Alpine);
  registerQueryZustandDemo(Alpine);
  registerQueryNanostoresDemo(Alpine);
  registerJsonApiDemo(Alpine);
  registerCalendarDemo(Alpine);
  registerCollectionDemo(Alpine);
  registerCommandDemo(Alpine);
  registerSelectionDemo(Alpine);
  registerCoreDemo(Alpine);
  registerThemeFaviconDemo(Alpine);
  registerDemoShell(Alpine);
  registerToastDemoHandlers(Alpine);
  registerToastSonner(Alpine);
}
