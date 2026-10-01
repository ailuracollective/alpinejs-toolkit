---
title: Overlay
---

@ailura/alpinejs-overlay

A shared z-index stack. It does not open or close anything: you claim a slot for your
own overlay elements, it hands you a z-index that never collides, and it tells you when
the stack changes.

Reach for it when you have two or more custom overlays — a menu plus a modal, a
toast rail plus a drawer — and you need them to layer predictably without hardcoding
`z-index: 9999` in three places.

## Install

```sh
pnpm add alpinejs @ailura/alpinejs-overlay
```

## Register the plugin

Do this once, before `Alpine.start()`.

```ts
import Alpine from "alpinejs";
import overlayPlugin from "@ailura/alpinejs-overlay";

Alpine.plugin(overlayPlugin());

Alpine.start();
```

That registers an `overlay` store, so everything below is reachable at `$store.overlay`.

## Minimal example

Claim an element when it opens, release it when it closes, and bind the z-index it
gives you. Claiming is explicit because reading the z-index is not: `zIndexOf()` is a
pure read, so a render-time `:style` binding never takes a slot on its own.

```html
<div x-data="{ id: 'quick-panel' }">
  <button
    @click="
      $store.overlay.claim('quick-panel', id);
      open = true;
    "
  >
    Open panel
  </button>

  <div
    x-show="open"
    x-init="open = $store.overlay.isOpen('quick-panel', id); $store.overlay.claim('quick-panel', id)"
    :style="'z-index: ' + $store.overlay.zIndexOf('quick-panel', id)"
    @click.outside="
      $store.overlay.unregister('quick-panel', id);
      open = false;
    "
  >
    Panel content
  </div>
</div>
```

`claim()` returns the z-index it assigned. Claiming the same pair twice is a no-op, so
calling it from a click handler is safe. `zIndexOf()` allocates nothing: it returns the
current z-index of a claimed entry, or the base z-index for anything unclaimed.

## Reading the stack

The store exposes the whole stack, which is what you need when the ordering is the
point.

```js
$store.overlay.count; // how many are open
$store.overlay.stack; // entries, most recent last
$store.overlay.isOpen("quick-panel", "panel-1"); // boolean
$store.overlay.zIndexOf("quick-panel", "panel-1"); // number
```

Each entry in `stack` carries `plugin`, `id`, `zIndex`, and `openedAt`, so you can
render a debug overlay without instrumenting anything.

## React to changes

`on("change", listener)` fires whenever a slot is claimed, released, or the stack is
destroyed. The listener receives the action (`"claim"`, `"unregister"`, or
`"destroy"`) and the new stack, which is how you close the top overlay when a new one
opens.

```js
$store.overlay.on("change", ({ action, stack, added, removed }) => {
  console.log(action, stack.length);
});
```

## Variants

**Change the base z-index or the step between layers.** The defaults suit a normal
app. Raise `baseZIndex` if something in your app is already sitting high.

```js
$store.overlay.configure({ baseZIndex: 1000, step: 10 });
```

**Mount overlays into a specific element.** By default the stack is document-level;
point `root` at a container when the overlays must be scoped.

```js
$store.overlay.configure({ root: "#app-overlays" });
```

## API reference

| Name                                    | Type     | Purpose                                                                                                          |
| --------------------------------------- | -------- | ---------------------------------------------------------------------------------------------------------------- |
| `$store.overlay.claim(plugin, id)`      | `method` | Claim a slot: push an entry onto the stack; returns its z-index.                                                 |
| `$store.overlay.unregister(plugin, id)` | `method` | Release the entry and free its layer.                                                                            |
| `$store.overlay.zIndexOf(plugin, id)`   | `method` | The entry's current z-index, or the base z-index when it has not been claimed. Allocates nothing.                |
| `$store.overlay.isOpen(plugin, id)`     | `method` | Whether that entry is on the stack.                                                                              |
| `$store.overlay.configure(options)`     | `method` | Change `root`, `baseZIndex`, or `step` at runtime.                                                               |
| `$store.overlay.on(event, listener)`    | `method` | Subscribe to stack changes.                                                                                      |
| `$store.overlay.destroy()`              | `method` | Host-owned teardown: releases the portal root, clears the slots and empties the stack. Nothing calls it for you. |
| `$store.overlay.stack`                  | `store`  | Reactive array of `{ plugin, id, zIndex, openedAt }`.                                                            |
| `$store.overlay.count`                  | `store`  | How many entries are open.                                                                                       |
| `$store.overlay.root`                   | `store`  | The resolved mount root.                                                                                         |
| `$store.overlay.baseZIndex` / `step`    | `store`  | The current base and increment.                                                                                  |

:::note[Nothing opens automatically]
`claim()` and `unregister()` are yours to call. Claiming a slot for a dialog plugin
does not open it, so an element can be visible with no z-index assigned and land
underneath whatever the stack thinks is on top.
:::

## Plugin options

```ts
overlayPlugin({ baseZIndex: 1000, step: 10, storeKey: "layers" });
```
