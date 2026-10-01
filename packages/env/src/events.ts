import type { BatteryState, EnvState, NetworkState, PlatformState, VisibilityState } from "./types";

export interface EnvChangeDetail extends EnvState {}

export interface EnvEvents extends Record<string, unknown[]> {
  change: [detail: EnvChangeDetail];
  "network:change": [state: NetworkState];
  "visibility:change": [state: VisibilityState];
  "battery:change": [state: BatteryState | null];
  "platform:change": [state: PlatformState];
}
