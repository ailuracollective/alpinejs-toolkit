---
title: History
---

@ailura/alpinejs-history

Una pila de undo/redo para un valor. El plugin maneja la pila, los agrupamientos y el
estado reactivo; tú decides qué cuenta como un cambio.

## Instalar

```sh
pnpm add alpinejs @ailura/alpinejs-history
```

## Registrar el plugin

Una vez, antes de `Alpine.start()`.

```ts
import Alpine from "alpinejs";
import historyPlugin from "@ailura/alpinejs-history";

Alpine.plugin(historyPlugin());

Alpine.start();
```

Eso registra un store `history`, así que todo lo de abajo vive en `$store.history`.

## Ejemplo mínimo

Un campo de texto con undo y redo atados al teclado.

```html
<div
  x-data="{ text: '' }"
  @keydown.meta.z.prevent="$store.history.undo()"
  @keydown.meta.shift.z.prevent="$store.history.redo()"
>
  <textarea x-model="text" @input="$store.history.commit(text)"></textarea>
  <button @click="$store.history.undo()" :disabled="!$store.history.canUndo">Deshacer</button>
  <button @click="$store.history.redo()" :disabled="!$store.history.canRedo">Rehacer</button>
</div>
```

`canUndo` y `canRedo` son booleanos reactivos, así que el estado deshabilitado no lo
tienes que mantener a mano.

## Agrupar cambios con transacciones

Cada `commit()` es su propio paso de undo, así que en un formulario eso es un undo por
tecla. `transaction()` abre un handle: commiteá el handle para conservar lo que hiciste
adentro, hacele rollback para descartar esos cambios.

```js
const tx = $store.history.transaction($store.history.value);
$store.history.commit($store.history.value + 5);
tx.commit(); // o tx.rollback() para descartar
```

`transactionDepth` cuenta los handles que tenés abiertos, así que una barra de
herramientas puede saber si está en medio de un cambio.

## Checkpoints y limpieza

Un checkpoint mete el valor actual en la pila de undo, así que `undo()` vuelve hasta
ahí; `clear()` vacía la pila, que es lo que querés cuando el valor ya no es deshacible,
por ejemplo después de guardar.

```js
$store.history.checkpoint({ label: "antes de importar" });
$store.history.clear();
```

## Referencia de la API

| Nombre                                     | Tipo   | Para qué sirve                                    |
| ------------------------------------------ | ------ | ------------------------------------------------- |
| `$store.history.value`                     | store  | El valor actual.                                  |
| `$store.history.undoStack`                 | store  | Las entradas que se pueden deshacer.              |
| `$store.history.redoStack`                 | store  | Las entradas que se pueden rehacer.               |
| `$store.history.canUndo`                   | store  | Si hay algo que deshacer.                         |
| `$store.history.canRedo`                   | store  | Si hay algo que rehacer.                          |
| `$store.history.transactionDepth`          | store  | Qué tan adentro de una transacción estás.         |
| `$store.history.commit(value, meta?)`      | método | Registrar un valor nuevo como paso de undo.       |
| `$store.history.push(value, meta?)`        | método | Alias de `commit()`.                              |
| `$store.history.undo()`                    | método | Un paso atrás.                                    |
| `$store.history.redo()`                    | método | Un paso adelante.                                 |
| `$store.history.reset(value, meta?)`       | método | Arrancar una historia nueva desde un valor nuevo. |
| `$store.history.transaction(initialValue)` | método | Abrir un handle con `commit()` / `rollback()`.    |
| `$store.history.checkpoint(meta?)`         | método | Poner el valor actual como un punto con nombre.   |
| `$store.history.clear()`                   | método | Vaciar la pila.                                   |
| `$store.history.destroy()`                 | método | Desarmar el store.                                |

`meta` tiene la misma forma en todos lados: `{ label, group, meta }`.

:::caution[Un commit nuevo borra la pila de redo]
`commit()` y `push()` son la misma llamada, y ambas vacían la pila de redo. O sea que el
redo sobrevive solo hasta el próximo commit: una tecla más después de un undo tira la
rama en la que estabas. Un commit cuyo valor es igual al de arriba de la pila se saltea
entero, así que si solo querés leer el valor actual, leé `$store.history.value`.
:::

## Opciones del plugin

```ts
historyPlugin({ id: "app-history", storeKey: "undo" });
```

Las opciones aceptadas son `id`, `storeKey` (default `history`), `initialValue`, `limit`
(default `100`), `clone` y `equality`.
