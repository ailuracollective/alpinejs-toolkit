---
title: Dialog
---

@ailura/alpinejs-dialog

A modal dialog. The plugin owns the open state, the escape key, and the outside-click
dismiss; you write the markup and keep focus inside.

## Install

```sh
pnpm add alpinejs @ailura/alpinejs-dialog
```

## Register the plugin

Do this once, before `Alpine.start()`.

```ts
import Alpine from "alpinejs";
import dialogPlugin from "@ailura/alpinejs-dialog";

Alpine.plugin(dialogPlugin());

Alpine.start();
```

That registers a `dialog` store, so everything below is reachable at `$store.dialog`.

## Minimal example

A confirm dialog that closes on escape, on an outside click, and on its own buttons.

```html
<div
  x-data="{ id: 'delete-project' }"
  x-init="$store.dialog.register(id)"
  @keydown.window="$store.dialog.handleKeydown(id, $event)"
>
  <button @click="$store.dialog.open(id)">Delete project</button>

  <template x-if="$store.dialog.isOpen(id)">
    <div class="backdrop" @click="$store.dialog.handleOutsideClick(id, $event)">
      <div
        x-bind="$store.dialog.dialogProps(id)"
        class="panel"
        x-init="$store.dialog.bindContainer(id, $el)"
        @click.stop
      >
        <h2 id="delete-project-label">Delete this project?</h2>
        <p>This cannot be undone.</p>
        <button @click="$store.dialog.close(id)">Cancel</button>
        <button @click="$store.dialog.close(id)">Delete</button>
      </div>
    </div>
  </template>
</div>
```

`dialogProps()` returns `role="dialog"`, `aria-modal`, and the `aria-labelledby` /
`aria-describedby` you passed to `register()`. Set the ids in `register()` and the
markup stays declarative:

```js
$store.dialog.register(id, { labelledBy: "delete-project-label" });
```

`template x-if` rather than `x-show` is deliberate: a closed dialog should not be in
the DOM at all, or the page behind it stays reachable to a screen reader. The
`x-init` on the panel is not optional either: outside-click closing only fires while
`bindContainer` has told the store which element is the dialog.

## Variants

**Let the dialog stay open when the user clicks outside it.** Some confirmations
should need an explicit choice. Turn both defaults off for a deliberate flow.

```js
$store.dialog.register(id, { closeOnEscape: false, closeOnOutsideClick: false });
```

**Open with content already in the store.** `open()` takes an options object, so you
can push server data in without a second round trip through Alpine state.

```js
$store.dialog.open(id, { labelledBy: "delete-project-label", describedBy: "warn-copy" });
```

**Hook the open and close transitions.** Use these for focus management, analytics,
or unsaved-changes warnings. They are options on `register()`, not methods, so they
fire once per transition rather than on every render.

```js
$store.dialog.register(id, {
  onOpen: () => console.log("opened"),
  onClose: () => console.log("closed"),
});
```

## API reference

Reach for this once the dialog already works and you need the exact signature.

| Name                                          | Type     | Purpose                                                                                           |
| --------------------------------------------- | -------- | ------------------------------------------------------------------------------------------------- |
| `$store.dialog.register(id, options?)`        | `method` | Create an instance. Options: `labelledBy`, `describedBy`, `closeOnEscape`, `closeOnOutsideClick`. |
| `$store.dialog.unregister(id)`                | `method` | Drop an instance.                                                                                 |
| `$store.dialog.open(id, options?)`            | `method` | Open it, optionally updating `labelledBy` / `describedBy`.                                        |
| `$store.dialog.close(id)`                     | `method` | Close it.                                                                                         |
| `$store.dialog.toggle(id, options?)`          | `method` | Open if closed, close if open.                                                                    |
| `$store.dialog.isOpen(id)`                    | `method` | Whether it is open. Drives `template x-if`.                                                       |
| `$store.dialog.handleKeydown(id, event)`      | `method` | Escape. Required for the escape-to-close default.                                                 |
| `$store.dialog.bindContainer(id, element)`    | `method` | Tell the store which element is the dialog. Required for close-on-outside-click.                  |
| `$store.dialog.handleOutsideClick(id, event)` | `method` | Backdrop click. Required for close-on-outside-click.                                              |
| `$store.dialog.dialogProps(id)`               | `method` | `role="dialog"`, `aria-modal`, `aria-labelledby`, `aria-describedby`.                             |
| `$store.dialog.instances`                     | `store`  | Reactive registry of every instance.                                                              |

:::caution[Keyboard support needs two handlers, and outside-click needs a third]
Escape closing is handled by `handleKeydown`, outside-click closing by
`handleOutsideClick` — which does nothing at all until `bindContainer` has registered
the dialog element. Bind only the first and the dialog closes on escape but a backdrop
click does nothing. The minimal example above wires all three, which is why they are so
easy to merge by accident.
:::

## Plugin options

`dialogPlugin()` takes options only if you already own the `dialog` store name, or if
you want to change the defaults every instance inherits.

```ts
dialogPlugin({ id: "app-dialog", storeKey: "modal", closeOnEscape: true });
```
