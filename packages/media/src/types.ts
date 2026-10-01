import type { SingletonScope } from "@ailura/alpinejs-core/singletons";
import type { Alpine } from "alpinejs";
export type MediaBreakpoint = string;

export interface MediaIntervals {
  readonly [breakpoint: string]: number;
}

export const DEFAULT_MEDIA_INTERVALS: MediaIntervals = {
  sm: 640,
  md: 768,
  lg: 1024,
  xl: 1280,
  "2xl": 1536,
};

export const DEFAULT_MEDIA_STORE_KEY = "media";

export interface MediaSnapshot {
  readonly width: number;
  readonly height: number;
  readonly breakpoint: MediaBreakpoint;
  readonly prefersReducedMotion: boolean;
  readonly prefersColorScheme: "light" | "dark" | "no-preference";
  readonly isDark: boolean;
}

export interface MediaChangeDetail extends MediaSnapshot {
  readonly previous: MediaSnapshot | null;
  readonly source: MediaChangeSource;
}

export type MediaChangeSource = "initialization" | "resize" | "system" | "refresh";

export interface MediaEvents extends Record<string, unknown[]> {
  change: [detail: MediaChangeDetail];
}

export interface CreateMediaOptions {
  readonly id?: string;
  readonly intervals?: MediaIntervals;
  readonly debounceMs?: number;
  readonly scope?: SingletonScope;
  readonly storeKey?: string;
}

export interface MediaStore extends MediaSnapshot {
  refresh(): void;
  destroy(): void;
}

export type MediaAlpine = Alpine;
export type MediaPluginCallback = (alpine: Alpine) => void;
