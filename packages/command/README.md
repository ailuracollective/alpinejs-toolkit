# @ailura/alpinejs-command

<p align="center">

[![bundlephobia minzip](https://badgen.net/bundlephobia/minzip/@ailura/alpinejs-command)](https://bundlephobia.com/package/@ailura/alpinejs-command)

</p>

> Alpine.js command palette — a registry with ranked filtering, pinned and recent ids, nested pages that load their own commands, async actions, and combobox/listbox ARIA on @ailura/alpinejs-core.

## Installation

```sh
pnpm add @ailura/alpinejs-command alpinejs
# or
npm install @ailura/alpinejs-command alpinejs
```

Requires `alpinejs@^3.0.0` as peer. `@ailura/alpinejs-core` is a **peer
dependency**, not a dependency: no package in this toolkit has a
`dependencies` block, so the host installs it too.

## Usage

### 1. Standalone (framework-agnostic)

```ts
import { createCommandController } from "@ailura/alpinejs-command";

const ctrl = createCommandController({
  closeOnRun: true,
  persistence: { maxRecent: 5 },
  rank: (item, search) => (item.label === search ? 3 : null),
});

const unregister = ctrl.register({
  id: "toggle-theme",
  label: "Toggle theme",
  group: "Appearance",
  keywords: ["dark", "light"],
  action: () => document.documentElement.classList.toggle("dark"),
});

ctrl.open();
ctrl.visibleItems; // CommandItemState[] — ranked, filtered, hidden removed
await ctrl.run("toggle-theme"); // awaits action, records it as recent, closes
ctrl.recentIds; // ['toggle-theme']
ctrl.pageStack; // ['root']

unregister(); // or ctrl.unregister("toggle-theme")
// ctrl.destroy() when done
```

The controller owns all mutable state and is safe to drive from any stack —
Blade, Livewire, Astro, or plain TypeScript.

### 2. Alpine

```ts
import Alpine from "alpinejs";
import commandPlugin from "@ailura/alpinejs-command";

Alpine.plugin(commandPlugin({ closeOnRun: true }));
Alpine.start();
```

```html
<div x-data>
  <button @click="$store.command.toggle()">Open</button>

  <input
    type="text"
    x-model="$store.command.search"
    x-bind="$store.command.inputProps()"
    @keydown="$store.command.handleKeydown($event)"
  />

  <ul x-bind="$store.command.listboxProps()">
    <template x-for="(entry, index) in $store.command.visibleItems" :key="entry.id">
      <li>
        <!--
          A raw <button> is right here: optionProps() computes role="option",
          id, aria-selected and aria-disabled, and a chrome variant would
          overwrite exactly what is being demonstrated.
        -->
        <button
          type="button"
          x-bind="$store.command.optionProps(entry.id)"
          :disabled="entry.disabled || entry.loading"
          @click="$store.command.run(entry.id)"
        >
          <span x-text="entry.item.label"></span>
        </button>
      </li>
    </template>
  </ul>
</div>
```

The plugin registers `$store.command`. There is no magic, and no directive: the
palette's markup is yours, and the store hands you the filtered list and the
ARIA attributes.

**Two bindings cannot be swapped for `x-bind` alone.** `optionProps()` computes
`aria-selected` from the active index, and an object-form `x-bind` is evaluated
exactly once — so live attributes stay as per-attribute bindings
(`:aria-selected="index === $store.command.activeIndex"`), and the static ones go
through `x-bind`.

## API

### Exports

| Export                      | Description                                                                                                                                             | Type       |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| `CommandController`         | Framework-agnostic controller class — owns the registry, search, pages, runs, emits 4 events                                                            | `class`    |
| `createCommandController`   | Factory — `createCommandController(options?) => CommandController`. **Does not mount**                                                                  | `function` |
| `commandPlugin`             | Alpine plugin factory — `commandPlugin(options?) => AlpineCallback`; also the `default` export                                                          | `function` |
| `DEFAULT_COMMAND_STORE_KEY` | Default `$store` key — `"command"`                                                                                                                      | `string`   |
| `CommandPluginOptions`      | Plugin options — `CommandStoreConfig` plus `{ id, storeKey }`                                                                                           | `type`     |
| `CommandControllerOptions`  | Controller factory options — `CommandStoreConfig` plus `{ id }`                                                                                         | `type`     |
| `CommandStoreConfig`        | Behaviour options — `onOpen`, `onClose`, `onRun`, `rank`, `persistence`, `closeOnRun`                                                                   | `type`     |
| `CommandStore`              | Alpine-facing store surface, including `filteredItems`, `visibleItems`, `groupedItems`                                                                  | `type`     |
| `CommandItem`               | One registered command — `id`, `label`, `group`, `shortcut`, `keywords`, `aliases`, `disabled`, `hidden`, `enabled`, `pinned`, `page`, `load`, `action` | `type`     |
| `CommandItemState`          | A visible item plus its computed state — `disabled`, `loading`, `pinned`, `recent`, `rank`, `selectable`                                                | `type`     |
| `CommandPage`               | A nested page — `id`, `title`, `parentId`, `load`                                                                                                       | `type`     |
| `CommandAction`             | `() => void \| Promise<void>` — what a command does                                                                                                     | `type`     |
| `CommandLoader`             | `() => void \| Promise<void>` — what a page's `load` does                                                                                               | `type`     |
| `CommandPredicate`          | `boolean \| (() => boolean)` — the shape of `disabled` / `hidden` / `enabled`                                                                           | `type`     |
| `CommandRankFn`             | `(item, search) => number \| null`; `null` means "filtered out of this search"                                                                          | `type`     |
| `CommandPersistence`        | `{ maxRecent }`                                                                                                                                         | `type`     |
| `CommandExecutionState`     | `"idle" \| "loading" \| "running"`                                                                                                                      | `type`     |
| `CommandEvents`             | Event map for `controller.on(…)`                                                                                                                        | `type`     |
| `CommandAlpine`             | Typed view of `Alpine` used by the plugin (an alias for Alpine's own)                                                                                   | `type`     |
| `CommandPluginCallback`     | `(alpine: Alpine) => void`                                                                                                                              | `type`     |

### Controller API

| Member                                                                        | Description                                                                                                                                                                                  |
| ----------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `register(item)`                                                              | Adds a command. **Throws** `Cannot register after destroy` if frozen and `Duplicate command id "x"` on a repeat id. Returns an unregister function                                           |
| `unregister(id)`                                                              | Removes it, along with its pinned and recent entries                                                                                                                                         |
| `open()` / `close()` / `toggle()`                                             | Visibility. Both are no-ops when already in that state, and each resets `search` and `activeIndex`. `close()` additionally resets the page stack to `["root"]`; `open()` does not restore it |
| `run(id)`                                                                     | Runs a visible, non-disabled command and **resolves to `void`** — it does not report whether it ran. Silent for an unknown or disabled id                                                    |
| `cancelRun()`                                                                 | Clears the in-flight set. It does **not** abort the promises already running — see Limitations                                                                                               |
| `pushPage(page)`                                                              | Pushes onto the page stack, resets search and active index, then `await page.load?.()`                                                                                                       |
| `popPage()` / `goBack()`                                                      | Same thing. `goBack()` is the readable alias; neither is a no-op at the root — `popPage()` returns early below one                                                                           |
| `itemState(id)`                                                               | The `CommandItemState` for a **visible** id, or `null`. A command filtered out by the current search returns `null`                                                                          |
| `handleKeydown(e)`                                                            | Arrow/Enter/Escape/Backspace navigation. A no-op while the palette is closed                                                                                                                 |
| `visibleItems`                                                                | Ranked, filtered, hidden-removed `CommandItemState[]`, sorted by `rank` descending                                                                                                           |
| `filteredItems`                                                               | `visibleItems.map(v => v.item)`                                                                                                                                                              |
| `groupedItems`                                                                | The same items keyed by `item.group ?? "General"`                                                                                                                                            |
| `search`                                                                      | Readable **and writable**. Assigning resets `activeIndex` to 0 and emits `change`                                                                                                            |
| `activeIndex`                                                                 | Readable and writable; a write below 0 clamps to 0                                                                                                                                           |
| `visible` / `isOpen`                                                          | The same boolean, twice                                                                                                                                                                      |
| `executionState` / `runningId` / `loadingIds`                                 | `"idle" \| "running"`; the newest in-flight id; every in-flight id                                                                                                                           |
| `items` / `pages` / `currentPageId` / `pageStack` / `pinnedIds` / `recentIds` | Read-only snapshots                                                                                                                                                                          |
| `toStore()`                                                                   | The controller cast to `CommandStore`. The plugin does not use it — it builds its own reactive facade (see Architecture)                                                                     |

### Store API

```ts
// Registry
$store.command.register({ id: "new", label: "New file", action: () => … }); // returns an unregister fn
$store.command.unregister("new");

// Visibility
$store.command.open();
$store.command.close();
$store.command.toggle();

// Search — writable, and the two fields an x-model owns
$store.command.search; // string (settable)
$store.command.activeIndex; // number (settable)

// Running
$store.command.run("new"); // typed as Promise<void>, but returns undefined — see Limitations
$store.command.cancelRun();

// Pages
$store.command.pushPage({ id: "settings", title: "Settings", load: () => … });
$store.command.popPage();
$store.command.goBack();

// Reads
$store.command.visibleItems; // CommandItemState[] — what you actually render
$store.command.filteredItems; // CommandItem[] — no computed state
$store.command.groupedItems; // Record<string, CommandItem[]>
$store.command.itemState("new"); // CommandItemState | null
$store.command.items; // Record<string, CommandItem>
$store.command.pinnedIds; // string[]
$store.command.recentIds; // string[] — newest first
$store.command.loadingIds; // string[]
$store.command.runningId; // string | null
$store.command.executionState; // "idle" | "running"
$store.command.currentPageId; // "root" by default
$store.command.pageStack; // ["root"]
$store.command.pages; // Record<string, CommandPage>

// ARIA
$store.command.inputProps(); // { role, aria-expanded, aria-controls, aria-activedescendant, aria-autocomplete }
$store.command.listboxProps(); // { role, id, aria-label }
$store.command.optionProps("new"); // { role, id, aria-selected, aria-disabled }

// Keyboard + teardown
$store.command.handleKeydown($event);
$store.command.destroy();
```

### Options

Plugin (`CommandPluginOptions`):

| Option                  | Default                 | Description                                                                   |
| ----------------------- | ----------------------- | ----------------------------------------------------------------------------- |
| `id`                    | `generateId("command")` | Controller id. Diagnostic only                                                |
| `storeKey`              | `"command"`             | `$store` key. Only `undefined`/`null` fall back to the default                |
| `onOpen` / `onClose`    | —                       | Side effects on the transitions                                               |
| `onRun`                 | —                       | `(item: CommandItem) => void`, called after the action resolves               |
| `rank`                  | `defaultRank` (below)   | `(item, search) => number \| null`. Higher sorts first; `null` hides the item |
| `persistence.maxRecent` | `10`                    | How many ids `recentIds` keeps                                                |
| `closeOnRun`            | `true`                  | `false` keeps the palette open after a successful run                         |

The default rank function, exactly:

```ts
// returns 1 for every item when the search is empty,
// 2 when the lowercased label contains it, 1 when a keyword does, else null.
```

**`item.aliases` is not part of it.** Aliases are read by nothing in this
package — see Limitations.

`register()` also takes `pinned` (seeds `pinnedIds`) and `page` (which page
the item belongs to; `"root"` when absent).

### Avoiding name collisions

```ts
Alpine.plugin(commandPlugin({ storeKey: "cmdk" })); // → $store.cmdk
```

`command` is store-only — there is no magic and no directive, so `storeKey` is
the only name to move. The exported `DEFAULT_COMMAND_STORE_KEY` keeps the
default discoverable from TypeScript, and `guardStore` throws
`RegistrationError` (`code: 'REGISTRATION_COLLISION'`) rather than
overwriting a name another package already claimed.

### Events

```ts
import type { CommandItem } from "@ailura/alpinejs-command";

const off = ctrl.on("run", (item: CommandItem) => console.log(item.id));
ctrl.on("open", () => …);
ctrl.on("close", () => …);
ctrl.on("change", () => …); // every mutation: search, register, run, page nav
```

`on` returns an unsubscribe function. `change` is the coarse signal the
plugin's sync subscribes to; `open`, `close` and `run` are the semantic ones
for application code.

## Ranking

`rank(item, search)` decides both membership and order:

- `null` — the item is filtered out **when a search is active**. An empty
  search never filters: every item ranks.
- a number — higher sorts first. Ties keep registration order.

The built-in rank gives 2 for a label substring match and 1 for a keyword
match, so a command whose label contains the query outranks one that only has a
matching keyword. Supply your own to change that:

```ts
commandPlugin({
  rank(item, search) {
    if (!search) return item.pinned ? 2 : 1; // pinned float to the top
    if (item.label.toLowerCase().startsWith(search.toLowerCase())) return 3;
    if (item.aliases?.some((a) => a.startsWith(search.toLowerCase()))) return 2;
    return null;
  },
});
```

`visibleItems` is memoised on `(pageId, search, item count, pinned count,
recent count, running ids)`. Changing a command's _content_ — relabelling it,
flipping `disabled` — does not change that key, so the cache can serve a stale
rank until something else invalidates it. Call `register()`/`unregister()` to
bust it.

## Nested pages

A page is a stack frame with its own commands. `load` runs every time the page
is pushed, so it has to be safe to re-run:

```ts
const ctrl = createCommandController();
await ctrl.pushPage({
  id: "settings",
  title: "Settings",
  parentId: "root",
  async load() {
    const prefs = await loadPreferences();
    ctrl.register({ id: "settings-theme", label: "Theme", page: "settings", action: … });
    return prefs; // the return value is discarded; load exists for its effect
  },
});
```

`register()` **throws** on a duplicate id, so a `load` that runs twice must
guard itself — check `ctrl.items[id]` first. `Backspace` with an empty search
pops a page, and `close()` resets the stack to `["root"]`.

## SSR

> Import-safe and SSR-safe. Nothing reads `window`, `document` or
> `matchMedia` at module scope; the controller touches no DOM at all, and the
> plugin's facade is a plain object. `open()`/`close()`/`run()` all work on the
> server if you drive them yourself. The palette's own markup is yours, so
> whether it server-renders open, closed or not at all is also yours.

## Accessibility

- Roles/attributes managed: `inputProps()` gives the input `role="combobox"`,
  `aria-expanded` bound to the palette's visibility, `aria-autocomplete="list"`,
  `aria-controls="command-listbox"` and `aria-activedescendant` pointing at the
  active option; `listboxProps()` gives the list `role="listbox"`,
  `id="command-listbox"` and `aria-label` set to the **current page's title**;
  `optionProps()` gives each row `role="option"`, `id="command-option-<id>"`,
  `aria-selected` on the active row and `aria-disabled` on a disabled one
- Keyboard: `handleKeydown()` — `ArrowDown`/`ArrowUp` move the active index,
  **skipping disabled rows** and wrapping; `Enter` runs the active command;
  `Escape` closes; `Backspace` with an empty search pops one page. Every branch
  calls `preventDefault()`. A no-op while closed, so the ⌘K binding is the
  host's job
- Focus: none. Nothing moves focus into the input on open or back to the
  trigger on close — do it in your `onOpen`/an `x-effect`, and consider
  `aria-modal` + a focus trap if the palette is a dialog
- Reference: [WAI-ARIA Authoring Practices — Combobox pattern](https://www.w3.org/WAI/ARIA/apg/patterns/combobox/)

## Integration

- **@ailura/alpinejs-overlay** — teleporting the palette to `#overlay-root` and
  asking `$store.overlay.zIndexOf(...)` for a layer is the intended way to put
  it above the page
- **@ailura/alpinejs-keyboard** — the ⌘K chord belongs to a scoped shortcut
  registry rather than an ad-hoc `keydown.window`
- **@ailura/alpinejs-toast** — a command's `action` is the natural place to push
  a toast, since `run()` awaits it and `onRun` fires after
- **@ailura/alpinejs-theme** — `action: () => $store.theme.toggle()` is the
  canonical toggle command

## Limitations

- **`aliases` are inert.** `CommandItem.aliases` is declared and nothing reads
  it — `defaultRank` matches on `label` and `keywords` only. It becomes live
  the moment you supply your own `rank`, and it is otherwise a field that looks
  like it works.
- **`$store.command.run()` is typed as a promise and returns `undefined`.**
  `CommandStore.run` is declared `Promise<void>`, but the plugin's facade is
  `void controller.run(id)` — it discards the promise. `$store.command.run(id)`
  therefore returns `undefined`, and `.then()` / `.catch()` on it throws a
  `TypeError` at runtime. Await `controller.run()` on the standalone path, or
  write the call as fire-and-forget in a template. `pushPage()` on the store does
  return a real promise.
- **A rejected action escapes the store.** `controller.run()` has no `catch`, so
  a failing action rejects its promise. Because the store drops that promise, a
  failure from a template produces an unhandled rejection and no feedback. Call
  `controller.run()` directly, or `catch` inside the action.
- **`cancelRun()` does not cancel.** It clears the in-flight set and sets
  `executionState` back to `"idle"`, but nothing aborts the promise — when the
  action finally settles, its `finally` block deletes an id that is already
  gone and `close()` still fires. `CommandAction` takes no `AbortSignal`.
- **`executionState` never says `"loading"`.** The type is
  `"idle" | "loading" | "running"` and the controller only ever assigns
  `"running"` and `"idle"`. Use `loadingIds` / `entry.loading` instead.
- **Nothing pins or unpins after registration.** `pinnedIds` is seeded from
  `item.pinned` in `register()` and is only cleared by `unregister()`. There is
  no `pin()` / `unpin()` on the controller or the store.
- **`recentIds` is not persistence.** `CommandPersistence` has one field,
  `maxRecent`; the list lives in memory and is gone on reload. The name is the
  misleading part.
- **`handleKeydown()` ignores typing in the input.** It only handles the four
  navigation keys, but it also runs on `Backspace`, which you must pair with the
  "search is empty" rule the page stack depends on. Bind it on the input, not
  on the window, or a stray keypress anywhere closes the palette.
- **One palette per page.** `inputProps()` hardcodes
  `aria-controls="command-listbox"` and `optionProps()` builds
  `command-option-<id>`, so two palettes on one page produce duplicate DOM
  ids and a broken `aria-activedescendant`.
- **`run()` reports nothing.** It returns `void` in every path, so "disabled",
  "filtered out" and "ran successfully" are indistinguishable at the call site.
- **`itemState()` only sees visible items.** A command the current search
  filtered out returns `null` rather than its state, and `optionProps()` then
  reports `aria-disabled="false"` for it.
- **`aliases` aside, the rank cache is content-blind** — see the note under
  [Ranking](#ranking).

## Size

`6.72 kB raw / 2.49 kB gzip` · budget `8 kB` · externalized peers: `alpinejs`,
`@ailura/alpinejs-core` · `size-limit` + `publint` + `attw` verified.

## Architecture

[Features layer](../../ARCHITECTURE.md) — controllers own state, Alpine owns reactivity. See canon, guards, and SSR rules in [ARCHITECTURE.md](../../ARCHITECTURE.md).

One deviation from the usual sync shape is worth knowing about: this package's
plugin does **not** use `controller.on('change', sync)` to mirror state into a
store object. Alpine wraps `store()` in a reactive proxy, but a getter that
reads a controller's private field registers no dependency — the template would
track a key nothing ever writes, and the palette would never open. The plugin
therefore keeps a reactive `view` object that `sync()` writes, and exposes only
`search` and `activeIndex` as accessors, because `x-model` assigns to those two
and they have to reach the controller.

## Testing

```sh
pnpm test              # vp test (happy-dom)
pnpm run typecheck     # tsc --noEmit
```

## License

MIT
