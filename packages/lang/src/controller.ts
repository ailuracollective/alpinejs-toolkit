import { BaseController } from "@ailura/alpinejs-core/controller";
import { generateId } from "@ailura/alpinejs-core/ids";

import type { LangEvents } from "./events";
import type {
  CreateLangOptions,
  LangChangeDetail,
  LangChangeSource,
  LangManager,
  LangState,
  NavigatorLike,
} from "./types";
import { DEFAULT_LANG_FALLBACK } from "./types";

function normalizeTag(tag: string): string {
  return tag.toLowerCase().replace(/_/g, "-");
}

/**
 * Split a BCP-47 tag into its base and region.
 *
 * The last subtag is treated as the region and kept only when it is two
 * characters, so `pt-br` yields `("pt", "br")` while `zh-hant-tw` yields
 * `("zh", "tw")` and a variant-only tag like `de-1996` yields `("de", null)`.
 * The store has no place to put a script subtag, so it is dropped rather than
 * misreported as a region.
 */
function parseTag(tag: string): { base: string; region: string | null } {
  const parts = tag.split("-");
  const base = parts[0] ?? "";
  const region = parts.length > 1 ? (parts[parts.length - 1] ?? null) : null;
  return { base, region: region && region.length === 2 ? region : null };
}

function detect(
  fallback: string,
  normalize: boolean,
  reader: NavigatorLike | null | undefined
): {
  current: string;
  base: string;
  region: string | null;
  languages: readonly string[];
  detected: boolean;
} {
  const src: NavigatorLike | null =
    reader !== undefined
      ? reader
      : typeof navigator !== "undefined"
        ? (navigator as unknown as NavigatorLike)
        : null;
  // `reader` is `undefined` for "use the ambient navigator" and `null` for
  // "there is no navigator" — the difference is the whole reason for the
  // tri-state, because a server and a test that stubs `navigator` away need
  // opposite behaviour.
  if (src) {
    const primary = typeof src.language === "string" && src.language ? src.language : null;
    const list = Array.isArray(src.languages) ? [...src.languages] : [];
    const pick = primary ?? list[0] ?? null;
    if (pick) {
      const norm = normalize ? normalizeTag(pick) : pick;
      const langs = list.map((t) => (normalize ? normalizeTag(t) : t));
      const parts = parseTag(norm);
      return {
        current: norm,
        base: parts.base,
        region: parts.region,
        languages: langs,
        detected: true,
      };
    }
  }
  const normFallback = normalize ? normalizeTag(fallback) : fallback;
  const parts = parseTag(normFallback);
  return {
    current: normFallback,
    base: parts.base,
    region: parts.region,
    languages: [],
    detected: false,
  };
}

export class LangController extends BaseController<LangEvents> implements LangManager {
  readonly id: string;
  readonly #fallback: string;
  readonly #normalize: boolean;
  readonly #reader: NavigatorLike | null | undefined;

  #current: string;
  #base: string;
  #region: string | null;
  #languages: readonly string[];
  #isDetected: boolean;

  constructor(options: CreateLangOptions = {}) {
    super();
    this.id = options.id ?? generateId("lang");
    this.#normalize = options.normalize !== false;
    this.#fallback = this.#normalize
      ? normalizeTag(options.fallback ?? DEFAULT_LANG_FALLBACK)
      : (options.fallback ?? DEFAULT_LANG_FALLBACK);
    this.#reader = options.navigator;
    // Detection is deferred to `mount()` unless a reader was injected. The
    // constructor has to pick *something* before mount so the object is never
    // half-built, and guessing from `navigator` there would read the global on
    // a server during module evaluation.
    const init =
      this.#reader !== undefined
        ? detect(this.#fallback, this.#normalize, this.#reader)
        : {
            current: this.#fallback,
            base: parseTag(this.#fallback).base,
            region: parseTag(this.#fallback).region,
            languages: [] as readonly string[],
            detected: false,
          };
    this.#current = init.current;
    this.#base = init.base;
    this.#region = init.region;
    this.#languages = init.languages;
    this.#isDetected = init.detected;
  }

  override mount(): void {
    if (this.lifecycle !== "idle") return;
    super.mount();
    if (this.#reader === undefined) {
      const d = detect(this.#fallback, this.#normalize, undefined);
      this.#current = d.current;
      this.#base = d.base;
      this.#region = d.region;
      this.#languages = d.languages;
      this.#isDetected = d.detected;
    }
    queueMicrotask(() => {
      if (this.lifecycle === "destroyed") return;
      // Deferred by a microtask so a listener attached right after `mount()`
      // still hears the first snapshot. `BaseController` gives `on()` no such
      // guarantee, and the plugin subscribes after mounting.
      this.#emit("initialization", null);
    });
  }

  get current(): string {
    return this.#current;
  }
  get base(): string {
    return this.#base;
  }
  get region(): string | null {
    return this.#region;
  }
  get languages(): readonly string[] {
    return this.#languages;
  }
  get fallback(): string {
    return this.#fallback;
  }
  get isDetected(): boolean {
    return this.#isDetected;
  }

  get(): LangState {
    return {
      current: this.#current,
      base: this.#base,
      region: this.#region,
      languages: this.#languages,
      fallback: this.#fallback,
      isDetected: this.#isDetected,
    };
  }

  is(value: string): boolean {
    return this.isFrom(this.get(), value);
  }

  /**
   * `is()` against a caller-supplied state.
   *
   * The Alpine store answers from a reactive snapshot rather than from these
   * private fields, so a template calling `$store.lang.is(...)` registers a
   * dependency on the value it reads and re-runs when the language changes.
   */
  isFrom(state: LangState, value: string): boolean {
    const cand = this.#normalize ? normalizeTag(value) : value;
    if (state.current === cand) return true;
    const parts = parseTag(cand);
    // An exact match, or a base-only candidate matching the current base:
    // `is('pt')` is true while the current language is `pt-BR`. A candidate
    // that carries its own region is never a base match — `is('pt')` must not
    // be true because the current is `pt-PT`.
    if (parts.region === null && state.base === cand) return true;
    return false;
  }

  includes(value: string): boolean {
    return this.includesFrom(this.get(), value);
  }

  /** `includes()` against a caller-supplied state. See {@link isFrom}. */
  includesFrom(state: LangState, value: string): boolean {
    const cand = this.#normalize ? normalizeTag(value) : value;
    const parts = parseTag(cand);
    for (const tag of state.languages) {
      if (tag === cand) return true;
      if (parts.region === null && parseTag(tag).base === cand) return true;
    }
    return false;
  }

  set(value: string): void {
    if (this.lifecycle === "destroyed") return;
    const next = this.#normalize ? normalizeTag(value) : value;
    // Setting the language already active is not a change. Without this,
    // clicking the active button in a language picker would repaint every
    // translation and emit a `change` for nothing.
    if (!next || next === this.#current) return;
    const prev = this.get();
    const parts = parseTag(next);
    this.#current = next;
    this.#base = parts.base || next;
    this.#region = parts.region;
    this.#emit("user", prev);
  }

  reset(): void {
    if (this.lifecycle === "destroyed") return;
    const prev = this.get();
    const d = detect(this.#fallback, this.#normalize, this.#reader);
    this.#current = d.current;
    this.#base = d.base;
    this.#region = d.region;
    this.#languages = d.languages;
    this.#isDetected = d.detected;
    this.#emit("reset", prev);
  }

  #emit(source: LangChangeSource, previous: LangState | null): void {
    const detail: LangChangeDetail = { ...this.get(), source, previous };
    this.emit("change", detail);
  }
}

export function createLangController(options?: CreateLangOptions): LangController {
  const c = new LangController(options);
  c.mount();
  return c;
}
