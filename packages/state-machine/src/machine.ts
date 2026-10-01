/**
 * Pure N-state synchronous machine controller.
 *
 * Owns the transition graph, sync guards, and `change` events. DOM-free by
 * design: the reactive Alpine bridge lives in `plugin.ts` and only observes
 * `change`. There is intentionally no `toggle()` and no free
 * `set(any → any)` — `setSilently` accepts declared states only.
 */
import { BaseController } from "@ailura/alpinejs-core/controller";
import { generateId } from "@ailura/alpinejs-core/ids";

import type {
  ChangeDetail,
  MachineConfig,
  MachineEvents,
  ScopedEvents,
  ScopedMachineHandle,
  Transition,
} from "./types";

/**
 * N-state sync machine on core lifecycle conventions.
 *
 * - `send(name)` commits the `(name, from: current)` edge, or silently
 *   no-ops when no edge applies (no emit, returns `false`).
 * - Sync `leave`/`before` guards cancel pre-enter on `return false`.
 * - `mount()` queues one `initialization` event via microtask, unless
 *   `setSilently()` hydrated the machine first.
 * - `destroy()` is idempotent and freezes the machine: every mutating call
 *   afterwards is a silent no-op that never throws.
 *
 * Typing: `S`/`E` are the state/event unions (inferred literally via
 * `defineMachine`); the optional tuple `T` preserves the literal transition
 * union so `forState` can narrow events per state. Lookup, emit, and destroy
 * logic are type-parameter-agnostic.
 */
export class MachineController<
  S extends string,
  E extends string,
  T extends Transition<S, E> = Transition<S, E>,
> extends BaseController<MachineEvents<S>> {
  /** Unique instance id, via core `generateId`. */
  readonly id: string;

  private current: S;
  private readonly initial: S;
  private readonly transitions: ReadonlyArray<Transition<S, E>>;
  private readonly known: Set<S>;
  private hydrated = false;

  constructor(config: MachineConfig<S, E> & { transitions: ReadonlyArray<T> }) {
    super();
    this.id = generateId("machine");
    this.initial = config.initial;
    this.current = config.initial;
    this.transitions = [...config.transitions];
    this.known = new Set<S>([config.initial]);
    for (const transition of config.transitions) {
      this.known.add(transition.from);
      this.known.add(transition.to);
    }
  }

  /** Current state. */
  get state(): S {
    return this.current;
  }

  /** Alias of {@link state} for reactive bindings. */
  get value(): S {
    return this.current;
  }

  /** Whether `name` has an edge from the current state. */
  can(name: NoInfer<E>): boolean {
    if (this.frozen) return false;
    return this.lookup(name) !== undefined;
  }

  /** Negation of {@link can}. */
  cannot(name: NoInfer<E>): boolean {
    return !this.can(name);
  }

  /** Whether the machine is currently in `state`. */
  is(state: S): boolean {
    return this.current === state;
  }

  /**
   * Fire `name`: commit the matching edge, or silently no-op.
   *
   * @returns `true` when the transition committed, `false` for illegal sends,
   * guard cancellations, and sends after destroy.
   */
  send(name: NoInfer<E>): boolean {
    if (this.frozen) return false;
    const transition = this.lookup(name);
    if (transition === undefined) return false;
    if (transition.leave?.(this.current) === false) return false;
    if (transition.before?.(this.current) === false) return false;
    const previous = this.current;
    this.current = transition.to;
    this.emitChange({ current: this.current, previous, source: "user" });
    return true;
  }

  /**
   * Opt-in per-state scoped handle: `send`/`can`/`cannot` accept only events
   * valid from `state` at compile time (via a single `Extract` over the
   * config tuple — needs `defineMachine` so `T` stays literal; otherwise
   * falls back to the full `E`, never `never`).
   *
   * Returns `this` narrowed: no new closures, no extra subscription, zero
   * added runtime behavior. A wrong-state send at runtime is still a silent
   * no-op; `is()` stays boolean and the `state` getter comparison is the
   * runtime narrowing path.
   */
  forState<S2 extends S>(state: S2): ScopedMachineHandle<ScopedEvents<T, S2, E>> {
    void state;
    return this as unknown as ScopedMachineHandle<ScopedEvents<T, S2, E>>;
  }

  /**
   * Restore the initial state with `source: 'reset'`.
   *
   * Silent no-op when already at the initial state or after destroy.
   */
  reset(): void {
    if (this.frozen) return;
    if (this.current === this.initial) return;
    const previous = this.current;
    this.current = this.initial;
    this.emitChange({ current: this.current, previous, source: "reset" });
  }

  /**
   * Set the state without emitting, marking the machine as hydrated so a
   * pending init microtask is suppressed.
   *
   * @throws When `state` is not a declared state (no free `set(any → any)`).
   */
  setSilently(state: S): void {
    if (this.frozen) return;
    if (!this.known.has(state)) {
      throw new Error(`[state-machine] Unknown state: ${state}`);
    }
    this.current = state;
    this.hydrated = true;
  }

  protected setup(): void {
    const previous = this.current;
    queueMicrotask(() => {
      if (this.frozen || this.hydrated) return;
      this.emitChange({ current: this.current, previous, source: "initialization" });
    });
  }

  private get frozen(): boolean {
    return this.lifecycle === "destroyed";
  }

  private lookup(name: E): Transition<S, E> | undefined {
    return this.transitions.find(
      (transition) => transition.name === name && transition.from === this.current
    );
  }

  private emitChange(detail: ChangeDetail<S>): void {
    this.emit("change", detail);
  }
}
