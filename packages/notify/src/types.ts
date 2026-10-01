import type { Alpine } from "alpinejs";

export type NotifyPermission = NotificationPermission;

export interface NotifySendOptions {
  readonly body?: string;
  readonly icon?: string;
  readonly badge?: string;
  readonly tag?: string;
  readonly renotify?: boolean;
  readonly requireInteraction?: boolean;
  readonly silent?: boolean;
  readonly data?: unknown;
}

export interface NotifyMagic {
  readonly isSupported: boolean;
  readonly requiresHomeScreenInstall: boolean;
  readonly permission: NotifyPermission;
  requestPermission(): Promise<NotifyPermission>;
  send(title: string, options?: NotifySendOptions): Notification | null;
  sendAsync(title: string, options?: NotifySendOptions): Promise<Notification | null>;
  sendIfPermitted(title: string, options?: NotifySendOptions): Notification | null;
  close(tag?: string): void;
}

/** Minimal shape of a service worker registration the plugin can release. */
export interface NotifyServiceWorkerRegistration {
  unregister(): Promise<boolean> | boolean;
}

/**
 * The host-owned teardown the notify plugin adds to the `$notify` surface.
 *
 * Declared as a separate intersection rather than a member of
 * {@link NotifyMagic} because `createNotifyMagic()` is a shared,
 * plugin-independent factory: the registration this handle releases belongs to
 * the plugin instance, not to the magic's own behaviour.
 */
export interface NotifyTeardown {
  /**
   * Host-owned teardown: unregisters the service worker registration this
   * plugin created (and only that one — never a blanket sweep of the host
   * application's registrations). Nothing invokes it automatically — the host
   * that registered the plugin calls it.
   */
  destroy(): void;
}

/** The facade `notifyPlugin` registers as `$notify`. */
export type NotifyMagicWithTeardown = NotifyMagic & NotifyTeardown;

export interface NotifyPluginOptions {
  readonly serviceWorkerUrl?: string;
  readonly autoRegisterServiceWorker?: boolean;
  readonly magicKey?: string;
}

export const DEFAULT_NOTIFY_MAGIC_KEY = "notify";

export type NotifyAlpine = Alpine;
export type NotifyPluginCallback = (alpine: Alpine) => void;
