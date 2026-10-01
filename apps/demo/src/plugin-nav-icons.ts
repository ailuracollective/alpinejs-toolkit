import * as lucide from "@lucide/astro/icons";

import { FALLBACK_ICON_NAME, PLUGIN_NAV_ICON_NAMES } from "./plugin-nav-icon-names";

type PluginNavIcon = (typeof lucide)["Puzzle"];

const components = lucide as unknown as Record<string, PluginNavIcon>;

/** Resolve a lucide icon by name; unknown names fall back to the puzzle piece. */
function icon(name: string): PluginNavIcon {
  return components[name] ?? components[FALLBACK_ICON_NAME];
}

export function getPluginNavIcon(id: string): PluginNavIcon {
  const name = PLUGIN_NAV_ICON_NAMES[id];
  return name ? icon(name) : icon(FALLBACK_ICON_NAME);
}
