---
title: Sidebar
---

@ailura/alpinejs-sidebar

Un sidebar abierto o cerrado, opcionalmente gobernado por una media query para que se
colapse en pantallas chicas. El plugin maneja el estado visible; tú escribes el panel y
el disparador.

## Instalar

```sh
pnpm add alpinejs @ailura/alpinejs-sidebar
```

## Registrar el plugin

Una vez, antes de `Alpine.start()`.

```ts
import Alpine from "alpinejs";
import sidebarPlugin from "@ailura/alpinejs-sidebar";

Alpine.plugin(sidebarPlugin());

Alpine.start();
```

Eso registra un store `sidebar`, así que todo lo de abajo vive en `$store.sidebar`.

## Ejemplo mínimo

Un disparador y un panel, con el overlay y el Escape vinculados.

```html
<div x-data>
  <button @click="$store.sidebar.toggle()" :aria-expanded="$store.sidebar.visible">Menú</button>

  <div x-show="$store.sidebar.visible" @click="$store.sidebar.hide()">
    <aside @click.stop @keydown="$store.sidebar.handleKeydown($event)">
      <button @click="$store.sidebar.hide()">Cerrar</button>
      <nav>...</nav>
    </aside>
  </div>
</div>
```

Los métodos se llaman `show()` y `hide()`, no `open()` y `close()`.

Hay dos booleanos y no son lo mismo:

- `visible` es el estado actual.
- `isVisible` es un alias, para que se lea mejor cuando pasas el store entero.

## Colapsar en pantallas chicas

Un breakpoint hace que el sidebar siga una media query. `onMismatch` decide qué pasa
cuando la query no matchea: ocultar el sidebar, o dejarlo como está.

```js
sidebarPlugin({
  breakpoint: {
    query: "(min-width: 768px)",
    onMismatch: "hide",
  },
});
```

`matchesBreakpoint` te dice si la query matchea hoy, así puedes renderizar un disparador
distinto para los dos casos.

```html
<button x-show="$store.sidebar.matchesBreakpoint" @click="$store.sidebar.toggle()">Menú</button>
```

## Variantes

**No cerrar con Escape.** Útil cuando el sidebar tiene un formulario que no quieres
perder.

```js
sidebarPlugin({ closeOnEscape: false });
```

**No cerrar con click en el overlay.** Un sidebar que se queda quieto hasta que el
usuario elige un destino.

```js
sidebarPlugin({ closeOnOverlayClick: false });
```

**Arrancar abierto.** Pasa el estado inicial, útil para un layout desktop-first.

```js
sidebarPlugin({ initial: true });
```

**Volver al estado inicial.** `reset()` vuelve a lo que era `initial`, que es lo que
quieres en una navegación.

```js
$store.sidebar.reset();
```

## Referencia de la API

| Nombre                                | Tipo   | Para qué sirve                                                                                                     |
| ------------------------------------- | ------ | ------------------------------------------------------------------------------------------------------------------ |
| `$store.sidebar.visible`              | store  | Si el sidebar se está mostrando.                                                                                   |
| `$store.sidebar.isVisible`            | store  | Alias de `visible`.                                                                                                |
| `$store.sidebar.matchesBreakpoint`    | store  | Si la media query configurada matchea hoy.                                                                         |
| `$store.sidebar.hasOverlay`           | store  | Si corresponde renderizar un overlay: visible **y** con `closeOnOverlayClick` activo.                              |
| `$store.sidebar.show()` / `hide()`    | método | Cambiar el estado.                                                                                                 |
| `$store.sidebar.toggle()`             | método | Mostrar si está oculto, ocultar si se muestra.                                                                     |
| `$store.sidebar.reset()`              | método | Volver al estado `initial`.                                                                                        |
| `$store.sidebar.handleKeydown(event)` | método | Escape. El plugin ya escucha en `document`, así que esto es solo para un handler explícito y acotado.              |
| `$store.sidebar.destroy()`            | método | Teardown que maneja el host: saca el listener del breakpoint y el keydown de `document`. Nadie lo llama por usted. |

:::caution[`handleKeydown` toma el evento, no un id]
A diferencia de accordion, tabs o dialog, el sidebar es un singleton: no hay id de
instancia que pasar. Es `$store.sidebar.handleKeydown($event)`. Copiar la forma de otra
página y agregar un id te da `undefined` en vez de una tecla Escape que funcione.
:::

:::note[Escape ya funciona sin vincular nada]
Mientras no pases `closeOnEscape: false`, el controller instala su propio listener de
keydown en `document` al montarse, así que Escape cierra el sidebar desde cualquier
lado. El `@keydown` del ejemplo de arriba es el mismo handler llamado explícitamente:
sacalo y no cambia nada.
:::

## Opciones del plugin

```ts
sidebarPlugin({ id: "app-sidebar", storeKey: "nav" });
```
