import { createDirectiveBinding, createValueReader } from "@ailura/alpinejs-core/directives";
import { guardDirective, guardStore } from "@ailura/alpinejs-core/guards";
import { generateId } from "@ailura/alpinejs-core/ids";
import { readAlpineStore, resolveStoreKey } from "@ailura/alpinejs-core/registration";
import { syncRecordFromSnapshot } from "@ailura/alpinejs-core/sync";
import type { Alpine } from "alpinejs";

import { DialogController } from "./controller";
import {
  type CreateDialogOptions,
  DEFAULT_DIALOG_DIRECTIVE_KEY,
  DEFAULT_DIALOG_STORE_KEY,
  type DialogOptions,
  type DialogPluginCallback,
  type DialogStore,
} from "./types";

const packageName = "@ailura/alpinejs-dialog";

export function dialogPlugin(options: CreateDialogOptions = {}): DialogPluginCallback {
  const storeKey = resolveStoreKey(options, DEFAULT_DIALOG_STORE_KEY);
  const directiveKey = options.directiveKey ?? DEFAULT_DIALOG_DIRECTIVE_KEY;

  return function registerDialog(alpine: Alpine): void {
    const controller = new DialogController({
      id: options.id,
      defaultCloseOnEscape: options.closeOnEscape,
      defaultCloseOnOutsideClick: options.closeOnOutsideClick,
    });
    const base = controller.toStore();
    // Same reason as every other package's override: `toStore()`'s `isOpen` is
    // an arrow closing over the controller's private registry, which is
    // untracked — inside an Alpine effect it registers no dependency and the
    // effect never re-runs, so `x-show` would never fire. Reading `this.instances`
    // is what makes the surrounding effect re-evaluate; `this` is Alpine's
    // reactive proxy, and only Alpine's, hence `function` over an arrow.
    base.isOpen = function (id) {
      return (this as DialogStore).instances?.[id]?.open ?? false;
    };
    const store: DialogStore = base;

    const sync = (): void => {
      // Mutate through the reactive proxy so Alpine triggers re-renders.
      syncRecordFromSnapshot(
        readAlpineStore<DialogStore>(alpine, storeKey, store).instances,
        controller.snapshotInstances()
      );
    };

    controller.on("change", sync);

    guardStore(alpine, storeKey, store, packageName);

    // x-dialog and x-dialog.panel: the element-bound half of the binding.
    //
    // `bindContainer` already accepts `null` as a release, but nothing in the
    // store surface ever passed one, so a hand-written binding was permanent:
    // the container reference outlived its element and `handleOutsideClick`
    // kept testing clicks against a detached node. A store registration has no
    // Alpine-invoked teardown in Alpine 3.17, so this directive's own
    // `cleanup()` is the only mechanism the runtime really invokes — Alpine
    // queues it in `el._x_cleanups` and `cleanupElement` drains it when the
    // element leaves the tree.
    //
    // `.panel` is a **modifier** of the same directive, not a second one:
    // Alpine parses `x-dialog.panel` as type `dialog` with modifiers
    // `['panel']` (its directive regex stops at the first dot), so
    // registering a `dialog-panel` key would never match that markup.
    guardDirective(
      alpine,
      directiveKey,
      (el, { expression, modifiers }, { cleanup, evaluateLater, effect }) => {
        const binding = createDirectiveBinding();
        cleanup(binding.release);

        // `.panel` adds outside-click handling. It is delegated on `document`
        // rather than bound to the panel, because a backdrop click does not
        // bubble *into* its own child: a panel-level listener would never see
        // the click it exists to detect. Delegating also retires both halves of
        // the old markup — the backdrop `@click="handleOutsideClick"` and the
        // panel `@click.stop` that only existed to stop inner clicks from
        // reaching it.
        const handlesOutsideClick = modifiers.includes("panel");

        let bound: string | null = null;
        // The id this element generated for itself, remembered across effect
        // runs: an options bag with no `id` would otherwise generate a new one
        // every run, and neither `id === bound` nor the teardown would settle.
        let generated: string | null = null;
        const onDocumentClick = (event: MouseEvent): void => {
          if (bound === null) return;
          controller.handleOutsideClick(bound, event);
        };

        const release = (): void => {
          if (bound === null) return;
          if (handlesOutsideClick) {
            document.removeEventListener("click", onDocumentClick, true);
          }
          // Unbind, not destroy: the panel usually lives inside a `<template
          // x-if>` that is destroyed and rebuilt while the dialog stays open, so
          // dropping the instance here would close a dialog the host is still
          // driving with `open(id)`.
          controller.bindContainer(bound, null);
          bound = null;
        };

        // A bare string is an explicit id, an object is the options bag with an
        // optional `id`, and an absent expression means "no dialog" rather than
        // "a dialog with defaults" — there is nothing to attach it to.
        createValueReader<DialogOptions | string>(
          expression,
          { evaluateLater, effect },
          (next: DialogOptions | string) => {
            if (next === undefined || next === null || next === "") {
              release();
              return;
            }
            const bag = (typeof next === "object" ? next : {}) as DialogOptions & { id?: string };
            const explicit = typeof next === "string" ? next : bag.id;
            const id =
              explicit && explicit !== "" ? explicit : (generated ??= generateId("dialog"));
            if (id === bound) return;

            release();
            bound = id;
            el.setAttribute("data-dialog-id", id);
            // Created here, not expected from the host: an `x-dialog="settings"`
            // whose id was never registered used to bind a container to an
            // instance that did not exist, and fail silently until the first
            // click.
            //
            // Only when missing: the host may have created this id with options
            // the markup cannot carry, and a re-`create` would drop them along
            // with the container it had already bound.
            const { id: _ignored, ...options } = bag;
            if (!controller.hasInstance(id)) controller.create(id, options);
            controller.bindContainer(id, el as HTMLElement);
            if (handlesOutsideClick) {
              // Capture phase, so a backdrop that stops propagation on its own
              // click handler still reaches this — otherwise the one click that
              // matters most would be the one to silence it.
              document.addEventListener("click", onDocumentClick, true);
            }
          }
        );
        binding.add(() => {
          el.removeAttribute("data-dialog-id");
          release();
        });
      },
      packageName
    );
  };
}

export default dialogPlugin;
