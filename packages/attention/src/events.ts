import type { IdleScreenState, IdleUserState } from "./types";

export interface WakeLockChangeDetail {
  readonly isActive: boolean;
  readonly isRequesting: boolean;
  readonly error: string | null;
}

export interface IdleChangeDetail {
  readonly userState: IdleUserState | null;
  readonly screenState: IdleScreenState | null;
  readonly permission: PermissionState | null;
  readonly error: string | null;
  readonly threshold: number;
  readonly isWatching: boolean;
}

export interface AttentionEvents extends Record<string, unknown[]> {
  "wakelock:change": [detail: WakeLockChangeDetail];
  "idle:change": [detail: IdleChangeDetail];
}

export type WakeLockEvents = Pick<AttentionEvents, "wakelock:change">;
export type IdleEvents = Pick<AttentionEvents, "idle:change">;
