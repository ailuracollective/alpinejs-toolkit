---
title: Accordion
---

@ailura/alpinejs-accordion

A collapsible FAQ, settings panel, or any list where one or more sections expand
and collapse. The plugin owns the open/closed state and the ARIA wiring; you write
the markup and the styling.

## Install

```sh
pnpm add alpinejs @ailura/alpinejs-accordion
```

## Register the plugin

Do this once, before `Alpine.start()`.

```ts
import Alpine from "alpinejs";
import accordionPlugin from "@ailura/alpinejs-accordion";

Alpine.plugin(accordionPlugin());

Alpine.start();
```

That registers an `accordion` store, so everything below is reachable at
`$store.accordion`.

## Minimal example

One group, two panels, single-expand. This is the shape most accordions need.

```html
<div
  x-data="{ gid: 'faq' }"
  x-init="
    $store.accordion.register(gid, { mode: 'single' });
    $store.accordion.registerItem(gid, 'shipping');
    $store.accordion.registerItem(gid, 'returns');
  "
  @keydown="$store.accordion.handleKeydown(gid, $event)"
>
  <button
    x-bind="$store.accordion.triggerProps(gid, 'shipping')"
    @click="$store.accordion.toggle(gid, 'shipping')"
  >
    How fast do you ship?
  </button>
  <div
    x-bind="$store.accordion.panelProps(gid, 'shipping')"
    x-show="$store.accordion.isOpen(gid, 'shipping')"
  >
    Within two business days.
  </div>

  <button
    x-bind="$store.accordion.triggerProps(gid, 'returns')"
    @click="$store.accordion.toggle(gid, 'returns')"
  >
    What is your returns policy?
  </button>
  <div
    x-bind="$store.accordion.panelProps(gid, 'returns')"
    x-show="$store.accordion.isOpen(gid, 'returns')"
  >
    Thirty days, no questions asked.
  </div>
</div>
```

Three things in there are doing work you would otherwise write by hand:

- `triggerProps()` returns `aria-expanded`, `aria-controls`, an `id`, and a roving
  `tabindex`. Bind it and you get correct ARIA for free.
- `panelProps()` returns the `id`, `role="region"`, and `aria-labelledby` that the
  trigger points at.
- `isOpen()` drives `x-show`, so the panel hides without you touching display.

:::caution[Don't drop the `@keydown` line]
Arrow keys, `Home`, and `End` are handled by
`$store.accordion.handleKeydown(gid, $event)`. Without it, `triggerProps` leaves
every trigger at `tabindex="-1"` and the group becomes unreachable by keyboard —
it still works with a mouse, which is exactly why the bug is easy to ship.
:::

## Variants

Reach for these when the default does not fit. Each one is a change to
`register()` or `registerItem()`; the markup stays the same.

**Let several panels stay open at once.** Use `multiple` when the panels are
independent questions, not a wizard. In `single` mode, opening one closes the
others.

```js
$store.accordion.register(gid, { mode: "multiple" });
```

**Start with a panel already open.** `defaultOpen` takes an id, or a list of ids.
In `single` mode only the first is used.

```js
$store.accordion.register(gid, { mode: "multiple", defaultOpen: ["shipping"] });
```

**Keep a section locked.** A disabled item will not open, and the arrow keys skip
over it. Useful for a section that unlocks once a condition is met.

```js
$store.accordion.registerItem(gid, "refunds", true);
```

**React to changes.** `onChange` receives the open ids whenever the selection
changes, so you can persist it or sync it elsewhere.

```js
$store.accordion.register(gid, {
  mode: "single",
  onChange: (openIds) => localStorage.setItem("faq", JSON.stringify(openIds)),
});
```

## API reference

Reach for this once the component already works and you need the exact signature.

| Name                                                            | Type     | Purpose                                                                              |
| --------------------------------------------------------------- | -------- | ------------------------------------------------------------------------------------ |
| `$store.accordion.register(id, options?)`                       | `method` | Create a group. Options: `mode` (`single` \| `multiple`), `defaultOpen`, `onChange`. |
| `$store.accordion.unregister(id)`                               | `method` | Drop a group and its items.                                                          |
| `$store.accordion.registerItem(id, itemId, disabled?)`          | `method` | Add a panel. Pass `true` to lock it.                                                 |
| `$store.accordion.unregisterItem(id, itemId)`                   | `method` | Remove a panel.                                                                      |
| `$store.accordion.open(id, itemId)`                             | `method` | Open a panel.                                                                        |
| `$store.accordion.close(id, itemId)`                            | `method` | Close a panel.                                                                       |
| `$store.accordion.toggle(id, itemId)`                           | `method` | Toggle a panel. The usual click handler.                                             |
| `$store.accordion.isOpen(id, itemId)`                           | `method` | Whether a panel is open. Drives `x-show`.                                            |
| `$store.accordion.openIds(id)`                                  | `method` | The open panel ids.                                                                  |
| `$store.accordion.handleKeydown(id, event)`                     | `method` | Arrow keys, `Home`, `End`. Required for keyboard support.                            |
| `$store.accordion.activeItem(id)` / `setActiveItem(id, itemId)` | `method` | The roving-tabindex target. `handleKeydown` maintains it for you.                    |
| `$store.accordion.triggerProps(id, itemId)`                     | `method` | `aria-expanded`, `aria-controls`, `id`, `tabindex` for a trigger.                    |
| `$store.accordion.panelProps(id, itemId)`                       | `method` | `id`, `role="region"`, `aria-labelledby`, `aria-hidden` for a panel.                 |
| `$store.accordion.groups`                                       | `store`  | Reactive registry of every group.                                                    |

## Plugin options

`accordionPlugin()` takes options only if you already own the `accordion` store
name.

```ts
accordionPlugin({ id: "faq-accordion", storeKey: "faq" });
```
