---
title: Menu
---

@ailura/alpinejs-menu

A dropdown or context menu. The plugin owns the open state, the roving tabindex, the
arrow-key navigation, and closing on an outside click; you write the markup.

## Install

```sh
pnpm add alpinejs @ailura/alpinejs-menu
```

## Register the plugin

Do this once, before `Alpine.start()`.

```ts
import Alpine from "alpinejs";
import menuPlugin from "@ailura/alpinejs-menu";

Alpine.plugin(menuPlugin());

Alpine.start();
```

That registers a `menu` store, so everything below is reachable at `$store.menu`.

## Minimal example

A row of actions behind a trigger button.

```html
<div
  x-data="{ id: 'row-actions' }"
  x-init="
    $store.menu.register(id);
    $store.menu.registerItem(id, 'rename');
    $store.menu.registerItem(id, 'duplicate');
    $store.menu.registerItem(id, 'delete');
  "
  @keydown="$store.menu.handleKeydown(id, $event)"
  @click.outside="$store.menu.close(id)"
>
  <button
    @click="$store.menu.toggle(id)"
    :aria-expanded="$store.menu.isOpen(id)"
    aria-haspopup="menu"
  >
    Actions
  </button>

  <div
    x-bind="$store.menu.menuProps(id)"
    x-bind:aria-hidden="$store.menu.menuHidden(id)"
    x-show="$store.menu.isOpen(id)"
  >
    <template x-for="item in ['rename', 'duplicate', 'delete']" :key="item">
      <button
        x-bind="$store.menu.itemProps(id, item)"
        x-bind:tabindex="$store.menu.itemTabIndex(id, item)"
        x-bind:aria-disabled="$store.menu.itemDisabled(id, item)"
        @click="$store.menu.selectItem(id, item)"
      >
        <span x-text="item"></span>
      </button>
    </template>
  </div>
</div>
```

`itemProps()` returns `role="menuitem"` and a stable `id`. `menuProps()` returns
`role="menu"`, the matching `id`, and `aria-orientation`.

:::caution[Anything that changes needs its own `x-bind:`, not the object form]
Alpine applies an object-form `x-bind="$store.menu.menuProps(id)"` exactly once, when the
element initialises. It is not an effect, so nothing in the returned object is ever
re-evaluated. Every attribute that has to follow state — `aria-hidden`, the roving
`tabindex`, `aria-disabled` — is therefore a separate accessor bound with the
per-attribute form, which does re-run.

Getting this wrong is quiet rather than loud. With `tabindex` frozen inside the object
every item sat at `tabindex="-1"` and the menu could not be reached by keyboard at all,
and with `aria-hidden` frozen at `true` the browser refused to hide the menu and warned
that focus was left inside it. If a value you expect to change never does, check whether
it is riding in the object.
:::

`close()` returns focus to the trigger, so a menu closed by <kbd>Escape</kbd> or by
choosing an item does not strand the keyboard inside a hidden subtree. It looks for a
focusable element inside whatever `bindTrigger()` was given, so passing a wrapper `<div>`
around the button is fine.

## Variants

**Keep the menu open after a choice.** The default closes on select, which is right
for commands. Turn it off for a menu of toggles.

```js
$store.menu.register(id, { closeOnSelect: false });
```

**Turn arrow keys with the layout.** Set `orientation` to `vertical` and up/down
navigate; leave it horizontal and left/right do.

```js
$store.menu.register(id, { orientation: "vertical" });
```

**Group items under a parent.** `parentId` records that an item belongs to a group, so
your own markup can nest or filter by it. The arrow keys walk the flat item list, so
drilling into a submenu is still your code.

```js
$store.menu.registerItem(id, "export-pdf", { parentId: "export" });
```

**Lock an item.** A disabled item is skipped by the arrow keys and reports
`aria-disabled`.

```js
$store.menu.registerItem(id, "delete", { disabled: true });
```

**React to selections.** `onSelect` fires with the item id, which is where you route
the command.

```js
$store.menu.register(id, { onSelect: (itemId) => run(itemId) });
```

## API reference

Reach for this once the menu already works and you need the exact signature.

| Name                                                | Type     | Purpose                                                                                       |
| --------------------------------------------------- | -------- | --------------------------------------------------------------------------------------------- |
| `$store.menu.register(id, options?)`                | `method` | Create an instance. Options: `orientation`, `closeOnSelect`, `onOpen`, `onClose`, `onSelect`. |
| `$store.menu.unregister(id)`                        | `method` | Drop an instance.                                                                             |
| `$store.menu.registerItem(id, itemId, options?)`    | `method` | Add an item. Options: `disabled`, `parentId`.                                                 |
| `$store.menu.unregisterItem(id, itemId)`            | `method` | Remove an item.                                                                               |
| `$store.menu.open(id)` / `close(id)` / `toggle(id)` | `method` | Change the open state.                                                                        |
| `$store.menu.isOpen(id)`                            | `method` | Whether it is open.                                                                           |
| `$store.menu.selectItem(id, itemId)`                | `method` | Activate an item, firing `onSelect`.                                                          |
| `$store.menu.handleKeydown(id, event)`              | `method` | Arrows, `Home`, `End`, `Enter`, `Space`. Required for keyboard.                               |
| `$store.menu.handleOutsideClick(id, event)`         | `method` | Click outside the menu.                                                                       |
| `$store.menu.itemProps(id, itemId)`                 | `method` | `role="menuitem"`, `id`. Static: bind per attribute, not as an object.                        |
| `$store.menu.itemTabIndex(id, itemId)`              | `method` | `0` for the active item, `-1` otherwise. For `x-bind:tabindex`.                               |
| `$store.menu.itemDisabled(id, itemId)`              | `method` | Whether an item is locked. For `x-bind:aria-disabled`.                                        |
| `$store.menu.menuProps(id)`                         | `method` | `role="menu"`, `id`, `aria-orientation`. Static.                                              |
| `$store.menu.menuHidden(id)`                        | `method` | `true` while closed. For `x-bind:aria-hidden`.                                                |
| `$store.menu.instances`                             | `store`  | Reactive registry of every instance.                                                          |

:::caution[Two handlers, and they are easy to merge by accident]
Arrows and `Enter` come from `handleKeydown`, closing from `onClick.outside` in the
markup. Bind only the first and the menu traps keyboard focus in a menu the user cannot
dismiss. The minimal example wires both on purpose; `handleOutsideClick` is the
store-level alternative for hosts that would rather not use the directive.
:::

## Plugin options

`menuPlugin()` takes options only if you already own the `menu` store name, if you
need the magic under a different key, or if you want more than one menu open at a time
(`exclusive` defaults to `true`).

```ts
menuPlugin({ id: "app-menu", storeKey: "appMenu", exclusive: false });
```
