import { guardStore } from "@ailura/alpinejs-core/guards";
import { readAlpineStore, resolveStoreKey } from "@ailura/alpinejs-core/registration";
import type { Alpine } from "alpinejs";

import { FormController } from "./controller";
import type { CreateFormOptions, FormStore } from "./types";
import { DEFAULT_FORM_STORE_KEY } from "./types";

const packageName = "@ailura/alpinejs-form";

export function formPlugin(options: CreateFormOptions = {}): (alpine: Alpine) => void {
  const storeKey = resolveStoreKey(options, DEFAULT_FORM_STORE_KEY);

  return function registerForm(alpine: Alpine): void {
    const controller = new FormController(options.id);
    const instances = {} as FormStore["instances"];
    const base: FormStore = {
      instances,
      create: (id, o) => controller.create(id, o),
      // One key, both arities, argument forwarded: `destroy: () =>
      // controller.destroy()` would make `store.destroy("demo")` tear the
      // controller down instead of one form.
      destroy: (id?: string) => controller.destroy(id),
      destroyAll: () => controller.destroyAll(),
      createField: (fid, p, o) => controller.createField(fid, p, o),
      destroyField: (fid, p) => controller.destroyField(fid, p),
      setValue: (fid, p, v) => controller.setValue(fid, p, v),
      getValue: (fid, p) => controller.getValue(fid, p),
      touch: (fid, p) => controller.touch(fid, p),
      validate: (fid) => controller.validate(fid),
      submit: (fid, h) => controller.submit(fid, h),
      reset: (fid, o) => controller.reset(fid, o),
      setServerErrors: (fid, e, fe) => controller.setServerErrors(fid, e, fe),
    };

    // The controller's private registry is replaced key by key rather than
    // reassigned, so Alpine's reactive proxy on `instances` keeps the object
    // identity a template is already tracking — assigning a fresh record would
    // re-render every field on every keystroke of every other field.
    const sync = (): void => {
      const snap = controller.snapshotInstances();
      const registry = readAlpineStore<FormStore>(alpine, storeKey, base)
        .instances as FormStore["instances"];
      for (const k in snap) {
        const value = snap[k];
        if (value !== undefined) registry[k] = value;
      }
      for (const k in registry) if (!(k in snap)) delete registry[k];
    };

    controller.on("change", sync);
    // Before `guardStore` registers the proxy, `readAlpineStore` returns the
    // base store, so this first pass is a no-op today — it exists so a
    // controller that was already populated before the plugin ran is not left
    // unsynced.
    sync();

    guardStore(alpine, storeKey, base as FormStore, packageName);
  };
}

export default formPlugin;
