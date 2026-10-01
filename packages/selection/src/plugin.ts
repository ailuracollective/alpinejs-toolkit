import { createDirectiveBinding, createValueReader } from "@ailura/alpinejs-core/directives";
import { guardDirective, guardMagic, guardStore } from "@ailura/alpinejs-core/guards";
import { generateId } from "@ailura/alpinejs-core/ids";
import { readAlpineStore, resolvePluginKeys } from "@ailura/alpinejs-core/registration";
import type { Alpine } from "alpinejs";

import { SelectionController, toKeyString } from "./controller";
import {
  type CreateSelectionOptions,
  DEFAULT_SELECTION_DIRECTIVE_KEY,
  DEFAULT_SELECTION_MAGIC_KEY,
  DEFAULT_SELECTION_STORE_KEY,
  type SelectionDirectiveOptions,
  type SelectionOptions,
  type SelectionPluginCallback,
  type SelectionStore,
} from "./types";

const packageName = "@ailura/alpinejs-selection";

export function selectionPlugin(options: CreateSelectionOptions = {}): SelectionPluginCallback {
  const { storeKey, magicKey } = resolvePluginKeys(
    options,
    DEFAULT_SELECTION_STORE_KEY,
    DEFAULT_SELECTION_MAGIC_KEY
  );
  const directiveKey = options.directiveKey ?? DEFAULT_SELECTION_DIRECTIVE_KEY;

  return function registerSelection(alpine: Alpine): void {
    const controller = new SelectionController(options.id);
    const instances: Record<string, SelectionStore["instances"][string]> = {};

    const store: SelectionStore = {
      instances,
      create: (id, opts) => controller.create(id, opts),
      destroy: (id) => controller.destroy(id),
      destroyAll: () => controller.destroyAll(),
      setKeys: (id, keys) => controller.setKeys(id, keys),
      setDisabledKeys: (id, keys) => controller.setDisabledKeys(id, keys),
      setMode: (id, mode) => controller.setMode(id, mode),
      setValue: (id, value) => controller.setValue(id, value),
      select: (id, key, opts) => controller.select(id, key, opts),
      replace: (id, key) => controller.replace(id, key),
      toggle: (id, key) => controller.toggle(id, key),
      extend: (id, key) => controller.extend(id, key),
      clear: (id) => controller.clear(id),
      selectAll: (id) => controller.selectAll(id),
      setActive: (id, key) => controller.setActive(id, key),
      setAnchor: (id, key) => controller.setAnchor(id, key),
      isSelected: function (id, key) {
        return (
          (this as SelectionStore).instances?.[id]?.selectedKeys.includes(toKeyString(key)) ?? false
        );
      },
      isSelectable: (id, key) => controller.isSelectable(id, key),
      isActive: function (id, key) {
        return (this as SelectionStore).instances?.[id]?.activeKey === toKeyString(key);
      },
      isAnchor: function (id, key) {
        return (this as SelectionStore).instances?.[id]?.anchorKey === toKeyString(key);
      },
      getSnapshot: (id) => controller.getSnapshot(id),
    };

    // Sync the reactive registry on controller changes so template reads
    // through isSelected/isActive/isAnchor re-render. Mutate through the
    // reactive proxy (raw mutations would never trigger Alpine).
    controller.on("destroy", ({ id }) => {
      // A destroy carries no snapshot, so drop the key directly. Without this
      // the projection keeps the deleted instance: `snapshotInstances()` no
      // longer lists it, but nothing removed it from the record.
      const registry = readAlpineStore<SelectionStore>(alpine, storeKey, store).instances as Record<
        string,
        SelectionStore["instances"][string]
      >;
      delete registry[id];
    });

    controller.on("change", () => {
      const snap = controller.snapshotInstances();
      const registry = readAlpineStore<SelectionStore>(alpine, storeKey, store).instances as Record<
        string,
        SelectionStore["instances"][string]
      >;
      for (const k in snap) {
        const value = snap[k];
        if (value !== undefined) registry[k] = value;
      }
      for (const k in registry) if (!(k in snap)) delete registry[k];
    });

    guardStore(alpine, storeKey, store as unknown as Record<string, unknown>, packageName);
    if (magicKey) {
      guardMagic(
        alpine,
        magicKey,
        () => readAlpineStore<SelectionStore>(alpine, storeKey),
        packageName
      );
    }

    // x-selection="{ mode: 'multiple', keys: [...] }": create on mount, destroy
    // on teardown.
    //
    // `create()` without a matching `destroy()` is the documented failure mode
    // for this package — the registry is reactive and long-lived, so an instance
    // created for a route that is no longer mounted keeps its snapshot alive
    // (see `packages/collection`'s docs, which spell the same rule out for
    // `instances`). A store registration has no Alpine-invoked teardown in
    // Alpine 3.17, so this directive's own `cleanup()` is the only mechanism the
    // runtime really invokes: Alpine queues it in `el._x_cleanups` and
    // `cleanupElement` drains it when the element leaves the tree.
    guardDirective(
      alpine,
      directiveKey,
      (el, { expression }, { cleanup, evaluateLater, effect }) => {
        const binding = createDirectiveBinding();
        cleanup(binding.release);

        let created: string | null = null;
        const release = (): void => {
          if (created === null) return;
          controller.destroy(created);
          created = null;
        };

        createValueReader<SelectionDirectiveOptions | string>(
          expression,
          { evaluateLater, effect },
          (value: SelectionDirectiveOptions | string) => {
            release();
            // An absent expression means "no instance", not "an instance with a
            // generated id" — a bare `x-selection` is a no-op rather than a
            // silent leak.
            if (value === undefined || value === null || value === "") return;
            // A bare token is an explicit id: `x-selection="files"`. An object
            // is the options bag, and its `id` is optional because most
            // components never need to name their instance — the directive
            // generates one, and the element gets it back as
            // `el.dataset.selectionId` for the read helpers.
            const explicitId = typeof value === "string" ? value : value?.id;
            const id = explicitId ?? generateId("selection");
            const options: SelectionOptions =
              typeof value === "string" ? {} : ({ ...value, id: undefined } as SelectionOptions);
            controller.create(id, options);
            created = id;
            el.setAttribute("data-selection-id", id);
          }
        );
        binding.add(() => {
          el.removeAttribute("data-selection-id");
          release();
        });
      },
      packageName
    );
  };
}

export default selectionPlugin;
