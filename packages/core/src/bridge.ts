/**
 * Bridges between controllers and Alpine directive registrations.
 *
 * The only bridge here is a directive bridge: it registers a controller-backed
 * directive through the collision guard and hands back an idempotent
 * `teardown()` with a fixed teardown order:
 *
 * 1. event-bus unsubscriptions, LIFO
 * 2. adapter DOM cleanups, LIFO
 * 3. `controller.destroy()`
 *
 * The teardown is a directive's own `cleanup()` payload, so it is
 * **element-bound**: hand the returned function to the `cleanup()` utility
 * Alpine supplies to directive callbacks, and Alpine invokes it when that
 * element leaves the tree (see `packages/gesture/src/plugin.ts`). A store
 * registration has no Alpine-invoked teardown in this Alpine version —
 * `plugin()` discards its callback's return value and the Alpine object
 * exposes no `cleanup`/`stop()` — so no store bridge is provided here.
 *
 * The cleanup arrays are read at teardown time, so the directive may keep
 * pushing subscriptions and DOM cleanups after bridging.
 */
import type { Alpine, DirectiveCallback } from "alpinejs";

import { guardDirective } from "./guards";
import { runLifo } from "./internal";

/** Minimal controller surface a bridge can tear down. */
export interface BridgeController {
  destroy(): void;
}

export interface BridgeDirectiveOptions {
  /** Alpine instance (passed in, never imported). */
  alpine: Alpine;
  /** Directive name without the `x-` prefix (camelCase is normalized to kebab-case). */
  directiveKey: string;
  /** Directive implementation. */
  directive: DirectiveCallback;
  /** Package name used for collision tracking. */
  packageName: string;
  /** Optional controller torn down after the cleanups. */
  controller?: BridgeController;
  /** Event-bus unsubscriptions (step 1 of teardown, LIFO). */
  eventCleanups?: Array<() => void>;
  /** Adapter DOM cleanups (step 2 of teardown, LIFO). */
  domCleanups?: Array<() => void>;
  /** Allow taking over names owned by another package. */
  override?: boolean;
}

/**
 * Register a controller-backed directive.
 *
 * @returns Idempotent teardown to hand to the directive's `cleanup()`
 *   utility, running the ordered teardown when the element is removed.
 */
export function bridgeControllerDirective(options: BridgeDirectiveOptions): () => void {
  guardDirective(
    options.alpine,
    options.directiveKey,
    options.directive,
    options.packageName,
    options
  );

  let torndown = false;
  return () => {
    if (torndown) return;
    torndown = true;
    // 1. Event-bus unsubscriptions, LIFO.
    if (options.eventCleanups) runLifo(options.eventCleanups);
    // 2. Adapter DOM cleanups, LIFO.
    if (options.domCleanups) runLifo(options.domCleanups);
    // 3. Controller teardown, last.
    options.controller?.destroy();
  };
}
