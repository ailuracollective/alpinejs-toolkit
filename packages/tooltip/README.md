# @ailura/alpinejs-tooltip

<p align="center">

[![bundlephobia minzip](https://badgen.net/bundlephobia/minzip/@ailura/alpinejs-tooltip)](https://bundlephobia.com/package/@ailura/alpinejs-tooltip)

</p>

> Headless tooltip behaviour for Alpine.js — hover/focus triggers with open and close delays, `Escape` dismissal, a scroll-away close that no hand-wired `@mouseenter`/`@mouseleave` pair can do, and an `x-tooltip` directive that binds and releases a trigger for you, built on `@ailura/alpinejs-core`. The controller is framework-agnostic; the plugin exposes it as `$store.tooltip` and `$tooltip`.

**This package generates no ARIA.** There is no `tooltipProps()`, no
`aria-describedby`, no `role="tooltip"`, and no `id` pairing between trigger and
panel. Those are yours. See [Limitations](#limitations).

## Installation

```sh
pnpm add @ailura/alpinejs-tooltip alpinejs
# or
npm install @ailura/alpinejs-tooltip alpinejs
```

Requires `alpinejs@^3.0.0` as peer. `@ailura/alpinejs-core` is a **peer
dependency**, not a dependency: no package in this toolkit has a
`dependencies` block, so the host installs it too.

## Usage

### 1. Standalone (framework-agnostic)

```ts
import { createTooltipController } from "@ailura/alpinejs-tooltip";

const ctrl = createTooltipController(); // mounted; mutators are live
ctrl.create("save-hint", { openDelay: 200, closeDelay: 80, onOpen: () => {} });

const trigger = document.querySelector<HTMLElement>("#save")!;
ctrl.bindTrigger("save-hint", trigger); // hover + focus + the scroll-away check
ctrl.isOpen("save-hint"); // false

ctrl.on("change", ({ instanceId, open, source }) => console.log(instanceId, open, source));

// ctrl.destroy('save-hint') when the trigger goes away — releases the five
// listeners, both timers and the registry entry
```

### 2. Alpine

The plugin registers `$store.tooltip`, the `$tooltip` magic (the same object),
and one directive, `x-tooltip`.

```ts
import Alpine from "alpinejs";
import tooltipPlugin from "@ailura/alpinejs-tooltip";

Alpine.plugin(tooltipPlugin());
Alpine.start();
```

```html
<button type="button" id="save" x-tooltip="'save-hint'">Save</button>

<!-- x-tooltip creates the instance if the id is new, and releases the whole
     binding when Alpine removes the trigger. The ARIA is yours: the package
     never writes role="tooltip" or aria-describedby. -->
<div id="save-hint" role="tooltip" x-show="$tooltip.isOpen('save-hint')" x-cloak>
  Only drafts can be saved
</div>

<!-- Escape is yours to route: the directive listens to no keys. -->
<button type="button" @keydown.escape="$tooltip.handleKeydown('save-hint', $event)">Save</button>
```

`x-tooltip` accepts three shapes, the same ones `x-selection` reads:

| Expression                                        | Meaning                                                                       |
| ------------------------------------------------- | ----------------------------------------------------------------------------- |
| `x-tooltip="'save-hint'"`                         | an explicit id                                                                |
| `x-tooltip="{ id: 'save-hint', openDelay: 300 }"` | the options bag, with an optional `id`                                        |
| `x-tooltip.sticky="'save-hint'"`                  | the same, with `closeOnScrollAway: false`                                     |
| `x-tooltip` (no expression)                       | **no tooltip** — the binding is released, rather than a tooltip with defaults |

An options bag with no `id` gets a generated one. `.sticky` is the only
modifier, and it exists because `closeOnScrollAway` is the one option with a
natural on/off spelling in markup.

## API

### Exports

| Export                          | Description                                                                                                                    | Type       |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ | ---------- |
| `TooltipController`             | Framework-agnostic controller class — owns the tooltip registry, emits `change`                                                | `class`    |
| `createTooltipController`       | Factory — `createTooltipController({ id? }) => TooltipController`; mounts it                                                   | `function` |
| `tooltipPlugin`                 | `Alpine.plugin()` factory — `tooltipPlugin({ id?, storeKey?, magicKey?, directiveKey? }) => PluginCallback`                    | `function` |
| `DEFAULT_TOOLTIP_STORE_KEY`     | Default `$store` key — `"tooltip"`                                                                                             | `string`   |
| `DEFAULT_TOOLTIP_MAGIC_KEY`     | Default `$tooltip` magic key — `"tooltip"`                                                                                     | `string`   |
| `DEFAULT_TOOLTIP_DIRECTIVE_KEY` | Default `x-tooltip` directive key — `"tooltip"`                                                                                | `string`   |
| `TooltipControllerOptions`      | `{ id? }` — controller id, generated by `generateId('tooltip')` when absent                                                    | `type`     |
| `CreateTooltipOptions`          | Plugin options — `{ id?, storeKey?, magicKey?, directiveKey? }`                                                                | `type`     |
| `TooltipOptions`                | Per-tooltip options — `{ openDelay?, closeDelay?, closeOnScrollAway?, onOpen?, onClose? }`                                     | `type`     |
| `TooltipInstance`               | One tooltip's projected state — `{ open, openDelay, closeDelay, openTimer, closeTimer, closeOnScrollAway, onOpen?, onClose? }` | `type`     |
| `TooltipChangeSource`           | Discriminator — `'user' \| 'initialization'`                                                                                   | `type`     |
| `TooltipChangeDetail`           | `change` payload — `{ instanceId, open, source }`                                                                              | `type`     |
| `TooltipStore`                  | The Alpine-facing surface, i.e. everything reachable as `$store.tooltip.*` / `$tooltip.*`                                      | `type`     |
| `TooltipAlpine`                 | Typed view of the `Alpine` instance the plugin uses                                                                            | `type`     |
| `TooltipPluginCallback`         | `Alpine.plugin()` callback signature — `(alpine: Alpine) => void`                                                              | `type`     |
| `TooltipEvents`                 | Event map for `controller.on('change', …)` — one key, one payload                                                              | `type`     |

`TooltipController` also exposes `hasInstance(id)` and `snapshotInstances()` for
adapter sync; neither is on the store.

### Store API

```ts
// Lifecycle
$store.tooltip.create("save-hint", { openDelay: 200, closeDelay: 80 });
$store.tooltip.destroy("save-hint"); // one tooltip — what x-tooltip's cleanup calls
$store.tooltip.destroy(); // the whole controller, every instance with it
$store.tooltip.destroyAll(); // every instance, controller still usable

// Open state — `open`/`close` honour the delays
$store.tooltip.open("save-hint");
$store.tooltip.close("save-hint");
$store.tooltip.toggle("save-hint");
$store.tooltip.isOpen("save-hint"); // boolean

// Trigger binding
$store.tooltip.bindTrigger("save-hint", $el);
$store.tooltip.unbindTrigger("save-hint");

// Named aliases for the handlers bindTrigger replaces
$store.tooltip.showOnHover("save-hint"); // → open()
$store.tooltip.hideOnHover("save-hint"); // → close()
$store.tooltip.showOnFocus("save-hint"); // → open()
$store.tooltip.hideOnFocus("save-hint"); // → close()

// Dismissal
$store.tooltip.handleKeydown("save-hint", $event); // Escape
```

| Method                                                        | Description                                                                                                                                                                                                                                     |
| ------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `create(id, options?)`                                        | Creates a tooltip, or **replaces the options of an existing one** — a second `create` on a live id is what a component does when it re-evaluates, and a merged-in old delay would be a silently wrong tooltip. Both pending timers are cleared. |
| `open(id)`                                                    | Opens after `openDelay` ms (`0` = immediately), cancelling any pending close first. **Creates the instance if none exists.**                                                                                                                    |
| `close(id)`                                                   | Closes after `closeDelay` ms, cancelling any pending open. No-op for an unregistered id.                                                                                                                                                        |
| `toggle(id)`                                                  | `close()` when open, `open()` otherwise.                                                                                                                                                                                                        |
| `isOpen(id)`                                                  | `false` for anything unregistered.                                                                                                                                                                                                              |
| `bindTrigger(id, el)`                                         | Attaches `mouseenter`/`mousemove`/`mouseleave`/`focus`/`blur`, records the last pointer position, and starts the window scroll watch. **Creates the instance if none exists**, and replaces a previous binding for the same id.                 |
| `unbindTrigger(id)`                                           | Removes all five listeners, drops the pointer record, and releases the window scroll watch once no trigger is left. Idempotent.                                                                                                                 |
| `showOnHover` / `hideOnHover` / `showOnFocus` / `hideOnFocus` | Plain `open()` / `close()`. They carry **no pointer position**, so a tooltip driven this way is never closed by a scroll.                                                                                                                       |
| `handleKeydown(id, ev)`                                       | `Escape` closes, when open. Nothing routes it for you.                                                                                                                                                                                          |
| `destroy(id)`                                                 | Releases one instance: listeners, both timers, the registry entry. Idempotent. This is what `x-tooltip`'s cleanup calls.                                                                                                                        |
| `destroy()`                                                   | Releases every trigger, drops the window scroll listener, clears every timer and instance, then tears down the controller. **Nothing calls it automatically.**                                                                                  |
| `destroyAll()`                                                | Drops every instance but leaves the controller usable. **The window scroll listener stays** if a trigger is still bound.                                                                                                                        |
| `instances`                                                   | `Record<id, TooltipInstance>` — the read-model, reactive.                                                                                                                                                                                       |

### Options

Plugin-level:

```ts
interface CreateTooltipOptions {
  id?: string; // controller id — defaults to generateId('tooltip')
  storeKey?: string; // $store key — default DEFAULT_TOOLTIP_STORE_KEY ("tooltip")
  magicKey?: string; // $tooltip magic key — default DEFAULT_TOOLTIP_MAGIC_KEY ("tooltip")
  directiveKey?: string; // x-directive name — default "tooltip"
}
```

Per-tooltip, passed to `create()` (or carried in the `x-tooltip` options bag):

```ts
type TooltipOptions = {
  openDelay?: number; // ms, default 0
  closeDelay?: number; // ms, default 0
  closeOnScrollAway?: boolean; // default TRUE
  onOpen?: () => void; // no default
  onClose?: () => void; // no default
};
```

| Option               | Default     | Effect                                                                                                                                                                                              |
| -------------------- | ----------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `openDelay`          | `0`         | Milliseconds before `open()` actually opens. Implemented as `setTimeout`, so it is _not_ a transition and does not block anything.                                                                  |
| `closeDelay`         | `0`         | Milliseconds before `close()` closes. The grace window that stops a tooltip flickering when the pointer crosses a gap between two triggers.                                                         |
| `closeOnScrollAway`  | **`true`**  | Close when scrolling moves the trigger out from under the pointer. Opt out with `x-tooltip.sticky` or `closeOnScrollAway: false`. **The check only ever closes** — scrolling back does not re-open. |
| `onOpen` / `onClose` | —           | Called once the delay has elapsed, not when it was requested.                                                                                                                                       |
| `storeKey`           | `'tooltip'` | `$store` key. Renaming it renames `magicKey` too unless `magicKey` is given explicitly.                                                                                                             |
| `magicKey`           | `'tooltip'` | `$tooltip` magic key. There is no way to register the store without it.                                                                                                                             |
| `directiveKey`       | `'tooltip'` | Directive name, without the `x-` prefix.                                                                                                                                                            |

### Avoiding name collisions

```ts
Alpine.plugin(tooltipPlugin({ storeKey: "hint" })); // → $store.hint and $hint
```

`storeKey` is the only name you need: `resolvePluginKeys` makes `magicKey` fall
back to `storeKey` before the package default, so one option moves both
surfaces. `DEFAULT_TOOLTIP_STORE_KEY` and `DEFAULT_TOOLTIP_MAGIC_KEY` keep the
defaults discoverable from TypeScript.

### Events

```ts
import type { TooltipChangeDetail } from "@ailura/alpinejs-tooltip";

ctrl.on("change", (detail: TooltipChangeDetail) => {
  detail.instanceId;
  detail.open; // the resulting state
  detail.source; // 'user' | 'initialization'
});
```

One event, one payload, and it fires for _every_ transition including the ones
that were only requested: `open()` emits `source: 'user'` with `open: true` when
the delay has actually elapsed. `create()` and `destroy(id)` emit
`source: 'initialization'`.

## Why the scroll check exists

This is the behaviour a hand-wired `@mouseenter`/`@mouseleave` pair cannot
express, and it is the reason `bindTrigger` (and `x-tooltip`) exist.

The browser only re-dispatches pointer events on **real movement**. Scroll a
trigger out from under a stationary cursor and no `mouseleave` is ever fired,
so a hand-wired tooltip stays open over a trigger the user can no longer see,
with nothing left to close it. `bindTrigger` records the last known pointer
position on every `mousemove` and a single shared window `scroll` listener
(capture, passive) closes any open tooltip whose trigger no longer contains it.

Two details make it safe:

- The check **only ever closes.** Scrolling back does not re-open, because
  re-opening is a real `mouseenter`'s job and a scroll handler that could open
  would fire it repeatedly for as long as the page moved.
- It uses `getBoundingClientRect()` rather than `document.elementFromPoint()`,
  which is exact for "is the trigger under the pointer" and immune to the
  tooltip itself swallowing the hit test while it is teleported into a fixed
  portal and painted on top.

The window listener is registered once, on the first trigger, and released when
the last one unbinds.

## ARIA is yours

The package owns the _behaviour_ of a tooltip and none of its _wiring_. It
never writes:

- `role="tooltip"` on the panel
- `aria-describedby` on the trigger
- an `id` on either, or a pairing between them

Wiring it is three attributes, and the pairing has to be manual because the
package does not generate ids:

```html
<button type="button" id="save" x-tooltip="'save-hint'" aria-describedby="save-hint">Save</button>

<div id="save-hint" role="tooltip" x-show="$tooltip.isOpen('save-hint')" x-cloak>
  Only drafts can be saved
</div>
```

`aria-describedby` does not have to track the open state — unlike
`aria-expanded`, it describes what the element _is_, not whether the
description is showing.

## SSR

> State is in-memory, and the only `window` access is `safeWindow()` inside the
> scroll watch, which is created lazily on the first `bindTrigger` and no-ops
> when there is no window. Nothing reads `window` or `document` at import time,
> so the package is safe to import during SSR. Every tooltip is closed by
> default, so render the panel hidden (`x-show` + `x-cloak`) and let the store
> drive visibility on the client. The `x-tooltip` directive binds an element
> and is client-only by nature.

## Accessibility

- **Nothing is generated.** No `role`, no `aria-describedby`, no ids. See
  [ARIA is yours](#aria-is-yours).
- Triggers: `bindTrigger` attaches `focus` and `blur` as well as the hover pair,
  so a keyboard user gets the tooltip on focus — which is the behaviour the
  pattern requires and the reason `hideOnHover`/`showOnHover` alone are not
  enough
- Keyboard, via `handleKeydown()`: `Escape` dismisses, when open. **You route
  it** — `x-tooltip` listens to no keys
- Focus: not moved by the package, in either direction. A tooltip shown on focus
  does not steal focus, and closing does not restore it
- `closeOnScrollAway` is a pointer-only heuristic; a tooltip opened by focus has
  no recorded pointer and is skipped by the scroll loop entirely
- Reference: [WAI-ARIA Authoring Practices — Tooltip pattern](https://www.w3.org/WAI/ARIA/apg/patterns/tooltip/)

## Integration

- **@ailura/alpinejs-overlay** — `overlay.zIndexOf('tooltip', id)` gives a
  teleported panel its place in the shared stack, and the `#overlay-root` portal
  to teleport into. Recommended: a teleported panel escapes the trigger's
  stacking context, which is the usual reason a tooltip ends up behind its own
  page
- **@alpinejs/anchor** — the positioning. `x-anchor.top.fixed.noflip.offset.8`
  is the usual pairing with a teleported panel

## Limitations

- **No ARIA at all.** No `tooltipProps()`, no `role="tooltip"`, no
  `aria-describedby`, no generated ids. See [ARIA is yours](#aria-is-yours).
- **The open delay is not cancellable by geometry.** `openDelay` is a
  `setTimeout` and the callback never re-checks whether the pointer is still
  over the trigger, so with `closeOnScrollAway: false` a trigger that scrolls
  away during its open delay will still open, and stay. Call `close()` from
  `onOpen` if that matters.
- **`showOnHover`/`hideOnHover`/`showOnFocus`/`hideOnFocus` are weaker than
  `bindTrigger`.** They are plain `open()`/`close()` and record no pointer
  position, so the scroll check never applies to them. Use `bindTrigger` or
  `x-tooltip`.
- **`x-tooltip` listens to no keys.** `Escape` needs
  `@keydown.escape="$tooltip.handleKeydown(id, $event)"` on the trigger.
- **`.sticky` is ignored if the host already created the id.** The directive
  calls `create()` only when `hasInstance(id)` is false, so a `x-tooltip.sticky`
  pointing at an id your code created with `closeOnScrollAway: true` keeps that
  value. Create the id with the option you want, or let the directive own it.
- **No positioning and no portal.** Both are consumer-owned, normally
  `@alpinejs/anchor` + `x-teleport` into `#overlay-root`.
- **No grouped delays or a "one tooltip at a time" mode.** Several tooltips can
  be open at once; there is no shared hover-intent coordinator.
- **`pnpm run typecheck` currently fails on this package.**
  `packages/tooltip/src/controller.ts:370` — `destroy: (id) => this.destroy(id)`
  is not assignable to `TooltipStore['destroy']`, which declares two overloads
  (`destroy(id)` and `destroy()`) and therefore requires an implementation that
  satisfies both arities. The four sibling packages write
  `destroy: (id?: string) => …`; this one dropped the `?`. It is a
  pre-existing failure at `HEAD`, not a regression, and it is a one-character
  fix that this audit deliberately does not apply.
- `@ailura/alpinejs-ui` is declared as a `peerDependency` and listed in
  `neverBundle`, but nothing in `src/` imports it. The peer is currently
  unnecessary; it costs an install for no reason.

## Size

`5.54 kB raw / 2.02 kB gzip` · budget `2.5 kB` · externalized peers: `alpinejs`, `@ailura/alpinejs-core`, `@ailura/alpinejs-ui` · `size-limit` + `publint` + `attw` verified.

## Architecture

[Features layer](../../ARCHITECTURE.md) — controllers own state, Alpine owns reactivity. See canon, guards, and SSR rules in [ARCHITECTURE.md](../../ARCHITECTURE.md).

## Testing

```sh
pnpm test              # vp test (happy-dom) — 26 tests, green
pnpm run typecheck     # tsc --noEmit — currently fails, see Limitations
```

Uses `@ailura/alpinejs-testing` — `html`/`mount`/`settled`/`start`/`resume`/`reset`. See [ARCHITECTURE.md §8](../../ARCHITECTURE.md).

## License

MIT
