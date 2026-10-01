/**
 * The attribute-transfer half of `x-child`, with no Alpine in scope: every
 * function here takes and returns plain DOM. The directive body that drives
 * them lives in `plugin.ts` and does need Alpine internals, which is why this
 * package has no controller class to extract (ARCHITECTURE.md §9).
 */

import type { ChildDirectiveConfig, ChildMergeMode } from "./types";

export function parseChildDirective(el: Element): ChildDirectiveConfig | null {
  const hasAttr =
    el.hasAttribute("x-child") ||
    el.hasAttribute("x-child.merge") ||
    el.hasAttribute("x-child.replace");
  if (!hasAttr) {
    // A prefixed `x-` (Alpine's `x-` → `x-data-` style prefixes) renames the
    // attribute, so fall back to a prefix-agnostic scan of the attribute list.
    const has = Array.from(el.attributes).some(
      (a) => a.name === "x-child" || a.name.startsWith("x-child.")
    );
    if (!has) return null;
  }
  let mode: ChildMergeMode = "default";
  if (
    el.hasAttribute("x-child.merge") ||
    Array.from(el.attributes).some((a) => a.name.includes(".merge"))
  )
    mode = "merge";
  if (
    el.hasAttribute("x-child.replace") ||
    Array.from(el.attributes).some((a) => a.name.includes(".replace"))
  )
    mode = "replace";
  return { mode };
}

export function findFirstElementChild(wrapper: Element): Element | null {
  for (const child of Array.from(wrapper.children)) {
    if (child.nodeType === 1) return child as Element;
  }
  return null;
}

export function countElementChildren(wrapper: Element): number {
  return wrapper.children.length;
}

function mergeClass(wrapperVal: string, childVal: string, mode: ChildMergeMode): string {
  if (mode === "replace") return wrapperVal;
  const childTokens = new Set(childVal.split(/\s+/).filter(Boolean));
  const wrapperTokens = wrapperVal.split(/\s+/).filter(Boolean);
  // Union, not override: a token on both sides appears once, keeping the
  // child's ordering. The attribute order carries no CSS meaning — the cascade
  // is decided by the stylesheet — so `merge` and `default` agree here, and
  // neither can make the wrapper's utility outrank the child's.
  for (const t of wrapperTokens) childTokens.add(t);
  return [...childTokens].join(" ");
}

function mergeStyle(wrapperVal: string, childVal: string): string {
  if (!wrapperVal) return childVal;
  if (!childVal) return wrapperVal;
  // Property-level merge, not string concatenation: a shorthand (`margin`) and
  // its longhands would otherwise both survive and the loser's value would be
  // dropped by the CSS parser depending on order. Comparing the property name
  // keeps it to one declaration per property, child first.
  const childProps = new Set(
    childVal
      .split(";")
      .map((s) => s.split(":")[0]?.trim().toLowerCase())
      .filter(Boolean)
  );
  const wrapperDecls = wrapperVal
    .split(";")
    .map((s) => s.trim())
    .filter(Boolean)
    .filter((decl) => {
      const prop = decl.split(":")[0]?.trim().toLowerCase();
      return prop && !childProps.has(prop);
    });
  return [
    ...childVal
      .split(";")
      .map((s) => s.trim())
      .filter(Boolean),
    ...wrapperDecls,
  ].join("; ");
}

/**
 * Copy the wrapper's attributes onto the child, per `mode`.
 *
 * `x-child*` is skipped (it is the directive being consumed), and so are
 * `x-data*` and `x-ignore`: the wrapper's Alpine scope belongs to the wrapper,
 * which the directive then morphs away — copying them onto the child would
 * give one element two scopes and double-initialise its tree.
 */
export function transferAttributes(wrapper: Element, target: Element, mode: ChildMergeMode): void {
  for (const attr of Array.from(wrapper.attributes)) {
    const name = attr.name;
    if (
      name === "x-child" ||
      name.startsWith("x-child.") ||
      name.startsWith("x-data") ||
      name.startsWith("x-ignore")
    )
      continue;
    const wVal = attr.value;
    const cVal = target.getAttribute(name);
    if (name === "class") {
      const merged = cVal ? mergeClass(wVal, cVal, mode) : wVal;
      target.setAttribute("class", merged);
      continue;
    }
    if (name === "style") {
      const merged = cVal ? mergeStyle(wVal, cVal) : wVal;
      target.setAttribute("style", merged);
      continue;
    }
    if (mode === "replace") {
      target.setAttribute(name, wVal);
    } else if (cVal === null || cVal === undefined) {
      target.setAttribute(name, wVal);
    }
  }
}

/**
 * Does nothing, and is exported anyway.
 *
 * The transfer copies attributes *onto* the child but never marks them, so
 * there is nothing to identify as transferred and nothing to remove. The
 * plugin calls it after the morph purely to keep the call site honest about
 * cleanup it is not doing — do not read a teardown guarantee into it.
 */
export function clearTransferredAttributes(_wrapper: Element): void {}
