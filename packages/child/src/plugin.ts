/**
 * The `x-child` directive body.
 *
 * This cannot be a controller: replacing the wrapper with its promoted child
 * needs `interceptInit`, `morph`, `mutateDom` and `initTree`, which are Alpine
 * internals with no framework-agnostic equivalent. The pure half — parsing the
 * directive and moving attributes — is in `controller.ts` and is testable
 * without Alpine.
 */

import { guardDirective } from "@ailura/alpinejs-core/guards";
import type { Alpine } from "alpinejs";

import {
  clearTransferredAttributes,
  countElementChildren,
  findFirstElementChild,
  parseChildDirective,
  transferAttributes,
} from "./controller";
import type {
  ChildAlpine,
  ChildMorphOptions,
  ChildPluginCallback,
  ChildPluginOptions,
} from "./types";
import { DEFAULT_CHILD_DIRECTIVE_KEY } from "./types";

const packageName = "@ailura/alpinejs-child";

type AlpineElement = Element & { _x_ignore?: boolean; _x_ignoreSelf?: boolean };

export function childPlugin(options: ChildPluginOptions = {}): ChildPluginCallback {
  const directiveKey = options.directiveKey ?? DEFAULT_CHILD_DIRECTIVE_KEY;

  return function registerChild(alpine: Alpine): void {
    const Alpine = alpine as unknown as ChildAlpine;
    const processedWrappers = new WeakSet<Element>();

    // Teaches Alpine's walker that `x-child` is an attribute it should
    // initialise, so a wrapper added later (a view transition, an `x-if`
    // reveal) is picked up without the host telling Alpine to rescan.
    if (
      typeof (Alpine as unknown as { addInitSelector?: unknown }).addInitSelector === "function"
    ) {
      (Alpine as unknown as { addInitSelector: (fn: () => string) => void }).addInitSelector(
        () => `[${(Alpine as unknown as { prefixed(n: string): string }).prefixed(directiveKey)}]`
      );
    }

    // `interceptInit` runs before Alpine builds the element's directive stack,
    // which is the only point at which the wrapper can be suppressed *and* its
    // attributes read. Every entry below is a capability check rather than a
    // version check: a host on an Alpine that lacks `interceptInit` or `morph`
    // gets a silent no-op rather than a crash at boot.
    const intercept = (
      Alpine as unknown as { interceptInit?: (fn: (el: Element, skip: () => void) => void) => void }
    ).interceptInit;
    if (typeof intercept === "function") {
      intercept((el: Element, skip: () => void) => {
        const config = parseChildDirective(el);
        if (!config) return;
        if (processedWrappers.has(el)) return;
        const target = findFirstElementChild(el);
        if (!target) return;
        if (countElementChildren(el) > 1) {
          // Siblings past the first are dropped by the morph below, which
          // replaces the wrapper wholesale with `target.outerHTML`. Deliberately
          // not an error: a wrapper with extra children still yields one real
          // element, it just loses the rest.
        }
        const morph = Alpine.morph;
        if (typeof morph !== "function") return;
        processedWrappers.add(el);
        (el as AlpineElement)._x_ignoreSelf = true;
        (target as AlpineElement)._x_ignore = true;
        // The wrapper's own directives are dropped: it is about to be replaced,
        // and its `x-data` scope must not be applied twice.
        skip();
        (Alpine as unknown as { nextTick(cb: () => void): void }).nextTick(() => {
          if (!(el.isConnected || target.isConnected)) return;
          transferAttributes(el, target, config.mode);
          let promoted: Element | null = null;
          // `mutateDom` suspends Alpine's mutation observer, otherwise it sees
          // the replacement as a live DOM change and re-runs its own walker over
          // a node that is already initialised. `added` is how the new element
          // is identified: the old reference is detached by the time it returns.
          (Alpine as unknown as { mutateDom(cb: () => void): void }).mutateDom(() => {
            const morphOptions: ChildMorphOptions = {
              added(node) {
                if (node.nodeType === 1) promoted = node as Element;
              },
            };
            morph(el, target.outerHTML, morphOptions);
          });
          // Only the wrapper is required to be connected: the promoted element
          // may be either one, depending on whether the morph inserted or
          // reused. Re-initialise it here because the skip() above deferred the
          // child's own directives, which would otherwise never run.
          const result = promoted ?? (el.isConnected ? el : null);
          if (result) {
            processedWrappers.add(result);
            (result as AlpineElement)._x_ignore = undefined;
            (Alpine as unknown as { initTree(el: Element): void }).initTree(result as HTMLElement);
          }
          clearTransferredAttributes(el);
        });
      });
    }

    // Run before `x-ignore` so a wrapper that is itself ignored still gets
    // its attributes transferred to the promoted child.
    guardDirective(Alpine as unknown as Alpine, directiveKey, () => ({}), packageName).before(
      "ignore"
    );
  };
}

export default childPlugin;
