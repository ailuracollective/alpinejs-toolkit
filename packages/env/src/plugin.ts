import { guardMagic } from "@ailura/alpinejs-core/guards";
import type { Alpine } from "alpinejs";

import { createEnvController, EnvController } from "./controller";
import {
  DEFAULT_ENV_MAGIC_KEY,
  type EnvMagic,
  type EnvPluginCallback,
  type EnvPluginOptions,
} from "./types";

const packageName = "@ailura/alpinejs-env";

export function envPlugin(options: EnvPluginOptions = {}): EnvPluginCallback {
  const magicKey = options.magicKey ?? DEFAULT_ENV_MAGIC_KEY;

  const enableNetwork = options.network !== false;
  const enableVisibility = options.visibility !== false;
  const enableBattery = options.battery !== false;
  const enablePlatform = options.platform !== false;

  return function registerEnv(alpine: Alpine): void {
    const controller = new EnvController(options.id);
    controller.mount();

    // Alpine's `injectMagics` defines `$name` as a plain getter returning
    // `callback(el, utilities)` — it does NOT wrap the result in `reactive()`.
    // Without a reactive proxy here, a template read tracks only the
    // never-changing `$env` key of Alpine's data proxy, so the view would never
    // re-render (the defect the four per-domain magics shipped with). Fall back
    // to a plain object when `alpine.reactive` is unavailable: values stay
    // correct, only the re-render is lost.
    const maybeReactive = (alpine as unknown as { reactive?: (v: unknown) => unknown }).reactive;
    const view = (maybeReactive ? maybeReactive({}) : {}) as Record<string, unknown>;

    // Registration read, captured before the first `sync()`. A domain disabled
    // through the options reports `supported: false` and stays frozen here: the
    // aggregate is never partial, but nothing re-renders for a domain the host
    // turned off.
    const initial = {
      network: { ...controller.network },
      visibility: { ...controller.visibility },
      battery: controller.battery ? { ...controller.battery } : null,
      platform: { ...controller.platform },
    };

    // ONE sync, reading the CONTROLLER's own getters rather than the event
    // detail: a controller-side read can never forget a declared field, and a
    // change to a detail's shape cannot silently drop one from the view.
    const sync = (): void => {
      view["network"] = enableNetwork
        ? { ...controller.network, supported: true }
        : { ...initial.network, supported: false };
      view["visibility"] = enableVisibility
        ? { ...controller.visibility, supported: true }
        : { ...initial.visibility, supported: false };
      view["battery"] = enableBattery
        ? controller.battery
          ? { ...controller.battery }
          : null
        : null;
      view["platform"] = enablePlatform
        ? { ...controller.platform, supported: true }
        : { ...initial.platform, supported: false };
    };

    // The controller emits `change` with the full snapshot alongside every
    // per-domain event, so one subscription covers all four domains.
    controller.on("change", sync);
    // Never hand out an empty view: the host may read `$env` before any event.
    sync();

    // Methods are closures over the controller so `this` never resolves to the
    // reactive proxy (class `#private` members throw when read through one).
    view["destroy"] = () => controller.destroy();

    guardMagic(alpine, magicKey, () => view as unknown as EnvMagic, packageName);
  };
}

export { createEnvController, EnvController };

export default envPlugin;
