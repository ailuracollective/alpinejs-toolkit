# @ailura/alpinejs-history

<p align="center">

[![bundlephobia minzip](https://badgen.net/bundlephobia/minzip/@ailura/alpinejs-history)](https://bundlephobia.com/package/@ailura/alpinejs-history)

</p>

> Alpine.js undo/redo history — a bounded, cloned stack with checkpoints and rollback-able transactions, on `@ailura/alpinejs-core`.

## Installation

```sh
pnpm add @ailura/alpinejs-history alpinejs
# or
npm install @ailura/alpinejs-history alpinejs
```

Requires `alpinejs@^3.0.0` as peer. `@ailura/alpinejs-core` is a **peer
dependency**, not a dependency: no package in this toolkit has a
`dependencies` block, so the host installs it too.

## Usage

### 1. Standalone (framework-agnostic)

```ts
import { createHistoryController } from "@ailura/alpinejs-history";

const history = createHistoryController<number>({ initialValue: 0, limit: 50 });

history.on("change", ({ source, value }) => {
  console.log(source, value); // 'commit' | 'undo' | 'redo' | 'clear' | 'reset'
});

history.commit(1, { label: "increment" });
history.value; // 1
history.canUndo; // true

history.undo(); // 0
history.redo(); // 1

// history.destroy() when done — every mutator is then a silent no-op
```

`createHistoryController<T>(options?)` constructs the controller and **does not
mount** — the constructor seeds the undo stack from `initialValue` and nothing
else needs a lifecycle. There is no DOM in this package at all, so the
controller is usable in a worker, a server render, or a test.

### 2. Alpine

```ts
import Alpine from "alpinejs";
import historyPlugin from "@ailura/alpinejs-history";

Alpine.plugin(historyPlugin<number>({ initialValue: 0 }));
Alpine.start();
```

The plugin registers `$store.history`. There are **no directives and no magic**.

```html
<div x-data="{ current() { return $store.history.value ?? 0 } }">
  <p>Value: <strong x-text="$store.history.value ?? 'none'"></strong></p>
  <p>Undo depth: <strong x-text="$store.history.undoStack.length"></strong></p>

  <button type="button" @click="$store.history.commit(current() + 1)">+1</button>
  <button type="button" @click="$store.history.undo()" :disabled="!$store.history.canUndo">
    Undo
  </button>
  <button type="button" @click="$store.history.redo()" :disabled="!$store.history.canRedo">
    Redo
  </button>
  <button type="button" @click="$store.history.clear()">Clear</button>
</div>
```

`$store.history.value` is `T | undefined`, so **coerce before doing arithmetic
on it**. A plugin registered with no `initialValue` starts at `undefined`;
`undefined + 1` is `NaN`, and `Object.is(NaN, NaN)` is `true`, so the dedupe
check treats every subsequent commit as a duplicate and the undo stack never
grows. The `current()` helper above is the fix — it is not optional.

## API

### Exports

| Export                              | Description                                                                                                                                                                                                                                                                             | Type       |
| ----------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| `HistoryController`                 | The controller class, generic in `T` (the value) and `TMeta` (the per-entry metadata). Getters `value`, `canUndo`, `canRedo`, `undoStack`, `redoStack`, `transactionDepth`, `limit`; methods `commit`, `push`, `undo`, `redo`, `clear`, `reset`, `checkpoint`, `transaction`, `destroy` | `class`    |
| `createHistoryController`           | `createHistoryController<T>(options?) => HistoryController<T>` — constructs without mounting                                                                                                                                                                                            | `function` |
| `historyPlugin`                     | `Alpine.plugin()` factory — `historyPlugin<T>(options?) => (alpine) => void`. Registers `$store.history`                                                                                                                                                                                | `function` |
| `DEFAULT_HISTORY_STORE_KEY`         | Default store key, `"history"`                                                                                                                                                                                                                                                          | `const`    |
| `HistoryEvents`                     | Event map — a single `change` event                                                                                                                                                                                                                                                     | `type`     |
| `HistoryChangeDetail`               | `change` payload — `{ source, value }`                                                                                                                                                                                                                                                  | `type`     |
| `HistoryChangeSource`               | `"commit" \| "undo" \| "redo" \| "reset" \| "checkpoint" \| "clear" \| "push" \| "initialization"` — see [Limitations](#limitations) for which of these actually fire                                                                                                                   | `type`     |
| `HistoryState<T>`                   | `{ value, canUndo, canRedo, undoStack, redoStack }` — the readable shape                                                                                                                                                                                                                | `type`     |
| `HistoryStore<T, TMeta>`            | What `$store.history` exposes: the `HistoryState` fields plus `transactionDepth` and every mutator, including `destroy`                                                                                                                                                                 | `type`     |
| `HistoryManager<T, TMeta>`          | The same surface plus a read-only `limit`. `HistoryController` implements it; the store does not                                                                                                                                                                                        | `type`     |
| `CreateHistoryControllerOptions<T>` | `{ id?, initialValue?, limit?, clone?, equality?, storeKey? }`                                                                                                                                                                                                                          | `type`     |
| `HistoryOptions<T>`                 | Alias of `CreateHistoryControllerOptions<T>`                                                                                                                                                                                                                                            | `type`     |
| `CreateHistoryOptions<T>`           | Alias of `CreateHistoryControllerOptions<T>`                                                                                                                                                                                                                                            | `type`     |
| `HistoryEntry<T, TMeta>`            | `{ value, meta }` — one stack entry                                                                                                                                                                                                                                                     | `type`     |
| `HistoryEntryMeta<TMeta>`           | `{ id, timestamp, label?, group?, estimatedSize?, meta? }`                                                                                                                                                                                                                              | `type`     |
| `TransactionHandle<T>`              | `{ value, commit(), rollback() }` — what `transaction()` returns                                                                                                                                                                                                                        | `type`     |
| `CloneStrategy<T>`                  | `(value: T) => T` — the snapshot strategy                                                                                                                                                                                                                                               | `type`     |
| `EqualityStrategy<T>`               | `(a: T, b: T) => boolean` — the dedupe comparison                                                                                                                                                                                                                                       | `type`     |
| `HistoryAlpine`                     | Alias of Alpine's own `Alpine` type                                                                                                                                                                                                                                                     | `type`     |
| `HistoryPluginCallback`             | `(alpine: Alpine) => void`                                                                                                                                                                                                                                                              | `type`     |

`historyPlugin` is also the package's `default` export.

`estimatedSize` is on `HistoryEntryMeta` and is never written by the controller
— there is no serialisation step to measure. Set it yourself in `meta` if you
need it.

### Store API

```ts
// Read
$store.history.value; // T | undefined
$store.history.canUndo;
$store.history.canRedo;
$store.history.undoStack; // readonly HistoryEntry<T>[]
$store.history.redoStack; // readonly HistoryEntry<T>[]
$store.history.transactionDepth;

// Write
$store.history.commit(value, { label: "rename", group: "doc" });
$store.history.push(value, meta); // identical to commit
$store.history.checkpoint({ label: "before-upload" });

$store.history.undo(); // → the restored value
$store.history.redo(); // → the restored value
$store.history.reset(value, meta); // clear, then make value the new bottom
$store.history.clear(); // both stacks empty, value undefined

$store.history.destroy();
```

| Method                      | Description                                                                                                                                                                           |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `commit(value, meta?)`      | Pushes `value` onto the undo stack and makes it current. **A no-op if it equals the top of the stack** — see [Limitations](#limitations). Clears the redo stack                       |
| `push(value, meta?)`        | The same operation as `commit`. Provided because `push` reads better at a call site that is not a form commit                                                                         |
| `undo()`                    | Moves the top entry to the redo stack and restores the one below. Returns the restored value, or the current value unchanged when there is nothing to undo                            |
| `redo()`                    | The reverse. Returns the restored value, or the current value when the redo stack is empty                                                                                            |
| `checkpoint(meta?)`         | Pushes the **current** value as its own entry without changing it — the snapshot a user can return to. Goes through the same dedupe, so checkpointing an unchanged value does nothing |
| `clear()`                   | Empties both stacks and sets `value` to `undefined`                                                                                                                                   |
| `reset(value, meta?)`       | `clear()`, then pushes `value` as the new bottom of the stack. Emits three events, not one — see [Limitations](#limitations)                                                          |
| `transaction(initialValue)` | Returns a handle. Commits inside it are grouped; `commit()` keeps them, `rollback()` throws them away and restores `initialValue`                                                     |
| `destroy()`                 | **Host-owned.** After it, every mutator is a silent no-op and `undo()`/`redo()` return `undefined`                                                                                    |

`meta` on every mutator is `{ label?, group?, meta? }` — free-form, stored on the
entry and never read by the controller. It is there for a command palette, a
history sidebar, or an analytics hook.

### Committing invalidates the redo stack

This is the standard undo/redo contract, and it is worth stating because it is
surprising the first time: **undo, then commit anything, and the redo stack is
gone.** The future you had undone is no longer reachable.

```ts
history.commit(1);
history.commit(2);
history.undo(); // value 1, redo holds 2
history.canRedo; // true

history.commit(99); // a new edit from here
history.canRedo; // false — the branch is discarded
```

To branch rather than overwrite, commit the state you want to keep before
undoing, or model the two paths as separate histories.

### Transactions

`transaction(initialValue)` returns a handle that groups the commits made inside
it, so a compound action is one undo step:

```ts
const tx = history.transaction(currentValue);
history.commit(currentValue + 5);
tx.commit(); // keeps the +5; the undo stack has it as one entry
```

`rollback()` is the other half — it restores the snapshot taken when the
transaction opened:

```ts
const tx = history.transaction(currentValue);
history.commit(currentValue + 100);
tx.rollback(); // value is back to currentValue, redo stack emptied
```

`commit()` and `rollback()` are idempotent — calling both, or calling either
twice, settles on the first. The handle's `value` getter returns the
`initialValue` you passed, not the live value: it is the snapshot the
transaction can be rolled back to.

`transactionDepth` is the number of open transactions, and it is on the store so
a toolbar can disable its buttons while one is in flight. Opening a handle
increments it and emits immediately, rather than only on settle.

### The undo stack holds clones

Every entry is a snapshot taken with the `clone` strategy, not a reference to
the caller's object. That is what makes history correct in the presence of
mutation:

```ts
const doc = { title: "Draft" };
history.commit(doc);
doc.title = "Final"; // the history entry is unaffected
```

The default `clone` is `structuredClone`, falling back to a JSON round-trip when
the value is not structured-cloneable. The fallback keeps a partially
serialisable state working at the cost of **silently dropping** functions, DOM
nodes, `Map`/`Set`, and `undefined`-valued keys. Pass your own `clone` when that
matters:

```ts
historyPlugin<FormState>({
  clone: (s) => ({ ...s, fields: s.fields.map((f) => ({ ...f })) }),
  equality: (a, b) => a.revision === b.revision,
});
```

### Options

```ts
type CreateHistoryControllerOptions<T> = {
  id?: string; // default: generateId('history')
  initialValue?: T; // default: undefined — see the NaN trap in Usage
  limit?: number; // default: 100
  clone?: CloneStrategy<T>; // default: structuredClone, JSON fallback
  equality?: EqualityStrategy<T>; // default: Object.is
  storeKey?: string; // default: 'history' — plugin only
};
```

| Option         | Default                           | Description                                                                                                                                                                                       |
| -------------- | --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `initialValue` | `undefined`                       | Seeded as the **bottom of the undo stack** with `label: "initial"`, and cloned. It is not committed, so it does not appear as an undoable step — `canUndo` is `false` until the first real commit |
| `limit`        | `100`                             | Maximum undo stack length. The **oldest** entry is dropped when exceeded, so `limit` is how far back undo reaches. Read it as `controller.limit`; the store does not expose it                    |
| `clone`        | `structuredClone` → JSON fallback | Snapshot strategy, applied to the value on every commit, on the seed, and on restore                                                                                                              |
| `equality`     | `Object.is`                       | Dedupe check against the top of the undo stack. A commit that compares equal is dropped entirely                                                                                                  |
| `id`           | `generateId("history")`           | Controller identifier, readable as `controller.id`                                                                                                                                                |
| `storeKey`     | `"history"`                       | `$store` key. Plugin-only — the standalone controller ignores it                                                                                                                                  |

### Avoiding name collisions

`guardStore` throws a `RegistrationError` if another package has claimed
`history`. Rename without forking:

```ts
Alpine.plugin(historyPlugin<number>({ storeKey: "undo" })); // → $store.undo
```

`DEFAULT_HISTORY_STORE_KEY` keeps the default discoverable from TypeScript.

## Events

One event, `change`:

```ts
history.on("change", ({ source, value }) => {
  // source: 'commit' | 'undo' | 'redo' | 'clear' | 'reset'
  // value:  T | undefined
});
```

| `source` | Fires from                                                                                                        |
| -------- | ----------------------------------------------------------------------------------------------------------------- |
| `commit` | `commit`, `push`, `checkpoint`, and the inner push of `reset` — plus the depth announcements from `transaction()` |
| `undo`   | `undo()`                                                                                                          |
| `redo`   | `redo()`                                                                                                          |
| `clear`  | `clear()`, the clear inside `reset()`, and `transaction().rollback()`                                             |
| `reset`  | The final emit of `reset()`                                                                                       |

The plugin syncs the store on every `change`, so this is the event to listen to
for anything reactive. There is no separate event for a transaction opening or
closing — both arrive as `commit`.

## SSR

> SSR-safe — no `window`/`document` at import time, and no DOM access anywhere
> in the package. The controller is pure state.

`createHistoryController()` and `historyPlugin()` are both safe to call during
SSR, and unlike the other packages in this layer there is no `setup()` guard
because there is nothing to set up. The controller's state is entirely in
memory, so it serialises across the SSR boundary if you want it to — carry
`value` and let the client rebuild the stack, or carry `undoStack` if you need
the depth to survive.

## Accessibility

Not applicable — this is a Primitives-layer package and it produces no roles,
ARIA attributes or key bindings. It is a data structure.

The consumer's obligation: an Undo button must be a real `<button>` and must
actually be disabled when `canUndo` is false, not merely styled that way —
`<button :disabled="!$store.history.canUndo">` is the whole of it. A history
strip built on `undoStack` should be keyboard-reachable and should say where
each entry goes, which the `label` and `group` fields on the meta are for.

## Integration

- **@ailura/alpinejs-form** — a form's field state is the natural `T`. Commit
  per field change with a `group`, and use `transaction()` around a multi-field
  operation so it undoes as one step.
- **@ailura/alpinejs-keyboard** — register `mod+z` and `mod+shift+z` against
  `$store.history.undo()` / `.redo()`. Note that `keyboard`'s
  `preventDefault: true` default is what stops the browser's own undo from
  firing as well.

## Limitations

- **A commit equal to the top of the stack is silently dropped.** The default
  `equality` is `Object.is`, so this bites in two ways that both look like "my
  commit did nothing": committing a value that did not change, and committing
  `NaN` (because `Object.is(NaN, NaN)` is `true`). Pass a custom `equality` for
  your state, and coerce before arithmetic — see the `undefined` + 1 → `NaN`
  trap in [Usage](#2-alpine).
- **Three of the eight declared `HistoryChangeSource` values never fire.**
  `push`, `checkpoint` and `initialization` are on the union but nothing emits
  them: `push` goes through `commit`, `checkpoint` goes through `pushEntry`, and
  the seeded initial value is set in the constructor before any listener can
  exist. A `switch` over `source` will have unreachable arms.
- **`reset()` emits three events**, in this order: `clear`, then `commit` from
  the inner push, then `reset`. A listener that treats one user action as one
  event sees three.
- **Committing clears the redo stack.** Undo, then commit, and the redo branch
  is gone. This is the standard contract, not a bug, but it is the thing a user
  notices first.
- **`clear()` sets `value` to `undefined`,** not to the initial value. A cleared
  history has no current value, so `$store.history.value` is `undefined` until
  the next commit. Use `reset(value)` if you want to keep a position.
- **`checkpoint()` is a no-op on an unchanged value** and on an `undefined`
  value, because it shares the commit path's dedupe and its `undefined` guard.
  It is not a reliable "record this moment" primitive.
- **The default `clone` silently degrades to JSON.** `structuredClone` throws on
  a function, a DOM node or a `Map` with non-string keys, and the fallback drops
  them without a warning. The history entry then does not round-trip.
- **No maximum total memory.** `limit` bounds the number of entries, not their
  size, and `estimatedSize` is never computed. A history of large objects is a
  history of large objects.
- **`push` and `commit` are the same method.** The distinction is at the call
  site, not in behaviour.
- **`HistoryManager.limit` is not on the store.** The type has it, the store
  does not, so a template cannot show "undo depth out of 50".
- **`HistoryOptions` and `CreateHistoryOptions` are aliases** of
  `CreateHistoryControllerOptions`. All three name the same type.
- **`HistoryManager` requires `limit` and `HistoryStore` does not**, so a
  `HistoryController` satisfies the former and a store does not.

## Size

`3.53 kB raw / 1.26 kB gzip` · budget `3 kB` · externalized peers: `alpinejs`,
`@ailura/alpinejs-core` · `size-limit` + `publint` + `attw` verified.

## Architecture

[Primitives layer](../../ARCHITECTURE.md) — controllers own state, Alpine owns
reactivity. See canon, guards, and SSR rules in
[ARCHITECTURE.md](../../ARCHITECTURE.md).

## Testing

```sh
pnpm test              # vp test (happy-dom)
pnpm run typecheck     # tsc --noEmit
```

One suite, `store-reactivity.test.ts`, covering the store's sync, undo/redo and
the stack flags.

## License

MIT
