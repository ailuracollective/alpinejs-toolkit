/** Barrel only — nothing in this file may do anything but re-export. */

export {
  createNotifyMagic,
  getNotifyPermission,
  isIosDevice,
  isNotifySupported,
  isServiceWorkerDeliveryRequired,
  isStandaloneDisplayMode,
  requiresServiceWorkerNotifications,
  showNotify,
} from "./controller";
export { notifyPlugin, notifyPlugin as default } from "./plugin";
export { createNotifyPermissionAdapter, NOTIFY_PERMISSION_NAME } from "./permission-adapter";
export type {
  NotifyAlpine,
  NotifyMagic,
  NotifyPermission,
  NotifyPluginCallback,
  NotifyPluginOptions,
  NotifySendOptions,
} from "./types";
export type {
  NotifyPermissionAdapter,
  NotifyPermissionAvailability,
  NotifyPermissionRequestResult,
  NotifyPermissionState,
} from "./permission-adapter";
export { DEFAULT_NOTIFY_MAGIC_KEY } from "./types";
