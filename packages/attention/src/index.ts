export {
  AttentionController,
  IdleController,
  WakeLockController,
  createAttentionController,
  createIdleController,
  createWakeLockController,
} from "./controller";
export type {
  AttentionEvents,
  IdleChangeDetail,
  IdleEvents,
  WakeLockChangeDetail,
  WakeLockEvents,
} from "./events";
export { attentionPlugin, attentionPlugin as default } from "./plugin";
export { createWakeLockPermissionAdapter, WAKE_LOCK_PERMISSION_NAME } from "./permission-adapter";
export type {
  WakeLockPermissionAdapter,
  WakeLockPermissionAvailability,
  WakeLockPermissionRequestResult,
  WakeLockPermissionState,
} from "./permission-adapter";
export type {
  AttentionControllerOptions,
  AttentionAlpine,
  AttentionPluginCallback,
  CreateAttentionOptions,
  IdleDetectorConstructor,
  IdleDetectorLike,
  IdleMagic,
  IdleScreenState,
  IdleUserState,
  WakeLockLike,
  WakeLockMagic,
  WakeLockSentinelLike,
} from "./types";
export {
  DEFAULT_ATTENTION_IDLE_KEY,
  DEFAULT_ATTENTION_WAKELOCK_KEY,
  DEFAULT_IDLE_THRESHOLD,
  MIN_IDLE_THRESHOLD,
} from "./types";
