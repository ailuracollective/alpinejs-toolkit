---
title: Selection
---

@ailura/alpinejs-selection

Selection state for single, multiple, and range selection, with the listbox and option
ARIA already worked out. The plugin owns the selection; you render the list.

## Install

```sh
pnpm add alpinejs @ailura/alpinejs-selection
```

## Register the plugin

Do this once, before `Alpine.start()`.

```ts
import Alpine from "alpinejs";
import selectionPlugin from "@ailura/alpinejs-selection";

Alpine.plugin(selectionPlugin());

Alpine.start();
```

That registers a `selection` store, so everything below is reachable at `$store.selection`.
The same object is also exposed as the `$selection` magic.

## Minimal example

A checkbox list with multiple selection.

```html
<div
  x-data="{ id: 'files' }"
  x-init="
    $store.selection.create(id, {
      mode: 'multiple',
      keys: ['a', 'b', 'c'],
    })
  "
>
  <ul x-bind="$store.selection.listProps(id)">
    <template x-for="key in ['a', 'b', 'c']" :key="key">
      <li
        role="option"
        x-bind="$store.selection.itemProps(id, key)"
        @click="$store.selection.toggle(id, key)"
      >
        <span x-text="key"></span>
      </li>
    </template>
  </ul>

  <p>
    Selected:
    <span x-text="$store.selection.getSnapshot(id).selectedKeys.join(', ') || 'none'"></span>
  </p>
</div>
```

`getSnapshot()` is the whole state in one object: `selectedKeys`, the `anchorKey`, the
`activeKey`, plus `mode`, `keys`, `disabledKeys` and `allowDisabledSelection`. Use it when
you need to hand the selection to your own code, rather than reading the individual
pieces.

`itemProps()` gives you `aria-selected` and the `data-*` hooks but no `role`, so add
`role="option"` yourself on whatever carries it — the `<li>` above does.

## Range and replace

`extend()` and `replace()` are what turn a click into a shift-click.

```js
$store.selection.toggle(id, key);
$store.selection.extend(id, key); // shift-click: from the anchor to here
$store.selection.replace(id, key); // the only key
```

The anchor is what `extend()` measures from, and it is set by `setAnchor()` when you
need to control it yourself.

## Locking keys

`setDisabledKeys()` stops a key from being selected while leaving it in the list,
which is what you want for an item the user cannot act on yet.

```js
$store.selection.setDisabledKeys(id, ["c"]);
```

`isSelectable(id, key)` tells you whether a given key can be selected, which is the
check to drive a disabled state on the cell.

## API reference

| Name                                            | Type   | Purpose                                                                                                                     |
| ----------------------------------------------- | ------ | --------------------------------------------------------------------------------------------------------------------------- |
| `$store.selection.create(id, options?)`         | method | Create an instance. Options: `mode`, `keys`, `disabledKeys`, `allowDisabledSelection`, `value`, `defaultValue`, `onChange`. |
| `$store.selection.destroy(id)` / `destroyAll()` | method | Tear instances down.                                                                                                        |
| `$store.selection.setMode(id, mode)`            | method | `single`, `multiple`, or `range`.                                                                                           |
| `$store.selection.setKeys(id, keys)`            | method | Replace the selectable keys.                                                                                                |
| `$store.selection.setDisabledKeys(id, keys)`    | method | Replace the locked keys.                                                                                                    |
| `$store.selection.select(id, key, options?)`    | method | Select one key.                                                                                                             |
| `$store.selection.toggle(id, key)`              | method | Select if unselected, deselect if selected.                                                                                 |
| `$store.selection.replace(id, key)`             | method | Make this the only selection.                                                                                               |
| `$store.selection.extend(id, key)`              | method | Select from the anchor through this key.                                                                                    |
| `$store.selection.selectAll(id)`                | method | Select every selectable key.                                                                                                |
| `$store.selection.clear(id)`                    | method | Clear the selection.                                                                                                        |
| `$store.selection.setValue(id, value)`          | method | Set the selection directly.                                                                                                 |
| `$store.selection.getSnapshot(id)`              | method | The full state as one object.                                                                                               |
| `$store.selection.isSelected(id, key)`          | method | Whether a key is selected.                                                                                                  |
| `$store.selection.isSelectable(id, key)`        | method | Whether a key can be selected.                                                                                              |
| `$store.selection.isActive(id, key)`            | method | Whether a key is the active one.                                                                                            |
| `$store.selection.isAnchor(id, key)`            | method | Whether a key is the range anchor.                                                                                          |
| `$store.selection.setActive(id, key)`           | method | Move the active key.                                                                                                        |
| `$store.selection.setAnchor(id, key)`           | method | Move the range anchor.                                                                                                      |
| `$store.selection.listProps(id, options?)`      | method | `role="listbox"`, plus `aria-multiselectable` in `multiple` and `range` mode. `options` takes an optional `label`.          |
| `$store.selection.itemProps(id, key)`           | method | `aria-selected`, `data-selected` (present only when selected), and `data-key`. No `role` — add it yourself.                 |
| `$store.selection.instances`                    | store  | Reactive registry of every instance.                                                                                        |

:::caution[`replace()` and `extend()` behave differently on purpose]
`replace()` discards whatever was selected. `extend()` keeps it and adds the span from
the anchor. A shift-click that calls `replace()` by mistake looks exactly like a
working click, so the bug only shows on multi-select.
:::

## Plugin options

```ts
selectionPlugin({ id: "app-selection", storeKey: "sel" });
```
