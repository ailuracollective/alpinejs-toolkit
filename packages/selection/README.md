# @ailura/alpinejs-selection

<p align="center">

[![bundlephobia minzip](https://badgen.net/bundlephobia/minzip/@ailura/alpinejs-selection)](https://bundlephobia.com/package/@ailura/alpinejs-selection)

</p>

> Headless single / multiple / range selection — a store of keyed instances, an `x-selection` directive that owns their lifetime, and a `select(id, key, { behavior })` entry point that replaces, toggles and extends on @ailura/alpinejs-core.

## Installation

```sh
pnpm add @ailura/alpinejs-selection alpinejs
# or
npm install @ailura/alpinejs-selection alpinejs
```

Requires `alpinejs@^3.0.0` as peer. `@ailura/alpinejs-core` is a **peer
dependency**, not a dependency: no package in this toolkit has a
`dependencies` block, so the host installs it too.

## Usage

This package registers a store, a magic and one directive:

| Registration       | Default name       | Guard            |
| ------------------ | ------------------ | ---------------- |
| `$store.selection` | `"selection"`      | `guardStore`     |
| `$selection`       | follows `storeKey` | `guardMagic`     |
| `x-selection`      | `"selection"`      | `guardDirective` |

### 1. Alpine — with the directive

The directive creates an instance when its element initialises and destroys it
when Alpine removes that element, which is the lifecycle this package asks for:

```html
<div x-data="{ items: ['a', 'b', 'c'], id: $el.dataset.selectionId }">
  <ul
    x-selection="{ mode: 'multiple', keys: items, disabledKeys: ['c'] }"
    role="listbox"
    aria-label="Files"
    aria-multiselectable="true"
  >
    <template x-for="key in items" :key="key">
      <li role="presentation">
        <button
          type="button"
          role="option"
          @click="$store.selection.select(id, key, { behavior: 'toggle' })"
          :aria-selected="$store.selection.isSelected(id, key)"
          :disabled="!$store.selection.isSelectable(id, key)"
          x-text="key"
        ></button>
      </li>
    </template>
  </ul>
</div>
```

The id reaches the bindings through `data-selection-id`, which the directive
writes on the element. Reading it as `$el.dataset.selectionId` in `x-data` is the
shortest way to hand it to the children; `$el.closest('[x-selection]').dataset.selectionId`
at each use site works too and does not depend on `x-data` ordering.

Three forms of the expression — and the "bare id" one is **not** a bare
identifier:

| Expression                                        | Meaning                                                                                      |
| ------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| `x-selection="'files'"`                           | An explicit id, as a **quoted string literal**. The quotes are required — see below          |
| `x-selection="{ id: 'files', mode: 'multiple' }"` | The options bag with an explicit `id`                                                        |
| `x-selection="{ mode: 'range', keys: items }"`    | The options bag; without an `id` one is generated                                            |
| `x-selection` (no value)                          | A no-op — **not** an instance with a generated id. A bare directive would otherwise leak one |

> **`x-selection="files"` does not work.** An unquoted expression is evaluated as
> JavaScript, so Alpine resolves a variable named `files` and throws
> `ReferenceError: files is not defined` when there is none. This directive does
> not opt into `createValueReader`'s `literalBareIdentifier`, deliberately — the
> core helper documents that opting in trades away `x-carousel="id"`-style
> expressions that name a real variable. Quote the id, or put it in the options
> bag as `id`.

### 2. Alpine — creating the instance yourself

```ts
Alpine.data("picker", () => ({
  items: ["a", "b", "c"],
  init() {
    this.$store.selection.create("files", {
      mode: "multiple",
      keys: this.items,
      disabledKeys: ["c"],
      onChange: (detail) => console.log(detail.selectedKeys),
    });
  },
  teardown() {
    // Pair this with create(), or `instances` grows one entry per navigation.
    this.$store.selection.destroy("files");
  },
}));
```

The hand-written form is unchanged by the directive and is what you want when
the instance outlives the element that declared it.

### 3. Standalone (framework-agnostic)

```ts
import { createSelectionController } from "@ailura/alpinejs-selection";

const ctrl = createSelectionController(); // already mounted
ctrl.create("rows", { mode: "range", keys: ["a", "b", "c", "d"] });

ctrl.select("rows", "b"); // { behavior: 'replace' } → value { from: "b" }
ctrl.setAnchor("rows", "b");
ctrl.select("rows", "d", { behavior: "extend" }); // value { from: "b", to: "d" }
ctrl.getSnapshot("rows").selectedKeys; // ['b', 'c', 'd'] — the closed span

const off = ctrl.on("change", (detail) => {
  detail.id; // "rows"
  detail.mode; // 'single' | 'multiple' | 'range'
  detail.value; // the mode-shaped value
  detail.selectedKeys; // the resolved key list — what a template should bind
  detail.previous; // the value before this call
});
ctrl.on("destroy", ({ id }) => console.log(id, "is gone"));
off();
ctrl.destroy(); // destroys every instance and all subscriptions
```

## API

| Export                        | Description                                                                                                           | Type       |
| ----------------------------- | --------------------------------------------------------------------------------------------------------------------- | ---------- |
| `SelectionController`         | Controller class — owns the instance registry, emits `change` and `destroy`                                           | `class`    |
| `createSelectionController`   | Factory — `(options?) => SelectionController`; **mounts before returning**                                            | `function` |
| `selectionPlugin`             | `Alpine.plugin()` factory — `(options?) => (alpine) => void`; also the package's `default` export                     | `function` |
| `DEFAULT_SELECTION_STORE_KEY` | Default `$store` key — `"selection"`                                                                                  | `string`   |
| `DEFAULT_SELECTION_MAGIC_KEY` | Default `$selection` key — the same constant as the store key                                                         | `string`   |
| `CreateSelectionOptions`      | Plugin options — `{ id, storeKey, magicKey, directiveKey }`                                                           | `type`     |
| `SelectionControllerOptions`  | Factory options — `{ id }`                                                                                            | `type`     |
| `SelectionStore`              | The full `$store.selection` surface — `instances` plus 19 commands                                                    | `type`     |
| `SelectionInstance`           | Readonly snapshot — `{ mode, value, keys, disabledKeys, anchorKey, activeKey, selectedKeys, allowDisabledSelection }` | `type`     |
| `SelectionOptions`            | Instance options — `{ mode, keys, disabledKeys, allowDisabledSelection, value, defaultValue, onChange }`              | `type`     |
| `SelectionSelectOptions`      | `{ behavior?: 'replace' \| 'toggle' \| 'extend' }`                                                                    | `type`     |
| `SelectionMode`               | `'single' \| 'multiple' \| 'range'`                                                                                   | `type`     |
| `SelectionBehavior`           | `'replace' \| 'toggle' \| 'extend'`                                                                                   | `type`     |
| `SelectionKey`                | `string \| number` — a key is compared as a string throughout                                                         | `type`     |
| `SelectionValue`              | Mode-shaped value: `SelectionKey \| null \| readonly SelectionKey[] \| SelectionRange`                                | `type`     |
| `SelectionRange`              | `{ from: SelectionKey; to?: SelectionKey }`                                                                           | `type`     |
| `SelectionChangeDetail`       | `change` payload — `{ id, mode, value, selectedKeys, previous }`                                                      | `type`     |
| `SelectionDestroyDetail`      | `destroy` payload — `{ id }`                                                                                          | `type`     |
| `SelectionEvents`             | Event map — `change`, `destroy`                                                                                       | `type`     |
| `SelectionPluginCallback`     | `(alpine: Alpine) => void` — the `Alpine.plugin()` callback signature                                                 | `type`     |
| `SelectionAlpine`             | Alias for the `Alpine` type the plugin callback receives                                                              | `type`     |

`SelectionDirectiveOptions` (`SelectionOptions & { id?: string }`) is declared in
`src/types.ts` but **not exported from the barrel** — see
[Limitations](#limitations). So is `DEFAULT_SELECTION_DIRECTIVE_KEY`.

`SelectionController` also exposes `hasInstance(id)`, `getSnapshot(id)`,
`snapshot(id)`, `snapshotInstances()`, and the alias `toStoreInstances()`.

### Modes and the value each one holds

The `value` is mode-shaped. That is the point of the mode — a consumer of the
snapshot does not have to branch — but it also means a value set in the wrong
mode is **coerced**, not rejected:

| Mode       | `value` shape             | Empty value | `selectedKeys`                          |
| ---------- | ------------------------- | ----------- | --------------------------------------- |
| `single`   | `SelectionKey \| null`    | `null`      | `[key]` or `[]`                         |
| `multiple` | `readonly SelectionKey[]` | `[]`        | the array, filtered to `keys`           |
| `range`    | `SelectionRange \| null`  | `null`      | **the closed span** between the indices |

`selectedKeys` is the field to bind. For `range` it is derived from the _positions_
of `from`/`to` in `keys`, so a range over a reordered list moves with the list, and
a range whose endpoints are no longer in `keys` resolves to `[]`.

### Store API — `$store.selection`

`instances` is a reactive registry, one `SelectionInstance` per id, rewritten
from the controller on every change.

```ts
$store.selection.instances.files?.mode; // 'single' | 'multiple' | 'range'
$store.selection.instances.files?.value; // mode-shaped value
$store.selection.instances.files?.selectedKeys; // readonly — bind this
$store.selection.instances.files?.keys; // the whitelist, as given
$store.selection.instances.files?.disabledKeys; // the blacklist, as given
$store.selection.instances.files?.anchorKey; // null until replace/toggle/extend
$store.selection.instances.files?.activeKey; // null until setActive/select
$store.selection.instances.files?.allowDisabledSelection; // boolean
```

| Command                         | Behaviour                                                                                                                            |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `create(id, options?)`          | Creates an instance. `mode` defaults to `'single'`. Re-creating an id **replaces** it, emitting `change`                             |
| `destroy(id)`                   | Removes one instance and emits `destroy`. An unknown id is a silent no-op                                                            |
| `destroyAll()`                  | Removes every instance, emits `destroy` for each, **and destroys the controller**                                                    |
| `setKeys(id, keys)`             | Replaces the key set, then prunes the value down to what still exists. `anchorKey`/`activeKey` are cleared if they no longer resolve |
| `setDisabledKeys(id, keys)`     | Replaces the disabled set. Does **not** re-check the current value                                                                   |
| `setMode(id, mode)`             | Switches mode, coercing the value. A no-op when the mode is unchanged                                                                |
| `setValue(id, value)`           | Sets the value, coerced to the mode. The way to restore a value read from a URL                                                      |
| `select(id, key, { behavior })` | **The entry point.** `behavior` defaults to `'replace'`; dispatches to the three named commands                                      |
| `replace(id, key)`              | Selects `key` alone; sets both `anchorKey` and `activeKey`. Refuses unknown and disabled keys                                        |
| `toggle(id, key)`               | `single`: `null` ↔ key. `multiple`: add/remove. `range`: collapse the span to `{ from: key }`, or `null` if already in the span      |
| `extend(id, key)`               | Extends from `anchorKey` (or `key` when there is none). Honours disabled keys                                                        |
| `clear(id)`                     | `null` / `[]`, and clears `anchorKey`. `activeKey` is **not** cleared                                                                |
| `selectAll(id)`                 | Every key that is not disabled. In `single` and `range` mode that is the _first_ enabled key, not everything                         |
| `setActive(id, key \| null)`    | Sets the roving/active marker                                                                                                        |
| `setAnchor(id, key \| null)`    | Sets the range anchor                                                                                                                |
| `getSnapshot(id)`               | The controller's own snapshot — throws if the id is unknown, unlike the registry read                                                |
| `isSelected(id, key)`           | `true` when `key` is in `selectedKeys`. Reads the registry, so it re-renders                                                         |
| `isSelectable(id, key)`         | `false` for a disabled key (unless `allowDisabledSelection`), and for an unknown key _when `keys` is non-empty_                      |
| `isActive(id, key)`             | `true` when `key` is `activeKey`. Reads the registry                                                                                 |
| `isAnchor(id, key)`             | `true` when `key` is `anchorKey`. Reads the registry                                                                                 |

`isSelected`, `isActive` and `isAnchor` are the three that read
`instances[id]` rather than the controller. That is deliberate — they go through
the reactive proxy so a template re-renders — and it is why they return `false`
rather than throwing for an unknown id, and why they are `function` expressions
using `this` and must be called as `$store.selection.isSelected(...)`, never
detached.

### Options

```ts
interface CreateSelectionOptions {
  id?: string; // controller id — defaults to generateId("selection")
  storeKey?: string; // $store key — default DEFAULT_SELECTION_STORE_KEY
  magicKey?: string; // $magic key — default magicKey ?? storeKey
  directiveKey?: string; // x- directive name, without x- — default "selection"
}
```

```ts
type SelectionOptions = {
  mode?: SelectionMode; // default 'single'
  keys?: readonly SelectionKey[]; // default []
  disabledKeys?: readonly SelectionKey[]; // default []
  allowDisabledSelection?: boolean; // default false
  value?: SelectionValue; // wins over defaultValue
  defaultValue?: SelectionValue; // used when `value` is absent
  onChange?: (detail: SelectionChangeDetail) => void;
};
```

| Option                   | Default    | Effect                                                                                                      |
| ------------------------ | ---------- | ----------------------------------------------------------------------------------------------------------- |
| `mode`                   | `'single'` | Decides the shape of `value` and of every command's effect                                                  |
| `keys`                   | `[]`       | The universe. A command on a key not in `keys` is a silent no-op, so this is the list you must keep current |
| `disabledKeys`           | `[]`       | Refused by `replace`, `extend`, `selectAll` and `isSelectable`                                              |
| `allowDisabledSelection` | `false`    | `true` disables the disabled-key guard — use it for a "select all, disabled rows included" case             |
| `value`                  | —          | Seeded and normalized through `normalizeValue` for the mode                                                 |
| `defaultValue`           | —          | Read only when `value` is absent. With neither, the empty value for the mode                                |
| `onChange`               | —          | Called with the same detail as the `change` event, after the event is emitted                               |

`keys` is a whitelist, not an index. Nothing in this package re-derives it from
the DOM: if the rendered list grows, `setKeys` must be called.

### Avoiding name collisions

```ts
Alpine.plugin(selectionPlugin({ storeKey: "files", directiveKey: "file-selection" }));
// → $store.files, $files, x-file-selection
```

`magicKey` follows `storeKey` — renaming the store renames both, resolved with
`resolvePluginKeys`, so one `storeKey` is enough to move the package off a
collided name. All three registrations go through `guardStore` / `guardMagic` /
`guardDirective`, so a collision throws a `RegistrationError` rather than
silently overwriting. Note that `DEFAULT_SELECTION_MAGIC_KEY` and
`DEFAULT_SELECTION_STORE_KEY` are the same constant, while
`DEFAULT_SELECTION_DIRECTIVE_KEY` is a separate literal that is **not exported**
— the default directive name is `"selection"`, documented here rather than
discoverable from the package.

### Events

```ts
import type { SelectionChangeDetail, SelectionDestroyDetail } from "@ailura/alpinejs-selection";

ctrl.on("change", (detail: SelectionChangeDetail) => {
  detail.id; // the instance id
  detail.mode;
  detail.value; // mode-shaped
  detail.selectedKeys; // resolved — bind this
  detail.previous; // the value before this command
});

ctrl.on("destroy", (detail: SelectionDestroyDetail) => {
  detail.id; // removed
});
```

`destroy` is a separate event because a `change` detail describes an instance's
state, and by the time a destroy is announced there is no state left to describe.
Without it there is no way to tell a listener an id is gone. Every mutator
except `destroy`/`destroyAll` emits `change` — including `setActive` and
`setAnchor`, which do not change the selection at all. A host that re-renders on
every `change` will therefore see events from pure focus movement.

## SSR

> SSR-safe — no `window`/`document` at import time. Nothing here touches the DOM;
> the controller is pure state plus a typed event emitter.

State is in-memory, so a server render produces nothing: `$store.selection.instances`
is `{}` and every command throws (`selection instance "<id>" not found`) because
`invariant` guards each one. Create the instance on the client — the
`x-selection` directive does this at init, or call `create()` from `x-init`.

Keys come from your data, so `x-selection="{ keys: items }"` is only correct if
`items` is populated by the time the element initialises. `x-init` runs after
`x-selection` is registered, so seeding the list in `x-init` leaves the instance
with `keys: []` — pass the keys through `$nextTick`, or create the instance by
hand with `setKeys()` once the data lands.

## Accessibility

> This is a `Primitives` package and ships **no ARIA and no key bindings.** It is
> a selection primitive, and the right widget role depends on the host: the same
> single/multiple/range value can back a `listbox`, a grid of `role="checkbox"`
> tiles, a file table, or shift-click range selection — which has no ARIA pattern
> at all. Claiming `role="listbox"` here would be wrong for most of them.

The read helpers are what a host binds:

```html
<button
  role="option"
  :aria-selected="$store.selection.isSelected('files', key)"
  :aria-disabled="!$store.selection.isSelectable('files', key)"
  @click="$store.selection.select('files', key, { behavior: 'toggle' })"
  x-text="key"
></button>
```

Bind each attribute **individually**. An object-form `x-bind` is evaluated once,
so an object carrying `aria-selected` freezes at its init value — which is why
this package offers no `itemProps()`/`listProps()` helper to spread, and why
there is nothing to configure here.

Keyboard handling is the host's. `setActive` and `setAnchor` exist so a host can
drive a roving `tabindex` or `aria-activedescendant` from its own key handling;
nothing in this package listens for a key. A selection widget also needs
`role="listbox"`, `aria-multiselectable`, and per-option `aria-selected` for the
value to be announced — write them in your markup.

## Integration

- **@ailura/alpinejs-collection** — `setActiveKey(id, key)` on a collection and
  `setActive(id, key)` on a selection instance are the same idea at different
  levels. A keyboard list is usually a collection (filter, sort, page) whose rows
  are a selection; `CollectionController.isSelected()` takes a selection
  instance's `selectedKeys` structurally.
- **@ailura/alpinejs-virtual** — virtualising a selectable list means `keys` has
  to describe the _whole_ list while the DOM shows a window. `selectedKeys`
  resolves against `keys`, not against rendered rows, so paging does not lose the
  selection.

## Limitations

- **`destroyAll()` destroys the controller.** It clears every instance and then
  calls `super.destroy()`, after which every mutator is a silent no-op and the
  `$store.selection` registry is frozen for the life of the page. Use
  `destroy(id)` per instance unless you mean to tear the store down.
- **`toggle()` ignores `disabledKeys`.** `replace()` and `extend()` refuse a
  disabled key and `isSelectable()` reports it as `false`, but `toggle()` only
  checks `keys`. A host gating on `isSelectable()` is safe; a host calling
  `toggle()` without that gate is not.
- **`selectAll()` in `single` and `range` mode selects only the first enabled
  key.** That is not a bug — the mode forbids more — but the name reads as
  "everything", so a `selectAll` button in a single-select list is confusing.
- **`clear()` leaves `activeKey` set.** It clears the value and `anchorKey`, not
  the roving marker, so a list with no selection can still report an active row.
- **`setDisabledKeys()` does not re-validate the current value.** A key already
  selected stays selected after being disabled; `isSelected()` keeps returning
  `true`.
- **`getSnapshot(id)` throws on an unknown id** while `isSelected(id, key)` and
  the registry read return `false`. The mix is deliberate — a command needs an
  instance, a predicate is asked about every row — but it means a template using
  `getSnapshot()` on an uncreated id throws inside an Alpine effect.
- **`isSelectable()` returns `true` for every key while `keys` is empty.** The
  whitelist check is skipped when there are no keys at all, so an instance
  created without `keys` — and before `setKeys()` — reports every row as
  selectable. The commands disagree: they _do_ require membership, so they no-op.
  Seed `keys` at `create()` if you bind `isSelectable()`.
- **`x-selection="files"` throws.** An unquoted expression is evaluated as
  JavaScript, and Alpine resolves `files` as a variable — a `ReferenceError` when
  there is none. The correct spellings are `x-selection="'files'"` (a quoted
  string literal) and `x-selection="{ id: 'files' }"`. `CreateSelectionOptions.directiveKey`
  and the comment above `createValueReader` in `plugin.ts` both say
  `x-selection="files"` names an explicit id, which is wrong.
- **`x-selection` re-creates on every expression change.** The directive tears
  down and recreates the instance whenever its expression re-evaluates to a new
  value, which means a reactive `keys: items` re-seeds the instance — resetting
  the selection. That is why a list bound through the directive should pass a
  stable expression or use `setKeys()` on a hand-created instance.
- **`x-selection` destroys the instance on teardown, and it is the only mechanism
  that runs.** An Alpine store registration has no Alpine-invoked disposer in
  Alpine 3.17; the directive's own `cleanup()` is what the runtime drains when
  the element leaves the tree. A hand-written `create()` gets nothing, which is
  the leak the docs warn about.
- **`pnpm run typecheck` fails in this package's test folder.** One error,
  pre-existing and not in `src/`: `test/no-widget-claims.test.ts:38` calls
  `(fn as (id: string, k: string) => unknown)(controller, "s", "a")` — three
  arguments against a two-argument signature. The guard it is asserting (that no
  `itemProps`/`listProps`-shaped method emits ARIA) still runs correctly, because
  the loop's `typeof fn !== "function"` check means it never reaches that call for
  any method that does not exist. `vp test` is green; only `tsc` complains.
- **`SelectionDirectiveOptions` and `DEFAULT_SELECTION_DIRECTIVE_KEY` are not
  exported from `src/index.ts`.** Both are declared and both are used — the
  directive's type argument and the `directiveKey` default — but neither reaches
  the barrel, so a consumer cannot name the directive's expression type or read
  the default directive key as a constant.
- **`toStoreInstances()` and `toKeyString()` are internal.** Both are exported
  from `src/controller.ts` and used by `plugin.ts`, but neither is in the barrel.
- **Keys are compared as strings.** `SelectionKey` is `string | number`, but every
  comparison goes through `toKeyString`, so `create({ keys: [1, 2] })` and
  `select(id, '1')` agree. `selectedKeys` is always `string[]`.
- **The `range` mode's span includes disabled keys.** `extend()` only checks its
  endpoint, so a range from `a` to `d` over a list where `b` is disabled yields
  `['a','b','c','d']` with `b` in it. Filtering the disabled keys out of the
  rendered range is the host's.

## Size

`7.67 kB raw / 2.44 kB gzip` · budget `4 kB` · externalized peers: `alpinejs`, `@ailura/alpinejs-core` · `size-limit` + `publint` + `attw` verified.

## Architecture

[Primitives layer](../../ARCHITECTURE.md) — controllers own state, Alpine owns reactivity. See canon, guards, and SSR rules in [ARCHITECTURE.md](../../ARCHITECTURE.md).

## Testing

```sh
pnpm test              # vp test (happy-dom)
pnpm run typecheck     # tsc --noEmit
```

## License

MIT
