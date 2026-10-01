/** Barrel only — nothing in this file may do anything but re-export. */

export { createEnvController, EnvController } from "./controller";
export type { EnvChangeDetail, EnvEvents } from "./events";
export { envPlugin, envPlugin as default } from "./plugin";
export type {
  EnvControllerOptions,
  BatteryState,
  EnvAlpine,
  EnvMagic,
  EnvPluginCallback,
  EnvPluginOptions,
  EnvState,
  NetworkState,
  PlatformState,
  VisibilityState,
} from "./types";
export { DEFAULT_ENV_MAGIC_KEY } from "./types";
