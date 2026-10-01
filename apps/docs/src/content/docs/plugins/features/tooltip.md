---
title: Tooltip
---

@ailura/alpinejs-tooltip

A tooltip with hover and focus handling, an open delay, and a close delay. The plugin
owns the open state and the timing; you write the trigger and the bubble.

## Install

```sh
pnpm add alpinejs @ailura/alpinejs-tooltip
```

## Register the plugin

Do this once, before `Alpine.start()`.

```ts
import Alpine from "alpinejs";
import tooltipPlugin from "@ailura/alpinejs-tooltip";

Alpine.plugin(tooltipPlugin());

Alpine.start();
```

That registers a `tooltip` store, so everything below is reachable at `$store.tooltip`.

## Minimal example

A hover and focus tooltip with a 200ms open delay, so it does not flash while the
pointer travels across the page.

```html
<div
  x-data="{ id: 'save-hint' }"
  x-init="$store.tooltip.register(id, { openDelay: 200 })"
  @keydown="$store.tooltip.handleKeydown(id, $event)"
>
  <button
    @mouseenter="$store.tooltip.showOnHover(id)"
    @mouseleave="$store.tooltip.hideOnHover(id)"
    @focus="$store.tooltip.showOnFocus(id)"
    @blur="$store.tooltip.hideOnFocus(id)"
  >
    Save
  </button>

  <span x-show="$store.tooltip.isOpen(id)" role="tooltip">Saved to your account.</span>
</div>
```

The `showOn*` / `hideOn*` pairs are the same calls as `open()` / `close()` under names
that say where they belong in the markup. All six honour `openDelay` and `closeDelay` —
there is no way to skip the delay except registering the instance with `0`.

## Variants

**Give the tooltip a close delay.** The gap between the pointer leaving the trigger
and the tooltip disappearing, so moving onto the bubble does not dismiss it.

```js
$store.tooltip.register(id, { closeDelay: 120 });
```

**Skip the delay entirely.** For a control that is already on screen and obvious, an
instant tooltip reads better than a delayed one.

```js
$store.tooltip.register(id, { openDelay: 0, closeDelay: 0 });
```

**React to open and close.** Useful for measuring or for pausing animations.

```js
$store.tooltip.register(id, {
  onOpen: () => track("tooltip_shown"),
  onClose: () => track("tooltip_dismissed"),
});
```

**Drive it from code.** When a tooltip has to open on something other than hover,
`open()` and `toggle()` are the calls, and they go through the same delays as the hover
pair.

```js
$store.tooltip.open(id);
$store.tooltip.toggle(id);
```

## API reference

| Name                                      | Type     | Purpose                                                                      |
| ----------------------------------------- | -------- | ---------------------------------------------------------------------------- |
| `$store.tooltip.register(id, options?)`   | `method` | Create an instance. Options: `openDelay`, `closeDelay`, `onOpen`, `onClose`. |
| `$store.tooltip.unregister(id)`           | `method` | Drop an instance.                                                            |
| `$store.tooltip.open(id)` / `close(id)`   | `method` | Open or close, honouring `openDelay` / `closeDelay`.                         |
| `$store.tooltip.toggle(id)`               | `method` | Open if closed, close if open; the delays apply.                             |
| `$store.tooltip.isOpen(id)`               | `method` | Whether it is open.                                                          |
| `$store.tooltip.showOnHover(id)`          | `method` | Alias of `open(id)`, named for a `@mouseenter` handler.                      |
| `$store.tooltip.hideOnHover(id)`          | `method` | Alias of `close(id)`, named for a `@mouseleave` handler.                     |
| `$store.tooltip.showOnFocus(id)`          | `method` | Alias of `open(id)`, named for a `@focus` handler.                           |
| `$store.tooltip.hideOnFocus(id)`          | `method` | Alias of `close(id)`, named for a `@blur` handler.                           |
| `$store.tooltip.handleKeydown(id, event)` | `method` | Escape-to-dismiss.                                                           |
| `$store.tooltip.instances`                | `store`  | Reactive registry of every instance.                                         |

:::caution[Escape needs its own handler]
`Escape` closing is handled by `handleKeydown`, so it only works if you bind it. Tooltips
are also the one place where a tooltip that stays open over a focused control is a real
accessibility problem, not a cosmetic one.
:::

## Plugin options

```ts
tooltipPlugin({ id: "app-tooltip", storeKey: "tips" });
```
