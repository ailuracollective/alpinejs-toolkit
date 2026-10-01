export type ShortcutScope = string;

export interface ShortcutMetadata {
  readonly id: string;
  readonly label?: string;
  readonly description?: string;
  readonly group?: string;
}

export type ShortcutHandler = (event: KeyboardEvent) => void;

/** Task-required alias: KeyBinding. */
export type KeyBinding = string;

export interface ShortcutRegistrationOptions {
  readonly id?: string;
  readonly scope?: ShortcutScope | readonly ShortcutScope[];
  readonly priority?: number;
  readonly enabled?: boolean;
  readonly allowInEditable?: boolean;
  readonly preventDefault?: boolean;
  readonly stopPropagation?: boolean;
  readonly metadata?: Omit<ShortcutMetadata, "id">;
  readonly when?: () => boolean;
}

export interface ShortcutRegistration extends ShortcutMetadata {
  readonly shortcut: string;
  readonly scopes: readonly ShortcutScope[];
  readonly priority: number;
  readonly enabled: boolean;
  readonly allowInEditable: boolean;
  readonly preventDefault: boolean;
  readonly stopPropagation: boolean;
}

export interface KeyboardOptions {
  readonly sequenceTimeout?: number;
  readonly ignoreEditableTargets?: boolean;
  readonly editableSelector?: string;
  readonly pauseWhileScopesActive?: readonly ShortcutScope[];
}

export interface KeyboardPluginOptions {
  readonly id?: string;
  readonly options?: KeyboardOptions;
  readonly shortcuts?: readonly KeyboardShortcutDefinition[];
  readonly storeKey?: string;
  /**
   * Alpine directive name, without the `x-` prefix, that registers a shortcut
   * for its own element and unregisters it when Alpine removes that element.
   * Defaults to {@link DEFAULT_KEYBOARD_DIRECTIVE_KEY}.
   *
   * ```html
   * <div x-keyboard.editor="'mod+s -> save()'">…</div>
   * ```
   *
   * The single modifier is the scope: `x-keyboard.editor="'mod+s -> save()'"`.
   * The registration id is derived from the scope and the shortcut, so two
   * shortcuts in one scope coexist and re-entering the page re-registers the
   * same id instead of throwing `ERR_KEYBOARD_DUPLICATE_ID`.
   *
   * The `window` `keydown` listener stays global — only the *registration* is
   * element-bound — so a scoped shortcut still fires only while its scope is
   * active, exactly as with the hand-written form.
   *
   * The hand-written `$store.keyboard.register(shortcut, handler)` remains
   * available and unchanged.
   */
  readonly directiveKey?: string;
}

/** Default `x-keyboard` directive key registered by {@link keyboardPlugin}. */
export const DEFAULT_KEYBOARD_DIRECTIVE_KEY = "keyboard";

export const DEFAULT_KEYBOARD_STORE_KEY = "keyboard";

export interface KeyboardShortcutDefinition {
  readonly shortcut: string;
  readonly handler: ShortcutHandler;
  readonly options?: ShortcutRegistrationOptions;
}

/**
 * The `x-keyboard` directive's object form.
 *
 * `"mod+s -> save()"` is the shorthand most callers want; this is for when the
 * handler already exists as a value rather than as markup.
 */
export type KeyboardDirectiveOptions = ShortcutRegistrationOptions & {
  readonly handler: ShortcutHandler;
};

/**
 * The shape the registered `$store.keyboard` exposes. Retained under its
 * historical name: it is the store contract, not a magic alias, and
 * `KeyboardStore` is an alias of it.
 */
export interface KeyboardMagic {
  readonly activeScopes: readonly ShortcutScope[];
  readonly suspendedScopes: readonly ShortcutScope[];
  readonly commands: readonly ShortcutRegistration[];
  register(
    shortcut: string,
    handler: ShortcutHandler,
    options?: ShortcutRegistrationOptions
  ): () => void;
  unregister(id: string): boolean;
  activateScope(scope: ShortcutScope): void;
  deactivateScope(scope: ShortcutScope): void;
  suspendScope(scope: ShortcutScope): void;
  resumeScope(scope: ShortcutScope): void;
  isScopeActive(scope: ShortcutScope): boolean;
  isScopeSuspended(scope: ShortcutScope): boolean;
  handleKeydown(event: KeyboardEvent): void;
  /**
   * Host-owned teardown: removes the `window` keydown listener and clears
   * every registered shortcut. Nothing invokes it automatically — the host
   * that registered the plugin calls it.
   */
  destroy(): void;
}

export interface KeyboardStore extends KeyboardMagic {}

export interface ParsedChordModifiers {
  ctrl: boolean;
  meta: boolean;
  alt: boolean;
  shift: boolean;
  mod: boolean;
}
export interface ParsedChord {
  readonly modifiers: ParsedChordModifiers;
  readonly key: string;
}
export interface InternalRegistration extends ShortcutRegistration {
  readonly chords: readonly ParsedChord[];
  readonly when?: () => boolean;
  readonly handler: ShortcutHandler;
}
