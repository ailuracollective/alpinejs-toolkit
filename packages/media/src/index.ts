/** Barrel only — nothing in this file may do anything but re-export. */

export { createMediaController, MediaController } from "./controller";
export type { MediaEvents } from "./events";
export { mediaPlugin, mediaPlugin as default } from "./plugin";
export type {
  CreateMediaOptions,
  MediaAlpine,
  MediaBreakpoint,
  MediaChangeDetail,
  MediaChangeSource,
  MediaIntervals,
  MediaPluginCallback,
  MediaSnapshot,
  MediaStore,
} from "./types";
export { DEFAULT_MEDIA_INTERVALS, DEFAULT_MEDIA_STORE_KEY } from "./types";
