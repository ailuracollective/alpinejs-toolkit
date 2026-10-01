---
title: Sidebar
---

@ailura/alpinejs-sidebar

A sidebar that is open or closed, optionally driven by a media query so it collapses on
small screens. The plugin owns the visible state; you write the panel and the trigger.

## Install

```sh
pnpm add alpinejs @ailura/alpinejs-sidebar
```

## Register the plugin

Do this once, before `Alpine.start()`.

```ts
import Alpine from "alpinejs";
import sidebarPlugin from "@ailura/alpinejs-sidebar";

Alpine.plugin(sidebarPlugin());

Alpine.start();
```

That registers a `sidebar` store, so everything below is reachable at `$store.sidebar`.

## Minimal example

A trigger and a panel, with the overlay and Escape wired.

```html
<div x-data>
  <button @click="$store.sidebar.toggle()" :aria-expanded="$store.sidebar.visible">Menu</button>

  <div x-show="$store.sidebar.visible" @click="$store.sidebar.hide()">
    <aside @click.stop @keydown="$store.sidebar.handleKeydown($event)">
      <button @click="$store.sidebar.hide()">Close</button>
      <nav>...</nav>
    </aside>
  </div>
</div>
```

The method names are `show()` and `hide()`, not `open()` and `close()`.

There are two booleans and they are not the same thing:

- `visible` is the current state.
- `isVisible` is an alias for it, kept for readability when you pass the whole store
  around.

## Collapse on small screens

A breakpoint makes the sidebar follow a media query. `onMismatch` decides what happens
when the query does not match: hide the sidebar, or leave it alone.

```js
sidebarPlugin({
  breakpoint: {
    query: "(min-width: 768px)",
    onMismatch: "hide",
  },
});
```

`matchesBreakpoint` tells you whether the query currently matches, so you can render a
different trigger for the two cases.

```html
<button x-show="$store.sidebar.matchesBreakpoint" @click="$store.sidebar.toggle()">Menu</button>
```

## Variants

**Do not close on Escape.** Useful when the sidebar holds a form you do not want to
lose.

```js
sidebarPlugin({ closeOnEscape: false });
```

**Do not close on overlay click.** A sidebar that stays put until the user picks a
destination.

```js
sidebarPlugin({ closeOnOverlayClick: false });
```

**Start open.** Pass the initial state, useful for a desktop-first layout.

```js
sidebarPlugin({ initial: true });
```

**Go back to the initial state.** `reset()` returns to whatever `initial` was, which
is the one you want on navigation.

```js
$store.sidebar.reset();
```

## API reference

| Name                                  | Type     | Purpose                                                                                                             |
| ------------------------------------- | -------- | ------------------------------------------------------------------------------------------------------------------- |
| `$store.sidebar.visible`              | `store`  | Whether the sidebar is showing.                                                                                     |
| `$store.sidebar.isVisible`            | `store`  | Alias of `visible`.                                                                                                 |
| `$store.sidebar.matchesBreakpoint`    | `store`  | Whether the configured media query currently matches.                                                               |
| `$store.sidebar.hasOverlay`           | `store`  | Whether an overlay should be rendered: visible **and** `closeOnOverlayClick` is on.                                 |
| `$store.sidebar.show()` / `hide()`    | `method` | Change the state.                                                                                                   |
| `$store.sidebar.toggle()`             | `method` | Show if hidden, hide if showing.                                                                                    |
| `$store.sidebar.reset()`              | `method` | Return to the `initial` state.                                                                                      |
| `$store.sidebar.handleKeydown(event)` | `method` | Escape. The plugin already listens on `document`, so this is only for a scoped, explicit handler.                   |
| `$store.sidebar.destroy()`            | `method` | Host-owned teardown: removes the breakpoint listener and the `document` keydown listener. Nothing calls it for you. |

:::caution[`handleKeydown` takes the event, not an id]
Unlike accordion, tabs or dialog, the sidebar is a singleton: there is no instance id
to pass. It is `$store.sidebar.handleKeydown($event)`. Copying the shape from another
page and adding an id gets you `undefined` instead of a working Escape key.
:::

:::note[Escape already works with no wiring]
Unless you pass `closeOnEscape: false`, the controller installs its own `document`
keydown listener on mount, so Escape closes the sidebar from anywhere. The
`@keydown` in the example above is the same handler called explicitly — drop it and
nothing changes.
:::

## Plugin options

```ts
sidebarPlugin({ id: "app-sidebar", storeKey: "nav" });
```
