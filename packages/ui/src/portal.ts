/**
 * SSR-safe portal root factory.
 *
 * Returns the existing portal container when one with the requested
 * id already exists in the DOM; otherwise creates a new element,
 * appends it to `document.body`, and returns it. Returns `null`
 * under SSR or when `document` is unavailable so the caller can
 * short-circuit consumer templates without throwing.
 *
 * The portal helper is generic on purpose — it is a DOM primitive
 * any consumer can compose. It does NOT ship a plugin.
 */

import { safeDocument } from "@ailura/alpinejs-core/env";

/**
 * Public options for {@link createPortalRoot}.
 *
 * - `id` — the DOM id of the portal container. Defaults to
 *   `"overlay-root"`.
 * - `className` — optional class list applied when the portal is
 *   created (existing elements are not re-styled).
 * - `as` — element tag. Default is `"div"`. The package is
 *   headless — the tag controls semantic role only.
 */
export interface PortalRootOptions {
  /**
   * Portal container id. Defaults to `"overlay-root"`. Pass a
   * custom value when the consumer already manages a different
   * portal layer.
   */
  readonly id?: string;
  /** Class list applied when the portal is created. */
  readonly className?: string;
  /** Tag of the created container. Default `"div"`. */
  readonly as?: keyof HTMLElementTagNameMap;
}

const DEFAULT_ID = "overlay-root";
const DEFAULT_TAG: keyof HTMLElementTagNameMap = "div";

/**
 * Detaches a portal container the caller already holds a reference to.
 *
 * The exact inverse of {@link createPortalRoot} for the node the caller
 * owns, and deliberately reference-taking rather than id-taking: the
 * helper can only ever remove a node the caller can already name, so
 * it can never tear down a portal root another consumer created for
 * the same id. SSR-safe (no `document` access without one) and
 * idempotent — removing twice, removing an already-detached node, and
 * removing `null` are all no-ops.
 *
 * @param root - The portal element to detach.
 * @returns `true` when a node was actually removed, `false` for every
 * no-op case (`null`, SSR, already detached).
 */
export function removePortalRoot(root: HTMLElement | null | undefined): boolean {
  if (!root) {
    return false;
  }
  if (!safeDocument()) {
    return false;
  }
  const parent = root.parentNode;
  if (!parent) {
    return false;
  }
  parent.removeChild(root);
  return true;
}

/**
 * Returns the portal container for `opts.id`, creating it on the
 * first call. Idempotent — repeat calls return the same element.
 *
 * @param opts - Portal configuration (id, className, tag).
 * @returns The portal container, or `null` when `document` is
 * unavailable (SSR / Node test runners). The absence check reads
 * through `@ailura/alpinejs-core/env` (`safeDocument()` returns
 * `undefined` without a DOM); the public contract stays `null`.
 */
export function createPortalRoot(opts: PortalRootOptions = {}): HTMLElement | null {
  const doc = safeDocument();
  if (!doc) {
    return null;
  }

  const id = opts.id ?? DEFAULT_ID;
  const existing = doc.getElementById(id);

  if (existing) {
    return existing;
  }

  const tag = opts.as ?? DEFAULT_TAG;
  const element = doc.createElement(tag);
  element.id = id;
  if (opts.className) {
    element.className = opts.className;
  }
  doc.body.appendChild(element);
  return element;
}
