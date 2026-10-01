/**
 * Icon name per catalog id, kept as data so it can be unit-tested without
 * importing `.astro` components.
 */
export const PLUGIN_NAV_ICON_NAMES: Record<string, string> = {
  core: "Component",
  "state-machine": "Workflow",
  env: "Globe",
  media: "Monitor",
  lang: "Languages",
  scroll: "ArrowDownUp",
  gesture: "Hand",
  keyboard: "Keyboard",
  history: "History",
  timer: "Timer",
  child: "Replace",
  transfer: "Send",
  selection: "ListChecks",
  collection: "Library",
  calendar: "Calendar",
  form: "LayoutDashboard",
  permissions: "ShieldCheck",
  notify: "Bell",
  geo: "MapPin",
  attention: "Focus",
  overlay: "Layers",
  dialog: "AppWindow",
  menu: "Menu",
  tooltip: "MessageCircle",
  toast: "MessageSquare",
  tabs: "LayoutPanelTop",
  accordion: "ListCollapse",
  command: "Command",
  carousel: "GalleryHorizontal",
  virtual: "List",
  sidebar: "PanelLeft",
  theme: "Palette",
  query: "Database",
  "query-adapter-alpine": "Mountain",
  "query-adapter-zustand": "Atom",
  "query-adapter-nanostores": "Signal",
  "json-api": "Braces",
};

/** Fallback for an id with no dedicated icon. */
export const FALLBACK_ICON_NAME = "Puzzle";
