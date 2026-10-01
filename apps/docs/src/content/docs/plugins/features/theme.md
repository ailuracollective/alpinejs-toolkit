---
title: Theme
---

@ailura/alpinejs-theme

Light, dark, or system theme backed by a state machine, so the toggle is a real
transition with a real current value. The plugin applies the theme to the document
and keeps it in sync with the operating system and other tabs; you render the control.

## Install

```sh
pnpm add alpinejs @ailura/alpinejs-theme
```

## Register the plugin

Do this once, before `Alpine.start()`.

```ts
import Alpine from "alpinejs";
import themePlugin from "@ailura/alpinejs-theme";

Alpine.plugin(themePlugin());

Alpine.start();
```

That registers a `theme` store, so everything below is reachable at `$store.theme`.

## Minimal example

A three-way switch between light, dark, and whatever the system says.

```html
<div x-data>
  <button @click="$store.theme.toggle()" :aria-label="'Theme: ' + $store.theme.resolved">
    <span x-text="$store.theme.resolved"></span>
  </button>
</div>
```

Two of the three values are different on purpose, and mixing them up is the usual bug:

- `current` is what the user picked. It is `"light"`, `"dark"`, or `"system"`.
- `resolved` is what is actually on screen right now. When `current` is `"system"`,
  `resolved` follows the OS and can change without the user doing anything.

Bind the UI to `resolved` and to the action to `current`, never the other way round.

## Variants

**Force a value instead of following the system.** Use `set()` when a user has
overridden the preference and it should stick across visits.

```js
$store.theme.set("dark");
```

**Go back to following the OS.** Passing `"system"` makes the plugin observe the OS
preference again.

```js
$store.theme.set("system");
```

**Re-apply the theme to the document.** Useful if something else replaced the
`class` or `data-theme` attribute on `<html>`, for example a third-party widget.

```js
$store.theme.apply();
```

**Start from a known preference instead of the stored one.** The starting preference is
`defaultTheme` in the plugin options, not an argument: `reset()` takes none, clears the
stored preference and falls back to `defaultTheme` (`"system"` unless you set it).

```js
$store.theme.reset();
```

## API reference

| Name                      | Type     | Purpose                                                                                                                                                                              |
| ------------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `$store.theme.current`    | `store`  | What the user picked: `light`, `dark`, or `system`.                                                                                                                                  |
| `$store.theme.resolved`   | `store`  | What is on screen now, after resolving `system`.                                                                                                                                     |
| `$store.theme.system`     | `store`  | What the operating system reports.                                                                                                                                                   |
| `$store.theme.set(value)` | `method` | Set the preference, and apply it.                                                                                                                                                    |
| `$store.theme.toggle()`   | `method` | Flip between light and dark.                                                                                                                                                         |
| `$store.theme.reset()`    | `method` | Clear the stored preference and fall back to `defaultTheme`. Takes no arguments.                                                                                                     |
| `$store.theme.apply()`    | `method` | Re-apply the theme to the target: a `dark`/`light` class by default, or the `data-theme` attribute with `strategy: "attribute"`.                                                     |
| `$store.theme.destroy()`  | `method` | Host-owned teardown: unsubscribes the system theme observer and the cross-tab storage subscription. Nothing invokes it automatically — the host that registered the plugin calls it. |

:::caution[`toggle()` ignores `"system"` on purpose]
`toggle()` flips between the two concrete values. If `current` is `"system"`, calling
it jumps to a fixed value and stops following the OS. Use `set("dark")` if you want to
leave the system behind deliberately.
:::

## Plugin options

```ts
themePlugin({ storeKey: "appTheme" });
```
