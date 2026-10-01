---
title: Tooltip
---

@ailura/alpinejs-tooltip

Un tooltip con manejo de hover y focus, un delay de apertura y uno de cierre. El plugin
maneja el estado abierto y el timing; tú escribes el trigger y la burbuja.

## Instalar

```sh
pnpm add alpinejs @ailura/alpinejs-tooltip
```

## Registrar el plugin

Una vez, antes de `Alpine.start()`.

```ts
import Alpine from "alpinejs";
import tooltipPlugin from "@ailura/alpinejs-tooltip";

Alpine.plugin(tooltipPlugin());

Alpine.start();
```

Eso registra un store `tooltip`, así que todo lo de abajo vive en `$store.tooltip`.

## Ejemplo mínimo

Un tooltip por hover y focus con 200ms de delay de apertura, para que no parpadee
mientras el pointer cruza la página.

```html
<div
  x-data="{ id: 'hint-guardar' }"
  x-init="$store.tooltip.register(id, { openDelay: 200 })"
  @keydown="$store.tooltip.handleKeydown(id, $event)"
>
  <button
    @mouseenter="$store.tooltip.showOnHover(id)"
    @mouseleave="$store.tooltip.hideOnHover(id)"
    @focus="$store.tooltip.showOnFocus(id)"
    @blur="$store.tooltip.hideOnFocus(id)"
  >
    Guardar
  </button>

  <span x-show="$store.tooltip.isOpen(id)" role="tooltip">Guardado en tu cuenta.</span>
</div>
```

Los pares `showOn*` / `hideOn*` son las mismas llamadas que `open()` / `close()`, con
nombres que dicen dónde van en el markup. Los seis respetan `openDelay` y `closeDelay`:
no hay forma de saltear el delay salvo registrar la instancia con `0`.

## Variantes

**Dale un delay de cierre.** El hueco entre que el pointer sale del trigger y el tooltip
desaparece, para que moverse hacia la burbuja no lo descarte.

```js
$store.tooltip.register(id, { closeDelay: 120 });
```

**Sin delay.** Para un control que ya está en pantalla y es obvio, un tooltip instantáneo
se lee mejor que uno con delay.

```js
$store.tooltip.register(id, { openDelay: 0, closeDelay: 0 });
```

**Reacciona a apertura y cierre.** Útil para medir o para pausar animaciones.

```js
$store.tooltip.register(id, {
  onOpen: () => track("tooltip_shown"),
  onClose: () => track("tooltip_dismissed"),
});
```

**Manejalo desde código.** Cuando un tooltip tiene que abrir por algo que no sea hover,
`open()` y `toggle()` son las llamadas, y pasan por los mismos delays que el par de
hover.

```js
$store.tooltip.open(id);
$store.tooltip.toggle(id);
```

## Referencia de la API

| Nombre                                    | Tipo     | Para qué sirve                                                                |
| ----------------------------------------- | -------- | ----------------------------------------------------------------------------- |
| `$store.tooltip.register(id, options?)`   | `method` | Crear una instancia. Options: `openDelay`, `closeDelay`, `onOpen`, `onClose`. |
| `$store.tooltip.unregister(id)`           | `method` | Quitar una instancia.                                                         |
| `$store.tooltip.open(id)` / `close(id)`   | `method` | Abrir o cerrar, respetando `openDelay` / `closeDelay`.                        |
| `$store.tooltip.toggle(id)`               | `method` | Abrir si está cerrado, cerrar si está abierto; aplican los delays.            |
| `$store.tooltip.isOpen(id)`               | `method` | Si está abierto.                                                              |
| `$store.tooltip.showOnHover(id)`          | `method` | Alias de `open(id)`, con nombre para un handler `@mouseenter`.                |
| `$store.tooltip.hideOnHover(id)`          | `method` | Alias de `close(id)`, con nombre para un handler `@mouseleave`.               |
| `$store.tooltip.showOnFocus(id)`          | `method` | Alias de `open(id)`, con nombre para un handler `@focus`.                     |
| `$store.tooltip.hideOnFocus(id)`          | `method` | Alias de `close(id)`, con nombre para un handler `@blur`.                     |
| `$store.tooltip.handleKeydown(id, event)` | `method` | Cerrar con Escape.                                                            |
| `$store.tooltip.instances`                | `store`  | Registro reactivo de todas las instancias.                                    |

:::caution[Escape necesita su propio handler]
El cierre con Escape lo maneja `handleKeydown`, así que solo funciona si lo vinculas. Los
tooltips son además el lugar donde un tooltip que queda abierto sobre un control con
focus es un problema real de accesibilidad, no algo cosmético.
:::

## Opciones del plugin

```ts
tooltipPlugin({ id: "app-tooltip", storeKey: "tips" });
```
