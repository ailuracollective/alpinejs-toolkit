/**
 * String-union generics only (`S extends string`, `E extends string`): they
 * erase cleanly at runtime, keeping the gzip budget reachable. No conditional
 * or mapped types reach the runtime path.
 */

/** Where a state change originated: a `send()`, a `reset()`, or the init microtask. */
export type StateSource = "user" | "reset" | "initialization";

/**
 * Sync guard: `return false` cancels the transition pre-enter.
 *
 * Receives the state the machine is leaving (the edge's `from`), so guards
 * can branch on it. Zero-arg functions (`() => true`) remain assignable.
 */
export type SyncGuard<S extends string = string> = (state: S) => boolean | void;

/**
 * One named edge in the transition graph.
 */
export interface Transition<S extends string, E extends string> {
  /** Event name triggering this edge (e.g. `'FETCH'`). */
  readonly name: E;
  /** State the machine must be in for the edge to apply. */
  readonly from: S;
  /** State the machine moves to when the edge commits. */
  readonly to: S;
  /** Runs before entering `to`; `return false` cancels. */
  readonly before?: SyncGuard<S>;
  /** Runs while leaving `from`; `return false` cancels. */
  readonly leave?: SyncGuard<S>;
}

/** Static definition of a machine: start state plus transition edges. */
export interface MachineConfig<S extends string, E extends string> {
  /** State the machine starts in (and `reset()` restores). */
  readonly initial: S;
  /** Transition edges, looked up by `(name, from)`. */
  readonly transitions: ReadonlyArray<Transition<S, E>>;
}

/** Payload emitted with every `change` event. */
export interface ChangeDetail<S extends string> {
  /** State after the change. */
  readonly current: S;
  /** State before the change. */
  readonly previous: S;
  /** What caused the change. */
  readonly source: StateSource;
}

/**
 * Events valid from one state in a transition tuple.
 *
 * A single `Extract` over the tuple union, computed once and reused — no
 * nested mapped or conditional chains, so `tsc` stays fast and the emitted
 * `.d.ts` stays shallow. Constrained structurally (`from` + `name` only) so
 * `Transition<S, E>` tuples fit regardless of guard variance.
 */
export type EventsFrom<
  T extends { readonly name: string; readonly from: string },
  S2 extends string,
> = Extract<T, { from: S2 }>["name"];

/** Alias of {@link EventsFrom}: events valid from `S2` in tuple `T`. */
export type StateEvents<
  T extends { readonly name: string; readonly from: string },
  S2 extends string,
> = EventsFrom<T, S2>;

/**
 * Event set for a `forState(s2)` scoped handle: per-state `EventsFrom` when
 * the literal tuple `T` is known (via `defineMachine`), otherwise the full
 * `E` — so `forState` on an explicitly-typed `MachineConfig<S, E>` machine
 * stays usable instead of collapsing to `never`. A single top-level
 * conditional: no nested mapped or inference chains.
 */
export type ScopedEvents<
  T extends { readonly name: string; readonly from: string },
  S2 extends string,
  E extends string,
> = [Extract<T, { from: S2 }>] extends [never] ? E : Extract<T, { from: S2 }>["name"];

/**
 * Opt-in per-state scoped handle returned by `forState(s2)`.
 *
 * Accepts only events valid from `s2` at compile time; at runtime a
 * wrong-state send is still a silent no-op (same as `send`). Type-only:
 * erased completely, zero runtime cost.
 */
export interface ScopedMachineHandle<E extends string> {
  /** Fire a transition valid from the scoped state. */
  send(name: E): boolean;
  /** Whether `name` has an edge from the scoped state. */
  can(name: E): boolean;
  /** Negation of {@link can}. */
  cannot(name: E): boolean;
}

/**
 * Config returned by {@link defineMachine}: a plain `MachineConfig<S, E>`
 * plus the literal transition tuple `T`, so `forState` can narrow per-state
 * events without re-inferring. Assignable anywhere `MachineConfig<S, E>` is
 * expected.
 */
export interface DefinedMachineConfig<
  S extends string,
  E extends string,
  T extends Transition<S, E>,
> extends MachineConfig<S, E> {
  readonly transitions: ReadonlyArray<T>;
}

/**
 * Infer the state/event unions from a config literal — no explicit generics.
 *
 * `const` type parameters capture literals (`as const` passthrough works
 * too); the literal transition tuple is preserved in the return type for
 * `forState` narrowing. Pure types: identity function, erased at runtime.
 */
export function defineMachine<
  const S extends string,
  const E extends string,
  const T extends Transition<S, E>,
>(config: MachineConfig<S, E> & { transitions: ReadonlyArray<T> }): DefinedMachineConfig<S, E, T> {
  return config;
}

/** Event map for {@link MachineController}: a single `change` event. */
export type MachineEvents<S extends string> = {
  change: [detail: ChangeDetail<S>];
};

/**
 * Options for the `$machine(config)` Alpine plugin factory.
 *
 * Registration takes no graph: the `MachineConfig` is the per-evaluation
 * magic-callback argument (`$machine(config)`), so N independent instances
 * with different configs coexist under one magic key.
 */
export interface PluginOptions {
  /** Rename the `$machine` magic (e.g. `magicKey: 'fsm'` → `$fsm`). */
  readonly magicKey?: string;
}

/**
 * Default `$machine` magic key registered by {@link stateMachine}.
 *
 * It has to be a constant, not a literal inside `plugin.ts`: the demo and doc
 * tooling resolve which package owns which magic by reading declared
 * `DEFAULT_*_KEY` constants, so a key that only exists as a string literal is
 * invisible to them and the ownership is effectively undeclared.
 */
export const DEFAULT_STATE_MACHINE_MAGIC_KEY = "machine";
