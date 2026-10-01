export {
  TimerControllerImpl,
  StopwatchControllerImpl,
  createTimerController,
  createStopwatchController,
} from "./controller";
export type { TimerEvents } from "./events";
export { timerPlugin, timerPlugin as default } from "./plugin";
export type {
  CreateTimerOptions,
  CreateTimerPluginOptions,
  StopwatchController,
  StopwatchLap,
  StopwatchOptions,
  TimerAlpine,
  TimerController,
  TimerDirection,
  TimerFormatParts,
  TimerFormatter,
  TimerMagic,
  TimerMode,
  TimerOptions,
  TimerPluginCallback,
  TimerSnapshot,
  TimerState,
} from "./types";
export { DEFAULT_TIMER_MAGIC_KEY } from "./types";
