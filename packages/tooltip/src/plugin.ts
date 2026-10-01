import { createDirectiveBinding, createValueReader } from "@ailura/alpinejs-core/directives";
import { guardDirective, guardMagic, guardStore } from "@ailura/alpinejs-core/guards";
import { generateId } from "@ailura/alpinejs-core/ids";
import { readAlpineStore, resolvePluginKeys } from "@ailura/alpinejs-core/registration";
import { syncRecordFromSnapshot } from "@ailura/alpinejs-core/sync";
import type { Alpine } from "alpinejs";

import { TooltipController } from "./controller";
import {
  type CreateTooltipOptions,
  DEFAULT_TOOLTIP_DIRECTIVE_KEY,
  DEFAULT_TOOLTIP_MAGIC_KEY,
  DEFAULT_TOOLTIP_STORE_KEY,
  type TooltipOptions,
  type TooltipPluginCallback,
  type TooltipStore,
} from "./types";

const packageName = "@ailura/alpinejs-tooltip";

export function tooltipPlugin(options: CreateTooltipOptions = {}): TooltipPluginCallback {
  const { storeKey, magicKey } = resolvePluginKeys(
    options,
    DEFAULT_TOOLTIP_STORE_KEY,
    DEFAULT_TOOLTIP_MAGIC_KEY
  );
  const directiveKey = options.directiveKey ?? DEFAULT_TOOLTIP_DIRECTIVE_KEY;

  return function registerTooltip(alpine: Alpine): void {
    const controller = new TooltipController(options.id);
    const base = controller.toStore();
    // `toStore()`'s `isOpen` is an arrow closing over the controller's private
    // registry, which is untracked: inside an Alpine effect it registers no
    // dependency, so `x-show="$store.tooltip.isOpen(id)"` would evaluate once
    // and never re-run. Reading `this.instances` is what makes the surrounding
    // effect re-evaluate, and `this` is Alpine's reactive proxy only.
    base.isOpen = function (id) {
      return (this as TooltipStore).instances?.[id]?.open ?? false;
    };
    const store: TooltipStore = base;

    const sync = (): void => {
      // Mutate through the reactive proxy so Alpine triggers re-renders.
      syncRecordFromSnapshot(
        readAlpineStore<TooltipStore>(alpine, storeKey, store).instances,
        controller.snapshotInstances()
      );
    };

    controller.on("change", sync);

    guardStore(alpine, storeKey, store, packageName);
    if (magicKey) {
      guardMagic(
        alpine,
        magicKey,
        () => readAlpineStore<TooltipStore>(alpine, storeKey),
        packageName
      );
    }

    // x-tooltip="id": the element-bound half of the binding.
    //
    // `bindTrigger` attaches five listeners plus a shared window `scroll`
    // watcher, and a store registration has no Alpine-invoked teardown in
    // Alpine 3.17 — `plugin()` discards the callback's return value and the
    // Alpine object exposes no `cleanup`/`stop()` — so this directive's own
    // `cleanup()` is the only mechanism the runtime really invokes. Alpine
    // queues it in `el._x_cleanups` and `cleanupElement` drains it when the
    // element leaves the tree.
    //
    // Hand-wiring `@mouseenter`/`@mouseleave` instead cannot express
    // `closeOnScrollAway`: a pointer that does not move produces no
    // `mouseleave`, because the browser only re-dispatches pointer events on
    // real movement, so a trigger that scrolls out from under a stationary
    // cursor stays open with nothing left to close it.
    guardDirective(
      alpine,
      directiveKey,
      (el, { expression, modifiers }, { cleanup, evaluateLater, effect }) => {
        const binding = createDirectiveBinding();
        cleanup(binding.release);

        // Modifiers are a shorthand for the one option that has a natural
        // on/off spelling in markup: `x-tooltip.sticky` opts out of the
        // scroll-away close. Anything else stays an expression concern.
        const sticky = modifiers.includes("sticky");
        const readOptions = (): TooltipOptions => (sticky ? { closeOnScrollAway: false } : {});

        let bound: string | null = null;
        // The id this element generated for itself, remembered across effect
        // runs: an options bag with no `id` would otherwise generate a new one
        // every run, and neither `id === bound` nor the teardown would settle.
        let generated: string | null = null;
        const release = (): void => {
          if (bound === null) return;
          // Unbind, not destroy: the panel may outlive the trigger (it is
          // usually teleported into a portal), and `destroy` would also drop an
          // instance the host created explicitly.
          controller.unbindTrigger(bound);
          bound = null;
        };

        // Three shapes, the same ones `x-selection` reads: a bare string is an explicit
        // id, an object is the options bag with an optional `id`, and an absent
        // expression means "no tooltip" rather than "a tooltip with defaults" —
        // there is nothing to attach it to, and a generated instance nobody
        // asked for would keep a live tooltip alive on the page.
        createValueReader<TooltipOptions | string>(
          expression,
          { evaluateLater, effect },
          (next: TooltipOptions | string) => {
            if (next === undefined || next === null || next === "") {
              release();
              return;
            }
            const bag = (typeof next === "object" ? next : {}) as TooltipOptions & { id?: string };
            const explicit = typeof next === "string" ? next : bag.id;
            const id =
              explicit && explicit !== "" ? explicit : (generated ??= generateId("tooltip"));
            if (id === bound) return;

            release();
            bound = id;
            el.setAttribute("data-tooltip-id", id);
            const { id: _ignored, ...options } = bag;
            // Only when missing: the host may have created this id with options
            // the markup cannot carry, and a re-`create` would drop them along
            // with the trigger binding.
            if (!controller.hasInstance(id))
              controller.create(id, { ...options, ...readOptions() });
            controller.bindTrigger(id, el as HTMLElement);
          }
        );
        binding.add(() => {
          el.removeAttribute("data-tooltip-id");
          release();
        });
      },
      packageName
    );
  };
}

export default tooltipPlugin;
