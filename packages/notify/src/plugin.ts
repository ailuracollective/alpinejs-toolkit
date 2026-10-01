import { safeWindow } from "@ailura/alpinejs-core/env";
import { guardMagic } from "@ailura/alpinejs-core/guards";
import type { Alpine } from "alpinejs";

import { createNotifyMagic } from "./controller";
import {
  DEFAULT_NOTIFY_MAGIC_KEY,
  type NotifyPluginCallback,
  type NotifyPluginOptions,
  type NotifyServiceWorkerRegistration,
  type NotifyMagicWithTeardown,
  type NotifySendOptions,
} from "./types";

const packageName = "@ailura/alpinejs-notify";

export function notifyPlugin(options: NotifyPluginOptions = {}): NotifyPluginCallback {
  const magicKey = options.magicKey ?? DEFAULT_NOTIFY_MAGIC_KEY;

  return function registerNotify(alpine: Alpine): void {
    // The pending registration, kept so the host-owned teardown can release it.
    // `null` once released, so a repeated `destroy()` cannot unregister twice.
    let pendingRegistration: Promise<NotifyServiceWorkerRegistration | null> | null = null;
    let destroyed = false;

    // Deferred service worker registration (no file needed for build)
    if (options.serviceWorkerUrl && options.autoRegisterServiceWorker !== false) {
      const win = safeWindow() as
        | (Window & {
            navigator: Navigator & {
              serviceWorker?: {
                register: (url: string) => Promise<NotifyServiceWorkerRegistration>;
              };
            };
          })
        | undefined;
      if (win?.navigator.serviceWorker) {
        // Best-effort, no await during registration to avoid blocking Alpine init.
        // The promise is retained rather than discarded: the unregister must
        // survive `destroy()` winning the race against this pending call.
        pendingRegistration = win.navigator.serviceWorker
          .register(options.serviceWorkerUrl)
          .catch(() => null);
      }
    }

    // Only the registration this plugin created is released. When the host
    // passed a URL the application had already registered, `register()` resolves
    // with that same registration object, so `destroy()` unregisters it too —
    // the plugin cannot tell the two apart, and never sweeps anything else.
    const destroy = (): void => {
      if (destroyed) return;
      destroyed = true;
      const pending = pendingRegistration;
      pendingRegistration = null;
      if (!pending) return;
      void pending.then((registration) => registration?.unregister()).catch(() => {});
    };

    const magic = createNotifyMagic();

    // Alpine's `injectMagics` defines `$name` as a plain getter returning
    // `callback(el, utilities)` — it does NOT wrap the result in `reactive()`.
    // The factory returned getters (`isSupported`, `permission`,
    // `requiresHomeScreenInstall`), so a template read tracked only the
    // never-changing `$notify` key and the view never re-rendered: the user
    // clicked `requestPermission()`, granted the browser prompt, and the readout
    // stayed on `default` while the real permission was already `granted`.
    //
    // So the three state values become plain data fields that `sync()` writes,
    // and the methods stay closures over the factory (never `this`, which would
    // resolve to the reactive proxy).
    const maybeReactive = (alpine as unknown as { reactive?: (v: unknown) => unknown }).reactive;
    const view = (maybeReactive
      ? maybeReactive({
          isSupported: magic.isSupported,
          requiresHomeScreenInstall: magic.requiresHomeScreenInstall,
          permission: magic.permission,
        })
      : {
          isSupported: magic.isSupported,
          requiresHomeScreenInstall: magic.requiresHomeScreenInstall,
          permission: magic.permission,
        }) as unknown as NotifyMagicWithTeardown;

    const sync = (): void => {
      (view as unknown as Record<string, unknown>)["isSupported"] = magic.isSupported;
      (view as unknown as Record<string, unknown>)["requiresHomeScreenInstall"] =
        magic.requiresHomeScreenInstall;
      (view as unknown as Record<string, unknown>)["permission"] = magic.permission;
    };

    // Nothing in the browser notifies us when the permission changes, and a user
    // can flip it in their own settings while the page stays open. `focus` and
    // `visibilitychange` are the two moments that state is worth re-reading.
    const win = safeWindow();
    if (win) {
      win.addEventListener("focus", sync);
      win.document?.addEventListener("visibilitychange", sync);
    }

    // Methods are closures over the factory so `this` never resolves to the
    // reactive proxy. `requestPermission` syncs afterwards: it is the one call
    // that changes the state the view shows.
    view.requestPermission = async (): Promise<NotificationPermission> => {
      const result = await magic.requestPermission();
      sync();
      return result;
    };
    view.send = (title: string, opts?: NotifySendOptions): Notification | null =>
      magic.send(title, opts);
    view.sendAsync = (title: string, opts?: NotifySendOptions): Promise<Notification | null> =>
      magic.sendAsync(title, opts);
    view.sendIfPermitted = (title: string, opts?: NotifySendOptions): Notification | null =>
      magic.sendIfPermitted(title, opts);
    view.close = (tag?: string): void => magic.close(tag);
    view.destroy = destroy;

    // Never hand out an empty view: a host may read `$notify` before any event.
    sync();

    guardMagic(alpine, magicKey, () => view, packageName);
  };
}

export default notifyPlugin;
