# @ailura/alpinejs-menu

<p align="center">

[![bundlephobia minzip](https://badgen.net/bundlephobia/minzip/@ailura/alpinejs-menu)](https://bundlephobia.com/package/@ailura/alpinejs-menu)

</p>

> Headless accessible menu button for Alpine.js — `vertical`/`horizontal` orientation, roving tabindex, full menu-keyboard support, exclusive-open by default and an `x-menu` directive that binds the trigger, the panel and each item, built on `@ailura/alpinejs-core`. The controller is framework-agnostic; the plugin exposes it as `$store.menu` and `$menu`.

## Installation

```sh
pnpm add @ailura/alpinejs-menu alpinejs
# or
npm install @ailura/alpinejs-menu alpinejs
```

Requires `alpinejs@^3.0.0` as peer. `@ailura/alpinejs-core` is a **peer
dependency**, not a dependency: no package in this toolkit has a
`dependencies` block, so the host installs it too.

## Usage

### 1. Standalone (framework-agnostic)

```ts
import { createMenuController } from "@ailura/alpinejs-menu";

const ctrl = createMenuController({ exclusive: true }); // mounted; mutators are live
ctrl.create("row-actions", { orientation: "vertical", closeOnSelect: true });
ctrl.createItem("row-actions", "rename");
ctrl.createItem("row-actions", "delete", { disabled: true });

ctrl.open("row-actions");
ctrl.activeItem("row-actions"); // 'rename' — the first enabled item
ctrl.selectItem("row-actions", "delete"); // no-op: disabled
ctrl.selectItem("row-actions", "rename"); // fires onSelect + select, then closes

ctrl.on("select", ({ menuId, itemId }) => console.log(menuId, itemId));
// ctrl.destroy() when done — every mutator after it is a silent no-op
```

### 2. Alpine

The plugin registers `$store.menu`, the `$menu` magic (the same object), and
**one** directive. `x-menu`, `x-menu.trigger` and `x-menu.item` are three
_modifiers_ of that one directive, not three names: Alpine's directive regex
stops at the first dot, so registering `menu-trigger` would never match
`x-menu.trigger`.

```ts
import Alpine from "alpinejs";
import menuPlugin from "@ailura/alpinejs-menu";

Alpine.plugin(menuPlugin());
Alpine.start();
```

```html
<div
  x-data="{ items: ['rename', 'duplicate', 'delete'] }"
  x-init="(() => {
    $store.menu.create('row-actions', { orientation: 'vertical' });
    items.forEach(id => $store.menu.createItem('row-actions', id));
    $store.menu.createItem('row-actions', 'delete', { disabled: true });
  })()"
  @keydown="$store.menu.handleKeydown('row-actions', $event)"
>
  <!-- the trigger: sets aria-haspopup/aria-expanded, toggles on click -->
  <button type="button" x-menu.trigger="'row-actions'">Actions</button>

  <!-- the panel: binds the container, closes on an outside click -->
  <div
    x-menu="'row-actions'"
    x-show="$menu.isOpen('row-actions')"
    x-cloak
    x-bind="$menu.menuProps('row-actions')"
  >
    <template x-for="id in items" :key="id">
      <!-- 'menuId:itemId' in ONE token: a directive cannot take two arguments -->
      <button
        type="button"
        x-menu.item="'row-actions:' + id"
        x-bind="$menu.itemProps('row-actions', id)"
        @click="$menu.selectItem('row-actions', id)"
        x-text="id"
      ></button>
    </template>
  </div>
</div>
```

`x-menu.item` writes `tabindex` and `aria-disabled` **imperatively**, which is
what makes the roving tabindex live. `itemProps()` omits both on purpose —
Alpine applies an object-form `x-bind` exactly once, so a `tabindex` in there
froze at its init value and left the whole menu unreachable by keyboard. If you
hand-wire instead of using the directive, bind those two per attribute:

```html
<button
  x-bind="$menu.itemProps('row-actions', id)"
  x-bind:tabindex="$menu.itemTabIndex('row-actions', id)"
  x-bind:aria-disabled="$menu.itemDisabled('row-actions', id)"
  @click="$menu.selectItem('row-actions', id)"
></button>
```

and, on the panel, `x-bind:aria-hidden="$menu.menuHidden('row-actions')"` — an
`aria-hidden` in `menuProps()` would freeze the same way.

`x-menu` accepts three shapes, the same ones `x-selection` reads: a bare string
is an explicit id, an object is the options bag with an optional `id`, and an
absent expression releases the binding rather than creating a menu with
defaults.

## API

### Exports

| Export                   | Description                                                                                                                                | Type       |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------ | ---------- |
| `MenuController`         | Framework-agnostic controller class — owns the menu registry, emits `open`/`close`/`select`/`change`                                       | `class`    |
| `createMenuController`   | Factory — `createMenuController({ id?, exclusive?, scroll? }) => MenuController`; mounts it                                                | `function` |
| `menuPlugin`             | `Alpine.plugin()` factory — `menuPlugin({ id?, exclusive?, scroll?, storeKey?, magicKey?, directiveKey? }) => PluginCallback`              | `function` |
| `DEFAULT_MENU_STORE_KEY` | Default `$store` key — `"menu"`                                                                                                            | `string`   |
| `DEFAULT_MENU_MAGIC_KEY` | Default `$menu` magic key — `"menu"`                                                                                                       | `string`   |
| `MenuControllerOptions`  | `{ id?, exclusive?, scroll? }` — controller id and the defaults every instance inherits                                                    | `type`     |
| `CreateMenuOptions`      | Plugin options — the two defaults, plus `storeKey?`, `magicKey?` and `directiveKey?`                                                       | `type`     |
| `MenuOptions`            | Per-menu options — `{ orientation?, closeOnSelect?, onOpen?, onClose?, onSelect? }`                                                        | `type`     |
| `MenuItemOptions`        | Per-item options — `{ disabled?, parentId? }`                                                                                              | `type`     |
| `MenuOrientation`        | `'vertical' \| 'horizontal'`                                                                                                               | `type`     |
| `MenuItemState`          | A registered item — `{ id, disabled, parentId }`                                                                                           | `type`     |
| `MenuInstance`           | One menu's projected state — `{ open, activeItemId, orientation, closeOnSelect, items, container, trigger, onOpen?, onClose?, onSelect? }` | `type`     |
| `MenuStore`              | The Alpine-facing surface, i.e. everything reachable as `$store.menu.*` / `$menu.*`                                                        | `type`     |
| `MenuAlpine`             | Typed view of the `Alpine` instance the plugin uses                                                                                        | `type`     |
| `MenuPluginCallback`     | `Alpine.plugin()` callback signature — `(alpine: Alpine) => void`                                                                          | `type`     |
| `MenuEvents`             | Event map for `controller.on('open' \| 'close' \| 'select' \| 'change', …)`                                                                | `type`     |

`DEFAULT_MENU_DIRECTIVE_KEY` (`"menu"`) is declared in `types.ts` but is **not**
re-exported from the package entrypoint, so `directiveKey` is the only way to
rename the directive. `MenuController` also exposes `hasInstance(id)` and
`snapshotInstances()`; neither is on the store.

### Store API

```ts
// Lifecycle
$store.menu.create("row-actions", { orientation: "vertical" });
$store.menu.createItem("row-actions", "rename");
$store.menu.createItem("row-actions", "delete", { disabled: true });
$store.menu.destroyItem("row-actions", "delete");
$store.menu.destroy("row-actions"); // one menu
$store.menu.destroy(); // the whole controller
$store.menu.destroyAll(); // every menu, controller still usable

// Open state
$store.menu.open("row-actions"); // closes the others when `exclusive`
$store.menu.close("row-actions");
$store.menu.toggle("row-actions");
$store.menu.isOpen("row-actions"); // boolean

// Roving tabindex
$store.menu.activeItem("row-actions"); // string | null
$store.menu.setActiveItem("row-actions", "rename"); // null clears it

// Selection
$store.menu.selectItem("row-actions", "rename");

// Element binding — the `x-menu` directive does both; only hand-wire if you must
$store.menu.bindTrigger("row-actions", $el);
$store.menu.bindMenu("row-actions", $el);

// Dismissal and keyboard
$store.menu.handleOutsideClick("row-actions", $event);
$store.menu.handleKeydown("row-actions", $event);
$store.menu.handleWindowOutsideClick($event, ["row-actions"]); // every menu if omitted
$store.menu.handleWindowKeydown($event, ["row-actions"]); // every OPEN menu if omitted

// ARIA helpers — split by "does this value change?"
$store.menu.menuProps("row-actions"); // { role: 'menu', id, 'aria-orientation' }
$store.menu.itemProps("row-actions", "rename"); // { role: 'menuitem', id }
$store.menu.menuHidden("row-actions"); // boolean → x-bind:aria-hidden
$store.menu.itemTabIndex("row-actions", "rename"); // 0 | -1 → x-bind:tabindex
$store.menu.itemDisabled("row-actions", "rename"); // boolean → x-bind:aria-disabled
```

| Method                                         | Description                                                                                                                                                                                       |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `create(id, options?)`                         | Creates a menu, **replacing** any existing one (an open menu is closed first, so its `onClose` runs).                                                                                             |
| `createItem(id, itemId, opts?)`                | Registers an item, creating the menu if none exists. Re-registering an id updates `disabled`/`parentId` and keeps the position.                                                                   |
| `destroyItem(id, itemId)`                      | Removes the item; if it was the active one, the first enabled item takes over.                                                                                                                    |
| `open(id)`                                     | Opens, creating the menu if needed. Closes every other open menu when `exclusive` is on. The first enabled item becomes active.                                                                   |
| `close(id)`                                    | Closes. **Returns focus to the trigger, but only when focus was inside the menu** — an outside-click close does not steal it.                                                                     |
| `toggle(id)`                                   | `close()` when open, `open()` otherwise.                                                                                                                                                          |
| `isOpen(id)` / `activeItem(id)`                | `false` / `null` for anything unregistered.                                                                                                                                                       |
| `setActiveItem(id, itemId)`                    | Moves the roving tabindex. Ignores an unknown or disabled item; `null` clears it.                                                                                                                 |
| `selectItem(id, itemId)`                       | Fires `onSelect` and `select`, then closes unless `closeOnSelect` is off. No-op for an unknown menu, unknown item or disabled item.                                                               |
| `bindTrigger(id, el)`                          | Records the trigger; `null` releases it.                                                                                                                                                          |
| `bindMenu(id, el)`                             | Records the panel; `null` releases it.                                                                                                                                                            |
| `handleOutsideClick(id, ev)`                   | Closes unless the click landed on the trigger or inside the panel.                                                                                                                                |
| `handleKeydown(id, ev)`                        | `ArrowDown`/`ArrowUp` on a **vertical** menu, `ArrowRight`/`ArrowLeft` on a **horizontal** one, plus `Home`/`End`/`Enter`/`Space`/`Escape`. Wraps, skips disabled, no-op when closed.             |
| `handleWindowOutsideClick(ev, ids?)`           | Fans out to `handleOutsideClick` for each id, or all menus.                                                                                                                                       |
| `handleWindowKeydown(ev, ids?)`                | Fans out to `handleKeydown` for each **open** menu, stopping at the first `preventDefault()`. Skipping closed menus is what keeps one menu's `Escape` from closing another that is not on screen. |
| `menuProps(id)` / `itemProps(id, itemId)`      | The fixed attributes. Safe in one `x-bind`.                                                                                                                                                       |
| `menuHidden` / `itemTabIndex` / `itemDisabled` | The changing ones. Each needs its own `x-bind:attr`.                                                                                                                                              |
| `instances`                                    | `Record<id, MenuInstance>` — the read-model, reactive.                                                                                                                                            |

### Options

Plugin-level:

```ts
interface CreateMenuOptions {
  id?: string; // controller id — defaults to generateId('menu')
  exclusive?: boolean; // default true — open() closes every other menu
  scroll?: unknown; // accepted and ignored, see Limitations
  storeKey?: string; // $store key — default DEFAULT_MENU_STORE_KEY ("menu")
  magicKey?: string; // $menu magic key — default DEFAULT_MENU_MAGIC_KEY ("menu")
  directiveKey?: string; // x-directive name — default "menu"
}
```

Per-menu, passed to `create()` (or carried in the `x-menu` options bag):

```ts
type MenuOptions = {
  orientation?: "vertical" | "horizontal"; // default 'vertical'
  closeOnSelect?: boolean; // default true
  onOpen?: () => void; // no default
  onClose?: () => void; // no default
  onSelect?: (itemId: string) => void; // no default
};
```

Per-item:

```ts
type MenuItemOptions = {
  disabled?: boolean; // default false
  parentId?: string | null; // default null
};
```

| Option          | Default      | Effect                                                                                                                               |
| --------------- | ------------ | ------------------------------------------------------------------------------------------------------------------------------------ |
| `orientation`   | `'vertical'` | Decides which arrow pair `handleKeydown()` acts on, and is emitted as `aria-orientation` by `menuProps()`.                           |
| `closeOnSelect` | `true`       | Whether `selectItem()` closes the menu. With `false`, the menu stays open and `change` is still emitted.                             |
| `exclusive`     | `true`       | Controller-wide. `open()`/`toggle()` close every other open menu first. Pass `exclusive: false` to the plugin for independent menus. |
| `parentId`      | `null`       | Recorded on the item. **Nothing reads it** — submenu traversal is not implemented; see Limitations.                                  |
| `scroll`        | —            | Typed `unknown`, accepted by both factories and **never read**. Declared for API stability only.                                     |
| `storeKey`      | `'menu'`     | `$store` key. Renaming it renames `magicKey` too unless `magicKey` is given explicitly.                                              |
| `magicKey`      | `'menu'`     | `$menu` magic key. There is no way to register the store without it.                                                                 |
| `directiveKey`  | `'menu'`     | Directive name, without the `x-` prefix.                                                                                             |

### Avoiding name collisions

```ts
Alpine.plugin(menuPlugin({ storeKey: "nav" })); // → $store.nav and $nav
```

`storeKey` is the only name you need: `resolvePluginKeys` makes `magicKey` fall
back to `storeKey` before the package default, so one option moves both
surfaces. `DEFAULT_MENU_STORE_KEY` and `DEFAULT_MENU_MAGIC_KEY` keep the
defaults discoverable from TypeScript.

### Events

```ts
ctrl.on("open", ({ menuId }) => console.log(menuId));
ctrl.on("close", ({ menuId }) => console.log(menuId));
ctrl.on("select", ({ menuId, itemId }) => console.log(menuId, itemId));
ctrl.on("change", (detail) => detail.menuId); // adapter sync; optional id
```

`open`, `close` and `select` carry a bare `{ menuId }` (plus `itemId` for
`select`) rather than a discriminated union — there is no `source` on this
package's events. `change` is the adapter-sync signal and fires on far more
than the three above: `create`, `destroy`, `createItem`, `destroyItem`,
`bindMenu`, `bindTrigger`, `setActiveItem`, the arrow-key movement, and the
`closeOnSelect: false` branch of `selectItem`. Its `menuId` is typed optional.

## Focus on close

`close()` is the one place in this package that calls `focus()`, and it is
deliberately narrow:

- It restores focus to the trigger **only when focus was actually inside the
  menu** when it closed. A menu closed by an outside click has focus somewhere
  else by then, and stealing it there would be a regression.
- It resolves the target through `focusableWithin()`, preferring the first
  focusable descendant of the bound trigger. `bindTrigger` is often given a
  wrapper around the button — a plain `<div>` cannot take focus, and focusing
  it directly would silently do nothing and leave focus stranded.
- With `x-menu.trigger` you can bind the button itself, or the wrapper; both
  work.

## SSR

> State is in-memory and nothing reads `window` or `document` at import time
> except inside `close()`'s focus restore, which is guarded by
> `typeof document !== "undefined"`. The package is safe to import during SSR.
> Menus are closed by default, so render them hidden (`x-show` + `x-cloak`) and
> let the store drive visibility on the client. The `x-menu` directive binds
> elements and is client-only by nature.

## Accessibility

- Menu panel, via `menuProps()`: `role="menu"`, `id`, `aria-orientation`
- Menu items, via `itemProps()`: `role="menuitem"`, `id`
- Trigger, written by `x-menu.trigger`: `aria-haspopup="menu"` and a live
  `aria-expanded`. Both are applied **imperatively**, not through an object
  `x-bind`, because an `aria-expanded` in a spread object froze at its init
  value and the trigger then claimed to be collapsed while the menu was open
- Changing attributes, each on its own binding: `x-bind:aria-hidden` from
  `menuHidden()`, `x-bind:tabindex` from `itemTabIndex()` (roving, `0` for the
  active item and `-1` for the rest), `x-bind:aria-disabled` from
  `itemDisabled()`
- Keyboard, via `handleKeydown()` or `handleWindowKeydown()`: `ArrowDown`/`ArrowUp`
  on a vertical menu, `ArrowRight`/`ArrowLeft` on a horizontal one,
  `Home`/`End` jump to the first/last enabled item, `Enter`/`Space` select the
  active item, `Escape` closes. The mismatched arrow pair is left to the page.
  Movement wraps and skips disabled items
- Focus: roving `tabindex` keeps the menu to one tab stop, and `close()` returns
  focus to the trigger. `handleKeydown()` itself never calls `focus()` — the
  browser follows the new `tabindex` if it is already inside the menu
- Reference: [WAI-ARIA Authoring Practices — Menu button pattern](https://www.w3.org/WAI/ARIA/apg/patterns/menu-button/)

## Integration

- **@ailura/alpinejs-overlay** — `overlay.zIndexOf('menu', id)` gives a
  teleported panel its place in the shared stack, and the `#overlay-root` portal
  to teleport into
- **@alpinejs/anchor** — the positioning. The store owns the active item and the
  ARIA wiring; where the panel sits in the viewport is the anchor plugin's job
  (`x-anchor.bottom-start.offset.8.fixed="triggerEl"`)

## Limitations

- **`parentId` is recorded and never read.** There is no submenu traversal: no
  `ArrowRight` opens a child menu, no nested `x-menu.item` resolution, no
  `aria-haspopup` on a parent item. `createItem(id, itemId, { parentId })`
  stores the value and nothing consumes it.
- **`scroll` is inert.** Both factories accept it and neither reads it; it is
  typed `unknown` to make that visible. There is no scroll-follows-active-item
  behaviour.
- **No auto-activation mode on click-open.** `open()` puts the first enabled
  item in the active slot, and the APG's "focus first item on open" is what
  happens — but the browser's focus does not follow, because nothing calls
  `focus()`. Put `@keydown` on the menu so real focus is already inside when
  the user arrows.
- **`x-menu.item` takes one token, `menuId:itemId`.** A directive cannot take
  two arguments, so every item repeats the menu id. There is no way to infer
  the menu from a DOM ancestor.
- **Hand-wiring costs you the live `tabindex` and `aria-disabled`.** The
  directive writes both imperatively; `itemProps()` omits them because an
  object-form `x-bind` is applied exactly once. If you use `bindMenu`/
  `bindTrigger` by hand, bind those two per attribute yourself.
- **`closeOnSelect: false` still emits `select` and `onSelect`.** The only
  difference is that the menu stays open.
- **One `x-menu` per menu per element role.** The trigger and the panel are
  separate elements running the same directive, so they only pair up if they
  name the same id.
- Positioning, z-index and stacking are consumer-owned.

## Size

`8.56 kB raw / 2.80 kB gzip` · budget `3 kB` · externalized peers: `alpinejs`, `@ailura/alpinejs-core` · `size-limit` + `publint` + `attw` verified.

## Architecture

[Features layer](../../ARCHITECTURE.md) — controllers own state, Alpine owns reactivity. See canon, guards, and SSR rules in [ARCHITECTURE.md](../../ARCHITECTURE.md).

## Testing

```sh
pnpm test              # vp test (happy-dom)
pnpm run typecheck     # tsc --noEmit
```

Uses `@ailura/alpinejs-testing` — `html`/`mount`/`settled`/`start`/`resume`/`reset`. See [ARCHITECTURE.md §8](../../ARCHITECTURE.md).

## License

MIT
