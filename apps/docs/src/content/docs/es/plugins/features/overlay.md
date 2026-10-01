---
title: Overlay
---

@ailura/alpinejs-overlay

Una pila de z-index compartida. No abre ni cierra nada: tú reclamas una capa para tus
propios elementos overlay, te da un z-index que nunca colisiona, y te avisa cuando la
pila cambia.

Usala cuando tengas dos o más overlays propios —un menú más un modal, un rail de toasts
más un drawer— y necesites que se apilen de forma predecible sin hardcodear
`z-index: 9999` en tres lugares.

## Instalar

```sh
pnpm add alpinejs @ailura/alpinejs-overlay
```

## Registrar el plugin

Una vez, antes de `Alpine.start()`.

```ts
import Alpine from "alpinejs";
import overlayPlugin from "@ailura/alpinejs-overlay";

Alpine.plugin(overlayPlugin());

Alpine.start();
```

Eso registra un store `overlay`, así que todo lo de abajo vive en `$store.overlay`.

## Ejemplo mínimo

Reclama una capa cuando el elemento abre, libérala cuando cierra, y vincula el z-index
que te da. Reclamar es explícito porque leer el z-index no lo es: `zIndexOf()` es una
lectura pura, así que un binding `:style` que sólo renderiza nunca toma una capa.

```html
<div x-data="{ id: 'panel-rapido' }">
  <button
    @click="
      $store.overlay.claim('panel-rapido', id);
      open = true;
    "
  >
    Abrir panel
  </button>

  <div
    x-show="open"
    x-init="open = $store.overlay.isOpen('panel-rapido', id); $store.overlay.claim('panel-rapido', id)"
    :style="'z-index: ' + $store.overlay.zIndexOf('panel-rapido', id)"
    @click.outside="
      $store.overlay.unregister('panel-rapido', id);
      open = false;
    "
  >
    Contenido del panel
  </div>
</div>
```

`claim()` devuelve el z-index que asignó. Reclamar el mismo par dos veces es un no-op,
así que llamarlo desde un handler de click es seguro. `zIndexOf()` no asigna nada:
devuelve el z-index actual de una entrada reclamada, o el z-index base si todavía no
fue reclamada.

## Leer la pila

El store expone la pila entera, que es lo que necesitas cuando el orden es justamente el
punto.

```js
$store.overlay.count; // cuántos están abiertos
$store.overlay.stack; // las entradas, la más reciente al final
$store.overlay.isOpen("panel-rapido", "panel-1"); // booleano
$store.overlay.zIndexOf("panel-rapido", "panel-1"); // número
```

Cada entrada de `stack` lleva `plugin`, `id`, `zIndex` y `openedAt`, así que puedes
renderizar un overlay de debug sin instrumentar nada.

## Reaccionar a los cambios

``on("change", listener)` dispara cada vez que se reclama una capa, se libera una, o se
destruye la pila. El listener recibe la acción (`"claim"`, `"unregister"`o`"destroy"`) y la pila nueva, que es como cierras el overlay de arriba cuando se abre uno
nuevo.

```js
$store.overlay.on("change", ({ action, stack, added, removed }) => {
  console.log(action, stack.length);
});
```

## Variantes

**Cambia el z-index base o el paso entre capas.** Los defaults le van bien a una app
normal. Subí `baseZIndex` si algo en tu app ya está muy arriba.

```js
$store.overlay.configure({ baseZIndex: 1000, step: 10 });
```

**Monta los overlays en un elemento concreto.** Por defecto la pila es a nivel de
document; señala `root` con un contenedor cuando los overlays deban quedar acotados.

```js
$store.overlay.configure({ root: "#app-overlays" });
```

## Referencia de la API

| Nombre                                  | Tipo     | Para qué sirve                                                                                                    |
| --------------------------------------- | -------- | ----------------------------------------------------------------------------------------------------------------- |
| `$store.overlay.claim(plugin, id)`      | `method` | Reclamar una capa: agregar una entrada a la pila; devuelve su z-index.                                            |
| `$store.overlay.unregister(plugin, id)` | `method` | Liberar la entrada y liberar su capa.                                                                             |
| `$store.overlay.zIndexOf(plugin, id)`   | `method` | El z-index actual de la entrada, o el z-index base si todavía no fue reclamada. No asigna nada.                   |
| `$store.overlay.isOpen(plugin, id)`     | `method` | Si esa entrada está en la pila.                                                                                   |
| `$store.overlay.configure(options)`     | `method` | Cambiar `root`, `baseZIndex` o `step` en runtime.                                                                 |
| `$store.overlay.on(event, listener)`    | `method` | Suscribirse a los cambios de la pila.                                                                             |
| `$store.overlay.destroy()`              | `method` | Teardown a cargo del host: libera la raíz del portal, limpia los slots y vacía la pila. Nadie lo llama por usted. |
| `$store.overlay.stack`                  | `store`  | Array reactivo de `{ plugin, id, zIndex, openedAt }`.                                                             |
| `$store.overlay.count`                  | `store`  | Cuántas entradas están abiertas.                                                                                  |
| `$store.overlay.root`                   | `store`  | La raíz de montaje resuelta.                                                                                      |
| `$store.overlay.baseZIndex` / `step`    | `store`  | La base y el incremento actuales.                                                                                 |

:::note[Nada se abre automáticamente]
`claim()` y `unregister()` los llamas tú. Reclamar una capa para un plugin de diálogo
no lo abre, así que un elemento puede estar visible sin z-index asignado y quedar por
debajo de lo que la pila cree que está arriba.
:::

## Opciones del plugin

```ts
overlayPlugin({ baseZIndex: 1000, step: 10, storeKey: "capas" });
```
