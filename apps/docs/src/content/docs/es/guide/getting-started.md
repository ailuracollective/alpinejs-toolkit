---
title: Primeros pasos
---

El toolkit de Alpine.js es un monorepo de **40 paquetes `@ailura/alpinejs-*`**. Cada uno
es un controlador agnóstico del framework más un puente fino hacia Alpine: el estado
vive en TypeScript plano, y Alpine solo se encarga de la reactividad.

Esta es la parte mecánica — instalar, registrar, llamar. Para el razonamiento detrás
del split, lee [Arquitectura](/es/guide/architecture/).

## Instalar

Elige el paquete que necesites e instálalo junto con Alpine:

```sh
pnpm add alpinejs @ailura/alpinejs-accordion @ailura/alpinejs-tabs
# o
npm install alpinejs @ailura/alpinejs-accordion @ailura/alpinejs-tabs
```

## Registrar

Una vez, antes de `Alpine.start()`:

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

Registrar el plugin de accordion te da `$store.accordion`; el de theme te da
`$store.theme` y el magic `$theme`. Cada plugin nombra sus propias claves, y
[Core](/es/plugins/foundation/core/) explica cómo renombrarlas.

## Usar

Los plugins se sirven a través de los mismos tres mecanismos que Alpine ya usa:

- **Stores** — `$store.accordion.openIds('group')`, `$store.theme.toggle()`
- **Magics** — `$timer.create(...)`, `$machine({...})`
- **Directivas** — `x-child`, `x-gesture`

La página de inicio agrupa los 40 paquetes en cuatro capas — elige la que corresponda
a lo que estás construyendo, y sigue las mismas secciones en la página en la
que caigas. No los 40 tienen página de demo todavía: el catálogo de demo tiene hoy 36
plugins de browser, y `query-adapter-nanostores` es el paquete más nuevo sin una.

## Siguiente

- [Arquitectura](/es/guide/architecture/) — las capas, el ciclo de vida del controlador y la factory del plugin.
- [Accordion](/es/plugins/features/accordion/) — un paquete completo para leer el patrón de punta a punta.
