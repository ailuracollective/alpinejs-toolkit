---
title: Keyboard
---

@ailura/alpinejs-keyboard

A shortcut registry with named scopes, so a modal can take over the keyboard and give
it back on close. The plugin owns the matching and the conflicts; you bind one handler
and register the shortcuts.

## Install

```sh
pnpm add alpinejs @ailura/alpinejs-keyboard
```

## Register the plugin

Do this once, before `Alpine.start()`.

```ts
import Alpine from "alpinejs";
import keyboardPlugin from "@ailura/alpinejs-keyboard";

Alpine.plugin(keyboardPlugin());

Alpine.start();
```

That registers a `keyboard` store, so everything below is reachable at `$store.keyboard`.

## Minimal example

One global handler, and the shortcuts registered against it.

```html
<div
  x-data="{ stop: null }"
  x-init="
    $store.keyboard.register('mod+s', () => save(), { id: 'save', scope: 'editor' });
  "
>
  <p>Active scopes: <span x-text="$store.keyboard.activeScopes"></span></p>
  <p>
    Shortcuts: <span x-text="$store.keyboard.commands.map((c) => c.shortcut).join(', ')"></span>
  </p>

  <button @click="$store.keyboard.activateScope('editor')">Enable shortcuts</button>
  <button @click="$store.keyboard.deactivateScope('editor')">Disable them</button>
</div>
```

**`register()` returns an unsubscribe function, not a handle.** It also takes an `id`, and
`unregister(id)` is what removes a shortcut by name. Keep the returned function when you
want teardown-scoped removal; use the `id` when you need to remove it from somewhere
else.

```js
const stop = $store.keyboard.register("mod+s", save, { id: "save" });
stop(); // same as $store.keyboard.unregister("save")
```

## Scopes are the point

A scope is a named set of shortcuts you can switch on and off. This is how a dialog
takes the keyboard without every page-level shortcut firing underneath it. A shortcut
fires when any one of its scopes is active, so a shortcut registered in `default` and one
registered in `dialog` only compete when both scopes are on.

```js
$store.keyboard.activateScope("editor");
$store.keyboard.deactivateScope("editor");
```

`suspendScope()` is the softer switch: it leaves the scope active but blocks its
shortcuts, so `resumeScope()` puts back exactly what was there.

## Resolving conflicts

`priority` decides which of two matching shortcuts wins. Give the more specific one the
higher number.

```js
$store.keyboard.register("escape", closeDialog, { scope: "dialog", priority: 10 });
$store.keyboard.register("escape", clearSearch, { scope: "editor", priority: 1 });
```

## Typing in an input

By default a shortcut does not fire while the user is typing, which is what you want
for almost everything. `allowInEditable` opts a shortcut back in, for the rare case
where a single key should work in a field too.

```js
$store.keyboard.register("mod+k", openSearch, { allowInEditable: true });
```

## API reference

| Name                                                 | Type   | Purpose                                                                                                                                                                           |
| ---------------------------------------------------- | ------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `$store.keyboard.commands`                           | store  | The registry, as an array of registrations (`id`, `shortcut`, `scopes`, `priority`, `enabled`, …).                                                                                |
| `$store.keyboard.activeScopes`                       | store  | The scopes currently on.                                                                                                                                                          |
| `$store.keyboard.suspendedScopes`                    | store  | The scopes suspended but still remembered.                                                                                                                                        |
| `$store.keyboard.register(chord, handler, options?)` | method | Add a shortcut; returns an unsubscribe function.                                                                                                                                  |
| `$store.keyboard.unregister(id)`                     | method | Remove it by the `id` it was registered with. Returns whether it existed.                                                                                                         |
| `$store.keyboard.activateScope(name)`                | method | Turn a scope on.                                                                                                                                                                  |
| `$store.keyboard.deactivateScope(name)`              | method | Turn a scope off.                                                                                                                                                                 |
| `$store.keyboard.suspendScope(name)`                 | method | Turn a scope off, remembering it was on.                                                                                                                                          |
| `$store.keyboard.resumeScope(name)`                  | method | Restore a suspended scope.                                                                                                                                                        |
| `$store.keyboard.isScopeActive(name)`                | method | Whether a scope is on.                                                                                                                                                            |
| `$store.keyboard.isScopeSuspended(name)`             | method | Whether a scope is suspended.                                                                                                                                                     |
| `$store.keyboard.handleKeydown(event)`               | method | Match and run against one event. The plugin already listens on `window`; call this to route a key yourself.                                                                       |
| `$store.keyboard.destroy()`                          | method | Host-owned teardown: removes the `window` keydown listener and clears every registered shortcut. Nothing invokes it automatically — the host that registered the plugin calls it. |

Registration options: `id`, `scope`, `priority`, `enabled`, `allowInEditable`,
`preventDefault`, `stopPropagation`, `metadata`, `when`.

:::caution[Do not bind `handleKeydown` to an element and expect it to stay local]
The plugin mounts the controller with a `window` `keydown` listener, so shortcuts already
fire globally. Adding `@keydown="$store.keyboard.handleKeydown($event)"` on a component
runs the registry a second time for the same key event — so a `preventDefault` shortcut
fires twice, and the second run sees the buffer the first one already consumed. Route
keys through `handleKeydown()` only when you are deliberately replacing the global
listener, for example in a test or an embedded editor.
:::

## Plugin options

```ts
keyboardPlugin({ id: "app-keyboard", storeKey: "keys" });
```
