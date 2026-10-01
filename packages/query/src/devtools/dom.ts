/**
 * Every DOM, storage and scheduling access the panel makes.
 *
 * Nothing here runs at import time and nothing here reads a bare `window` or
 * `document`: each entry point resolves the global through
 * `@ailura/alpinejs-core/env` and degrades instead of throwing. That is the
 * whole SSR story — on a server `mountQueryDevtools()` returns a no-op
 * controller and this module is never asked for a node it cannot have.
 */
import { isBrowser, safeDocument, safeMatchMedia, safeWindow } from "@ailura/alpinejs-core/env";

import { CLASS_STYLES } from "./styles";

export { isBrowser, safeDocument, safeMatchMedia, safeWindow };

/**
 * The document, or a throw. Only called from code paths that already proved a
 * DOM exists (`mountQueryDevtools` bails out otherwise), so the throw can only
 * fire if a host removed the document between the check and the first render.
 */
export function requireDocument(): Document {
  const doc = safeDocument();
  if (!doc) throw new Error("@ailura/alpinejs-query/devtools requires a DOM");
  return doc;
}

export function createEl<K extends keyof HTMLElementTagNameMap>(
  doc: Document,
  tag: K
): HTMLElementTagNameMap[K];
export function createEl(doc: Document, tag: string): HTMLElement;
export function createEl(doc: Document, tag: string): HTMLElement {
  return doc.createElement(tag) as HTMLElement;
}

/** `ResizeObserver` is absent in some environments; its absence is not fatal. */
export function resizeObserverCtor(): typeof ResizeObserver | undefined {
  const win = safeWindow() as (Window & { ResizeObserver?: typeof ResizeObserver }) | undefined;
  return win?.ResizeObserver;
}

/** `MutationObserver` is absent in some environments; its absence is not fatal. */
export function mutationObserverCtor(): typeof MutationObserver | undefined {
  const win = safeWindow() as (Window & { MutationObserver?: typeof MutationObserver }) | undefined;
  return win?.MutationObserver;
}

/** `replaceChildren` with a fallback, so an old DOM implementation is not a crash. */
export function replaceChildren(el: Element, ...nodes: Node[]): void {
  if (typeof el.replaceChildren === "function") el.replaceChildren(...nodes);
  else {
    while (el.firstChild) el.removeChild(el.firstChild);
    for (const node of nodes) el.appendChild(node);
  }
}

export function setCssText(el: HTMLElement, css: string): void {
  el.style.cssText = css;
}

/**
 * The styling system: set the class list, then inline the matching rules plus
 * every `a.b` combination rule both classes take part in.
 */
export function applyClass(el: HTMLElement, ...names: (string | false | null | undefined)[]): void {
  const active = names.filter((n): n is string => Boolean(n));
  el.className = active.join(" ");
  const css: string[] = [];
  for (const name of active) {
    const rule = CLASS_STYLES[name];
    if (rule) css.push(rule);
  }
  for (let i = 0; i < active.length; i++) {
    for (let j = i + 1; j < active.length; j++) {
      const rule = CLASS_STYLES[`${active[i]}.${active[j]}`];
      if (rule) css.push(rule);
    }
  }
  setCssText(el, css.join("; "));
}

const CHEVRON_STYLE: Record<string, string> = {
  appearance: "none",
  "-webkit-appearance": "none",
  "padding-left": "0.75rem",
  "padding-right": "2rem",
  "padding-top": "0.375rem",
  "padding-bottom": "0.375rem",
  "background-image":
    "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' fill='none' viewBox='0 0 24 24' stroke='%2394a3b8' stroke-width='2'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")",
  "background-repeat": "no-repeat",
  "background-position": "right 0.625rem center",
  "background-size": "0.75rem",
};

/** A `<select>` styled by the class map plus the native-arrow resets. */
export function applySelectClass(el: HTMLElement, ...names: string[]): void {
  applyClass(el, ...names);
  for (const [property, value] of Object.entries(CHEVRON_STYLE))
    el.style.setProperty(property, value);
}

export function toKebab(property: string): string {
  return property.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);
}

/** `null` / `undefined` / `""` remove the property, matching the old helper. */
export function setStyles(
  el: HTMLElement,
  styles: Record<string, string | number | null | undefined>
): void {
  for (const [property, value] of Object.entries(styles)) {
    if (value === null || value === undefined || value === "") continue;
    el.style.setProperty(toKebab(property), String(value));
  }
}

/** Add a listener and hand back the one call that removes it. */
export function on<E extends Event = Event>(
  target: EventTarget | null | undefined,
  type: string,
  handler: (event: E) => void,
  options?: AddEventListenerOptions
): () => void {
  if (!target) return () => {};
  target.addEventListener(type, handler as EventListener, options);
  return () => target.removeEventListener(type, handler as EventListener, options);
}

/**
 * `localStorage`, or `null` when there is none. The old panel tested
 * `typeof localStorage > "u"`; going through `safeWindow()` is the same guard
 * expressed the toolkit's way, and it also covers a browser that throws on
 * `localStorage` access (Safari private mode, blocked third-party storage).
 */
function storage(): Storage | null {
  const win = safeWindow();
  if (!win) return null;
  try {
    return win.localStorage ?? null;
  } catch {
    return null;
  }
}

export function readStorage(key: string): string | null {
  try {
    return storage()?.getItem(key) ?? null;
  } catch {
    return null;
  }
}

export function writeStorage(key: string, value: string): void {
  try {
    storage()?.setItem(key, value);
  } catch {
    // A full or unavailable quota is not a reason to break the panel.
  }
}

/** `requestAnimationFrame` with a timer fallback, and never a bare global read. */
export function requestFrame(callback: () => void): void {
  const win = safeWindow();
  if (win && typeof win.requestAnimationFrame === "function") win.requestAnimationFrame(callback);
  else setTimeout(callback, 16);
}

/** `scrollIntoView` is not implemented by every DOM shim; missing is not fatal. */
export function scrollIntoViewNearest(el: Element | null): void {
  if (!el || typeof el.scrollIntoView !== "function") return;
  el.scrollIntoView({ block: "nearest" });
}
