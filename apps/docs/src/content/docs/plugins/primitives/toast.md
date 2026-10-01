---
title: Toast
---

@ailura/alpinejs-toast

A toast store: a queue with positions, variants, dedup by key, and a per-position
view. The plugin owns the queue and the stacking; you render the toasts.

## Install

```sh
pnpm add alpinejs @ailura/alpinejs-toast
```

## Register the plugin

Do this once, before `Alpine.start()`.

```ts
import Alpine from "alpinejs";
import toastPlugin from "@ailura/alpinejs-toast";

Alpine.plugin(toastPlugin());

Alpine.start();
```

That registers a `toast` store, so everything below is reachable at `$store.toast`.

## Minimal example

Push a toast, list them, and dismiss.

```html
<div x-data>
  <button @click="$store.toast.push({ message: 'Saved', variant: 'success' })">Save</button>
  <button @click="$store.toast.dismissAll()">Dismiss all</button>

  <ul>
    <template x-for="item in $store.toast.items" :key="item.id">
      <li>
        <span x-text="item.message"></span>
        <button @click="$store.toast.dismiss(item.id)">Close</button>
      </li>
    </template>
  </ul>
</div>
```

## Avoiding duplicate toasts

`pushUnique(key, options)` is the one to reach for when the same action can fire
repeatedly. It replaces the toast carrying that key instead of stacking a second one,
so a user who clicks save five times sees one toast, not five.

```js
$store.toast.pushUnique("sync", { message: "Syncing…", variant: "info" });
```

That is the difference between a queue that helps and one that becomes noise.

## Rendering by position

`itemsAt(position)` returns the toasts for one corner, so a template per position is
one loop rather than four.

```html
<template x-for="position in ['top-right', 'bottom-left']" :key="position">
  <div :class="'toasts-' + position">
    <template x-for="item in $store.toast.itemsAt(position)" :key="item.id">
      <div x-text="item.message"></div>
    </template>
  </div>
</template>
```

`stackPositions` reports which positions currently hold toasts, and `maxVisible` and
`maxToasts` are the caps you passed to the factory.

## Updating a toast in place

When a long operation finishes, update the toast rather than pushing a second one.

```js
const id = $store.toast.push({ message: "Uploading…" });
$store.toast.update(id, { message: "Upload complete", variant: "success" });
```

## API reference

| Name                                    | Type   | Purpose                                            |
| --------------------------------------- | ------ | -------------------------------------------------- |
| `$store.toast.items`                    | store  | Every toast in the queue.                          |
| `$store.toast.defaultPosition`          | store  | The position used when one is not given.           |
| `$store.toast.stackPositions`           | store  | Which positions currently hold toasts.             |
| `$store.toast.maxVisible` / `maxToasts` | store  | The configured caps.                               |
| `$store.toast.push(options)`            | method | Add a toast; returns its id.                       |
| `$store.toast.pushUnique(key, options)` | method | Add or replace the toast with that key.            |
| `$store.toast.update(id, options)`      | method | Change a toast in place.                           |
| `$store.toast.dismiss(id)`              | method | Remove one toast.                                  |
| `$store.toast.dismissAt(position, id?)` | method | Remove a toast by position, or the whole position. |
| `$store.toast.dismissAll()`             | method | Empty the queue.                                   |
| `$store.toast.itemsAt(position)`        | method | The toasts at one position.                        |
| `$store.toast.destroy()`                | method | Tear the store down.                               |

:::caution[`push()` has no id of its own to cancel]
`push()` returns the id, so keep it if you intend to update or dismiss later. Calling
`push()` and then trying to find the toast by message works until two toasts share a
message, which is exactly when you need the id.
:::

## Plugin options

```ts
toastPlugin({ storeKey: "notices", defaultPosition: "bottom-right" });
```
