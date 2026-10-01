import { guardMagic } from "@ailura/alpinejs-core/guards";
import type { Alpine } from "alpinejs";

import { IdleController, WakeLockController } from "./controller";
import {
  type AttentionPluginCallback,
  type CreateAttentionOptions,
  DEFAULT_ATTENTION_IDLE_KEY,
  DEFAULT_ATTENTION_WAKELOCK_KEY,
  type IdleMagic,
  type WakeLockMagic,
} from "./types";

const packageName = "@ailura/alpinejs-attention";

export function attentionPlugin(options: CreateAttentionOptions = {}): AttentionPluginCallback {
  const wakelockKey = options.wakelockKey ?? DEFAULT_ATTENTION_WAKELOCK_KEY;
  const idleKey = options.idleKey ?? DEFAULT_ATTENTION_IDLE_KEY;

  return function registerAttention(alpine: Alpine): void {
    // Two independent controllers, not one `AttentionController`: a page that
    // only wants a wake lock should not carry an idle detector's state, and
    // `$idle.destroy()` should not take the wake lock down with it.
    const wakeLock = new WakeLockController();
    const idle = new IdleController();

    wakeLock.mount();
    idle.mount();

    // Alpine's `injectMagics` defines `$name` as a plain getter returning
    // `callback(el, utilities)` — it does NOT wrap the result in
    // `reactive()`. Without a reactive proxy here, a template read tracks only
    // the never-changing `$wakelock` key of Alpine's data proxy and nothing
    // else, so the view would never re-render. Fall back to a plain object
    // when `alpine.reactive` is unavailable: values stay correct, only the
    // re-render is lost (never fall back to the controller — the magic's
    // declared shape is not the controller's shape).
    const maybeReactive = (alpine as unknown as { reactive?: (v: unknown) => unknown }).reactive;

    // `error` is the one writable member of each surface, so it cannot be a
    // plain data property: `sync()` would overwrite the write on the next
    // event. It becomes an accessor defined on the RAW target, and the value
    // lives in a non-enumerable backing key so `Object.keys` keeps reporting
    // exactly the declared surface.
    //
    // Vue's proxy (what `alpine.reactive` returns) intercepts accessors: its
    // `get` trap does `Reflect.get(target, key, receiver)`, which runs the
    // getter and tracks the `error` key, and its `set` trap does
    // `Reflect.set(...)`, which runs the setter. The getter reads the backing
    // key THROUGH the proxy, so `sync()`'s write of the backing key is what
    // triggers the re-render.
    const makeView = (
      raw: Record<string, unknown>,
      setError: (error: string | null) => void,
      backing: string
    ): Record<string, unknown> => {
      const view = (maybeReactive ? maybeReactive(raw) : raw) as Record<string, unknown>;
      Object.defineProperty(raw, backing, {
        value: null,
        writable: true,
        enumerable: false,
        configurable: true,
      });
      Object.defineProperty(raw, "error", {
        get: () => view[backing],
        set: (value: unknown) => setError(value as string | null),
        enumerable: true,
        configurable: true,
      });
      return view;
    };

    const wlState = makeView(
      {},
      (error) => wakeLock.setError(error),
      "__error__"
    ) as unknown as WakeLockMagic;
    const wlView = wlState as unknown as Record<string, unknown>;
    // Methods are closures over the controller so `this` never resolves to the
    // reactive proxy (class `#private` members throw when read through one).
    wlView["request"] = () => wakeLock.request();
    wlView["release"] = () => wakeLock.release();
    // Alpine has no plugin-level teardown, so this is the only handle a host
    // has on the wake-lock controller. Nothing calls it automatically.
    wlView["destroy"] = () => wakeLock.destroy();
    const syncWakeLock = (): void => {
      wlView["__error__"] = wakeLock.error;
      wlView["isRequesting"] = wakeLock.isRequesting;
      wlView["isActive"] = wakeLock.isActive;
      wlView["isSupported"] = wakeLock.isSupported;
    };

    // Sync reads the CONTROLLER's getters, not the event detail: the detail
    // shape drifts from the surface (it carries no `isLoading`/`isActive`),
    // and a controller-side read can never forget a declared field.
    wakeLock.on("wakelock:change", syncWakeLock);
    syncWakeLock();

    guardMagic(alpine, wakelockKey, () => wlState, packageName);

    const idleState = makeView(
      {},
      (error) => idle.setError(error),
      "__error__"
    ) as unknown as IdleMagic;
    const idleView = idleState as unknown as Record<string, unknown>;
    idleView["requestPermission"] = () => idle.requestPermission();
    idleView["start"] = (opts?: { threshold?: number }) => idle.start(opts);
    idleView["stop"] = () => idle.stop();
    idleView["destroy"] = () => idle.destroy();
    const syncIdle = (): void => {
      idleView["userState"] = idle.userState;
      idleView["screenState"] = idle.screenState;
      idleView["permission"] = idle.permission;
      idleView["__error__"] = idle.error;
      idleView["threshold"] = idle.threshold;
      idleView["isLoading"] = idle.isLoading;
      idleView["isWatching"] = idle.isWatching;
      idleView["isSupported"] = idle.isSupported;
      idleView["isActive"] = idle.isActive;
      idleView["isIdle"] = idle.isIdle;
    };
    idle.on("idle:change", syncIdle);
    syncIdle();

    guardMagic(alpine, idleKey, () => idleState, packageName);
  };
}

export default attentionPlugin;
