# @ailura/alpinejs-keyboard

<p align="center">

[![bundlephobia minzip](https://badgen.net/bundlephobia/minzip/@ailura/alpinejs-keyboard)](https://bundlephobia.com/package/@ailura/alpinejs-keyboard)

</p>

> Alpine.js scoped shortcut registry — chords, multi-key sequences, `mod` that means the right key on each platform, and priority-based conflict resolution, on `@ailura/alpinejs-core`.

## Installation

```sh
pnpm add @ailura/alpinejs-keyboard alpinejs
# or
npm install @ailura/alpinejs-keyboard alpinejs
```

Requires `alpinejs@^3.0.0` as peer. `@ailura/alpinejs-core` is a **peer
dependency**, not a dependency: no package in this toolkit has a
`dependencies` block, so the host installs it too.

## Usage

### 1. Standalone (framework-agnostic)

```ts
import { createKeyboardController } from "@ailura/alpinejs-keyboard";

// `createKeyboardController` does NOT mount — call mount() to attach the listener.
const keys = createKeyboardController({ sequenceTimeout: 800 });
keys.mount();

const off = keys.register("mod+k", (event) => {
  event.preventDefault();
  openPalette();
});

// keys.register returns the unregister disposer:
off();

keys.register("g h", () => goHome()); // a two-key sequence
keys.register("mod+shift+k", save, { priority: 10, metadata: { label: "Save" } });

keys.activateScope("editor");

keys.on("shortcut", (registration) => {
  console.log("fired:", registration.shortcut);
});

// keys.destroy() when done
```

`destroy()` is idempotent and final. After it, `register()` still works but the
`keydown` listener is gone, so nothing fires.

### 2. Alpine

```ts
import Alpine from "alpinejs";
import keyboardPlugin from "@ailura/alpinejs-keyboard";

Alpine.plugin(keyboardPlugin());
Alpine.start();
```

The plugin registers `$store.keyboard`. There is **no magic** — the store is the
whole surface. You can register by hand:

```html
<div
  x-data="{ hits: 0, log: [] }"
  x-init="(() => {
  $store.keyboard.register('mod+k', () => { hits++ }, {
    metadata: { label: 'Command palette', group: 'Global' },
  });
})()"
>
  <p>Hits: <span x-text="hits"></span></p>
  <ul>
    <template x-for="entry in log" :key="entry">
      <li x-text="entry"></li>
    </template>
  </ul>
  <button type="button" @click="$store.keyboard.activateScope('editor')">Enter editor mode</button>
</div>
```

> **Wrap a multi-statement `x-init` in an IIFE.** Alpine compiles `x-init` to
> `let __result = <expression>` and then invokes `__result` if it is a function —
> and `register()` returns its unregister disposer. A bare list of `register()`
> calls therefore disposes its first registration the moment the element mounts.
> `(() => { ... })()` evaluates to `undefined`, so nothing is invoked. The
> package cannot fix this from the outside; it is a property of how Alpine
> compiles `x-init`.

The `x-keyboard` directive avoids the trap entirely, because a directive
callback never assigns its expression's value:

```html
<div x-data="{ saved: false }">
  <div x-keyboard.editor="'mod+s -> saved = true'">Editor surface</div>
  <p x-text="saved ? 'Saved' : 'Not saved'"></p>
</div>
```

The single modifier is the **scope**. The registration id is derived from the
scope and the shortcut, so two shortcuts in one scope coexist and re-entering
the page re-registers the same id instead of throwing. When the element leaves
the tree, `cleanup()` releases the registration — something no store call can
do. The `window` `keydown` listener stays global; only the _registration_ is
element-bound.

## API

### Exports

| Export                           | Description                                                                                                                                                                                                                                     | Type       |
| -------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| `KeyboardController`             | The registry class. Getters `activeScopes`, `suspendedScopes`, `commands`; methods `register`, `unregister`, `activateScope`, `deactivateScope`, `suspendScope`, `resumeScope`, `isScopeActive`, `isScopeSuspended`, `handleKeydown`, `destroy` | `class`    |
| `createKeyboardController`       | `createKeyboardController(options?) => KeyboardController` — constructs but **does not mount**; the `window` listener is attached by `mount()`                                                                                                  | `function` |
| `keyboardPlugin`                 | `Alpine.plugin()` factory — `keyboardPlugin(options?) => (alpine) => void`. Registers `$store.keyboard` and the `x-keyboard` directive                                                                                                          | `function` |
| `DEFAULT_KEYBOARD_STORE_KEY`     | Default store key, `"keyboard"`                                                                                                                                                                                                                 | `const`    |
| `DEFAULT_KEYBOARD_DIRECTIVE_KEY` | Default directive name, `"keyboard"` — the `x-keyboard` part                                                                                                                                                                                    | `const`    |
| `KeyboardEvents`                 | Event map — `register`, `unregister`, `scope:change`, `shortcut`                                                                                                                                                                                | `type`     |
| `KeyboardStore`                  | What `$store.keyboard` exposes. An alias of `KeyboardMagic`; identical surface                                                                                                                                                                  | `type`     |
| `KeyboardMagic`                  | The same interface under its historical name — it is a store, not a magic, and this is not a separate surface                                                                                                                                   | `type`     |
| `KeyboardOptions`                | Controller options — `sequenceTimeout`, `ignoreEditableTargets`, `editableSelector`, `pauseWhileScopesActive`                                                                                                                                   | `type`     |
| `KeyboardPluginOptions`          | Plugin options — `id`, `options`, `shortcuts`, `storeKey`, `directiveKey`                                                                                                                                                                       | `type`     |
| `KeyboardShortcutDefinition`     | `{ shortcut, handler, options? }` — one entry for the plugin's `shortcuts` array                                                                                                                                                                | `type`     |
| `ShortcutRegistrationOptions`    | Per-registration options — `id`, `scope`, `priority`, `enabled`, `allowInEditable`, `preventDefault`, `stopPropagation`, `metadata`, `when`                                                                                                     | `type`     |
| `ShortcutRegistration`           | A registered shortcut as `commands` reports it — the options plus `shortcut` and the normalised `scopes`                                                                                                                                        | `type`     |
| `ShortcutMetadata`               | `{ id, label?, description?, group? }` — `id` is supplied by the registration, so `metadata` takes the other three                                                                                                                              | `type`     |
| `ShortcutHandler`                | `(event: KeyboardEvent) => void`                                                                                                                                                                                                                | `type`     |
| `ShortcutScope`                  | Alias of `string`                                                                                                                                                                                                                               | `type`     |
| `KeyBinding`                     | Alias of `string` — the key token of a chord, e.g. `"k"` in `"mod+k"`                                                                                                                                                                           | `type`     |
| `ParsedChord`                    | `{ modifiers: ParsedChordModifiers, key: string }`                                                                                                                                                                                              | `type`     |
| `ParsedChordModifiers`           | `{ ctrl, meta, alt, shift, mod }` — five booleans, with `mod` resolved against the platform                                                                                                                                                     | `type`     |
| `InternalRegistration`           | `ShortcutRegistration` plus the parsed `chords`, the `handler`, and the `when` predicate. Exported for typing adapters                                                                                                                          | `type`     |

`keyboardPlugin` is also the package's `default` export.

### Store API

```ts
// Read
$store.keyboard.activeScopes; // readonly string[] — starts as ['default']
$store.keyboard.suspendedScopes; // readonly string[]
$store.keyboard.commands; // readonly ShortcutRegistration[]

// Register — returns an unregister disposer
const off = $store.keyboard.register("mod+k", handler, { metadata: { label: "Palette" } });
off();

// Unregister by id
$store.keyboard.unregister("some-id"); // → boolean

// Scopes
$store.keyboard.activateScope("editor");
$store.keyboard.deactivateScope("editor");
$store.keyboard.suspendScope("editor"); // registered but not firing
$store.keyboard.resumeScope("editor");
$store.keyboard.isScopeActive("editor");
$store.keyboard.isScopeSuspended("editor");

// For a host with its own keydown listener
$store.keyboard.handleKeydown(event);

$store.keyboard.destroy();
```

`unregister(id)` returns `true` if something was removed, `false` if the id was
unknown — so a double-unregister is detectable here, unlike the scroll lock.

`destroy()` is host-owned. It removes the `window` listener and clears every
registration; nothing calls it for you.

### Writing a shortcut

A shortcut string is a **sequence of chords**: whitespace separates the steps,
`+` separates modifiers from the key.

| Written          | Means                                                                   |
| ---------------- | ----------------------------------------------------------------------- |
| `"mod+k"`        | the platform's primary modifier plus `k` — Cmd on macOS, Ctrl elsewhere |
| `"ctrl+shift+p"` | explicitly Ctrl and Shift, on every platform                            |
| `"g h"`          | press `g`, then `h`, within `sequenceTimeout` of each other             |
| `"g mod+k"`      | a sequence mixing a bare key and a chord                                |
| `"escape"`       | matched case-insensitively against `event.key`                          |

`mod` is resolved **at comparison time, not at parse time**, so a registration
made as `mod+s` still reports `mod+s` in `commands` and in the emitted detail.
`mod` also _forbids_ the other modifier: on macOS `mod+s` demands Cmd and will
not match Ctrl+S or Ctrl+Cmd+S; elsewhere it demands Ctrl and will not match
Cmd+S or Ctrl+Shift+S.

Modifier aliases: `control` → `ctrl`, `cmd`/`command` → `meta`,
`option` → `alt`. The whole chord is lowercased, so `"Escape"` and `"escape"`
are the same key.

### Scopes

Every controller starts with the scope `"default"` active, and **it cannot be
deactivated** — allowing it would mean the page could reach a state where no
scope is active and every unscoped shortcut is dead. A registration with no
`scope` lands in `"default"`, which is what makes the common case work with no
setup.

A registration fires when **any** of its scopes is active and **none** of them
is suspended. That gives the two distinct controls:

- `activateScope` / `deactivateScope` — _where_ the reader is. An editor's
  shortcuts are registered in `editor` and only fire while the editor is open.
- `suspendScope` / `resumeScope` — _whether_ they respond. A scope can stay
  active (the editor is still open) while being suspended (a modal is on top).

```ts
$store.keyboard.register("mod+s", save, { scope: "editor" });

$store.keyboard.activateScope("editor"); // mod+s now fires
$store.keyboard.suspendScope("editor"); // still active, but mod+s is inert
$store.keyboard.resumeScope("editor");
$store.keyboard.deactivateScope("editor");
```

### Conflict resolution

When more than one registration matches a keypress, **only one handler runs**.
The highest `priority` wins; on a tie the sort is stable, so the
earlier-registered shortcut keeps the slot. This is what makes `priority` usable
for shadowing a built-in binding:

```ts
$store.keyboard.register("mod+k", openPalette); // priority 0
$store.keyboard.register("mod+k", openCommandMenu, { priority: 10 }); // this one wins
```

A single-chord winner does **not** consume the sequence buffer, so `"g h"` still
completes if an unrelated `g` shortcut wins the `g` press. A matched _sequence_
does clear the buffer.

### Options

Controller options, passed as `keyboardPlugin({ options: { … } })` or straight
to `createKeyboardController`:

```ts
type KeyboardOptions = {
  sequenceTimeout?: number; // default: 800 (ms)
  ignoreEditableTargets?: boolean; // default: true — declared, see Limitations
  editableSelector?: string; // default: 'input, textarea, [contenteditable]'
  pauseWhileScopesActive?: readonly string[]; // default: []
};
```

| Option                   | Default                                | Description                                                                                                                                                                                                        |
| ------------------------ | -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `sequenceTimeout`        | `800`                                  | How long a partially-typed sequence waits before the buffer is dropped. The timer resets on every keypress, so this is the gap _between_ two keys, not the length of the whole sequence                            |
| `editableSelector`       | `"input, textarea, [contenteditable]"` | What counts as editable. Matched against the event target **and its ancestors**, so typing inside a `contenteditable` child counts                                                                                 |
| `pauseWhileScopesActive` | `[]`                                   | If **any** listed scope is active, the whole registry goes inert — no shortcut fires, global ones included. The point is "nothing responds while the reader is in here". Checked before any per-registration logic |
| `ignoreEditableTargets`  | `true`                                 | **Has no effect.** The per-registration `allowInEditable` check is what actually gates editing fields, and it runs regardless. Setting this to `false` does not make shortcuts fire in inputs                      |

Plugin options:

```ts
type KeyboardPluginOptions = {
  id?: string; // accepted; the controller generates its own
  options?: KeyboardOptions; // passed to the controller
  shortcuts?: readonly KeyboardShortcutDefinition[]; // registered before mount
  storeKey?: string; // default: 'keyboard'
  directiveKey?: string; // default: 'keyboard'
};
```

`shortcuts` is a declarative alternative to `x-init`: each entry is registered
before the controller mounts, so the store's first `sync()` already sees them.

```ts
keyboardPlugin({
  shortcuts: [
    { shortcut: "mod+k", handler: openPalette, options: { metadata: { label: "Palette" } } },
    { shortcut: "g h", handler: goHome, options: { scope: ["nav"] } },
  ],
});
```

### Per-registration options

```ts
type ShortcutRegistrationOptions = {
  id?: string; // default: generateId('shortcut') — must be unique, throws on a duplicate
  scope?: string | readonly string[]; // default: 'default'
  priority?: number; // default: 0
  enabled?: boolean; // default: true
  allowInEditable?: boolean; // default: false
  preventDefault?: boolean; // default: true
  stopPropagation?: boolean; // default: false
  metadata?: { label?; description?; group? };
  when?: () => boolean; // evaluated per keypress; false excludes the candidate
};
```

`preventDefault` defaults to `true`, which means a registered shortcut
**suppresses the browser's own binding** for that chord. That is usually what you
want — it is why `mod+s` does not also trigger Save in Firefox — but it means
registering a bare letter swallows that key for the page. Pass
`preventDefault: false` when you are layering on top of native behaviour.

### Avoiding name collisions

`guardStore` and `guardDirective` throw a `RegistrationError` if another package
has claimed `keyboard`. Rename without forking:

```ts
Alpine.plugin(keyboardPlugin({ storeKey: "keys", directiveKey: "hotkey" }));
// → $store.keys, and x-hotkey
```

`DEFAULT_KEYBOARD_STORE_KEY` and `DEFAULT_KEYBOARD_DIRECTIVE_KEY` keep the
defaults discoverable from TypeScript.

## Events

```ts
keys.on("register", (registration) => {
  registration.shortcut; // normalised: 'mod+k', 'g h'
  registration.scopes;
  registration.priority;
  registration.enabled;
});

keys.on("unregister", (id) => {
  /* the id that was removed */
});

keys.on("scope:change", ({ active, suspended }) => {
  /* both arrays, on every scope transition */
});

keys.on("shortcut", (registration, event) => {
  /* the winner, after its handler has already run */
});
```

The plugin's store syncs on the first three — `scope:change` covers every scope
transition and `register`/`unregister` cover the command list. It does **not**
subscribe to `shortcut`, so listening to it is purely a consumer concern.

## SSR

> SSR-safe — no `window`/`document` at import time. The `keydown` listener is
> attached in `setup()`, which `mount()` calls, and that is guarded by
> `safeWindow()` from `@ailura/alpinejs-core/env`.

`createKeyboardController()` and `keyboardPlugin()` are both safe to call during
SSR. Without a window there is no listener, and `handleKeydown()` can still be
invoked by a host that has its own event source — which is the SSR-shaped use
case: register on the server, feed synthetic events on the client. The `isMac()`
probe reads `navigator.platform` through `safeWindow()` and reports `false` when
there is none, so `mod` means Ctrl until the controller is constructed in a
browser.

## Accessibility

Not applicable — this is a Primitives-layer package and it produces no roles,
ARIA attributes or focus management. It is the keyboard layer, and the
consequence is the one worth stating: **every shortcut registered here is
unreachable without a physical or Bluetooth keyboard**, and a shortcut is
invisible to a screen-reader user navigating in browse mode. Always pair a
shortcut with a visible, focusable control that does the same thing. A command
palette registered here is an enhancement over visible buttons, never a
replacement for them.

`preventDefault: true` — the default — means a registered chord suppresses the
browser's own binding. On `mod+s` that is the point; on a bare `s` it silently
disables a browser find-in-page-adjacent behaviour. Prefer `mod`-prefixed chords
or a scope.

## Integration

- **@ailura/alpinejs-command** — a command palette is a modal surface; register
  its bindings in a scope and use `suspendScope` to turn them off while an input
  inside the palette has focus.
- **@ailura/alpinejs-dialog** — a dialog that should own the keyboard can
  `suspendScope` the page's scope on open and `resumeScope` on close, which is
  cheaper and less error-prone than unregistering and re-registering.

## Limitations

- **`ignoreEditableTargets` does nothing.** It is on `KeyboardOptions` and its
  branch in `handleKeydown()` is empty. The real gate is the per-registration
  `allowInEditable`, which defaults to `false` and is checked for every
  candidate regardless of this option — so the common case (do not fire in
  inputs) works, but setting `ignoreEditableTargets: false` does **not** make
  shortcuts fire inside an input. Use `allowInEditable: true` per registration.
- **`preventDefault` defaults to `true`**, so a registered chord silently
  suppresses the browser's own binding. A bare-letter shortcut is more
  destructive than it looks.
- **`createKeyboardController()` does not mount.** The `window` listener is
  attached in `setup()`. Forgetting `mount()` yields a controller that registers
  shortcuts that never fire, with no error.
- **A multi-statement `x-init` of `register()` calls disposes its first
  registration.** Alpine compiles `x-init` to `let __result = <expr>` and
  invokes a function result; `register()` returns its disposer. Wrap in an
  IIFE, or use the `x-keyboard` directive, which does not have this problem.
- **`register()` throws on a duplicate `id`.** Correct for a bug, hostile to a
  page that re-initialises — under Astro view transitions or a client-side
  router, an `x-init` that re-runs will throw on the second visit unless it
  unregisters first or the `x-keyboard` directive derives its id.
- **Sequence matching is a suffix of the buffer, not a prefix.** A sequence is
  recognised when the last N keys match it, so typing `x g h` completes `"g h"`.
  The buffer is unbounded within the timeout.
- **The `when` predicate runs on every keypress** for every registration, before
  priority resolution. An expensive `when` is paid on unrelated keys too.
- **Only `event.key` is matched** — never `event.code`. A chord written `"mod+k"`
  matches the _key_ `k`, so it fires on a different physical key under a
  different layout (AZERTY's `k` is where QWERTY's `l` is). That is usually what
  you want, and occasionally not.
- **No `repeat` filtering.** A held key generates repeated `keydown` events, and
  a held arrow or letter will fire its shortcut repeatedly. Guard in the handler
  with `if (event.repeat) return`.
- **`pauseWhileScopesActive` is all-or-nothing.** One active listed scope
  disables the entire registry, including global shortcuts. There is no
  per-registration escape.
- **The `window` listener cannot be scoped.** The `x-keyboard` directive
  element-binds the _registration_, not the listener, so a shortcut bound to a
  still-mounted element fires as long as its scope is active even when focus is
  elsewhere on the page.
- **`KeyboardMagic` and `KeyboardStore` are the same interface** under two
  names. `KeyboardMagic` is retained for compatibility; there is no `$keyboard`
  magic — only `$store.keyboard`.
- **`KeyBinding` is `string`**, not a union of valid key names, so a typo in a
  shortcut is a runtime no-op rather than a type error.
- **`KeyboardPluginOptions.id` is accepted and ignored** — the controller
  generates its own id.
- **The `x-keyboard` directive's object form takes a `handler` value**, so it
  cannot be used from markup alone; the `"chord -> expression"` string form is
  the one that works in a template.

## Size

`6.36 kB raw / 2.50 kB gzip` · budget `3 kB` · externalized peers: `alpinejs`,
`@ailura/alpinejs-core` · `size-limit` + `publint` + `attw` verified.

## Architecture

[Primitives layer](../../ARCHITECTURE.md) — controllers own state, Alpine owns
reactivity. See canon, guards, and SSR rules in
[ARCHITECTURE.md](../../ARCHITECTURE.md).

## Testing

```sh
pnpm test              # vp test (happy-dom)
pnpm run typecheck     # tsc --noEmit
```

Four suites: `plugin.test.ts` for chord parsing and `mod` resolution on both
platforms, `shortcut-directive.test.ts` for `x-keyboard`, `store-reactivity.test.ts`
for the store's sync, `demo-registration.test.ts` which pins the exact `x-init`
IIFE the published demo uses.

## License

MIT
