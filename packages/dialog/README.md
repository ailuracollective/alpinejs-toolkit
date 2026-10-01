# @ailura/alpinejs-dialog

<p align="center">

[![bundlephobia minzip](https://badgen.net/bundlephobia/minzip/@ailura/alpinejs-dialog)](https://bundlephobia.com/package/@ailura/alpinejs-dialog)

</p>

> Headless accessible modal for Alpine.js — a registry of dialogs where each id carries its own open state, ARIA wiring and close rules, plus an `x-dialog` directive that binds and releases a panel for you, built on `@ailura/alpinejs-core`. The controller is framework-agnostic; the plugin exposes it as `$store.dialog`.

**This package holds no focus management.** It never moves focus into the panel
and never returns it to the trigger, and there is no focus trap. `open()`'s
`trigger` option _records_ the element so you can act on it. See
[Limitations](#limitations).

## Installation

```sh
pnpm add @ailura/alpinejs-dialog alpinejs
# or
npm install @ailura/alpinejs-dialog alpinejs
```

Requires `alpinejs@^3.0.0` as peer. `@ailura/alpinejs-core` is a **peer
dependency**, not a dependency: no package in this toolkit has a
`dependencies` block, so the host installs it too.

## Usage

### 1. Standalone (framework-agnostic)

```ts
import { createDialogController } from "@ailura/alpinejs-dialog";

const ctrl = createDialogController({ defaultCloseOnEscape: true });
ctrl.create("settings", { labelledBy: "settings-title", describedBy: "settings-desc" });

ctrl.on("open", ({ instanceId, source }) => console.log(instanceId, source));
ctrl.on("close", ({ instanceId, source }) => console.log(instanceId, source));

ctrl.open("settings", { trigger: document.querySelector("#open") });
ctrl.isOpen("settings"); // true
ctrl.dialogProps("settings");
// → { role: 'dialog', 'aria-modal': true, 'aria-labelledby': 'settings-title', 'aria-describedby': 'settings-desc' }
ctrl.close("settings");

// ctrl.destroy() when done — every mutator after it is a silent no-op
```

### 2. Alpine

The plugin registers `$store.dialog` and one directive, `x-dialog`. `.panel` is
a **modifier** of that same directive, not a second name — Alpine parses
`x-dialog.panel` as type `dialog` with modifiers `['panel']`, so a
`dialog-panel` key would never match the markup.

```ts
import Alpine from "alpinejs";
import dialogPlugin from "@ailura/alpinejs-dialog";

Alpine.plugin(dialogPlugin());
Alpine.start();
```

```html
<button type="button" @click="$store.dialog.open('settings', { trigger: $el })">
  Open settings
</button>

<template x-teleport="#overlay-root">
  <div
    x-show="$store.dialog.isOpen('settings')"
    x-cloak
    x-transition.duration.150ms
    class="fixed inset-0 flex items-center justify-center p-4"
  >
    <!-- presentational only: the .panel modifier owns the outside click -->
    <div class="absolute inset-0 bg-black/50" aria-hidden="true"></div>

    <!-- x-dialog.panel binds this element as the container AND closes on an
         outside click. It creates the instance if the id is new, and releases
         the binding when Alpine removes the element. Without .panel it only
         binds, and you wire handleOutsideClick yourself. -->
    <div
      x-dialog.panel="'settings'"
      class="relative z-10 w-full max-w-md rounded-lg border p-6"
      x-bind="$store.dialog.dialogProps('settings')"
    >
      <h2 id="settings-title">Settings</h2>
      <p id="settings-desc" class="text-sm">Escape, the backdrop, or the button closes it.</p>
      <button type="button" @click="$store.dialog.close('settings')">Close</button>
    </div>
  </div>
</template>

<!-- Escape is yours to route: the directive does not listen for keys. -->
<div @keydown.window="$store.dialog.handleKeydown('settings', $event)"></div>
```

`x-dialog` accepts three shapes, the same ones `x-selection` reads:

| Expression                                            | Meaning                                                                     |
| ----------------------------------------------------- | --------------------------------------------------------------------------- |
| `x-dialog="'settings'"`                               | an explicit id                                                              |
| `x-dialog="{ id: 'settings', closeOnEscape: false }"` | the options bag, with an optional `id`                                      |
| `x-dialog` (no expression)                            | **no dialog** — the binding is released, rather than a dialog with defaults |

An options bag with no `id` gets a generated one, so a single-element dialog
works without naming it. `.panel` is the only modifier.

## API

### Exports

| Export                     | Description                                                                                                                                     | Type       |
| -------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| `DialogController`         | Framework-agnostic controller class — owns the dialog registry, emits `open`/`close`/`change`                                                   | `class`    |
| `createDialogController`   | Factory — `createDialogController({ id?, defaultCloseOnEscape?, defaultCloseOnOutsideClick? }) => DialogController`; mounts it                  | `function` |
| `dialogPlugin`             | `Alpine.plugin()` factory — `dialogPlugin({ id?, closeOnEscape?, closeOnOutsideClick?, storeKey?, directiveKey? }) => PluginCallback`           | `function` |
| `DEFAULT_DIALOG_STORE_KEY` | Default `$store` key — `"dialog"`                                                                                                               | `string`   |
| `DialogControllerOptions`  | `{ id?, defaultCloseOnEscape?, defaultCloseOnOutsideClick? }` — controller id and the defaults instances inherit                                | `type`     |
| `CreateDialogOptions`      | Plugin options — the two defaults, plus `storeKey?` and `directiveKey?`                                                                         | `type`     |
| `DialogOptions`            | Per-dialog options — `{ closeOnEscape?, closeOnOutsideClick?, labelledBy?, describedBy?, onOpen?, onClose? }`                                   | `type`     |
| `DialogOpenOptions`        | Per-`open()` options — `{ trigger?, labelledBy?, describedBy? }`                                                                                | `type`     |
| `DialogInstance`           | One dialog's projected state — `{ open, closeOnEscape, closeOnOutsideClick, labelledBy?, describedBy?, trigger, container, onOpen?, onClose? }` | `type`     |
| `DialogChangeSource`       | Discriminator — `'user' \| 'initialization'`                                                                                                    | `type`     |
| `DialogOpenDetail`         | `open` payload — `{ instanceId, source }`                                                                                                       | `type`     |
| `DialogCloseDetail`        | `close` payload — `{ instanceId, source }`                                                                                                      | `type`     |
| `DialogChangeDetail`       | `change` payload — `{ instanceId? }`, the adapter-sync signal                                                                                   | `type`     |
| `DialogStore`              | The Alpine-facing surface, i.e. everything reachable as `$store.dialog.*`                                                                       | `type`     |
| `DialogAlpine`             | Typed view of the `Alpine` instance the plugin uses                                                                                             | `type`     |
| `DialogPluginCallback`     | `Alpine.plugin()` callback signature — `(alpine: Alpine) => void`                                                                               | `type`     |
| `DialogEvents`             | Event map for `controller.on('open' \| 'close' \| 'change', …)`                                                                                 | `type`     |

`DEFAULT_DIALOG_DIRECTIVE_KEY` (`"dialog"`) is declared in `types.ts` but is
**not** re-exported from the package entrypoint, so `directiveKey` is the only
way to rename the directive. `DialogController` also exposes `hasInstance(id)`
and `snapshotInstances()`; neither is on the store.

### Store API

```ts
// Lifecycle
$store.dialog.create("settings", { closeOnEscape: false });
$store.dialog.destroy("settings"); // one dialog
$store.dialog.destroy(); // the whole controller
$store.dialog.destroyAll(); // every dialog, controller still usable

// Open state — `open()` creates the instance if it is missing
$store.dialog.open("settings", { trigger: $el, labelledBy: "settings-title" });
$store.dialog.close("settings");
$store.dialog.toggle("settings");
$store.dialog.isOpen("settings"); // boolean

// Element binding — `x-dialog` does this; only hand-wire if you must
$store.dialog.bindContainer("settings", $el);
$store.dialog.bindContainer("settings", null); // release

// Dismissal
$store.dialog.handleKeydown("settings", $event); // Escape
$store.dialog.handleOutsideClick("settings", $event); // click outside the container

// ARIA
$store.dialog.dialogProps("settings");
// → { role: 'dialog', 'aria-modal': true, 'aria-labelledby', 'aria-describedby' }
```

| Method                       | Description                                                                                                                                                                    |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `create(id, options?)`       | Creates the dialog, filling `closeOnEscape`/`closeOnOutsideClick` from the controller defaults. Re-creating an id **replaces** it, and a replaced open dialog is closed first. |
| `open(id, options?)`         | Opens, creating the instance if none exists. No-op if already open — which is what makes `onOpen` a once-per-open hook. `options.trigger` is stored, never focused.            |
| `close(id)`                  | Closes. No-op if not open.                                                                                                                                                     |
| `toggle(id, options?)`       | `close()` when open, `open()` otherwise.                                                                                                                                       |
| `isOpen(id)`                 | `false` for anything unregistered.                                                                                                                                             |
| `destroy(id)`                | Closes the dialog if open, drops it, emits `change`.                                                                                                                           |
| `destroy()`                  | Drops every dialog **and** tears down the controller — later mutations are silent no-ops. Prefer `destroyAll()`.                                                               |
| `destroyAll()`               | Drops every dialog, controller still usable.                                                                                                                                   |
| `bindContainer(id, el)`      | Records the panel element for `handleOutsideClick()`. `null` releases it. Does **not** manage focus — see the note below.                                                      |
| `handleKeydown(id, event)`   | `Escape` closes when the dialog is open and its own `closeOnEscape` is on. Nothing else is handled and no focus is trapped.                                                    |
| `handleOutsideClick(id, ev)` | Closes when the click target is outside the bound container. No-op without a container.                                                                                        |
| `dialogProps(id)`            | `role="dialog"`, `aria-modal="true"` and the labelled/described pair. All fixed for the element's life, so safe in one `x-bind`.                                               |
| `instances`                  | `Record<id, DialogInstance>` — the read-model, reactive. `instances[id].trigger` is where the element you passed to `open()` ends up.                                          |

`bindContainer()` is also the natural hook for your own focus work — it is the
one place that knows the panel element exists.

### Options

Plugin-level — the two close rules are controller-wide **defaults** that every
instance inherits unless `create()` overrides them:

```ts
interface CreateDialogOptions {
  id?: string; // controller id — defaults to generateId('dialog')
  closeOnEscape?: boolean; // default true
  closeOnOutsideClick?: boolean; // default true
  storeKey?: string; // $store key — default DEFAULT_DIALOG_STORE_KEY ("dialog")
  directiveKey?: string; // x-directive name — default "dialog"
}
```

Per-dialog, passed to `create()` (or carried in the `x-dialog` options bag):

```ts
type DialogOptions = {
  closeOnEscape?: boolean; // inherits the controller default (true)
  closeOnOutsideClick?: boolean; // inherits the controller default (true)
  labelledBy?: string; // no default
  describedBy?: string; // no default
  onOpen?: () => void; // no default
  onClose?: () => void; // no default
};
```

Per-`open()`:

```ts
type DialogOpenOptions = {
  trigger?: HTMLElement | null; // recorded, never focused
  labelledBy?: string; // overrides the instance's for this open and after
  describedBy?: string; // overrides the instance's for this open and after
};
```

| Option                | Default    | Effect                                                                                                       |
| --------------------- | ---------- | ------------------------------------------------------------------------------------------------------------ |
| `closeOnEscape`       | `true`     | Whether `handleKeydown()`'s `Escape` closes **this** dialog. Per instance, so two dialogs can disagree.      |
| `closeOnOutsideClick` | `true`     | Whether a click outside the bound container closes **this** dialog. Still needs the container.               |
| `labelledBy`          | —          | Element id for `aria-labelledby`. Undefined means the attribute is omitted, not empty.                       |
| `describedBy`         | —          | Element id for `aria-describedby`. Same.                                                                     |
| `onOpen` / `onClose`  | —          | Called from `open()`/`close()` — the hook the demo uses for scroll lock. Never called on a no-op open/close. |
| `storeKey`            | `'dialog'` | `$store` key the plugin registers under.                                                                     |
| `directiveKey`        | `'dialog'` | Directive name, without the `x-` prefix.                                                                     |

### Avoiding name collisions

```ts
Alpine.plugin(dialogPlugin({ storeKey: "modal" })); // → $store.modal
```

This package registers no magic, so `storeKey` is the only name to move. The
exported constant `DEFAULT_DIALOG_STORE_KEY` keeps the default discoverable.

## Events

```ts
import type { DialogCloseDetail, DialogOpenDetail } from "@ailura/alpinejs-dialog";

ctrl.on("open", (detail: DialogOpenDetail) => {
  detail.instanceId;
  detail.source; // 'user'
});
ctrl.on("close", (detail: DialogCloseDetail) => {
  detail.instanceId;
  detail.source; // 'user'
});
ctrl.on("change", (detail) => detail.instanceId); // adapter sync; emitted by all three
```

`source` is `'user'` for every path that reaches `open()`/`close()` — a click, a
key, an outside click — and `'initialization'` is declared but never emitted by
the current code. `change` is the odd one out: its `instanceId` is optional and
it fires for `create`, `destroy` and `bindContainer` too, so it is a
"something moved" signal rather than an open/closed one.

## Focus management is yours

The package is honest about the boundary: it owns **state**, not the keyboard.

- It never calls `focus()`. Opening a dialog leaves focus wherever it was —
  usually on the trigger that is now behind a backdrop.
- It never restores focus. Closing a dialog does not put focus back.
- It does not trap `Tab` inside the panel, and it does not set `inert` on the
  rest of the page.

Wiring it yourself is three lines, and `onOpen`/`onClose` are the right place:

```ts
$store.dialog.create("settings", {
  onOpen() {
    $store.dialog.instances.settings?.container?.querySelector<HTMLElement>("[autofocus]")?.focus();
  },
  onClose() {
    document.querySelector<HTMLElement>("#settings-trigger")?.focus();
  },
});
```

## SSR

> State is in-memory and nothing reads `window` or `document` at import time, so
> the package is safe to import during SSR. Every dialog is closed by default, so
> render your markup in a closed state (`x-show` + `x-cloak`) and drive
> visibility from the store once the client is up. The `x-dialog` directive binds
> an element and needs that element to exist, so it is client-only by nature.

## Accessibility

- Panel, via `dialogProps()`: `role="dialog"`, `aria-modal="true"`,
  `aria-labelledby`, `aria-describedby` — all four fixed for the element's life,
  so one `x-bind` is enough
- Panel visibility, via `isOpen()` — bind it yourself with `x-show`/`x-cloak`;
  the package sets no `hidden` and no `inert`
- Keyboard, via `handleKeydown()`: `Escape` only, and only when the dialog is
  open and its own `closeOnEscape` is on. **No focus trap**, no `Tab`
  containment, no initial focus, no focus restoration
- Dismissal, via `handleOutsideClick()` (or `x-dialog.panel`): a click whose
  target is outside the bound container. Needs a bound container
- Reference: [WAI-ARIA Authoring Practices — Dialog (Modal) pattern](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/)

## Integration

- **@ailura/alpinejs-scroll** — the scroll lock is _not_ in this package. Wire
  `lock()`/`unlock()` from `onOpen`/`onClose`; defer the unlock past your leave
  transition or the body width shifts mid-animation
- **@ailura/alpinejs-overlay** — `overlay.zIndexOf('dialog', id)` gives a
  teleported panel its place in the shared stack, and the `#overlay-root` portal
  it teleports into
- **@alpinejs/focus** — if you want a trap, the plugin ecosystem has one; this
  package deliberately does not duplicate it

## Limitations

- **No focus management, at all.** No initial focus, no restoration, no trap.
  `open({ trigger })` records the element and does nothing else with it. This is
  the single largest thing to know before using the package.
- **No scroll lock.** `closeOnOutsideClick` is a rule, not a lock: the page
  behind the dialog scrolls freely.
- **No `inert`, no `aria-hidden` on the background.** `aria-modal="true"` is an
  assertion the package makes on the dialog's behalf; making it true is the
  caller's job.
- **The store has no `register()`.** The call is `create()`. Any doc or snippet
  that says `register('settings')` for this package is wrong.
- **`handleOutsideClick()` is a silent no-op without `bindContainer()`.** A
  hand-wired backdrop that forgets the binding looks exactly like one that does
  nothing. `x-dialog.panel` does both.
- **`handleKeydown()` must be routed by you.** The directive does not listen for
  keys, so a `x-dialog` used without a `@keydown` binding will not close on
  `Escape`.
- **`destroy()` with no argument tears down the controller.** Use `destroyAll()`
  to keep it alive.
- **Stack and z-index are consumer-owned.**
- `@ailura/alpinejs-ui` is declared as a `peerDependency` and listed in
  `neverBundle`, but nothing in `src/` imports it. The peer is currently
  unnecessary; it costs an install for no reason.

## Size

`4.42 kB raw / 1.64 kB gzip` · budget `3 kB` · externalized peers: `alpinejs`, `@ailura/alpinejs-core`, `@ailura/alpinejs-ui` · `size-limit` + `publint` + `attw` verified.

## Architecture

[Features layer](../../ARCHITECTURE.md) — controllers own state, Alpine owns reactivity. See canon, guards, and SSR rules in [ARCHITECTURE.md](../../ARCHITECTURE.md).

## Testing

```sh
pnpm test              # vp test (happy-dom)
pnpm run typecheck     # tsc --noEmit
```

Uses `@ailura/alpinejs-testing` — `html`/`mount`/`settled`/`start`/`resume`/`reset`. See [ARCHITECTURE.md §8](../../ARCHITECTURE.md).

## License

MIT
