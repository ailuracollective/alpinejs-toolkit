---
title: Selection
---

@ailura/alpinejs-selection

Estado de selección simple, múltiple y por rango, con el ARIA de listbox y option ya
resuelto. El plugin maneja la selección; tú renderizas la lista.

## Instalar

```sh
pnpm add alpinejs @ailura/alpinejs-selection
```

## Registrar el plugin

Una vez, antes de `Alpine.start()`.

```ts
import Alpine from "alpinejs";
import selectionPlugin from "@ailura/alpinejs-selection";

Alpine.plugin(selectionPlugin());

Alpine.start();
```

Eso registra un store `selection`, así que todo lo de abajo vive en `$store.selection`.
El mismo objeto queda expuesto también como el magic `$selection`.

## Ejemplo mínimo

Una lista de checkboxes con selección múltiple.

```html
<div
  x-data="{ id: 'files' }"
  x-init="
    $store.selection.create(id, {
      mode: 'multiple',
      keys: ['a', 'b', 'c'],
    })
  "
>
  <ul x-bind="$store.selection.listProps(id)">
    <template x-for="key in ['a', 'b', 'c']" :key="key">
      <li
        role="option"
        x-bind="$store.selection.itemProps(id, key)"
        @click="$store.selection.toggle(id, key)"
      >
        <span x-text="key"></span>
      </li>
    </template>
  </ul>

  <p>
    Seleccionadas:
    <span x-text="$store.selection.getSnapshot(id).selectedKeys.join(', ') || 'ninguna'"></span>
  </p>
</div>
```

`getSnapshot()` es todo el estado en un objeto: `selectedKeys`, el `anchorKey`, el
`activeKey`, más `mode`, `keys`, `disabledKeys` y `allowDisabledSelection`. Úsalo cuando
tengas que pasarle la selección a tu propio código, en vez de leer las partes sueltas.

`itemProps()` te da `aria-selected` y los hooks `data-*`, pero ningún `role`, así que
agregá vos `role="option"` en lo que los lleve — arriba es el `<li>`.

## Rango y reemplazo

`extend()` y `replace()` son los que convierten un click en un shift-click.

```js
$store.selection.toggle(id, key);
$store.selection.extend(id, key); // shift-click: del ancla hasta aquí
$store.selection.replace(id, key); // la única clave
```

El ancla es desde donde mide `extend()`, y la pone `setAnchor()` cuando necesitas
controlarla tú.

## Bloquear claves

`setDisabledKeys()` impide que una clave se seleccione y la deja en la lista, que es lo
que quieres para un elemento sobre el que el usuario todavía no puede actuar.

```js
$store.selection.setDisabledKeys(id, ["c"]);
```

`isSelectable(id, key)` te dice si una clave se puede seleccionar, que es el chequeo que
hay que usar para el estado deshabilitado de la celda.

## Referencia de la API

| Nombre                                          | Tipo   | Para qué sirve                                                                                                               |
| ----------------------------------------------- | ------ | ---------------------------------------------------------------------------------------------------------------------------- |
| `$store.selection.create(id, options?)`         | método | Crear una instancia. Options: `mode`, `keys`, `disabledKeys`, `allowDisabledSelection`, `value`, `defaultValue`, `onChange`. |
| `$store.selection.destroy(id)` / `destroyAll()` | método | Desarmar instancias.                                                                                                         |
| `$store.selection.setMode(id, mode)`            | método | `single`, `multiple` o `range`.                                                                                              |
| `$store.selection.setKeys(id, keys)`            | método | Reemplazar las claves seleccionables.                                                                                        |
| `$store.selection.setDisabledKeys(id, keys)`    | método | Reemplazar las claves bloqueadas.                                                                                            |
| `$store.selection.select(id, key, options?)`    | método | Seleccionar una clave.                                                                                                       |
| `$store.selection.toggle(id, key)`              | método | Seleccionar si no está, deseleccionar si está.                                                                               |
| `$store.selection.replace(id, key)`             | método | Dejar esta como única selección.                                                                                             |
| `$store.selection.extend(id, key)`              | método | Seleccionar del ancla hasta esta clave.                                                                                      |
| `$store.selection.selectAll(id)`                | método | Seleccionar todas las claves seleccionables.                                                                                 |
| `$store.selection.clear(id)`                    | método | Limpiar la selección.                                                                                                        |
| `$store.selection.setValue(id, value)`          | método | Fijar la selección directamente.                                                                                             |
| `$store.selection.getSnapshot(id)`              | método | Todo el estado en un objeto.                                                                                                 |
| `$store.selection.isSelected(id, key)`          | método | Si una clave está seleccionada.                                                                                              |
| `$store.selection.isSelectable(id, key)`        | método | Si una clave se puede seleccionar.                                                                                           |
| `$store.selection.isActive(id, key)`            | método | Si una clave es la activa.                                                                                                   |
| `$store.selection.isAnchor(id, key)`            | método | Si una clave es el ancla del rango.                                                                                          |
| `$store.selection.setActive(id, key)`           | método | Mover la clave activa.                                                                                                       |
| `$store.selection.setAnchor(id, key)`           | método | Mover el ancla del rango.                                                                                                    |
| `$store.selection.listProps(id, options?)`      | método | `role="listbox"`, más `aria-multiselectable` en modo `multiple` y `range`. `options` acepta un `label` opcional.             |
| `$store.selection.itemProps(id, key)`           | método | `aria-selected`, `data-selected` (solo cuando está seleccionada) y `data-key`. Sin `role` — agregalo vos.                    |
| `$store.selection.instances`                    | store  | Registro reactivo de cada instancia.                                                                                         |

:::caution[`replace()` y `extend()` se comportan distinto a propósito]
`replace()` descarta lo que estaba seleccionado. `extend()` lo conserva y agrega el
tramo desde el ancla. Un shift-click que por error llama a `replace()` es
indistinguible de un click que funciona, así que el bug solo aparece en multiselección.
:::

## Opciones del plugin

```ts
selectionPlugin({ id: "app-selection", storeKey: "sel" });
```
