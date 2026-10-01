/**
 * Pure machine (transition graph, sync guards, `change` events) plus the
 * reactive `$machine(config)` bridge, in one entry so the gzip budget measures
 * the combination a consumer actually loads.
 */
export { MachineController } from "./machine";
export { stateMachine } from "./plugin";
export { stateMachine as default } from "./plugin";
export type { MachineFacade, StateMachinePluginCallback } from "./plugin";
export { DEFAULT_STATE_MACHINE_MAGIC_KEY } from "./types";
export { defineMachine } from "./types";
export type {
  ChangeDetail,
  DefinedMachineConfig,
  EventsFrom,
  MachineConfig,
  MachineEvents,
  PluginOptions,
  ScopedEvents,
  ScopedMachineHandle,
  StateEvents,
  StateSource,
  SyncGuard,
  Transition,
} from "./types";
