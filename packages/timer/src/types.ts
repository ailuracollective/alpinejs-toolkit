export const DEFAULT_TIMER_MAGIC_KEY = "timer";

export type TimerDirection = "up" | "down";

/**
 * What the timer counts, as one union.
 *
 * `stopwatch` used to be a separate magic method (`$timer.stopwatch()`) with its
 * own options type, which made "which of the four ways do I build a timer?" the
 * first question a reader had to answer. One option makes it a value.
 */
export type TimerMode = TimerDirection | "stopwatch";

export interface TimerFormatParts {
  readonly hours: number;
  readonly minutes: number;
  readonly seconds: number;
  readonly milliseconds: number;
  readonly elapsed: number;
  readonly remaining: number | null;
}

export type TimerFormatter = (parts: TimerFormatParts) => string;

export type TimerState = TimerSnapshot;

export interface TimerSnapshot {
  readonly direction: TimerDirection;
  readonly running: boolean;
  readonly paused: boolean;
  readonly completed: boolean;
  readonly elapsed: number;
  readonly remaining: number | null;
  readonly duration: number | null;
  readonly progress: number | null;
  readonly formatted: string;
  readonly iteration: number;
}

export interface TimerController {
  readonly id: string;
  readonly direction: TimerDirection;
  readonly running: boolean;
  readonly paused: boolean;
  readonly completed: boolean;
  readonly elapsed: number;
  readonly remaining: number | null;
  readonly duration: number | null;
  readonly progress: number | null;
  readonly formatted: string;
  readonly iteration: number;
  start(): void;
  pause(): void;
  resume(): void;
  toggle(): void;
  reset(): void;
  restart(): void;
  dispose(): void;
  destroy(): void;
}

/** Options for `$timer(…)` — one bag for every mode. */
export type TimerOptions = CreateTimerOptions;

export interface CreateTimerOptions {
  /**
   * `down` (default), `up`, or `stopwatch`.
   *
   * Replaces the four separate entry points (`create`, `countdown`, `countup`,
   * `stopwatch`): they differed only in this value, so they were one option
   * spelled four ways.
   */
  readonly mode?: TimerMode;
  /** Stop after this many milliseconds. `null` (default) runs until stopped. */
  readonly duration?: number;
  /**
   * Stop at this many milliseconds.
   *
   * The spelling `countup` used for the same thing; kept because "limit" reads
   * better at the call site than `duration` when the value is a target rather
   * than a countdown.
   */
  readonly limit?: number;
  readonly initialElapsed?: number;
  readonly autoStart?: boolean;
  readonly precision?: number;
  readonly repeat?: boolean | number;
  readonly format?: TimerFormatter;
  /**
   * Accepted for compatibility and never read: the controller has no pattern
   * parser. Pass `format` for a custom layout.
   */
  readonly formatPattern?: string;
  readonly onTick?: (timer: TimerSnapshot) => void;
  readonly onComplete?: (timer: TimerSnapshot) => void;
  readonly id?: string;
}

export interface StopwatchLap {
  readonly id: string;
  readonly index: number;
  readonly elapsed: number;
  readonly split: number;
  readonly formatted: string;
  readonly splitFormatted: string;
}

/** Options for `$timer({ mode: "stopwatch" })`. */
export interface StopwatchOptions extends Omit<CreateTimerOptions, "mode"> {
  readonly mode?: "stopwatch";
  readonly lapFormat?: TimerFormatter;
  /** Accepted for compatibility and never read — use `lapFormat`. */
  readonly lapFormatPattern?: string;
  readonly onLap?: (lap: StopwatchLap, stopwatch: StopwatchController) => void;
}

export interface StopwatchController extends TimerController {
  readonly laps: readonly StopwatchLap[];
  readonly lastLap: StopwatchLap | null;
  readonly fastestLap: StopwatchLap | null;
  readonly slowestLap: StopwatchLap | null;
  lap(): StopwatchLap | null;
  removeLap(id: StopwatchLap["id"]): boolean;
  clearLaps(): void;
}

/**
 * `$timer(options)` — a call, not a namespace of methods.
 *
 * A method form would imply a choice the caller has to get right before
 * anything happens; here the choice is an option, and the default is the
 * sensible one (`mode: "down"`, no duration, runs until stopped).
 *
 * Every call builds a fresh instance, so `$timer()` twice is two timers. The
 * generated `id` is on the returned view.
 */
export interface TimerMagic {
  (options?: TimerOptions): TimerController;
  (options: StopwatchOptions & { mode: "stopwatch" }): StopwatchController;
}

export interface CreateTimerPluginOptions {
  readonly magicKey?: string;
}
export type TimerPluginCallback = (alpine: unknown) => void;
export type TimerAlpine = unknown;
