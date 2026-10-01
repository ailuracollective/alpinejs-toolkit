---
title: Tabs
---

@ailura/alpinejs-tabs

A tab strip that switches between panels. The plugin owns the active tab, the ARIA
wiring, and the arrow-key navigation; you write the markup.

## Install

```sh
pnpm add alpinejs @ailura/alpinejs-tabs
```

## Register the plugin

Do this once, before `Alpine.start()`.

```ts
import Alpine from "alpinejs";
import tabsPlugin from "@ailura/alpinejs-tabs";

Alpine.plugin(tabsPlugin());

Alpine.start();
```

That registers a `tabs` store, so everything below is reachable at `$store.tabs`.

## Minimal example

Two tabs, horizontal, both panels in the DOM with only the active one visible.

```html
<div
  x-data="{ gid: 'settings' }"
  x-init="
    $store.tabs.register(gid, { orientation: 'horizontal' });
    $store.tabs.registerTab(gid, 'profile');
    $store.tabs.registerTab(gid, 'billing');
  "
  @keydown="$store.tabs.handleKeydown(gid, $event)"
>
  <div x-bind="$store.tabs.tablistProps(gid)">
    <button
      x-bind="$store.tabs.tabProps(gid, 'profile')"
      @click="$store.tabs.select(gid, 'profile')"
    >
      Profile
    </button>
    <button
      x-bind="$store.tabs.tabProps(gid, 'billing')"
      @click="$store.tabs.select(gid, 'billing')"
    >
      Billing
    </button>
  </div>

  <div x-bind="$store.tabs.panelProps(gid, 'profile')">Your name, email, avatar.</div>
  <div x-bind="$store.tabs.panelProps(gid, 'billing')">Card, invoices, plan.</div>
</div>
```

Three things are doing work you would otherwise write by hand:

- `tabProps()` returns `role="tab"`, an `id`, `aria-selected`, `aria-controls`, and a
  roving `tabindex`.
- `panelProps()` returns `role="tabpanel"`, the `id` the tab points at, and `hidden`.
  Use it instead of `x-show` so the panel is properly hidden from assistive tech.
- `tablistProps()` returns `role="tablist"` plus the `aria-orientation` you registered.

:::caution[Don't drop the `@keydown` line]
Left and right arrows, up and down, `Home`, and `End` are handled by
`$store.tabs.handleKeydown(gid, $event)`. Without it, `tabProps` leaves every tab at
`tabindex="-1"` and the strip is unreachable by keyboard — while still working fine
with a mouse, which is what lets the bug ship.
:::

## Variants

**Change arrow keys to follow the visual layout.** Set `orientation` when the tabs
stack vertically; the arrow directions flip with it.

```js
$store.tabs.register(gid, { orientation: "vertical" });
```

**Open a specific tab on load.** `defaultTab` picks the initial tab.

```js
$store.tabs.register(gid, { defaultTab: "billing" });
```

**Lock a tab.** A disabled tab is skipped by the arrow keys and cannot be selected.

```js
$store.tabs.registerTab(gid, "billing", true);
```

**React to changes.** `onChange` receives the new tab id.

```js
$store.tabs.register(gid, { onChange: (tabId) => console.log("now on", tabId) });
```

## API reference

Reach for this once the tabs already work and you need the exact signature.

| Name                                            | Type     | Purpose                                                               |
| ----------------------------------------------- | -------- | --------------------------------------------------------------------- |
| `$store.tabs.register(id, options?)`            | `method` | Create a group. Options: `orientation`, `defaultTab`, `onChange`.     |
| `$store.tabs.unregister(id)`                    | `method` | Drop a group and its tabs.                                            |
| `$store.tabs.registerTab(id, tabId, disabled?)` | `method` | Add a tab. Pass `true` to lock it.                                    |
| `$store.tabs.unregisterTab(id, tabId)`          | `method` | Remove a tab.                                                         |
| `$store.tabs.select(id, tabId)`                 | `method` | Activate a tab.                                                       |
| `$store.tabs.active(id)`                        | `method` | The active tab id, or `null`.                                         |
| `$store.tabs.isActive(id, tabId)`               | `method` | Whether a tab is active.                                              |
| `$store.tabs.handleKeydown(id, event)`          | `method` | Arrow keys, `Home`, `End`. Required for keyboard support.             |
| `$store.tabs.next(id)` / `previous(id)`         | `method` | Move the selection one enabled tab forward or back, wrapping around.  |
| `$store.tabs.tablistProps(id)`                  | `method` | `role="tablist"` and `aria-orientation`. Bind on the strip container. |
| `$store.tabs.tabProps(id, tabId)`               | `method` | `role="tab"`, `id`, `aria-selected`, `aria-controls`, `tabindex`.     |
| `$store.tabs.panelProps(id, tabId)`             | `method` | `role="tabpanel"`, `id`, `aria-labelledby`, `hidden`.                 |
| `$store.tabs.groups`                            | `store`  | Reactive registry of every group.                                     |
| `$store.tabs.destroy()`                         | `method` | Tear the controller down.                                             |

## Plugin options

`tabsPlugin()` takes options only if you already own the `tabs` store name, or you
need the magic under a different key.

```ts
tabsPlugin({ id: "settings-tabs", storeKey: "settingsTabs" });
```
