---
title: Getting Started
---

The Alpine.js Toolkit is a monorepo of **40 `@ailura/alpinejs-*` packages**. Each one is
a framework-agnostic controller plus a thin Alpine bridge: the state lives in plain
TypeScript, and Alpine only handles reactivity.

This page is the mechanical path — install, register, call. For the reasoning behind
the split, read [Architecture](/guide/architecture/).

## Install

Pick any package and install it alongside Alpine:

```sh
pnpm add alpinejs @ailura/alpinejs-accordion @ailura/alpinejs-tabs
# or
npm install alpinejs @ailura/alpinejs-accordion @ailura/alpinejs-tabs
```

## Register

Every plugin is a **factory** that returns an `Alpine.plugin` callback. Register what
you need before `Alpine.start()`:

```ts
import Alpine from "alpinejs";
import accordionPlugin from "@ailura/alpinejs-accordion";
import tabsPlugin from "@ailura/alpinejs-tabs";
import themePlugin from "@ailura/alpinejs-theme";

Alpine.plugin(accordionPlugin());
Alpine.plugin(tabsPlugin());
Alpine.plugin(themePlugin());

Alpine.start();
```

Registering the accordion plugin gives you `$store.accordion`; the theme plugin gives
you `$store.theme` and the `$theme` magic. Each plugin names its own keys, and
[Core](/plugins/foundation/core/) covers how to rename them.

## Use

Plugins surface through the same three mechanisms Alpine already uses:

- **Stores** — `$store.accordion.openIds('group')`, `$store.theme.toggle()`
- **Magics** — `$timer.create(...)`, `$machine({...})`
- **Directives** — `x-child`, `x-gesture`

The home page groups the 40 packages into four layers — pick the one that matches what
you're building, then follow the same sections on any page you land on. 37 of the 40 ship
a browser plugin and have a demo page; the three that do not are `ui`, `testing` and
`plugin-template`.

## Next

- [Architecture](/guide/architecture/) — the layers, the controller lifecycle, and the plugin factory.
- [Accordion](/plugins/features/accordion/) — one complete package to read the pattern end to end.
