import type { TimerSnapshot } from "./types";

export interface TimerEvents extends Record<string, unknown[]> {
  tick: [TimerSnapshot];
  complete: [TimerSnapshot];
  start: [];
  pause: [];
  reset: [];
}
