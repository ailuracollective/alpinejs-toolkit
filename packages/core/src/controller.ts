/**
 * Lifecycle primitives: typed event emitter, LIFO cleanup stack, and a base
 * controller with an explicit `idle -> mounted -> destroyed` lifecycle.
 */
import { LIFECYCLE_DESTROYED, LIFECYCLE_IDLE, LIFECYCLE_MOUNTED } from "./constants";
import { runLifo } from "./internal";

/** Map of event names to listener argument tuples. */
export type EventMap = Record<string, unknown[]>;

/** Listener for one event in an {@link EventMap}; `TArgs` is that event's tuple. */
export type EventListener<TArgs extends unknown[] = unknown[]> = (...args: TArgs) => void;

/**
 * Strongly typed event emitter. `on` returns an unsubscribe function so
 * subscriptions compose with {@link CleanupStack}.
 */
export class EventEmitter<TEvents extends EventMap = EventMap> {
  private readonly listeners = new Map<keyof TEvents, Set<(...args: never[]) => void>>();

  /**
   * Subscribe to an event. Returns an unsubscribe function.
   */
  on<K extends keyof TEvents>(event: K, listener: (...args: TEvents[K]) => void): () => void {
    let set = this.listeners.get(event);
    if (!set) {
      set = new Set();
      this.listeners.set(event, set);
    }
    set.add(listener as unknown as (...args: never[]) => void);
    return () => {
      this.off(event, listener);
    };
  }

  /** Subscribe to the next emission of an event only. */
  once<K extends keyof TEvents>(event: K, listener: (...args: TEvents[K]) => void): () => void {
    const wrapper = (...args: TEvents[K]): void => {
      this.off(event, wrapper as (...args: TEvents[K]) => void);
      listener(...args);
    };
    return this.on(event, wrapper as (...args: TEvents[K]) => void);
  }

  /** Remove a previously added listener. */
  off<K extends keyof TEvents>(event: K, listener: (...args: TEvents[K]) => void): void {
    this.listeners.get(event)?.delete(listener as unknown as (...args: never[]) => void);
  }

  /** Emit an event to all current listeners. */
  emit<K extends keyof TEvents>(event: K, ...args: TEvents[K]): void {
    const set = this.listeners.get(event);
    if (!set || set.size === 0) return;
    // Snapshot before iterating so listeners that (un)subscribe mid-emit are safe.
    const snapshot = Array.from(set);
    for (const listener of snapshot) {
      (listener as unknown as (...args: TEvents[K]) => void)(...args);
    }
  }

  /** Number of listeners for an event (useful in tests). */
  listenerCount<K extends keyof TEvents>(event: K): number {
    return this.listeners.get(event)?.size ?? 0;
  }
}

/**
 * LIFO stack of cleanup callbacks with idempotent `dispose()`.
 *
 * Cleanups run last-registered-first. A throwing cleanup does not stop the
 * remaining ones; the first error is rethrown after the stack drains.
 */
export class CleanupStack {
  private cleanups: Array<() => void> = [];
  private isDisposed = false;

  /** Register a cleanup to run on `dispose()`. */
  push(cleanup: () => void): void {
    if (this.isDisposed) return;
    this.cleanups.push(cleanup);
  }

  /** Alias for `push`. */
  add(cleanup: () => void): void {
    this.push(cleanup);
  }

  /** Number of pending cleanups. */
  get size(): number {
    return this.cleanups.length;
  }

  /** Whether `dispose()` has run. */
  get disposed(): boolean {
    return this.isDisposed;
  }

  /** Run all cleanups in LIFO order. Safe to call more than once. */
  dispose(): void {
    if (this.isDisposed) return;
    this.isDisposed = true;
    runLifo(this.cleanups.splice(0));
  }
}

/** Lifecycle phase of a {@link BaseController}. */
export type LifecyclePhase =
  | typeof LIFECYCLE_IDLE
  | typeof LIFECYCLE_MOUNTED
  | typeof LIFECYCLE_DESTROYED;

/**
 * Base class for toolkit controllers.
 *
 * Subclasses override `setup()` (wire events, DOM observers) instead of the
 * constructor, and push every teardown step into `cleanups` so `destroy()`
 * reverses them in LIFO order. Mounting is idempotent; destroying is
 * idempotent and final — a destroyed controller cannot be remounted.
 */
export abstract class BaseController<TEvents extends EventMap = EventMap> {
  /** Typed event bus for controller state changes. */
  protected readonly events = new EventEmitter<TEvents>();
  /** Teardown callbacks, drained LIFO by `destroy()`. */
  protected readonly cleanups = new CleanupStack();
  private phase: LifecyclePhase = LIFECYCLE_IDLE;

  /** Current lifecycle phase. */
  get lifecycle(): LifecyclePhase {
    return this.phase;
  }

  /** Transition `idle -> mounted` and run `setup()`. No-op unless idle. */
  mount(): void {
    if (this.phase !== LIFECYCLE_IDLE) return;
    this.phase = LIFECYCLE_MOUNTED;
    this.setup();
  }

  /**
   * Drain `cleanups`, run `teardown()`, and transition to `destroyed`.
   * Safe to call from `idle` (disposes an empty stack) and to repeat.
   */
  destroy(): void {
    if (this.phase === LIFECYCLE_DESTROYED) return;
    this.cleanups.dispose();
    this.teardown();
    this.phase = LIFECYCLE_DESTROYED;
  }

  /**
   * Register a cleanup to run on `destroy()`.
   *
   * @returns An unsubscribe function (also runs automatically on destroy).
   */
  protected onCleanup(cleanup: () => void): void {
    this.cleanups.push(cleanup);
  }

  /** Subscribe to a controller event; unsubscribed automatically on destroy. */
  on<K extends keyof TEvents>(event: K, listener: (...args: TEvents[K]) => void): () => void {
    const unsubscribe = this.events.on(event, listener);
    this.onCleanup(unsubscribe);
    return unsubscribe;
  }

  /** Emit a controller event. */
  protected emit<K extends keyof TEvents>(event: K, ...args: TEvents[K]): void {
    this.events.emit(event, ...args);
  }

  /** Override to wire the controller. Runs once, on `mount()`. */
  protected setup(): void {}

  /** Override for teardown beyond `cleanups`. Runs once, on `destroy()`. */
  protected teardown(): void {}
}
