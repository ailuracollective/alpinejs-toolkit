import { createDirectiveBinding, createValueReader } from "@ailura/alpinejs-core/directives";
import { guardDirective, guardStore } from "@ailura/alpinejs-core/guards";
import { generateId } from "@ailura/alpinejs-core/ids";
import { readAlpineStore, resolveStoreKey } from "@ailura/alpinejs-core/registration";
import { syncRecordFromSnapshot } from "@ailura/alpinejs-core/sync";
import type { Alpine } from "alpinejs";

import { CarouselController } from "./controller";
import type {
  CarouselDirectiveOptions,
  CarouselOptions,
  CarouselPluginCallback,
  CarouselStore,
  CreateCarouselOptions,
} from "./types";
import {
  DEFAULT_CAROUSEL_DIRECTIVE_KEY as DirectiveKey,
  DEFAULT_CAROUSEL_STORE_KEY as StoreKey,
} from "./types";

const packageName = "@ailura/alpinejs-carousel";

export function carouselPlugin(options: CreateCarouselOptions = {}): CarouselPluginCallback {
  const storeKey = resolveStoreKey(options, StoreKey);
  const directiveKey = options.directiveKey ?? DirectiveKey;
  return function registerCarousel(alpine: Alpine): void {
    const controller = new CarouselController(options.id);
    const store = controller.toStore() as CarouselStore & { instances: Record<string, unknown> };
    const sync = () => {
      const proxy = readAlpineStore<CarouselStore>(alpine, storeKey, store);
      // Mutate through the reactive proxy so Alpine triggers re-renders.
      syncRecordFromSnapshot(
        proxy.instances as Record<string, unknown>,
        controller.snapshotInstances() as Record<string, unknown>
      );
    };
    controller.on("change", sync);
    controller.on("slideChange", sync);
    guardStore(alpine, storeKey, store, packageName);

    // x-carousel="id": the element-bound half of the binding.
    //
    // A store registration has no Alpine-invoked teardown in Alpine 3.17 —
    // `plugin()` discards the callback's return value and the Alpine object
    // exposes no `cleanup`/`stop()` — so a directive's own `cleanup()` is the
    // only mechanism the runtime really invokes. Alpine queues it in
    // `el._x_cleanups` and `cleanupElement` drains it when the element leaves
    // the tree (see `packages/gesture/src/plugin.ts`).
    guardDirective(
      alpine,
      directiveKey,
      (el, { expression, modifiers }, utilities) => {
        const binding = createDirectiveBinding();
        utilities.cleanup(binding.release);
        // `.viewport` binds without creating, for the case where the host
        // creates the instance elsewhere. Without the modifier the directive
        // creates the instance when it is missing, which is what removes the
        // hand-written `create()` + `$nextTick` + `querySelector` dance the
        // playground needed to bind a viewport inside a container.
        const creates = !modifiers.includes("viewport");

        let bound: string | null = null;
        // The id this element generated for itself, remembered across effect
        // runs. Without it, an expression carrying options but no id would
        // generate a *new* id on every run, so `id === bound` never held, the
        // directive re-created and re-bound each time, and each write to
        // `data-carousel-id` fed the mutation observer that ran the effect
        // again — a loop that never settles.
        let generated: string | null = null;
        const release = (): void => {
          if (bound === null) return;
          // Element-owned resources only: `bindViewport(id, null)` drops the
          // element reference and destroys the Embla engine, while the
          // instance stays in the store for its controls to keep driving.
          controller.bindViewport(bound, null);
          bound = null;
        };

        createValueReader<CarouselDirectiveOptions | string>(
          expression,
          { evaluateLater: utilities.evaluateLater, effect: utilities.effect },
          (value: CarouselDirectiveOptions | string) => {
            // A bare token is an instance id; an object is `{ id, ...options }`.
            const config = typeof value === "string" ? { id: value } : (value ?? {});
            const explicit = typeof config.id === "string" ? config.id : "";
            // No id anywhere: generate one, so `x-carousel="{ loop: true }"` is a
            // working carousel rather than a directive that binds nothing.
            const id = explicit !== "" ? explicit : (generated ??= generateId("carousel"));
            if (id === bound) return;
            release();
            bound = id;
            el.setAttribute("data-carousel-id", id);
            if (creates && !controller.hasInstance(id)) {
              const { id: _ignored, ...options } = config as CarouselDirectiveOptions;
              controller.create(id, options as CarouselOptions);
            }
            controller.bindViewport(id, el as HTMLElement);
          }
        );
        binding.add(() => {
          el.removeAttribute("data-carousel-id");
          release();
        });
      },
      packageName
    );
  };
}

export default carouselPlugin;
