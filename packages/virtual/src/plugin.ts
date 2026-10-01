import { createDirectiveBinding } from "@ailura/alpinejs-core/directives";
import { guardDirective, guardMagic, guardStore } from "@ailura/alpinejs-core/guards";
import { generateId } from "@ailura/alpinejs-core/ids";
import { readAlpineStore, resolvePluginKeys } from "@ailura/alpinejs-core/registration";
import type { Alpine } from "alpinejs";

import { VirtualController } from "./controller";
import type {
  CreateVirtualOptions,
  VirtualOptions,
  VirtualPluginCallback,
  VirtualStore,
} from "./types";
import {
  DEFAULT_VIRTUAL_DIRECTIVE_KEY,
  DEFAULT_VIRTUAL_MAGIC_KEY,
  DEFAULT_VIRTUAL_STORE_KEY,
} from "./types";

const packageName = "@ailura/alpinejs-virtual";

export function virtualPlugin(options: CreateVirtualOptions = {}): VirtualPluginCallback {
  const { storeKey, magicKey } = resolvePluginKeys(
    options,
    DEFAULT_VIRTUAL_STORE_KEY,
    DEFAULT_VIRTUAL_MAGIC_KEY
  );
  const directiveKey = options.directiveKey ?? DEFAULT_VIRTUAL_DIRECTIVE_KEY;
  return function registerVirtual(alpine: Alpine): void {
    const controller = new VirtualController(options.id);
    const store = controller.toStore() as VirtualStore & { instances: Record<string, unknown> };
    const sync = () => {
      const snap = controller.snapshotInstances();
      const instances = readAlpineStore<VirtualStore & { instances: Record<string, unknown> }>(
        alpine,
        storeKey,
        store
      ).instances;
      for (const k of Object.keys(snap)) instances[k] = snap[k];
      for (const k of Object.keys(instances)) if (!(k in snap)) delete instances[k];
    };
    controller.on("change", sync);
    controller.on("rangeChange", sync);
    controller.on("scroll", sync);
    guardStore(alpine, storeKey, store, packageName);
    if (magicKey)
      guardMagic(
        alpine,
        magicKey,
        () => readAlpineStore<VirtualStore>(alpine, storeKey),
        packageName
      );

    // x-virtual-scroll="id": the element-bound half of the binding.
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
        // `.create` opts into creating the instance from the expression's
        // options, which removes the separate `x-init="$store.virtual.create(id,
        // { … })"` that every virtualized list had to open with. Off by default
        // so the documented binding-only behaviour is unchanged.
        const creates = modifiers.includes("create");

        let bound: string | null = null;
        let unsubscribe: (() => void) | null = null;
        // The id this element generated for itself, remembered across effect
        // runs and retries: an options bag with no `id` would otherwise
        // generate a new one every time, and neither `tryBind` nor the
        // teardown would settle.
        let generated: string | null = null;
        const release = (): void => {
          if (bound === null) return;
          // Unbind, not destroy: `bindScrollElement(id, null)` runs the
          // instance's own `scrollCleanup`, so the scroll listener goes away
          // while the instance keeps serving the store.
          controller.bindScrollElement(bound, null);
          bound = null;
        };
        // Returns false when the instance does not exist yet, so the caller can
        // retry instead of assuming success.
        const tryBind = (id: string | null, options?: VirtualOptions): boolean => {
          if (id === null || id === bound) return true;
          release();
          if (!controller.hasInstance(id)) {
            if (!(creates && options)) return false;
            controller.create(id, options);
          }
          bound = id;
          el.setAttribute("data-virtual-id", id);
          controller.bindScrollElement(id, el);
          return true;
        };

        // A bare token IS the id, and that is the form the package documents
        // (`x-virtual-scroll="rows"`). Evaluating it as an expression asks
        // Alpine to resolve a *variable* named `rows`, which throws
        // "rows is not defined" before `tryBind` ever runs — and because
        // `evaluateLater` reports the failure to Alpine's own handler rather
        // than throwing here, the list simply stayed dead.
        //
        // So a bare identifier is taken literally. Anything else — a quoted
        // string, or a variable holding the id — is evaluated as before.
        const raw = typeof expression === "string" ? expression.trim() : "";
        const literal = /^[A-Za-z_$][\w$-]*$/.test(raw) ? raw : null;
        const bind = (id: string | null, options?: VirtualOptions): void => {
          if (tryBind(id, options)) return;
          // The instance does not exist yet. NOT the cause of the bug this file
          // fixes — Alpine walks the tree depth first, so a parent's `x-init`
          // runs before a directive on its children, and a mutation that
          // removed this retry still passes every test here.
          //
          // It is a safety net for the case that IS real: `bindScrollElement`
          // returns silently when the instance is missing, so an instance
          // created after init (a fetch, a lazily mounted list) would leave a
          // dead viewport with no symptom. Retry on the next tick, and on every
          // change the controller announces until it lands.
          if (unsubscribe) return;
          const stop = (): void => {
            unsubscribe?.();
            unsubscribe = null;
          };
          unsubscribe = controller.on("change", () => {
            if (tryBind(id, options)) stop();
          });
          queueMicrotask(() => {
            if (tryBind(id, options)) stop();
          });
        };

        if (literal !== null) {
          bind(literal);
        } else {
          utilities.evaluateLater(expression)(
            (value: unknown) => {
              if (typeof value === "string" && value !== "") {
                // A quoted bare id means "create with the controller's
                // defaults", which is why `.create` works without an options
                // bag.
                bind(value, {});
                return;
              }
              // The object form carries the options: `{ id: 'rows', count: 10000 }`.
              const config = value as Partial<VirtualOptions> & { id?: unknown };
              const explicit = typeof config?.id === "string" ? config.id : "";
              // No id in the bag: generate one and remember it, so the retry
              // loop below and the effect's next run address the same instance
              // instead of conjuring a new one each time.
              const id = explicit || (generated ??= generateId("virtual"));
              const { id: _ignored, ...options } = config as { id: string } & VirtualOptions;
              bind(id, options);
            },
            { scope: {} as never }
          );
        }

        binding.add(() => {
          unsubscribe?.();
          unsubscribe = null;
          el.removeAttribute("data-virtual-id");
          release();
        });
      },
      packageName
    );
  };
}

export default virtualPlugin;
