---
title: History
---

@ailura/alpinejs-history

An undo/redo stack for a value. The plugin owns the stack, the grouping, and the
reactive state; you decide what counts as one change.

## Install

```sh
pnpm add alpinejs @ailura/alpinejs-history
```

## Register the plugin

Do this once, before `Alpine.start()`.

```ts
import Alpine from "alpinejs";
import historyPlugin from "@ailura/alpinejs-history";

Alpine.plugin(historyPlugin());

Alpine.start();
```

That registers a `history` store, so everything below is reachable at `$store.history`.

## Minimal example

A text field with undo and redo bound to the keyboard.

```html
<div
  x-data="{ text: '' }"
  @keydown.meta.z.prevent="$store.history.undo()"
  @keydown.meta.shift.z.prevent="$store.history.redo()"
>
  <textarea x-model="text" @input="$store.history.commit(text)"></textarea>
  <button @click="$store.history.undo()" :disabled="!$store.history.canUndo">Undo</button>
  <button @click="$store.history.redo()" :disabled="!$store.history.canRedo">Redo</button>
</div>
```

`canUndo` and `canRedo` are reactive booleans, so the disabled state is not something
you have to maintain.

## Grouping changes with transactions

Every `commit()` is its own undo step, which for a form means one undo per keystroke.
`transaction()` opens a handle instead: commit the handle to keep what you did inside
it, roll it back to throw those changes away.

```js
const tx = $store.history.transaction($store.history.value);
$store.history.commit($store.history.value + 5);
tx.commit(); // or tx.rollback() to discard
```

`transactionDepth` counts the handles you currently have open, so a toolbar can tell
whether it is in the middle of a change.

## Checkpoints and clearing

A checkpoint pushes the current value onto the undo stack, so `undo()` walks back to
it; `clear()` empties the stack, which is what you want when the value is no longer
undoable, like after a save.

```js
$store.history.checkpoint({ label: "before import" });
$store.history.clear();
```

## API reference

| Name                                       | Type   | Purpose                                       |
| ------------------------------------------ | ------ | --------------------------------------------- |
| `$store.history.value`                     | store  | The current value.                            |
| `$store.history.undoStack`                 | store  | The entries that can be undone.               |
| `$store.history.redoStack`                 | store  | The entries that can be redone.               |
| `$store.history.canUndo`                   | store  | Whether there is anything to undo.            |
| `$store.history.canRedo`                   | store  | Whether there is anything to redo.            |
| `$store.history.transactionDepth`          | store  | How deep you are inside a transaction.        |
| `$store.history.commit(value, meta?)`      | method | Record a new value as an undo step.           |
| `$store.history.push(value, meta?)`        | method | Alias of `commit()`.                          |
| `$store.history.undo()`                    | method | Step back.                                    |
| `$store.history.redo()`                    | method | Step forward.                                 |
| `$store.history.reset(value, meta?)`       | method | Start a fresh history from a new value.       |
| `$store.history.transaction(initialValue)` | method | Open a handle with `commit()` / `rollback()`. |
| `$store.history.checkpoint(meta?)`         | method | Push the current value as a labelled point.   |
| `$store.history.clear()`                   | method | Empty the stack.                              |
| `$store.history.destroy()`                 | method | Tear the store down.                          |

`meta` is the same shape everywhere: `{ label, group, meta }`.

:::caution[A new commit drops the redo stack]
`commit()` and `push()` are the same call, and both empty the redo stack. Redo therefore
only survives until the next commit: one more keystroke after an undo throws the branch
you were on away. A commit whose value equals the top of the stack is skipped entirely,
so if you only want to read the current value, read `$store.history.value`.
:::

## Plugin options

```ts
historyPlugin({ id: "app-history", storeKey: "undo" });
```

`id`, `storeKey` (default `history`), `initialValue`, `limit` (default `100`),
`clone`, and `equality` are the accepted options.
