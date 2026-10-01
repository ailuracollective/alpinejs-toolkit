/**
 * The collapsible value tree used by the Data / Options / Variables sections.
 *
 * Branch nodes are `<details open>` so a branch can be folded without any
 * bookkeeping, and every node is created from the `Document` the caller passes
 * in — this module never resolves a global.
 */
import { applyClass, createEl } from "./dom";
import { treeLeafValue } from "./format";

function leaf(doc: Document, key: string, value: unknown): HTMLElement {
  const row = createEl(doc, "div");
  applyClass(row, "aq-devtools-tree-row", "aq-devtools-tree-row--leaf");
  const keyEl = createEl(doc, "span");
  applyClass(keyEl, "aq-devtools-tree-key");
  keyEl.textContent = key;
  const valueEl = createEl(doc, "span");
  applyClass(valueEl, "aq-devtools-tree-value", `aq-devtools-tree-value--${typeof value}`);
  valueEl.textContent = treeLeafValue(value);
  row.append(keyEl, valueEl);
  return row;
}

function branch(
  doc: Document,
  key: string,
  size: number,
  children: () => Node[]
): HTMLDetailsElement {
  const details = doc.createElement("details") as HTMLDetailsElement;
  applyClass(details, "aq-devtools-tree-branch");
  details.open = true;
  const summary = createEl(doc, "summary");
  applyClass(summary, "aq-devtools-tree-summary");
  const keyEl = createEl(doc, "span");
  applyClass(keyEl, "aq-devtools-tree-key");
  keyEl.textContent = key;
  const meta = createEl(doc, "span");
  applyClass(meta, "aq-devtools-tree-meta");
  meta.textContent = String(size);
  summary.append(keyEl, meta);
  const childList = createEl(doc, "div");
  applyClass(childList, "aq-devtools-tree-children");
  for (const child of children()) childList.append(child);
  details.append(summary, childList);
  return details;
}

function node(doc: Document, key: string, value: unknown): HTMLElement {
  if (value === null || typeof value !== "object") return leaf(doc, key, value);
  if (Array.isArray(value)) {
    if (value.length === 0) return leaf(doc, key, []);
    return branch(doc, `${key} []`, value.length, () => arrayNodes(doc, value));
  }
  const entries = Object.entries(value as Record<string, unknown>);
  if (entries.length === 0) return leaf(doc, key, {});
  return branch(doc, `${key} {}`, entries.length, () => objectNodes(doc, value as object));
}

function arrayNodes(doc: Document, value: readonly unknown[]): HTMLElement[] {
  return value.map((item, index) => node(doc, String(index), item));
}

function objectNodes(doc: Document, value: object): HTMLElement[] {
  return Object.entries(value).map(([key, item]) => node(doc, key, item));
}

/** The whole tree for one value, rooted at `rootLabel`. */
export function buildTree(doc: Document, value: unknown, rootLabel = "data"): HTMLElement {
  const root = createEl(doc, "div");
  applyClass(root, "aq-devtools-tree");
  if (value === null || typeof value !== "object") {
    root.append(leaf(doc, rootLabel, value));
  } else if (Array.isArray(value)) {
    if (value.length === 0) root.append(leaf(doc, rootLabel, []));
    else root.append(branch(doc, `${rootLabel} []`, value.length, () => arrayNodes(doc, value)));
  } else {
    const keys = Object.keys(value as object);
    if (keys.length === 0) root.append(leaf(doc, rootLabel, {}));
    else root.append(branch(doc, `${rootLabel} {}`, keys.length, () => objectNodes(doc, value)));
  }
  return root;
}
