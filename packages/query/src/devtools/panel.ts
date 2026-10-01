/**
 * The devtools panel.
 *
 * One `mountQueryDevtools()` call builds a fixed panel, a corner toggle, every
 * observer it needs and one batched render loop, and returns a controller that
 * can open, close, move and destroy all of it.
 *
 * Three properties are load-bearing, and each is a deliberate departure from
 * the old implementation:
 *
 * 1. **No global without a guard.** Every `document` / `window` /
 *    `localStorage` / `ResizeObserver` / `MutationObserver` / `matchMedia` /
 *    `requestAnimationFrame` access is routed through `./dom`, which resolves it
 *    through `@ailura/alpinejs-core/env`. Nothing is read at import time, and
 *    `mountQueryDevtools()` on a server returns an inert controller instead of
 *    throwing.
 * 2. **Teardown is complete.** The `devtools.subscribe` unsubscribe, the 100 ms
 *    fetch ticker, the resize listeners, the theme `MutationObserver`, the
 *    compact `ResizeObserver`, the media-query listeners and the window
 *    `resize` listener are all released by `destroy()`.
 * 3. **It renders the snapshot it is actually given.** The panel does not
 *    mutate: every write it offers (Refetch, Invalidate, Reset, Remove, Reset
 *    cache, Clear mutations, Edit-and-apply) is probed on the source, and an
 *    affordance the source cannot honour is hidden or disabled with a stated
 *    reason.
 */
import {
  applyClass,
  applySelectClass,
  createEl,
  isBrowser,
  on,
  replaceChildren,
  requestFrame,
  requireDocument,
  resizeObserverCtor,
  mutationObserverCtor,
  safeDocument,
  safeMatchMedia,
  safeWindow,
  scrollIntoViewNearest,
  setCssText,
  setStyles,
  writeStorage,
} from "./dom";
import {
  EMPTY_VALUE,
  MUTATION_SORTS,
  QUERY_SORTS,
  booleanTone,
  entryRank,
  fetchTone,
  formatDuration,
  formatKey,
  formatTime,
  isBusy,
  labelColors,
  mutationSortLabel,
  parseJson,
  prettyJson,
  querySortLabel,
  searchMatches,
  sortEntries,
  sortMutations,
  stableJson,
  stateTone,
  statusTone,
  yesNo,
  type MutationSort,
  type QuerySort,
} from "./format";
import {
  ALL_SOURCES,
  clampPanelHeight,
  loadPreferences,
  loadToggleCorner,
  normalizePreferences,
  preferredPanelHeight,
  savePreferences,
} from "./preferences";
import { createSourceAggregator, type PanelEntry, type PanelMutation } from "./sources";
import { buildTree } from "./tree";
import {
  DEFAULT_PREFERENCES_STORAGE_KEY,
  DEFAULT_TOGGLE_CORNER,
  DEFAULT_TOGGLE_CORNER_STORAGE_KEY,
  TOGGLE_CORNERS,
  type QueryDevtoolsController,
  type QueryDevtoolsMountOptions,
  type QueryDevtoolsSource,
  type ToggleCorner,
} from "./types";

const CORNER_LABELS: Record<ToggleCorner, string> = {
  "top-left": "Top left",
  "top-right": "Top right",
  "bottom-left": "Bottom left",
  "bottom-right": "Bottom right",
};

/** Below this viewport width the panel stacks and the list/detail swap. */
const MOBILE_BREAKPOINT_PX = 640;
/** A rendered panel narrower than this also counts as compact. */
const COMPACT_PANEL_MAX_PX = 680;
/** How often the panel repaints while a query is in flight. */
const FETCH_TICK_MS = 100;
/** The panel never shrinks below this. */
const MIN_PANEL_HEIGHT_PX = 400;

const NOOP: () => void = () => {};

/** Printed whenever the mounted source cannot be written to. */
const READ_ONLY_NOTICE =
  "Read-only source: the devtools contract exposes getSnapshot() and subscribe(), and nothing else. " +
  "Pass a store that also exposes setData() to enable the editor.";

/** On a server there is nothing to mount, but the caller still gets a controller. */
function inertController(corner: ToggleCorner): QueryDevtoolsController {
  let current = corner;
  return {
    open: NOOP,
    close: NOOP,
    toggle: NOOP,
    setToggleCorner(next) {
      current = next;
    },
    getToggleCorner: () => current,
    destroy: NOOP,
  };
}

type Stat = { label: string; value: string; tone?: string };

export function mountQueryDevtools(
  options: QueryDevtoolsMountOptions = {}
): QueryDevtoolsController {
  const {
    position = "bottom",
    initialOpen = false,
    theme = "system",
    toggleCorner = DEFAULT_TOGGLE_CORNER,
    persistToggleCorner = true,
    toggleCornerStorageKey = DEFAULT_TOGGLE_CORNER_STORAGE_KEY,
    persistPreferences = true,
    preferencesStorageKey = DEFAULT_PREFERENCES_STORAGE_KEY,
    followLatest = false,
    rememberOpenState = false,
    zIndex = 60,
  } = options;

  // SSR: no panel, no throw. A server render imports this subpath through the
  // plugin, and the plugin's only job there is to exist.
  if (!isBrowser()) return inertController(toggleCorner);

  const doc = requireDocument();
  const win = safeWindow();
  const aggregator = createSourceAggregator(options);

  // --- state -------------------------------------------------------------
  const seed = { filter: options.filter, followLatest, initialOpen, rememberOpenState };
  const prefs = persistPreferences
    ? loadPreferences(preferencesStorageKey, seed)
    : normalizePreferences(null, seed);

  let isOpen = prefs.isOpen;
  let rememberOpen = prefs.rememberOpenState;
  let activeTab = prefs.activeTab;
  let search = prefs.search;
  let selectedSourceId = prefs.selectedSourceId;
  let querySort = prefs.querySort;
  let mutationSort = prefs.mutationSort;
  let followLatestOn = prefs.followLatest;
  let mobileHeight = prefs.mobilePanelHeight;
  let view: "list" | "detail" = "list";
  let selectedEntryId: string | null = null;
  let selectedMutationId: string | null = null;
  let compact = false;
  let multiSource = false;
  let scheduled = false;
  let destroyed = false;
  let fetchTimer: ReturnType<typeof setInterval> | null = null;
  let corner = persistToggleCorner
    ? loadToggleCorner(toggleCornerStorageKey, toggleCorner)
    : toggleCorner;
  /** When the panel first saw each entry go into `fetching`, for the live timer. */
  const fetchingSince = new Map<string, number>();
  const disposers: (() => void)[] = [];
  const listen = <E extends Event = Event>(
    target: EventTarget | null | undefined,
    type: string,
    handler: (event: E) => void,
    opts?: AddEventListenerOptions
  ) => {
    disposers.push(on<E>(target, type, handler, opts));
  };

  const persist = () => {
    if (!persistPreferences) return;
    savePreferences(preferencesStorageKey, {
      selectedSourceId,
      querySort,
      mutationSort,
      search,
      activeTab,
      followLatest: followLatestOn,
      mobilePanelHeight: mobileHeight,
      isOpen,
      rememberOpenState: rememberOpen,
    });
  };
  /** Only remember the open state when the user asked for it to be remembered. */
  const persistOpen = () => {
    if (rememberOpen) persist();
  };

  // --- DOM ---------------------------------------------------------------
  const root = createEl(doc, "div");
  const isDark = () => root.classList.contains("aq-devtools-root--dark");
  const resolveTheme = (): "light" | "dark" => {
    if (theme === "light" || theme === "dark") return theme;
    const host = safeDocument()?.documentElement;
    const attr = host?.dataset.theme;
    if (attr === "light" || attr === "dark") return attr;
    if (host?.classList.contains("dark")) return "dark";
    return safeMatchMedia("(prefers-color-scheme: dark)")?.matches ? "dark" : "light";
  };
  const applyTheme = () => {
    const resolved = theme === "light" || theme === "dark" ? theme : resolveTheme();
    applyClass(root, "aq-devtools-root", `aq-devtools-root--${resolved}`);
  };
  applyTheme();

  const toggleButton = createEl(doc, "button");
  toggleButton.type = "button";
  toggleButton.setAttribute("aria-label", "Toggle Alpine Query Devtools");
  const toggleDot = createEl(doc, "span");
  setStyles(toggleDot, {
    width: "0.5rem",
    height: "0.5rem",
    borderRadius: "9999px",
    background: "var(--aq-brand)",
    boxShadow: "0 0 0 3px color-mix(in srgb, var(--aq-brand) 25%, transparent)",
    flexShrink: "0",
  });
  const toggleLabel = createEl(doc, "span");
  toggleButton.append(toggleDot, toggleLabel);
  const applyCorner = () =>
    applyClass(toggleButton, "aq-devtools-toggle", `aq-devtools-toggle--${corner}`);

  const panel = createEl(doc, "section");
  applyClass(panel, "aq-devtools-panel", `aq-devtools-panel--${position}`);

  const resizeHandle = createEl(doc, "div");
  applyClass(resizeHandle, "aq-devtools-resize-handle");
  resizeHandle.hidden = true;
  resizeHandle.setAttribute("role", "separator");
  resizeHandle.setAttribute("aria-orientation", "horizontal");
  resizeHandle.setAttribute("aria-label", "Resize panel height");
  const resizeGrip = createEl(doc, "span");
  applyClass(resizeGrip, "aq-devtools-resize-grip");
  resizeHandle.append(resizeGrip);

  const header = createEl(doc, "header");
  applyClass(header, "aq-devtools-header");
  const headerTop = createEl(doc, "div");
  applyClass(headerTop, "aq-devtools-header-top");
  const brand = createEl(doc, "div");
  applyClass(brand, "aq-devtools-brand");
  const title = createEl(doc, "div");
  applyClass(title, "aq-devtools-title");
  title.textContent = "Alpine Query";
  const subtitle = createEl(doc, "div");
  applyClass(subtitle, "aq-devtools-subtitle");
  brand.append(title, subtitle);

  const cornerSelect = createEl(doc, "select");
  applySelectClass(cornerSelect, "aq-devtools-select");
  cornerSelect.setAttribute("aria-label", "Toggle button corner");
  for (const value of TOGGLE_CORNERS) {
    const option = doc.createElement("option");
    option.value = value;
    option.textContent = CORNER_LABELS[value];
    cornerSelect.append(option);
  }
  cornerSelect.value = corner;

  const closeButton = createEl(doc, "button");
  closeButton.type = "button";
  applyClass(closeButton, "aq-devtools-btn", "aq-devtools-btn--icon");
  closeButton.setAttribute("aria-label", "Close Alpine Query Devtools");
  closeButton.textContent = "×";
  headerTop.append(brand, cornerSelect, closeButton);

  const headerToolbar = createEl(doc, "div");
  applyClass(headerToolbar, "aq-devtools-header-toolbar");
  const toolbarTop = createEl(doc, "div");
  const toolbarBottom = createEl(doc, "div");

  const sourceSelect = createEl(doc, "select");
  applySelectClass(sourceSelect, "aq-devtools-select", "aq-devtools-select--adapter");
  sourceSelect.hidden = true;
  sourceSelect.setAttribute("aria-label", "Filter by source");

  const sortSelect = createEl(doc, "select");
  applySelectClass(sortSelect, "aq-devtools-select", "aq-devtools-select--sort");
  sortSelect.setAttribute("aria-label", "Sort list");

  const tabs = createEl(doc, "div");
  applyClass(tabs, "aq-devtools-tabs");
  const queriesTab = createEl(doc, "button");
  queriesTab.type = "button";
  applyClass(queriesTab, "aq-devtools-tab");
  queriesTab.textContent = "Queries";
  const mutationsTab = createEl(doc, "button");
  mutationsTab.type = "button";
  applyClass(mutationsTab, "aq-devtools-tab");
  mutationsTab.textContent = "Mutations";
  tabs.append(queriesTab, mutationsTab);

  const searchInput = createEl(doc, "input");
  applyClass(searchInput, "aq-devtools-search");
  searchInput.type = "search";
  searchInput.placeholder = "Filter by query key…";
  searchInput.value = search;

  const followLatestLabel = createEl(doc, "label");
  applyClass(followLatestLabel, "aq-devtools-follow-latest");
  followLatestLabel.title = "Always select the most recently updated query or mutation";
  const followLatestInput = createEl(doc, "input");
  followLatestInput.type = "checkbox";
  followLatestInput.checked = followLatestOn;
  followLatestInput.setAttribute("aria-label", "Follow latest");
  const followLatestText = createEl(doc, "span");
  followLatestText.textContent = "Follow latest";
  followLatestLabel.append(followLatestInput, followLatestText);

  const rememberLabel = createEl(doc, "label");
  applyClass(rememberLabel, "aq-devtools-follow-latest", "aq-devtools-remember-open");
  rememberLabel.title = "Restore panel open or closed state after reload";
  const rememberInput = createEl(doc, "input");
  rememberInput.type = "checkbox";
  rememberInput.checked = rememberOpen;
  rememberInput.setAttribute("aria-label", "Remember open");
  const rememberText = createEl(doc, "span");
  rememberText.textContent = "Remember open";
  rememberLabel.append(rememberInput, rememberText);

  const backButton = createEl(doc, "button");
  backButton.type = "button";
  applyClass(backButton, "aq-devtools-btn", "aq-devtools-btn--ghost", "aq-devtools-back");
  backButton.setAttribute("aria-label", "Back to list");
  backButton.textContent = "← Back";
  backButton.hidden = true;

  const globalAction = createEl(doc, "button");
  globalAction.type = "button";
  applyClass(
    globalAction,
    "aq-devtools-btn",
    "aq-devtools-btn--ghost",
    "aq-devtools-global-action"
  );

  const toolbarActions = createEl(doc, "div");
  applyClass(toolbarActions, "aq-devtools-toolbar-actions");
  toolbarActions.append(backButton, globalAction);

  toolbarTop.append(sourceSelect, sortSelect, tabs);
  toolbarBottom.append(searchInput, followLatestLabel, rememberLabel, toolbarActions);
  headerToolbar.append(toolbarTop, toolbarBottom);
  header.append(headerTop, headerToolbar);

  const body = createEl(doc, "div");
  applyClass(body, "aq-devtools-body");
  const list = createEl(doc, "div");
  applyClass(list, "aq-devtools-list");
  const detail = createEl(doc, "div");
  applyClass(detail, "aq-devtools-detail");
  body.append(list, detail);
  panel.append(resizeHandle, header, body);
  root.append(toggleButton, panel);
  doc.body.append(root);

  const showSourceLabels = () => multiSource && selectedSourceId === ALL_SOURCES;

  // --- small builders ----------------------------------------------------
  const badge = (text: string, tone: string): HTMLElement => {
    const el = createEl(doc, "span");
    applyClass(el, "aq-devtools-badge", `aq-devtools-badge--${tone}`);
    el.textContent = text;
    return el;
  };

  /** A source label chip, coloured from a hash of the label so it is stable. */
  const sourceBadge = (label: string): HTMLElement => {
    const el = createEl(doc, "span");
    applyClass(el, "aq-devtools-badge--shell", "aq-devtools-badge--adapter");
    const colors = labelColors(label, isDark() ? "dark" : "light");
    setCssText(
      el,
      `${el.style.cssText}; border-color: ${colors.borderColor}; background: ${colors.background}; color: ${colors.color}`
    );
    el.className = "aq-devtools-badge aq-devtools-badge--adapter";
    el.textContent = label;
    el.title = label;
    return el;
  };

  const empty = (message: string): HTMLElement => {
    const el = createEl(doc, "div");
    applyClass(el, "aq-devtools-empty");
    el.textContent = message;
    return el;
  };

  const listHeader = (label: string, count: number): HTMLElement => {
    const el = createEl(doc, "div");
    applyClass(el, "aq-devtools-list-header");
    const pill = createEl(doc, "span");
    applyClass(pill, "aq-devtools-list-count");
    pill.textContent = String(count);
    el.append(doc.createTextNode(label), pill);
    return el;
  };

  const statGrid = (stats: Stat[]): HTMLElement => {
    const grid = createEl(doc, "div");
    applyClass(grid, "aq-devtools-grid");
    setStyles(grid, {
      gridTemplateColumns: compact
        ? "repeat(auto-fill, minmax(6.5rem, 1fr))"
        : "repeat(auto-fill, minmax(9.5rem, 1fr))",
    });
    for (const stat of stats) {
      const card = createEl(doc, "div");
      applyClass(card, "aq-devtools-stat");
      const label = createEl(doc, "span");
      applyClass(label, "aq-devtools-stat-label");
      label.textContent = stat.label;
      const value = createEl(doc, "span");
      applyClass(
        value,
        "aq-devtools-stat-value",
        stat.tone ? `aq-devtools-stat-value--${stat.tone}` : ""
      );
      value.textContent = stat.value;
      card.append(label, value);
      grid.append(card);
    }
    return grid;
  };

  const sectionHeading = (text: string): HTMLElement => {
    const el = createEl(doc, "h3");
    applyClass(el, "aq-devtools-section-title");
    el.textContent = text;
    return el;
  };

  const section = (title: string, isLast = false): HTMLElement => {
    const el = createEl(doc, "div");
    applyClass(el, "aq-devtools-section", isLast ? "aq-devtools-section--last" : "");
    if (title) el.append(sectionHeading(title));
    return el;
  };

  const actionButton = (label: string, tone: string, onClick: () => void): HTMLButtonElement => {
    const el = createEl(doc, "button");
    el.type = "button";
    applyClass(el, "aq-devtools-btn", tone);
    el.textContent = label;
    el.addEventListener("click", onClick);
    return el;
  };

  // --- value viewer (Tree / JSON / Edit) ---------------------------------
  type ViewerOptions = { title: string; rootLabel: string; onApply?: (value: unknown) => void };

  const valueViewer = (value: unknown, opts: ViewerOptions): HTMLElement => {
    const container = section(opts.title, true);
    const modes = createEl(doc, "div");
    applyClass(modes, "aq-devtools-data-modes");
    const treeTab = createEl(doc, "button");
    treeTab.type = "button";
    applyClass(treeTab, "aq-devtools-tab");
    treeTab.textContent = "Tree";
    const jsonTab = createEl(doc, "button");
    jsonTab.type = "button";
    applyClass(jsonTab, "aq-devtools-tab");
    jsonTab.textContent = "JSON";
    const editTab = createEl(doc, "button");
    editTab.type = "button";
    applyClass(editTab, "aq-devtools-tab");
    editTab.textContent = "Edit";
    const viewport = createEl(doc, "div");
    applyClass(viewport, "aq-devtools-data-viewport");

    // The old editor called `store.setData(key, parsed)`. The devtools contract
    // has no writer, so a source without one gets a disabled tab and a printed
    // reason, rather than a button that silently does nothing.
    const writable = typeof opts.onApply === "function";
    if (!writable) {
      editTab.disabled = true;
      editTab.title = "No writer on this source: pass a store exposing setData() to enable Apply.";
      const notice = createEl(doc, "p");
      applyClass(notice, "aq-devtools-notice");
      notice.textContent = READ_ONLY_NOTICE;
      container.append(notice);
    }

    const showTree = () => {
      applyClass(treeTab, "aq-devtools-tab", "is-active");
      applyClass(jsonTab, "aq-devtools-tab");
      applyClass(editTab, "aq-devtools-tab", writable ? "" : "aq-devtools-tab--disabled");
      replaceChildren(viewport, buildTree(doc, value, opts.rootLabel));
    };
    const showJson = () => {
      applyClass(treeTab, "aq-devtools-tab");
      applyClass(jsonTab, "aq-devtools-tab", "is-active");
      applyClass(editTab, "aq-devtools-tab", writable ? "" : "aq-devtools-tab--disabled");
      const pre = createEl(doc, "pre");
      applyClass(pre, "aq-devtools-pre");
      pre.textContent = prettyJson(value);
      replaceChildren(viewport, pre);
    };
    const showEdit = () => {
      applyClass(treeTab, "aq-devtools-tab");
      applyClass(jsonTab, "aq-devtools-tab");
      applyClass(editTab, "aq-devtools-tab", "is-active");
      const editor = createEl(doc, "textarea");
      applyClass(editor, "aq-devtools-editor");
      editor.spellcheck = false;
      editor.value = prettyJson(value);
      const feedback = createEl(doc, "div");
      applyClass(feedback, "aq-devtools-editor-feedback");
      const actions = createEl(doc, "div");
      applyClass(actions, "aq-devtools-actions");
      actions.append(
        actionButton("Apply", "aq-devtools-btn--primary", () => {
          const parsed = parseJson(editor.value);
          if (!parsed.ok) {
            applyClass(
              feedback,
              "aq-devtools-editor-feedback",
              "aq-devtools-editor-feedback--error"
            );
            feedback.textContent = parsed.error;
            return;
          }
          opts.onApply?.(parsed.value);
          applyClass(
            feedback,
            "aq-devtools-editor-feedback",
            "aq-devtools-editor-feedback--success"
          );
          feedback.textContent = "Cache updated";
        })
      );
      replaceChildren(viewport, editor, actions, feedback);
    };

    treeTab.addEventListener("click", showTree);
    jsonTab.addEventListener("click", showJson);
    editTab.addEventListener("click", showEdit);
    modes.append(treeTab, jsonTab, editTab);
    showTree();
    container.append(modes, viewport);
    return container;
  };

  // --- rows --------------------------------------------------------------
  const entryBadges = (entry: PanelEntry): HTMLElement => {
    const badges = createEl(doc, "div");
    applyClass(badges, "aq-devtools-badges");
    badges.append(badge(entry.status, stateTone(entry.status)));
    badges.append(badge(entry.fetchStatus, stateTone(entry.fetchStatus)));
    if (entry.status === "success" && !entry.isStale) badges.append(badge("fresh", "fresh"));
    if (entry.isStale) badges.append(badge("stale", "stale"));
    if (isBusy(entry)) {
      const since = fetchingSince.get(entry.entryId);
      if (since !== undefined) badges.append(badge(formatDuration(Date.now() - since), "fetching"));
    }
    if (!entry.enabled) badges.append(badge("disabled", "muted"));
    return badges;
  };

  const entryRow = (entry: PanelEntry): HTMLElement => {
    const row = createEl(doc, "button");
    row.type = "button";
    applyClass(row, "aq-devtools-item", selectedEntryId === entry.entryId ? "is-selected" : "");
    const head = createEl(doc, "div");
    applyClass(head, "aq-devtools-item-header");
    if (showSourceLabels()) head.append(sourceBadge(entry.sourceLabel));
    const key = createEl(doc, "div");
    applyClass(key, "aq-devtools-item-key");
    key.textContent = formatKey(entry.key, {
      omitAdapterName: showSourceLabels() ? entry.sourceLabel : undefined,
    });
    key.title = stableJson(entry.key);
    head.append(key);
    row.append(head, entryBadges(entry));
    row.addEventListener("click", () => {
      stopFollowing();
      selectedEntryId = entry.entryId;
      if (compact) view = "detail";
      draw();
    });
    return row;
  };

  const mutationRow = (mutation: PanelMutation): HTMLElement => {
    const row = createEl(doc, "button");
    row.type = "button";
    applyClass(
      row,
      "aq-devtools-item",
      selectedMutationId === mutation.entryId ? "is-selected" : ""
    );
    const head = createEl(doc, "div");
    applyClass(head, "aq-devtools-item-header");
    if (showSourceLabels()) head.append(sourceBadge(mutation.sourceLabel));
    const key = createEl(doc, "div");
    applyClass(key, "aq-devtools-item-key");
    key.textContent = `${mutation.id} · ${mutation.status}`;
    head.append(key);
    const badges = createEl(doc, "div");
    applyClass(badges, "aq-devtools-badges");
    badges.append(badge(mutation.status, stateTone(mutation.status)));
    row.append(head, badges);
    row.addEventListener("click", () => {
      stopFollowing();
      selectedMutationId = mutation.entryId;
      if (compact) view = "detail";
      draw();
    });
    return row;
  };

  // --- detail panes ------------------------------------------------------
  const stateBadges = (entry: PanelEntry): HTMLElement => {
    const badges = createEl(doc, "div");
    applyClass(badges, "aq-devtools-badges");
    badges.append(badge(entry.status, stateTone(entry.status)));
    badges.append(badge(entry.fetchStatus, stateTone(entry.fetchStatus)));
    if (entry.status === "success" && !entry.isStale) badges.append(badge("fresh", "fresh"));
    if (entry.isStale) badges.append(badge("stale", "stale"));
    return badges;
  };

  const queryDetail = (entry: PanelEntry, source: QueryDevtoolsSource): void => {
    const detailHeader = createEl(doc, "div");
    applyClass(detailHeader, "aq-devtools-detail-header");
    const head = createEl(doc, "div");
    applyClass(head, "aq-devtools-item-header");
    if (showSourceLabels()) head.append(sourceBadge(entry.sourceLabel));
    const key = createEl(doc, "code");
    applyClass(key, "aq-devtools-detail-key");
    key.textContent = formatKey(entry.key, {
      omitAdapterName: showSourceLabels() ? entry.sourceLabel : undefined,
    });
    key.title = stableJson(entry.key);
    head.append(key);
    detailHeader.append(head, stateBadges(entry));

    const content = createEl(doc, "div");
    applyClass(content, "aq-devtools-detail-content");

    // Every action is rendered only when the source can perform it, so the
    // panel never offers a button whose effect would be a silent no-op.
    const actionSection = section("Actions");
    const actionRow = createEl(doc, "div");
    applyClass(actionRow, "aq-devtools-actions");
    if (source.get) {
      actionRow.append(
        actionButton("Refetch", "aq-devtools-btn--primary", () => {
          void source.get?.(entry.key)?.refetch();
        })
      );
    }
    if (source.invalidate) {
      actionRow.append(
        actionButton("Invalidate", "", () => {
          source.invalidate?.(entry.key);
        })
      );
    }
    if (source.resetQueries) {
      actionRow.append(
        actionButton("Reset", "", () => {
          source.resetQueries?.(entry.key);
          draw();
        })
      );
    }
    if (source.remove) {
      actionRow.append(
        actionButton("Remove", "aq-devtools-btn--destructive", () => {
          source.remove?.(entry.key);
          selectedEntryId = null;
          if (compact) view = "list";
          draw();
        })
      );
    }
    if (actionRow.childElementCount === 0) {
      const notice = createEl(doc, "p");
      applyClass(notice, "aq-devtools-notice");
      notice.textContent = READ_ONLY_NOTICE;
      actionSection.append(notice);
    } else {
      actionSection.append(actionRow);
    }

    const stateSection = section("State");
    const since = fetchingSince.get(entry.entryId);
    stateSection.append(
      statGrid([
        { label: "Status", value: entry.status, tone: statusTone(entry.status) },
        { label: "Fetch", value: entry.fetchStatus, tone: fetchTone(entry.fetchStatus) },
        {
          label: "Fetching",
          value:
            isBusy(entry) && since !== undefined ? formatDuration(Date.now() - since) : EMPTY_VALUE,
          tone: isBusy(entry) ? "warning" : "muted",
        },
        { label: "Enabled", value: yesNo(entry.enabled), tone: booleanTone(entry.enabled) },
        { label: "Stale", value: yesNo(entry.isStale), tone: entry.isStale ? "warning" : "muted" },
        { label: "Stale time", value: formatDuration(entry.staleTime), tone: "muted" },
        { label: "Data updated", value: formatTime(entry.dataUpdatedAt), tone: "muted" },
        { label: "Error updated", value: formatTime(entry.errorUpdatedAt), tone: "muted" },
        {
          label: "Error",
          value: entry.error ? `${entry.error.name}: ${entry.error.message}` : "None",
          tone: entry.error ? "error" : "muted",
        },
      ])
    );

    // The snapshot exposes the effective options it can see and no writer for
    // them, so the options viewer is always read-only.
    const optionsSection = valueViewer(
      { staleTime: entry.staleTime, enabled: entry.enabled },
      { title: "Options", rootLabel: "options" }
    );
    const dataSection = valueViewer(entry.data, {
      title: "Data",
      rootLabel: "data",
      onApply: source.setData
        ? (value) => {
            source.setData?.(entry.key, value);
            draw();
          }
        : undefined,
    });

    content.append(actionSection, stateSection, optionsSection, dataSection);
    replaceChildren(detail, detailHeader, content);
  };

  const mutationDetail = (mutation: PanelMutation): void => {
    const detailHeader = createEl(doc, "div");
    applyClass(detailHeader, "aq-devtools-detail-header");
    const head = createEl(doc, "div");
    applyClass(head, "aq-devtools-item-header");
    if (showSourceLabels()) head.append(sourceBadge(mutation.sourceLabel));
    const key = createEl(doc, "code");
    applyClass(key, "aq-devtools-detail-key");
    key.textContent = String(mutation.id);
    head.append(key);
    const badges = createEl(doc, "div");
    applyClass(badges, "aq-devtools-badges");
    badges.append(badge(mutation.status, stateTone(mutation.status)));
    detailHeader.append(head, badges);

    const content = createEl(doc, "div");
    applyClass(content, "aq-devtools-detail-content");
    const summary = section("Mutation");
    summary.append(
      statGrid([
        { label: "Status", value: mutation.status, tone: statusTone(mutation.status) },
        {
          label: "Error",
          value: mutation.error ? `${mutation.error.name}: ${mutation.error.message}` : "None",
          tone: mutation.error ? "error" : "muted",
        },
      ])
    );
    // No Variables section: `QueryDevtoolsMutation` carries no variables, and
    // inventing one here would mean showing data the cache never held.
    content.append(summary, valueViewer(mutation.data, { title: "Data", rootLabel: "result" }));
    replaceChildren(detail, detailHeader, content);
  };

  // --- layout ------------------------------------------------------------
  const applyPanelHeight = (height: number) => {
    setStyles(panel, {
      height: `${clampPanelHeight(height)}px`,
      minHeight: `${MIN_PANEL_HEIGHT_PX}px`,
    });
  };

  const applyCompactSheet = (height: number | null) => {
    applyClass(body, "aq-devtools-body");
    setStyles(body, { gridTemplateColumns: "1fr", gridTemplateRows: "1fr" });
    setStyles(list, { borderRight: "none", borderBottom: "none" });
    setStyles(panel, {
      left: "0.5rem",
      right: "0.5rem",
      width: "auto",
      bottom: "0.5rem",
      transform: "none",
      borderRadius: "var(--aq-radius) var(--aq-radius) 0 0",
    });
    applyPanelHeight(preferredPanelHeight(height));
    resizeHandle.hidden = false;
  };

  /**
   * `isCompact` is the width condition; `narrow` is the opposite of it, and
   * drives the toolbar wrapping that used to follow the media query alone.
   */
  const applyLayout = (isCompact: boolean) => {
    compact = isCompact;
    const narrow = !isCompact;
    setStyles(headerToolbar, { flexDirection: "column", gap: "0.5rem" });
    for (const bar of [toolbarTop, toolbarBottom]) {
      setStyles(bar, {
        display: "flex",
        flexWrap: "wrap",
        alignItems: "center",
        gap: "0.5rem",
        minWidth: "0",
      });
    }
    setStyles(searchInput, {
      flex: narrow ? "1 1 12rem" : "1",
      minWidth: narrow ? "100%" : "0",
      width: narrow ? "100%" : null,
    });
    setStyles(sourceSelect, {
      flex: narrow ? "1 1 calc(50% - 0.25rem)" : "0 1 auto",
      maxWidth: narrow ? null : "11.5rem",
    });
    setStyles(sortSelect, {
      flex: narrow ? "1 1 calc(50% - 0.25rem)" : "0 1 auto",
      maxWidth: narrow ? null : "12rem",
    });
    setStyles(tabs, {
      display: "inline-flex",
      marginLeft: narrow ? "0" : "auto",
      width: narrow ? "100%" : null,
    });
    setStyles(queriesTab, { flex: narrow ? "1 1 0" : null });
    setStyles(mutationsTab, { flex: narrow ? "1 1 0" : null });

    if (position === "right") {
      applyClass(body, "aq-devtools-body");
      setStyles(body, {
        gridTemplateColumns: "1fr",
        gridTemplateRows: narrow ? "1fr" : "minmax(180px, 38%) 1fr",
      });
      setStyles(list, {
        borderRight: "none",
        borderBottom: narrow ? "none" : "1px solid var(--aq-border)",
      });
      return;
    }
    if (isCompact) {
      applyCompactSheet(mobileHeight);
      return;
    }
    resizeHandle.hidden = true;
    applyClass(body, "aq-devtools-body");
    setStyles(list, { borderRight: "1px solid var(--aq-border)", borderBottom: "none" });
  };

  const applyZIndex = () => {
    if (zIndex === undefined) return;
    // Re-applied after every `applyClass` pass, which rewrites `style.cssText`.
    setStyles(root, { position: "relative", zIndex: String(zIndex) });
    setStyles(toggleButton, { zIndex: String(zIndex) });
    setStyles(panel, { zIndex: String(zIndex) });
  };

  /** Compact is a viewport-or-narrow-panel condition, re-checked on either. */
  const syncCompact = (): (() => void) => {
    const media = safeMatchMedia(`(max-width: ${MOBILE_BREAKPOINT_PX}px)`);
    const measure = () => {
      const width = panel.getBoundingClientRect().width;
      const next = Boolean(media?.matches) || (width > 0 && width < COMPACT_PANEL_MAX_PX);
      if (next === compact) return;
      if (next) view = "list";
      applyLayout(next);
      draw();
    };
    const Observer = resizeObserverCtor();
    const observer = Observer ? new Observer(measure) : undefined;
    observer?.observe(panel);
    const offMedia = media ? on(media, "change", measure) : NOOP;
    return () => {
      observer?.disconnect();
      offMedia();
    };
  };

  /** Drag-to-resize with pointer capture, released on pointerup or cancel. */
  const attachResize = (): (() => void) => {
    let dragging = false;
    let startY = 0;
    let startHeight = 0;
    const stopDragging = () => {
      win?.removeEventListener("pointermove", onMove);
      win?.removeEventListener("pointerup", onUp);
      win?.removeEventListener("pointercancel", onUp);
    };
    const onMove = (event: PointerEvent) => {
      if (!dragging) return;
      event.preventDefault();
      const next = clampPanelHeight(startHeight + (startY - event.clientY));
      applyPanelHeight(next);
      mobileHeight = next;
      persist();
    };
    const onUp = (event: PointerEvent) => {
      if (!dragging) return;
      dragging = false;
      if (resizeHandle.hasPointerCapture?.(event.pointerId)) {
        resizeHandle.releasePointerCapture?.(event.pointerId);
      }
      stopDragging();
    };
    const onDown = (event: PointerEvent) => {
      if (event.button !== 0) return;
      dragging = true;
      startY = event.clientY;
      startHeight = panel.getBoundingClientRect().height;
      resizeHandle.setPointerCapture?.(event.pointerId);
      win?.addEventListener("pointermove", onMove);
      win?.addEventListener("pointerup", onUp);
      win?.addEventListener("pointercancel", onUp);
      event.preventDefault();
    };
    const off = on<PointerEvent>(resizeHandle, "pointerdown", onDown);
    return () => {
      off();
      stopDragging();
    };
  };

  // --- render ------------------------------------------------------------
  const emptyMessage = (noun: string): string => {
    if (selectedSourceId !== ALL_SOURCES) return `No ${noun} for this source.`;
    if (search.trim()) return `No ${noun} match your filter.`;
    return noun === "queries" ? "No queries cached yet." : "No mutations yet.";
  };

  const inScope = (storeId: string) =>
    selectedSourceId === ALL_SOURCES || storeId === selectedSourceId;

  const syncSourceSelect = () => {
    const options = aggregator.getSourceOptions();
    multiSource = options.length > 1;
    sourceSelect.hidden = !multiSource;
    if (!multiSource) {
      selectedSourceId = ALL_SOURCES;
      return;
    }
    const previous = sourceSelect.value || selectedSourceId;
    replaceChildren(sourceSelect);
    const all = doc.createElement("option");
    all.value = ALL_SOURCES;
    all.textContent = "All sources";
    sourceSelect.append(all);
    for (const option of options) {
      const el = doc.createElement("option");
      el.value = option.id;
      el.textContent = option.label;
      sourceSelect.append(el);
    }
    selectedSourceId =
      previous === ALL_SOURCES || options.some((option) => option.id === previous)
        ? previous
        : ALL_SOURCES;
    sourceSelect.value = selectedSourceId;
  };

  const syncSortSelect = () => {
    const isQueries = activeTab === "queries";
    replaceChildren(sortSelect);
    for (const value of isQueries ? QUERY_SORTS : MUTATION_SORTS) {
      const option = doc.createElement("option");
      option.value = value;
      option.textContent = isQueries
        ? querySortLabel(value as QuerySort)
        : mutationSortLabel(value as MutationSort);
      sortSelect.append(option);
    }
    sortSelect.value = isQueries ? querySort : mutationSort;
    globalAction.textContent = isQueries ? "Reset cache" : "Clear mutations";
    const method = isQueries ? "reset" : "clearMutations";
    const available = aggregator
      .getSourcesForScope(selectedSourceId)
      .some((source) => typeof source[method] === "function");
    globalAction.disabled = !available;
    globalAction.title = available ? "" : `This source does not expose ${method}().`;
    applyClass(
      globalAction,
      "aq-devtools-btn",
      "aq-devtools-btn--ghost",
      "aq-devtools-global-action",
      available ? "" : "aq-devtools-btn--disabled"
    );
  };

  const applyViewMode = () => {
    if (!compact) {
      list.style.removeProperty("display");
      detail.style.removeProperty("display");
      backButton.hidden = true;
      return;
    }
    if (view === "detail" && !(activeTab === "queries" ? selectedEntryId : selectedMutationId)) {
      view = "list";
    }
    const showingDetail = view === "detail";
    backButton.hidden = !showingDetail || followLatestOn;
    if (showingDetail) {
      list.style.display = "none";
      detail.style.removeProperty("display");
      return;
    }
    list.style.removeProperty("display");
    detail.style.display = "none";
  };

  /**
   * Tracks when each entry entered `fetching` so the panel can show a live
   * elapsed time, and keeps the 100 ms repaint running only while one is
   * in flight. Nothing else in the panel needs a timer.
   */
  const syncFetchTimer = (entries: readonly PanelEntry[]): void => {
    const fetching = new Set(
      entries.filter((entry) => entry.fetchStatus === "fetching").map((entry) => entry.entryId)
    );
    const now = Date.now();
    for (const id of fetching) if (!fetchingSince.has(id)) fetchingSince.set(id, now);
    for (const id of [...fetchingSince.keys()]) if (!fetching.has(id)) fetchingSince.delete(id);
    if (isOpen && fetching.size > 0) {
      if (!fetchTimer) fetchTimer = setInterval(draw, FETCH_TICK_MS);
      return;
    }
    if (fetchTimer) {
      clearInterval(fetchTimer);
      fetchTimer = null;
    }
  };

  const drawQueries = (entries: readonly PanelEntry[]) => {
    const visible = sortEntries(
      entries.filter(
        (entry) =>
          inScope(entry.storeId) &&
          searchMatches(`${entry.sourceLabel} ${stableJson(entry.key)}`, search)
      ),
      querySort
    );
    if (visible.length === 0) {
      list.append(empty(emptyMessage("queries")));
      return;
    }
    list.append(listHeader("Queries", visible.length));
    if (followLatestOn) {
      const latest = visible.reduce<PanelEntry | null>(
        (best, entry) => (!best || entryRank(entry) > entryRank(best) ? entry : best),
        null
      );
      if (latest) {
        selectedEntryId = latest.entryId;
        if (compact) view = "detail";
      }
    }
    for (const entry of visible) list.append(entryRow(entry));
    scrollIntoViewNearest(list.querySelector(".aq-devtools-item.is-selected"));
    const current = visible.find((entry) => entry.entryId === selectedEntryId) ?? visible[0];
    if (!current) return;
    selectedEntryId = current.entryId;
    if (!compact || view === "detail") {
      queryDetail(current, aggregator.getSourceForEntry(current.storeId));
    }
  };

  const drawMutations = (mutations: readonly PanelMutation[]) => {
    const visible = sortMutations(
      mutations.filter(
        (mutation) =>
          inScope(mutation.storeId) &&
          searchMatches(
            `${mutation.sourceLabel} ${mutation.id} ${prettyJson(mutation.data)}`,
            search
          )
      ),
      mutationSort
    );
    if (visible.length === 0) {
      list.append(empty(emptyMessage("mutations")));
      return;
    }
    list.append(listHeader("Mutations", visible.length));
    if (followLatestOn) {
      const latest = visible.reduce<PanelMutation | null>(
        (best, mutation) => (!best || mutation.id > best.id ? mutation : best),
        null
      );
      if (latest) {
        selectedMutationId = latest.entryId;
        if (compact) view = "detail";
      }
    }
    for (const mutation of visible) list.append(mutationRow(mutation));
    scrollIntoViewNearest(list.querySelector(".aq-devtools-item.is-selected"));
    const current =
      visible.find((mutation) => mutation.entryId === selectedMutationId) ?? visible[0];
    if (!current) return;
    selectedMutationId = current.entryId;
    if (!compact || view === "detail") mutationDetail(current);
  };

  const draw = () => {
    scheduled = false;
    if (destroyed) return;
    const snapshot = aggregator.getSnapshotView();
    // Tracked before the rows render, so the very first paint of an in-flight
    // entry already has a start time.
    syncFetchTimer(snapshot.entries);
    syncSourceSelect();
    syncSortSelect();

    toggleLabel.textContent = `Query (${snapshot.entries.length})`;
    subtitle.textContent = multiSource ? "" : (snapshot.sourceLabel ?? "");
    subtitle.style.display = subtitle.textContent ? "" : "none";

    applyClass(
      panel,
      "aq-devtools-panel",
      `aq-devtools-panel--${position}`,
      isOpen ? "is-open" : ""
    );
    toggleButton.hidden = isOpen;
    applyClass(queriesTab, "aq-devtools-tab", activeTab === "queries" ? "is-active" : "");
    applyClass(mutationsTab, "aq-devtools-tab", activeTab === "mutations" ? "is-active" : "");
    followLatestInput.checked = followLatestOn;
    rememberInput.checked = rememberOpen;
    applyLayout(compact);
    applyZIndex();

    replaceChildren(list);
    replaceChildren(detail);
    if (activeTab === "queries") drawQueries(snapshot.entries);
    else drawMutations(snapshot.mutations);
    applyViewMode();
    applyZIndex();
  };

  /** A manual selection wins once: follow-latest takes the selection back. */
  const stopFollowing = () => {
    if (!followLatestOn) return;
    followLatestOn = false;
    followLatestInput.checked = false;
    persist();
  };

  /** One repaint per frame, however many changes arrived. */
  const schedule = () => {
    if (scheduled || destroyed) return;
    scheduled = true;
    requestFrame(draw);
  };

  // --- listeners ---------------------------------------------------------
  applyCorner();
  applyZIndex();
  listen(searchInput, "input", () => {
    search = searchInput.value;
    persist();
    schedule();
  });
  listen(toggleButton, "click", () => {
    isOpen = !isOpen;
    persistOpen();
    schedule();
  });
  listen(closeButton, "click", () => {
    isOpen = false;
    persistOpen();
    schedule();
  });
  listen(queriesTab, "click", () => {
    activeTab = "queries";
    view = "list";
    persist();
    schedule();
  });
  listen(mutationsTab, "click", () => {
    activeTab = "mutations";
    view = "list";
    persist();
    schedule();
  });
  listen(backButton, "click", () => {
    view = "list";
    schedule();
  });
  listen(sortSelect, "change", () => {
    if (activeTab === "queries") querySort = sortSelect.value as QuerySort;
    else mutationSort = sortSelect.value as MutationSort;
    persist();
    schedule();
  });
  listen(sourceSelect, "change", () => {
    selectedSourceId = sourceSelect.value;
    if (!followLatestOn) {
      selectedEntryId = null;
      selectedMutationId = null;
    }
    view = "list";
    persist();
    schedule();
  });
  listen(followLatestInput, "change", () => {
    followLatestOn = followLatestInput.checked;
    persist();
    schedule();
  });
  listen(rememberInput, "change", () => {
    rememberOpen = rememberInput.checked;
    persist();
    schedule();
  });
  listen(cornerSelect, "change", () => {
    corner = cornerSelect.value as ToggleCorner;
    applyCorner();
    applyZIndex();
    if (persistToggleCorner) writeStorage(toggleCornerStorageKey, corner);
  });
  listen(globalAction, "click", () => {
    const scoped = aggregator.getSourcesForScope(selectedSourceId);
    if (activeTab === "queries") {
      for (const source of scoped) source.reset?.();
      selectedEntryId = null;
      view = "list";
    } else {
      for (const source of scoped) source.clearMutations?.();
      selectedMutationId = null;
      view = "list";
    }
    schedule();
  });

  // The window `resize` matters only for the compact bottom sheet, whose height
  // is a pixel value that has to be re-clamped when the viewport changes.
  const onWindowResize = () => {
    if (!compact || position !== "bottom") return;
    applyPanelHeight(preferredPanelHeight(mobileHeight));
    schedule();
  };
  win?.addEventListener("resize", onWindowResize);
  disposers.push(() => win?.removeEventListener("resize", onWindowResize));

  // `system` theme follows the host root's `data-theme` / `.dark` and the OS
  // colour scheme; both watchers are released by `destroy()`.
  const themeCleanup = ((): (() => void) => {
    const repaint = () => {
      applyTheme();
      applyZIndex();
      schedule();
    };
    if (theme !== "system") return NOOP;
    const host = safeDocument()?.documentElement ?? doc.documentElement;
    const MutationObserverCtor = mutationObserverCtor();
    const observer = MutationObserverCtor ? new MutationObserverCtor(repaint) : undefined;
    observer?.observe(host, { attributes: true, attributeFilter: ["data-theme", "class"] });
    const scheme = safeMatchMedia("(prefers-color-scheme: dark)");
    const offScheme = scheme ? on(scheme, "change", repaint) : NOOP;
    return () => {
      observer?.disconnect();
      offScheme();
    };
  })();
  disposers.push(themeCleanup);
  disposers.push(syncCompact());
  disposers.push(attachResize());

  // First paint comes from `getSnapshot()`, so a panel that mounts after the
  // last change is not blank; every change after that arrives by subscription.
  draw();
  const unsubscribe = aggregator.subscribe(schedule);

  return {
    open() {
      isOpen = true;
      persistOpen();
      schedule();
    },
    close() {
      isOpen = false;
      persistOpen();
      schedule();
    },
    toggle() {
      isOpen = !isOpen;
      persistOpen();
      schedule();
    },
    setToggleCorner(next) {
      corner = next;
      cornerSelect.value = next;
      applyCorner();
      applyZIndex();
      if (persistToggleCorner) writeStorage(toggleCornerStorageKey, next);
    },
    getToggleCorner() {
      return corner;
    },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      unsubscribe();
      if (fetchTimer) clearInterval(fetchTimer);
      fetchTimer = null;
      for (const dispose of disposers.splice(0)) dispose();
      root.parentNode?.removeChild(root);
    },
  };
}
