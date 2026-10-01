/**
 * The reactive `$machine(config)` bridge.
 *
 * Registration is stateless and follows the toolkit factory canon
 * (`xxxPlugin(options) => (alpine) => void`): `stateMachine(options?)`
 * resolves the magic key once and returns the `Alpine.plugin()` callback
 * that registers the magic via `guardMagic`. Every
 * `$machine(config)` evaluation builds a FRESH isolated instance — its own
 * {@link MachineController} (own id via `generateId`), its own
 * `Alpine.reactive` facade, one `change` subscription, and one idempotent
 * `dispose` wired to that evaluation's `cleanup()`. N instances coexist
 * under the same magic key with different configs and never share state.
 *
 * Each committed transition performs exactly one reactive write
 * (`facade.state = current`); rejected or guard-cancelled sends emit
 * nothing, so they write nothing.
 *
 * SSR-safe by construction: Alpine is always a parameter, never an import,
 * and neither this module nor its imports touch `window`/`document` at
 * import time.
 *
 * Teardown note: Alpine exposes no global `Alpine.cleanup` (verified against
 * alpinejs 3.17.1) — per-element teardown comes from the `cleanup` utility
 * passed to the magic callback, which runs on element removal via
 * `onElRemoved`. Removing a component disposes only its own instance
 * (unsubscribe + destroy, idempotent); siblings are unaffected.
 *
 * Alpine usage: evaluate once per component and reuse the facade —
 * `x-data="{ m: $machine({ initial: 'idle', transitions: [...] }) }"` —
 * because every `$machine(config)` call creates a new instance.
 */
import { guardMagic } from "@ailura/alpinejs-core/guards";
import type { Alpine } from "alpinejs";

import { MachineController } from "./machine";
import type {
  MachineConfig,
  PluginOptions,
  ScopedEvents,
  ScopedMachineHandle,
  Transition,
} from "./types";
import { DEFAULT_STATE_MACHINE_MAGIC_KEY } from "./types";

/**
 * Reactive `$machine` view bound to one {@link MachineController}.
 *
 * The object identity never changes (in-place mutation keeps the Alpine
 * reactive proxy stable); `value` is a getter over `state`, so the single
 * per-transition write updates both views.
 *
 * `S`/`E` are the state/event unions, `T` the literal transition tuple
 * (inferred per `$machine(config)` evaluation via `const` type parameters,
 * since the Alpine magic registration itself is loosely typed). Each facade
 * keeps its own `S`/`E`/detail: cross-instance assignment is rejected.
 */
export interface MachineFacade<
  S extends string,
  E extends string,
  T extends Transition<S, E> = Transition<S, E>,
> {
  /** Unique instance id, via core `generateId` — distinct per evaluation. */
  readonly id: string;
  /** Current state — the only reactive data property; written once per transition. */
  state: S;
  /** Alias of {@link state} for reactive bindings (read-through getter). */
  readonly value: S;
  /** Fire a transition; delegates to the controller. */
  send(name: NoInfer<E>): boolean;
  /** Whether `name` has an edge from the current state. */
  can(name: NoInfer<E>): boolean;
  /** Negation of {@link can}. */
  cannot(name: NoInfer<E>): boolean;
  /** Whether the machine is currently in `state`. */
  is(state: S): boolean;
  /**
   * Opt-in per-state scoped handle (see `MachineController.forState`):
   * accepts only events valid from `state` at compile time.
   */
  forState<S2 extends S>(state: S2): ScopedMachineHandle<ScopedEvents<T, S2, E>>;
  /** Restore the initial state with `source: 'reset'`. */
  reset(): void;
  /** Hydrate without emitting (declared states only); syncs the facade. */
  setSilently(state: S): void;
  /** Idempotent per-instance teardown: unsubscribe + destroy (also runs on removal). */
  dispose(): void;
}

const packageName = "@ailura/alpinejs-state-machine";

/** The `Alpine.plugin()` callback produced by {@link stateMachine}. */
export type StateMachinePluginCallback = (alpine: Alpine) => void;

/**
 * Plugin factory — returns the `Alpine.plugin()` callback that registers
 * the `$machine(config)` factory magic. Registration-only: no machine is
 * created by the callback and nothing is returned from it — each
 * `$machine(config)` evaluation creates its own instance.
 *
 * @param options - `PluginOptions { magicKey? }` rename (default `$machine`).
 *   The default comes from `DEFAULT_STATE_MACHINE_MAGIC_KEY`, not a literal here.
 */
export function stateMachine(options: PluginOptions = {}): StateMachinePluginCallback {
  const magicKey = options.magicKey ?? DEFAULT_STATE_MACHINE_MAGIC_KEY;

  return function registerStateMachine(Alpine: Alpine): void {
    guardMagic(
      Alpine,
      magicKey,
      (_el, { cleanup }) => {
        const createInstance = <
          const S extends string,
          const E extends string,
          const T extends Transition<S, E>,
        >(
          config: MachineConfig<S, E> & { transitions: ReadonlyArray<T> }
        ): MachineFacade<S, E, T> => {
          const machine = new MachineController<S, E, T>(config);
          // Declared before `target` and assigned after it: the `can()`/`is()`
          // accessors close over `facade`, and `facade` is built *from* `target`.
          // That circular shape cannot be a `const`.
          // oxlint-disable-next-line prefer-const -- assigned once, after the object it wraps is built
          let facade!: MachineFacade<S, E, T>;
          const target: MachineFacade<S, E, T> = {
            id: machine.id,
            state: config.initial,
            get value(): S {
              return this.state;
            },
            send: (name) => machine.send(name),
            can: (name) => {
              // Register a reactive dependency on the facade state so Alpine
              // re-evaluates `:disabled`/`x-show` bindings that call `can()`
              // after a transition. `machine.can()` reads the controller's
              // private `current` — without touching the reactive `state`
              // here, those bindings would stay frozen on their first value.
              void facade.state;
              return machine.can(name);
            },
            cannot: (name) => {
              void facade.state;
              return machine.cannot(name);
            },
            is: (state) => {
              // Same reason as `can`/`cannot` above: `machine.is()` reads the
              // controller's private `current`, so without this the binding
              // tracks nothing and stays frozen on its first value. A state dot
              // bound with `:class="m.is('idle') ? … : …"` would keep the colour
              // it painted on load while the label next to it said `ready`.
              void facade.state;
              return machine.is(state);
            },
            forState: <S2 extends S>(state: S2) => machine.forState(state),
            reset: () => machine.reset(),
            setSilently: (state) => {
              machine.setSilently(state);
              facade.state = machine.state;
            },
            dispose: () => dispose(),
          };
          facade = Alpine.reactive(target);
          const unsubscribe = machine.on("change", (detail) => {
            facade.state = detail.current;
          });
          let disposed = false;
          const dispose = (): void => {
            if (disposed) return;
            disposed = true;
            unsubscribe();
            machine.destroy();
          };
          machine.mount();
          cleanup(dispose);
          return facade;
        };
        return createInstance;
      },
      packageName
    );
  };
}
