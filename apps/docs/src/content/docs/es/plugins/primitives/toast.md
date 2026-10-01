---
title: Toast
---

@ailura/alpinejs-toast

Un store de toasts: una cola con posiciones, variantes, dedupe por clave y una vista por
posición. El plugin maneja la cola y el apilado; tú renderizas los toasts.

## Instalar

```sh
pnpm add alpinejs @ailura/alpinejs-toast
```

## Registrar el plugin

Una vez, antes de `Alpine.start()`.

```ts
import Alpine from "alpinejs";
import toastPlugin from "@ailura/alpinejs-toast";

Alpine.plugin(toastPlugin());

Alpine.start();
```

Eso registra un store `toast`, así que todo lo de abajo vive en `$store.toast`.

## Ejemplo mínimo

Agregar un toast, listarlos y descartarlos.

```html
<div x-data>
  <button @click="$store.toast.push({ message: 'Guardado', variant: 'success' })">Guardar</button>
  <button @click="$store.toast.dismissAll()">Descartar todos</button>

  <ul>
    <template x-for="item in $store.toast.items" :key="item.id">
      <li>
        <span x-text="item.message"></span>
        <button @click="$store.toast.dismiss(item.id)">Cerrar</button>
      </li>
    </template>
  </ul>
</div>
```

## Evitar toasts duplicados

`pushUnique(key, options)` es lo que hay que usar cuando la misma acción puede dispararse
repetidas veces. Reemplaza el toast que tiene esa clave en vez de apilar un segundo, así
que un usuario que hace click en guardar cinco veces ve un toast, no cinco.

```js
$store.toast.pushUnique("sync", { message: "Sincronizando…", variant: "info" });
```

Ahí está la diferencia entre una cola que ayuda y una que se vuelve ruido.

## Renderizar por posición

`itemsAt(position)` devuelve los toasts de una esquina, así que un template por posición
es un solo loop en vez de cuatro.

```html
<template x-for="position in ['top-right', 'bottom-left']" :key="position">
  <div :class="'toasts-' + position">
    <template x-for="item in $store.toast.itemsAt(position)" :key="item.id">
      <div x-text="item.message"></div>
    </template>
  </div>
</template>
```

`stackPositions` dice qué posiciones tienen toasts, y `maxVisible` y `maxToasts` son los
topes que pasaste a la factory.

## Actualizar un toast en el lugar

Cuando una operación larga termina, actualiza el toast en vez de pushing un segundo.

```js
const id = $store.toast.push({ message: "Subiendo…" });
$store.toast.update(id, { message: "Subida completa", variant: "success" });
```

## Referencia de la API

| Nombre                                  | Tipo   | Para qué sirve                                    |
| --------------------------------------- | ------ | ------------------------------------------------- |
| `$store.toast.items`                    | store  | Todos los toasts de la cola.                      |
| `$store.toast.defaultPosition`          | store  | La posición usada cuando no se pasa ninguna.      |
| `$store.toast.stackPositions`           | store  | Qué posiciones tienen toasts ahora.               |
| `$store.toast.maxVisible` / `maxToasts` | store  | Los topes configurados.                           |
| `$store.toast.push(options)`            | método | Agregar un toast; devuelve su id.                 |
| `$store.toast.pushUnique(key, options)` | método | Agregar o reemplazar el toast con esa clave.      |
| `$store.toast.update(id, options)`      | método | Cambiar un toast en el lugar.                     |
| `$store.toast.dismiss(id)`              | método | Quitar un toast.                                  |
| `$store.toast.dismissAt(position, id?)` | método | Quitar un toast por posición, o toda la posición. |
| `$store.toast.dismissAll()`             | método | Vaciar la cola.                                   |
| `$store.toast.itemsAt(position)`        | método | Los toasts de una posición.                       |
| `$store.toast.destroy()`                | método | Desarmar el store.                                |

:::caution[`push()` no tiene un id propio para cancelar]
`push()` devuelve el id, así que guárdalo si piensas actualizar o descartar después.
Hacer `push()` y después buscar el toast por el mensaje funciona hasta que dos toasts
comparten mensaje, que es justo cuando necesitas el id.
:::

## Opciones del plugin

```ts
toastPlugin({ storeKey: "notices", defaultPosition: "bottom-right" });
```
