import { BaseController } from "@ailura/alpinejs-core/controller";
import { safeWindow } from "@ailura/alpinejs-core/env";
import { generateId } from "@ailura/alpinejs-core/ids";
import { invariant } from "@ailura/alpinejs-core/invariant";

import type { KeyboardEvents } from "./events";

const ERR_KEYBOARD_DUPLICATE_ID = (id: string): string => `Shortcut id "${id}" already registered`;

import type {
  InternalRegistration,
  KeyboardOptions,
  ParsedChord,
  ShortcutHandler,
  ShortcutRegistrationOptions,
  ShortcutScope,
} from "./types";

/**
 * Every controller starts with this scope active, and it cannot be deactivated.
 * A registration with no explicit `scope` lands here, which is what makes the
 * common case — a global shortcut — fire without any scope setup at all.
 */
const DEFAULT_SCOPE = "default";

function normalizeScopes(scope?: ShortcutScope | readonly ShortcutScope[]): string[] {
  if (!scope) return [DEFAULT_SCOPE];
  if (Array.isArray(scope)) return [...(scope as readonly string[])];
  return [scope as string];
}

/**
 * One chord, lowercased.
 *
 * The whole string is lowercased rather than just the modifiers because the
 * comparison side lowercases `event.key` too — which is why a chord can be
 * written `"escape"` and still match a key that reports as `"Escape"`, and why
 * a chord can never distinguish `Shift` from `shift`.
 */
function parseChord(raw: string): ParsedChord {
  const parts = raw
    .toLowerCase()
    .split("+")
    .map((s) => s.trim())
    .filter(Boolean);
  const key = parts.pop() ?? "";
  const mods = { ctrl: false, meta: false, alt: false, shift: false, mod: false };
  for (const p of parts) {
    if (p === "ctrl" || p === "control") mods.ctrl = true;
    else if (p === "meta" || p === "cmd" || p === "command") mods.meta = true;
    else if (p === "alt" || p === "option") mods.alt = true;
    else if (p === "shift") mods.shift = true;
    else if (p === "mod") mods.mod = true;
  }
  return { modifiers: mods, key };
}

/**
 * A shortcut string is a sequence of chords: whitespace separates the steps,
 * `+` separates the modifiers from the key. `"mod+k"` is one chord, `"g h"` is
 * a two-step sequence, `"g mod+k"` mixes both.
 */
function parseShortcut(shortcut: string): ParsedChord[] {
  return shortcut.trim().split(/\s+/).filter(Boolean).map(parseChord);
}

function formatShortcut(chords: ParsedChord[]): string {
  return chords
    .map((c) => {
      const parts: string[] = [];
      if (c.modifiers.ctrl) parts.push("ctrl");
      if (c.modifiers.meta) parts.push("meta");
      if (c.modifiers.alt) parts.push("alt");
      if (c.modifiers.shift) parts.push("shift");
      if (c.modifiers.mod) parts.push("mod");
      parts.push(c.key);
      return parts.join("+");
    })
    .join(" ");
}

/**
 * `navigator.platform` is deprecated but it is the only signal that is stable
 * across the iPad's desktop-mode spoofing, which `userAgentData.platform` is
 * not. A `null` platform — some privacy configurations report it — reads as
 * non-mac, so `mod` becomes Ctrl.
 */
function isMac(): boolean {
  try {
    return safeWindow()?.navigator.platform.toLowerCase().includes("mac") ?? false;
  } catch {
    return false;
  }
}

/**
 * Compare a keydown against a registered chord.
 *
 * `mod` is resolved HERE, at comparison time only, so that parsing and
 * `formatShortcut` keep the literal token (the registration's `shortcut`
 * string must still read `mod+s`). A chord declaring `mod` means the
 * platform's primary modifier and nothing else: on macOS it demands Cmd and
 * forbids Ctrl, elsewhere it demands Ctrl and forbids Cmd.
 */
function eventMatchesChord(
  eventKey: string,
  eventMods: ParsedChord["modifiers"],
  chord: ParsedChord,
  onMac: boolean
): boolean {
  const expectedCtrl = chord.modifiers.mod ? !onMac : chord.modifiers.ctrl;
  const expectedMeta = chord.modifiers.mod ? onMac : chord.modifiers.meta;
  const expectedMod = onMac ? expectedMeta : expectedCtrl;
  return (
    chord.key === eventKey &&
    expectedCtrl === eventMods.ctrl &&
    expectedMeta === eventMods.meta &&
    chord.modifiers.alt === eventMods.alt &&
    chord.modifiers.shift === eventMods.shift &&
    expectedMod === eventMods.mod
  );
}

/**
 * True when the event target is, or is inside, an editable field.
 *
 * `closest` is what makes a shortcut typed into a rich-text editor's inner
 * `<div>` count as editable; without it `contenteditable` would only be caught
 * when it was the element itself.
 */
function isEditable(el: EventTarget | null, selector?: string): boolean {
  if (!(el instanceof HTMLElement)) return false;
  const sel = selector ?? "input, textarea, [contenteditable]";
  return el.matches(sel) || !!el.closest(sel);
}

export class KeyboardController extends BaseController<KeyboardEvents> {
  readonly id: string;
  readonly #options: KeyboardOptions;
  readonly #registrations = new Map<string, InternalRegistration>();
  readonly #activeScopes = new Set<string>([DEFAULT_SCOPE]);
  readonly #suspendedScopes = new Set<string>();
  #keydownHandler: ((e: KeyboardEvent) => void) | null = null;
  #onMac: boolean;
  #sequenceBuffer: ParsedChord[] = [];
  #sequenceTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(options: KeyboardOptions = {}, isMacHint?: boolean) {
    super();
    this.id = generateId("keyboard");
    this.#options = options;
    this.#onMac = isMacHint ?? isMac();
  }

  get activeScopes(): readonly string[] {
    return [...this.#activeScopes];
  }
  get suspendedScopes(): readonly string[] {
    return [...this.#suspendedScopes];
  }
  get commands(): readonly import("./types").ShortcutRegistration[] {
    return [...this.#registrations.values()].map((r) => ({
      id: r.id,
      shortcut: r.shortcut,
      scopes: r.scopes,
      priority: r.priority,
      enabled: r.enabled,
      allowInEditable: r.allowInEditable,
      preventDefault: r.preventDefault,
      stopPropagation: r.stopPropagation,
      label: r.label,
      description: r.description,
      group: r.group,
    }));
  }

  /**
   * Register a shortcut and return its unregister disposer.
   *
   * Throws if `options.id` is already taken — which is deliberate, because a
   * silently-replaced shortcut is a bug that surfaces as a dead keypress much
   * later. Omit `id` and a fresh one is generated, so the throwing path is only
   * reachable by a caller that chose its own id.
   */
  register(
    shortcut: string,
    handler: ShortcutHandler,
    options: ShortcutRegistrationOptions = {}
  ): () => void {
    const chords = parseShortcut(shortcut);
    const id = options.id ?? generateId("shortcut");
    invariant(!this.#registrations.has(id), ERR_KEYBOARD_DUPLICATE_ID(id));
    const scopes = normalizeScopes(options.scope);
    const reg: InternalRegistration = {
      id,
      shortcut: formatShortcut(chords),
      chords,
      scopes,
      priority: options.priority ?? 0,
      enabled: options.enabled !== false,
      allowInEditable: options.allowInEditable === true,
      preventDefault: options.preventDefault !== false,
      stopPropagation: options.stopPropagation === true,
      label: options.metadata?.label,
      description: options.metadata?.description,
      group: options.metadata?.group,
      when: options.when,
      handler,
    };
    this.#registrations.set(id, reg);
    this.emit("register", reg as never);
    return () => this.unregister(id);
  }

  unregister(id: string): boolean {
    const ok = this.#registrations.delete(id);
    if (ok) this.emit("unregister", id);
    return ok;
  }

  activateScope(scope: ShortcutScope): void {
    this.#activeScopes.add(scope);
    this.emit("scope:change", {
      active: [...this.#activeScopes],
      suspended: [...this.#suspendedScopes],
    });
  }
  deactivateScope(scope: ShortcutScope): void {
    // Refuses to deactivate the default scope. Every global registration lives
    // there, so allowing it would mean the page could end up with no active
    // scope and every unscoped shortcut silently dead.
    if (scope === DEFAULT_SCOPE) return;
    this.#activeScopes.delete(scope);
    this.emit("scope:change", {
      active: [...this.#activeScopes],
      suspended: [...this.#suspendedScopes],
    });
  }
  suspendScope(scope: ShortcutScope): void {
    this.#suspendedScopes.add(scope);
    this.emit("scope:change", {
      active: [...this.#activeScopes],
      suspended: [...this.#suspendedScopes],
    });
  }
  resumeScope(scope: ShortcutScope): void {
    this.#suspendedScopes.delete(scope);
    this.emit("scope:change", {
      active: [...this.#activeScopes],
      suspended: [...this.#suspendedScopes],
    });
  }
  isScopeActive(scope: ShortcutScope): boolean {
    return this.#activeScopes.has(scope);
  }
  isScopeSuspended(scope: ShortcutScope): boolean {
    return this.#suspendedScopes.has(scope);
  }

  /**
   * The one `keydown` entry point. Wired to `window` on `mount()` and also
   * exposed on the store, so a host that owns its own listener can delegate
   * here instead of double-binding.
   */
  handleKeydown(event: KeyboardEvent): void {
    if (
      this.#options.ignoreEditableTargets !== false &&
      isEditable(event.target, this.#options.editableSelector)
    ) {
      // Deliberately empty. The per-registration `allowInEditable` check in the
      // candidate filter below is the one that actually gates editing fields —
      // it runs for every registration regardless of this option. So
      // `ignoreEditableTargets` currently has no effect in either position;
      // leave the branch in place because removing it would read as a decision
      // rather than as a known gap.
    }
    // A whole-registry pause, checked before anything else: entering a named
    // scope (a text editor, say) switches off every shortcut including the
    // global ones, which is what makes it usable for "nothing responds while I
    // am typing in here".
    const pauseScopes = this.#options.pauseWhileScopesActive ?? [];
    if (pauseScopes.some((s) => this.#activeScopes.has(s))) return;

    const eventKey = event.key.toLowerCase();
    const eventMods: ParsedChord["modifiers"] = {
      ctrl: event.ctrlKey,
      meta: event.metaKey,
      alt: event.altKey,
      shift: event.shiftKey,
      mod: this.#onMac ? event.metaKey : event.ctrlKey,
    };
    const chord: ParsedChord = { modifiers: eventMods, key: eventKey };
    // Every keydown joins the buffer, even one that matches nothing: a sequence
    // like `"g h"` matches on its *last* chord, so the `g` has to be there when
    // the `h` arrives. The timer bounds the window and is reset on each press,
    // so the gap is measured between the last two keys, not the first and last.
    this.#sequenceBuffer.push(chord);
    if (this.#sequenceTimer) clearTimeout(this.#sequenceTimer);
    this.#sequenceTimer = setTimeout(() => {
      this.#sequenceBuffer = [];
    }, this.#options.sequenceTimeout ?? 800);

    const candidates = [...this.#registrations.values()].filter((r) => {
      if (!r.enabled) return false;
      if (r.when && !r.when()) return false;
      if (r.scopes.some((s) => this.#suspendedScopes.has(s))) return false;
      if (!r.scopes.some((s) => this.#activeScopes.has(s))) return false;
      if (!r.allowInEditable && isEditable(event.target, this.#options.editableSelector))
        return false;
      // match chords: if registration has single chord, match directly; if sequence, match buffer tail
      if (r.chords.length === 1) {
        const chord = r.chords.at(0);
        if (!chord) return false;
        return eventMatchesChord(eventKey, eventMods, chord, this.#onMac);
      }
      if (r.chords.length > 1) {
        if (this.#sequenceBuffer.length < r.chords.length) return false;
        const slice = this.#sequenceBuffer.slice(-r.chords.length);
        return slice.every((c, i) => {
          const p = r.chords.at(i);
          if (!p) return false;
          // The buffered chord is the event side: its `mod` is already
          // resolved by `eventMods`, and the registered chord is the
          // declaration `mod` gets resolved against.
          return eventMatchesChord(c.key, c.modifiers, p, this.#onMac);
        });
      }
      return false;
    });

    if (candidates.length === 0) return;
    // Conflict resolution: highest priority wins, and on a tie the array sort is
    // stable, so the earlier-registered shortcut keeps the slot. Only one
    // handler runs — two shortcuts on the same chord do not both fire, which is
    // what makes priority usable to shadow a built-in binding.
    candidates.sort((a, b) => b.priority - a.priority);
    const winner = candidates.at(0);
    if (!winner) return;
    if (winner.preventDefault) event.preventDefault();
    if (winner.stopPropagation) event.stopPropagation();
    winner.handler(event);
    this.emit("shortcut", winner as never, event as never);
    // Only a matched *sequence* consumes the buffer. A single-chord winner
    // leaves it alone, so `"g h"` stays live if an unrelated `g` shortcut wins
    // the `g` press — the `h` still completes the sequence.
    if (winner.chords.length > 1) this.#sequenceBuffer = [];
  }

  protected setup(): void {
    const w = safeWindow();
    if (!w) return;
    this.#keydownHandler = (e: KeyboardEvent) => this.handleKeydown(e);
    w.addEventListener("keydown", this.#keydownHandler);
    this.onCleanup(() => {
      if (w && this.#keydownHandler) w.removeEventListener("keydown", this.#keydownHandler);
    });
  }

  protected teardown(): void {
    if (this.#sequenceTimer) clearTimeout(this.#sequenceTimer);
    this.#registrations.clear();
  }
}

export function createKeyboardController(options?: KeyboardOptions): KeyboardController {
  return new KeyboardController(options);
}
