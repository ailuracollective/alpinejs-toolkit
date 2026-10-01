---
title: Scroll
---

@ailura/alpinejs-scroll

Un store `scroll` para la página o para cualquier elemento: posición, progreso, si
estás en un borde, y un lock de scroll del body que anida correctamente.

## Instalar

```sh
pnpm add alpinejs @ailura/alpinejs-scroll
```

## Registrar el plugin

Una vez, antes de `Alpine.start()`.

```ts
import Alpine from "alpinejs";
import scrollPlugin from "@ailura/alpinejs-scroll";

Alpine.plugin(scrollPlugin());

Alpine.start();
```

Eso registra un store `scroll`, así que todo lo de abajo vive en `$store.scroll`.

## Ejemplo mínimo

Una barra de progreso de lectura y un botón para volver arriba.

```html
<div x-data>
  <p>Leído: <span x-text="Math.round($store.scroll.progress * 100) + '%'"></span></p>
  <button @click="$store.scroll.toTop()" x-show="!$store.scroll.atTop">Volver arriba</button>
</div>
```

`progress` va de 0 a 1, así que multiplica antes de mostrarlo. `atTop` y `atBottom` son
reactivos, y por eso el botón se puede vincular con `x-show` en vez de mantener un flag a
mano.

## Bloquear el body

El bloqueo es contado, no booleano. `lock()` devuelve un handle y `unlock()` lo devuelve,
así que dos cosas que bloquean a la vez no se desbloquean entre sí.

```html
<div x-data="{ handle: null }">
  <button @click="handle = $store.scroll.lock('modal')">Abrir</button>
  <button @click="$store.scroll.unlock(handle)" x-show="handle">Cerrar</button>
  <p x-show="$store.scroll.locked">
    Bloqueado <span x-text="$store.scroll.lockCount"></span> niveles
  </p>
</div>
```

`lockCount` es la cantidad de bloqueos activos. Si pones un flag para recordar "el modal
está abierto" y pasas ese mismo flag como razón, desbloquear dos veces no va a hacer
nada la segunda vez — el conteo es lo que te dice si es seguro.

**Liberar todo de una.** Cuando cambia una ruta y no puedes asegurar que se liberó cada
lock, usa `unlockAll()`.

```js
$store.scroll.unlockAll();
```

## Scrollear por código

```js
$store.scroll.toTop();
$store.scroll.toBottom();
$store.scroll.by({ y: 400 }); // 400px hacia abajo desde donde estás
```

`by()` toma un objeto de offset, no un número: `by({ y: 400 })` se mueve en vertical,
`by({ x: 100 })` en horizontal, y `by({ x: 100, y: 400 })` en las dos.

`scrollIntoView()` es la que hay que usar cuando tienes un elemento en vez de un offset.

```js
$store.scroll.scrollIntoView(heading);
```

## Referencia de la API

| Nombre                                 | Tipo   | Para qué sirve                                                                                          |
| -------------------------------------- | ------ | ------------------------------------------------------------------------------------------------------- |
| `$store.scroll.x` / `y`                | store  | Los offsets actuales.                                                                                   |
| `$store.scroll.progress`               | store  | De 0 a 1 sobre el rango scrolleable.                                                                    |
| `$store.scroll.atTop` / `atBottom`     | store  | Si estás en alguno de los bordes.                                                                       |
| `$store.scroll.direction`              | store  | `"up"` o `"down"`.                                                                                      |
| `$store.scroll.activeSection`          | store  | El id de la sección que está a la vista.                                                                |
| `$store.scroll.visibleSections`        | store  | Todos los ids de sección a la vista.                                                                    |
| `$store.scroll.locked`                 | store  | Si hay algún bloqueo activo.                                                                            |
| `$store.scroll.lockCount`              | store  | Cuántos bloqueos hay activos.                                                                           |
| `$store.scroll.lock(reason)`           | método | Tomar un bloqueo; devuelve un handle.                                                                   |
| `$store.scroll.unlock(handle)`         | método | Liberar un bloqueo por su handle.                                                                       |
| `$store.scroll.unlockAll()`            | método | Liberar todos.                                                                                          |
| `$store.scroll.toTop()` / `toBottom()` | método | Scrollear a un borde.                                                                                   |
| `$store.scroll.by(delta)`              | método | Scrollear un offset. `delta` es `{ x?, y? }`, no un número.                                             |
| `$store.scroll.scrollIntoView(el)`     | método | Scrollear un elemento a la vista.                                                                       |
| `$store.scroll.destroy()`              | método | Teardown que maneja el host: desconecta el observer y libera todos los locks. Nadie lo llama por usted. |

:::caution[Un lock que nunca se libera congela la página para todos]
`locked` sigue en `true` hasta que el conteo llega a cero, y el conteo solo baja cuando
se llama a `unlock()` con el handle correcto. Un componente que bloquea en el mount y
desbloquea con un click que puede no ocurrir nunca deja la página sin scroll después de
navegar. Ata la liberación al teardown, no a un botón.
:::

## Opciones del plugin

```ts
scrollPlugin({ id: "app-scroll", storeKey: "scroller" });
```
