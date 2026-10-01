---
title: Command
---

@ailura/alpinejs-command

A command palette: a search input over a list of actions, with ranked filtering, pinned
and recent items, and async execution. The plugin owns the search, the ranking and the
listbox ARIA; you write the items and the commands.

## Install

```sh
pnpm add alpinejs @ailura/alpinejs-command
```

## Register the plugin

Do this once, before `Alpine.start()`.

```ts
import Alpine from "alpinejs";
import commandPlugin from "@ailura/alpinejs-command";

Alpine.plugin(commandPlugin());

Alpine.start();
```

That registers a `command` store, so everything below is reachable at `$store.command`.

## Minimal example

An input, a filtered list, and two commands.

```html
<div
  x-data="{
    createFile() {
      console.log('create');
    },
    openFile() {
      console.log('open');
    },
  }"
  x-init="
    $store.command.register({ id: 'new-file', label: 'New file', action: () => createFile() });
    $store.command.register({ id: 'open-file', label: 'Open file', action: () => openFile() });
  "
  @keydown="$store.command.handleKeydown($event)"
>
  <button @click="$store.command.open()">Commands</button>

  <template x-if="$store.command.isOpen">
    <div>
      <input x-bind="$store.command.inputProps()" x-model="$store.command.search" />

      <ul x-bind="$store.command.listboxProps()">
        <template x-for="state in $store.command.visibleItems" :key="state.id">
          <li x-bind="$store.command.optionProps(state.id)" @click="$store.command.run(state.id)">
            <span x-text="state.item.label"></span>
            <span x-show="state.loading">…</span>
          </li>
        </template>
      </ul>
    </div>
  </template>
</div>
```

`register` takes one `CommandItem` — `{ id, label, action }` plus optional `group`,
`shortcut`, `keywords`, `aliases`, `pinned`, `page` and predicates — and it returns the
function that releases that registration. Keep the returned function when you need to
remove the item later:

```js
const release = $store.command.register({ id: "new-file", label: "New file", action: create });
// later, in whatever teardown path you have:
release();
```

`visibleItems` is a list of item _state_ objects: `state.id` identifies the row,
`state.item` is the `CommandItem` you registered, and `state.disabled` / `state.loading` /
`state.pinned` / `state.recent` / `state.selectable` are the flags to render.

`search` is a reactive property, not a method. Bind it with `x-model` and the filtering
and ranking happen as the user types. There is no `setQuery()` to call.

`visibleItems` is the filtered, ranked, slice-worth of commands. Loop over that rather
than `items`, or the palette will not filter.

## Variants

`rank` and the lifecycle hooks are store config, so they belong to
`commandPlugin(...)`, not to an individual item. There is no `filter` option.

**Score results yourself.** By default the ranking is whatever the plugin ships with;
pass a `rank` function when "best match" means something specific to your app.

```ts
commandPlugin({ rank: (item, search) => (item.label.startsWith(search) ? 10 : 1) });
```

**Filter the items yourself.** `rank` returning `null` drops the item from the visible
list — that is the only thing that filters.

```ts
commandPlugin({
  rank: (item, search) =>
    item.keywords?.some((k) => k.includes(search)) ? 2 : item.label.includes(search) ? 1 : null,
});
```

:::note[No `filter` option]
The store config has no `filter` member. Ranking does all the work: return a number to
score a match, or `null` to drop the item from the visible list.
:::

**Make a command async.** `action` may return a promise. The palette tracks the running
command so you can show a spinner on the right row.

```js
$store.command.register({ id: "deploy", label: "Deploy", action: () => deploy() });
```

**Use pages for nested navigation.** `pushPage` stacks a page, `popPage` or `goBack`
pops it. `pageStack` reports the depth. Items belong to a page through their `page`
field; items with no `page` (or `page: "root"`) live on the root page.

```js
$store.command.register({ id: "browse-project", label: "Browse project", action: browse });
await $store.command.pushPage({ id: "project", title: "Project" });
$store.command.goBack();
```

**React to the palette opening.** Use it to focus the input.

```ts
commandPlugin({ onOpen: () => focusInput() });
```

## API reference

| Name                                             | Type     | Purpose                                                                                                                                                                                                                               |
| ------------------------------------------------ | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `$store.command.register(item)`                  | `method` | Add one `CommandItem` (`{ id, label, action, group?, shortcut?, keywords?, aliases?, pinned?, page?, ... }`). Throws on a duplicate id. **Returns the unregister function** — call it (or `unregister(item.id)`) to release the item. |
| `$store.command.unregister(itemId)`              | `method` | Remove one registered item by id, dropping it from pinned and recent lists.                                                                                                                                                           |
| `$store.command.open()` / `close()` / `toggle()` | `method` | Open state.                                                                                                                                                                                                                           |
| `$store.command.isOpen`                          | `store`  | Whether it is open.                                                                                                                                                                                                                   |
| `$store.command.search`                          | `store`  | The query. Writable, so `x-model` works: writing it also resets `activeIndex` to 0.                                                                                                                                                   |
| `$store.command.visibleItems`                    | `store`  | Filtered and ranked items to render.                                                                                                                                                                                                  |
| `$store.command.filteredItems` / `groupedItems`  | `store`  | The same data, other shapes.                                                                                                                                                                                                          |
| `$store.command.items` / `pages`                 | `store`  | Registered items and the page stack.                                                                                                                                                                                                  |
| `$store.command.activeIndex`                     | `store`  | The highlighted row.                                                                                                                                                                                                                  |
| `$store.command.runningId` / `loadingIds`        | `store`  | Which commands are executing.                                                                                                                                                                                                         |
| `$store.command.pinnedIds` / `recentIds`         | `store`  | Pinned and recently used ids.                                                                                                                                                                                                         |
| `$store.command.pageStack` / `currentPageId`     | `store`  | Page depth and the current page.                                                                                                                                                                                                      |
| `$store.command.pushPage(page)`                  | `method` | Push a page (`{ id, title, parentId?, load? }`) on the page stack, reset search and active index, and await the page's `load()` when present. Resolves once the page is live.                                                         |
| `$store.command.popPage()` / `goBack()`          | `method` | Pop one page (no-op at the root page) and reset search and active index. `goBack()` is an alias of `popPage()`.                                                                                                                       |
| `$store.command.run(itemId)`                     | `method` | Execute a command by item id. Async-safe.                                                                                                                                                                                             |
| `$store.command.cancelRun()`                     | `method` | Clear every in-flight run and reset the execution state. Pending actions still finish.                                                                                                                                                |
| `$store.command.itemState(id)`                   | `method` | Per-item state: loading, pinned, recent.                                                                                                                                                                                              |
| `$store.command.inputProps()`                    | `method` | `role="combobox"` and the input's aria attributes.                                                                                                                                                                                    |
| `$store.command.listboxProps()`                  | `method` | `role="listbox"`, `id="command-listbox"` and the current page's title as `aria-label`.                                                                                                                                                |
| `$store.command.optionProps(itemId)`             | `method` | `role="option"` and per-row attributes.                                                                                                                                                                                               |
| `$store.command.handleKeydown(event)`            | `method` | Arrows, `Enter`, `Escape`. Required for keyboard use.                                                                                                                                                                                 |

:::caution[The arrow keys and `Enter` only work if you bind `handleKeydown`]
The palette opens, filters and highlights perfectly with a mouse, and arrow keys do
nothing. `handleKeydown` is what drives the active index and runs the command, and
there is no visual sign that a handler is missing.
:::

## Plugin options

```ts
commandPlugin({ id: "app-command", storeKey: "palette" });
```
