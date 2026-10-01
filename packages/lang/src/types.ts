import type { Alpine } from "alpinejs";

export const DEFAULT_LANG_FALLBACK = "en" as const;

export type LangChangeSource = "initialization" | "user" | "reset";

export interface LangState {
  readonly current: string;
  readonly base: string;
  readonly region: string | null;
  readonly languages: readonly string[];
  readonly fallback: string;
  readonly isDetected: boolean;
}

export interface LangChangeDetail extends LangState {
  readonly source: LangChangeSource;
  readonly previous: LangState | null;
}

export interface NavigatorLike {
  readonly language?: string | undefined;
  readonly languages?: readonly string[] | undefined;
}

export interface CreateLangOptions {
  readonly id?: string;
  readonly fallback?: string;
  readonly normalize?: boolean;
  readonly navigator?: NavigatorLike | null;
}

export type LangOptions = CreateLangOptions;

export interface LangManager {
  readonly current: string;
  readonly base: string;
  readonly region: string | null;
  readonly languages: readonly string[];
  readonly fallback: string;
  readonly isDetected: boolean;
  get(): LangState;
  is(value: string): boolean;
  includes(value: string): boolean;
  set(language: string): void;
  reset(): void;
  on(event: "change", listener: (detail: LangChangeDetail) => void): () => void;
  destroy(): void;
}

export type LangAlpine = Alpine & { store(name: string): unknown };

export interface LangStore {
  current: string;
  base: string;
  region: string | null;
  languages: readonly string[];
  readonly fallback: string;
  isDetected: boolean;
  is(value: string): boolean;
  includes(value: string): boolean;
  set(language: string): void;
  reset(): void;
}

export interface LangPluginOptions {
  readonly fallback?: string;
  readonly normalize?: boolean;
  readonly storeKey?: string;
}

export const DEFAULT_LANG_STORE_KEY = "lang" as const;

export type LangPluginCallback = (alpine: Alpine) => void;
