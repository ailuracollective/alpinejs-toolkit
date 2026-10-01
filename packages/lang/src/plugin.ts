import { guardStore } from "@ailura/alpinejs-core/guards";
import { resolveStoreKey } from "@ailura/alpinejs-core/registration";
import type { Alpine } from "alpinejs";

import { LangController } from "./controller";
import {
  DEFAULT_LANG_STORE_KEY,
  type LangPluginCallback,
  type LangPluginOptions,
  type LangState,
  type LangStore,
} from "./types";

const packageName = "@ailura/alpinejs-lang";

export function langPlugin(options: LangPluginOptions = {}): LangPluginCallback {
  const storeKey = resolveStoreKey(options, DEFAULT_LANG_STORE_KEY);

  return function registerLang(alpine: Alpine): void {
    // `navigator` is deliberately not passed through: the plugin always detects
    // from the ambient one, so the two ways of constructing a controller agree
    // about what `reset()` will restore.
    const controller = new LangController({
      fallback: options.fallback,
      normalize: options.normalize,
    });

    // Every value the store exposes is read through this object, and every
    // write lands on it, so a template read tracks a key that `sync` actually
    // writes.
    //
    // The `is()`/`includes()` predicates are the reason this is not just the
    // controller: a predicate called from a template must read the reactive
    // values, not the controller's private fields. Reading the controller
    // registers no dependency, so `x-show="$store.lang.is('es')"` evaluated once
    // and then never again — the demo's translations stayed frozen on the first
    // language rendered, with nothing on screen to tell that they were stale.
    const reactive = (alpine as unknown as { reactive?: (v: unknown) => unknown }).reactive;
    // `LangState` is readonly because it describes the controller's view of
    // itself. The store's copy is written on every change, so it is held as a
    // mutable record and only ever read back as `LangState`.
    const raw: Record<string, unknown> = { ...controller.get() };
    const view = (reactive ? reactive(raw) : raw) as Record<string, unknown>;
    const read = () => view as unknown as LangState;

    // `fallback` is seeded once and never rewritten, so it does not need a sync
    // write of its own — but it is read through the same reactive record so a
    // template binding it registers a dependency like every other field.
    const sync = (): void => {
      const next = controller.get();
      view["current"] = next.current;
      view["base"] = next.base;
      view["region"] = next.region;
      view["languages"] = next.languages;
      view["isDetected"] = next.isDetected;
    };

    const store: LangStore = {
      get current() {
        return read().current;
      },
      get base() {
        return read().base;
      },
      get region() {
        return read().region;
      },
      get languages() {
        return read().languages;
      },
      get fallback() {
        return read().fallback;
      },
      get isDetected() {
        return read().isDetected;
      },
      // Read the reactive values, then answer from them: those reads are what
      // make the surrounding effect re-run.
      is: (value: string) => controller.isFrom(read(), value),
      includes: (value: string) => controller.includesFrom(read(), value),
      set: (value: string) => controller.set(value),
      reset: () => controller.reset(),
    };

    // `mount()` before `on("change")`: `mount()` queues the initialization event
    // on a microtask, so a listener attached synchronously right after still
    // receives it.
    controller.mount();
    controller.on("change", sync);

    guardStore(alpine, storeKey, store, packageName);
  };
}

export default langPlugin;
