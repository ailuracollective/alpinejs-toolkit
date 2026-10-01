import { BaseController } from "@ailura/alpinejs-core/controller";
import { generateId } from "@ailura/alpinejs-core/ids";

import type { TimerEvents } from "./events";
import type {
  CreateTimerOptions,
  StopwatchController,
  StopwatchLap,
  StopwatchOptions,
  TimerSnapshot,
} from "./types";

function formatParts(
  elapsed: number,
  remaining: number | null,
  format?: (p: import("./types").TimerFormatParts) => string
): string {
  if (format) {
    const total = elapsed;
    const hours = Math.floor(total / 3600000);
    const minutes = Math.floor((total % 3600000) / 60000);
    const seconds = Math.floor((total % 60000) / 1000);
    const milliseconds = total % 1000;
    return format({ hours, minutes, seconds, milliseconds, elapsed, remaining });
  }
  const s = Math.floor(elapsed / 1000);
  const ms = String(elapsed % 1000).padStart(3, "0");
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}.${ms}`;
}

export class TimerControllerImpl
  extends BaseController<TimerEvents>
  implements Omit<import("./types").TimerController, "id">
{
  readonly id: string;
  #direction: "up" | "down";
  #duration: number | null;
  #elapsed = 0;
  #running = false;
  #paused = false;
  #completed = false;
  #iteration = 0;
  #precision: number;
  #repeat: boolean | number;
  #format?: (p: import("./types").TimerFormatParts) => string;
  #onTick?: (s: TimerSnapshot) => void;
  #onComplete?: (s: TimerSnapshot) => void;
  #timerId: ReturnType<typeof setTimeout> | null = null;
  #startWall = 0;
  #startElapsed = 0;

  constructor(options: CreateTimerOptions = {}) {
    super();
    this.id = options.id ?? generateId("timer");
    // `mode` is the spelling the magic uses; `down` is the default so a bare
    // `$timer()` still counts down. `limit` is the target spelling `countup`
    // used, kept because it reads better than `duration` for a target.
    this.#direction = options.mode === "up" ? "up" : "down";
    this.#duration = options.duration ?? options.limit ?? null;
    this.#elapsed = options.initialElapsed ?? 0;
    this.#precision = options.precision ?? 16;
    this.#repeat = options.repeat ?? false;
    this.#format = options.format;
    this.#onTick = options.onTick;
    this.#onComplete = options.onComplete;
    if (options.autoStart) this.start();
  }

  get direction(): "up" | "down" {
    return this.#direction;
  }
  get running(): boolean {
    return this.#running;
  }
  get paused(): boolean {
    return this.#paused;
  }
  get completed(): boolean {
    return this.#completed;
  }
  get elapsed(): number {
    return this.#elapsed;
  }
  get remaining(): number | null {
    if (this.#duration === null) return null;
    if (this.#direction === "down") return Math.max(0, this.#duration - this.#elapsed);
    return Math.max(0, (this.#duration ?? 0) - this.#elapsed);
  }
  get duration(): number | null {
    return this.#duration;
  }
  get progress(): number | null {
    if (this.#duration === null || this.#duration === 0) return null;
    return Math.min(1, this.#elapsed / this.#duration);
  }
  get formatted(): string {
    return formatParts(this.#elapsed, this.remaining, this.#format);
  }
  get iteration(): number {
    return this.#iteration;
  }

  private snapshot(): TimerSnapshot {
    return {
      direction: this.#direction,
      running: this.#running,
      paused: this.#paused,
      completed: this.#completed,
      elapsed: this.#elapsed,
      remaining: this.remaining,
      duration: this.#duration,
      progress: this.progress,
      formatted: this.formatted,
      iteration: this.#iteration,
    };
  }

  private schedule(): void {
    if (this.#timerId) clearTimeout(this.#timerId);
    this.#timerId = setTimeout(() => this.tick(), this.#precision);
  }

  private tick(): void {
    if (!this.#running || this.#paused) return;
    // Elapsed is recomputed from the wall clock on every tick and never
    // accumulated, which is the whole of the drift story: a late, throttled or
    // dropped timeout costs nothing, because the next tick lands on the true
    // elapsed time instead of on the sum of intervals that were each slightly
    // late. `precision` therefore sets only how often the value is refreshed,
    // never how far it may wander.
    const now = Date.now();
    const delta = now - this.#startWall;
    this.#elapsed = this.#startElapsed + delta;

    if (this.#duration !== null && this.#elapsed >= this.#duration) {
      this.#elapsed = this.#duration;
      const snap = this.snapshot();
      this.emit("tick", snap);
      this.#onTick?.(snap);
      this.#completed = true;
      this.#running = false;
      if (this.#timerId) {
        clearTimeout(this.#timerId);
        this.#timerId = null;
      }
      const cs = this.snapshot();
      this.emit("complete", cs);
      this.#onComplete?.(cs);
      const shouldRepeat =
        this.#repeat === true ||
        (typeof this.#repeat === "number" && this.#iteration < this.#repeat);
      if (shouldRepeat) {
        this.#iteration++;
        this.#elapsed = 0;
        this.#completed = false;
        this.start();
      }
      return;
    }

    const snap = this.snapshot();
    this.emit("tick", snap);
    this.#onTick?.(snap);
    this.schedule();
  }

  start(): void {
    if (this.lifecycle === "destroyed") return;
    if (this.#running && !this.#paused) return;
    this.#running = true;
    this.#paused = false;
    this.#completed = false;
    this.#startWall = Date.now();
    this.#startElapsed = this.#elapsed;
    this.emit("start");
    this.schedule();
  }

  pause(): void {
    if (!this.#running || this.#paused) return;
    this.#paused = true;
    if (this.#timerId) {
      clearTimeout(this.#timerId);
      this.#timerId = null;
    }
    this.emit("pause");
  }

  resume(): void {
    if (!this.#running || !this.#paused) return;
    this.#paused = false;
    this.#startWall = Date.now();
    this.#startElapsed = this.#elapsed;
    this.schedule();
  }

  toggle(): void {
    if (this.#running && !this.#paused) this.pause();
    else if (this.#paused) this.resume();
    else this.start();
  }

  reset(): void {
    if (this.#timerId) {
      clearTimeout(this.#timerId);
      this.#timerId = null;
    }
    this.#elapsed = 0;
    this.#running = false;
    this.#paused = false;
    this.#completed = false;
    this.emit("reset");
  }

  restart(): void {
    this.reset();
    this.start();
  }

  dispose(): void {
    this.destroy();
  }

  override destroy(): void {
    if (this.#timerId) {
      clearTimeout(this.#timerId);
      this.#timerId = null;
    }
    super.destroy();
  }

  protected teardown(): void {
    if (this.#timerId) clearTimeout(this.#timerId);
  }
}

export class StopwatchControllerImpl
  extends TimerControllerImpl
  implements Omit<StopwatchController, "id">
{
  #laps: StopwatchLap[] = [];
  #options: StopwatchOptions;

  constructor(options: StopwatchOptions = {}) {
    // `limit` is forwarded as `duration` so a stopwatch with a target still
    // reports `remaining` and `progress`. `direction` reads "down" either way —
    // the base constructor maps anything that is not `mode: "up"` to its
    // default — and it is `elapsed` that counts up. The type is what tells the
    // two apart, not the direction.
    const limit = (options as unknown as { limit?: number }).limit ?? undefined;
    super({ ...options, duration: limit });
    this.#options = options;
  }

  get laps(): readonly StopwatchLap[] {
    return this.#laps;
  }
  get lastLap(): StopwatchLap | null {
    return this.#laps[this.#laps.length - 1] ?? null;
  }
  get fastestLap(): StopwatchLap | null {
    if (this.#laps.length === 0) return null;
    return [...this.#laps].sort((a, b) => a.split - b.split).at(0) ?? null;
  }
  get slowestLap(): StopwatchLap | null {
    if (this.#laps.length === 0) return null;
    return [...this.#laps].sort((a, b) => b.split - a.split).at(0) ?? null;
  }

  lap(): StopwatchLap | null {
    if (!this.running && !this.paused) return null;
    const idx = this.#laps.length;
    const elapsed = this.elapsed;
    const prev = this.#laps[idx - 1]?.elapsed ?? 0;
    const split = elapsed - prev;
    const fmt = this.#options.lapFormat;
    const l: StopwatchLap = {
      id: generateId("lap"),
      index: idx,
      elapsed,
      split,
      formatted: formatParts(elapsed, null, fmt),
      splitFormatted: formatParts(split, null, fmt),
    };
    this.#laps.push(l);
    this.#options.onLap?.(l, this);
    return l;
  }

  removeLap(id: string): boolean {
    const idx = this.#laps.findIndex((l) => l.id === id);
    if (idx < 0) return false;
    this.#laps.splice(idx, 1);
    return true;
  }

  clearLaps(): void {
    this.#laps = [];
  }
}

export function createTimerController(options?: CreateTimerOptions): TimerControllerImpl {
  return new TimerControllerImpl(options);
}
export function createStopwatchController(options?: StopwatchOptions): StopwatchControllerImpl {
  return new StopwatchControllerImpl(options);
}
