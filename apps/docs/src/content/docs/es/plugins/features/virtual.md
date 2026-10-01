---
title: Virtual
---

@ailura/alpinejs-virtual

Una lista virtualizada: mantiene en el DOM solo las filas que están a la vista, sin
importarle cuántas haya en total. El plugin maneja la matemática de la ventana; tú
escribes el contenedor con scroll y las filas.

Usala cuando una lista es lo bastante larga como para que renderizar todas las filas sea
el cuello de botella.

## Instalar

```sh
pnpm add alpinejs @ailura/alpinejs-virtual
```

## Registrar el plugin

Una vez, antes de `Alpine.start()`.

```ts
import Alpine from "alpinejs";
import virtualPlugin from "@ailura/alpinejs-virtual";

Alpine.plugin(virtualPlugin());

Alpine.start();
```

Eso registra un store `virtual`, así que todo lo de abajo vive en `$store.virtual`.

## Ejemplo mínimo

Diez mil filas, renderizadas por el slice que te da el store.

```html
<div
  x-data="{ id: 'filas' }"
  x-init="$store.virtual.create(id, { count: 10000, estimateSize: 32 })"
>
  <div
    x-bind="$store.virtual.listProps(id)"
    x-virtual-scroll="id"
    style="height: 400px; overflow-y: auto"
  >
    <div
      x-bind="$store.virtual.contentProps(id)"
      :style="`position: relative; height: $store.virtual.instances[id].totalSize + 'px'`"
    >
      <template x-for="row in $store.virtual.instances[id].virtualItems" :key="row.key">
        <div
          x-bind="$store.virtual.itemProps(id, row.index)"
          :style="`position: absolute; top: 0; left: 0; transform: translateY(${row.start}px); height: ${row.size}px`"
          x-text="row.index"
        ></div>
      </template>
    </div>
  </div>
</div>
```

Dos cosas hacen que esto funcione y las dos son fáciles de pasar por alto:

- `x-virtual-scroll` le dice al store qué elemento scrollea. Sin eso la ventana nunca se
  actualiza y la lista renderiza como una única fila estática.
- `contentProps()` solo publica `data-virtual-total-size`. La altura del scroll es tuya:
  vinculá el `height` del spacer interior a `instances[id].totalSize` y posicioná las
  filas con su `start`. Sin eso la barra de scroll nunca crece y el usuario no puede
  scrollear.

Iterá sobre `instances[id].virtualItems`, no sobre el conteo completo. Ese registro es
la proyección reactiva: el store lo reescribe en cada scroll, así que el template
re-renderiza. `getVirtualItems(id)` devuelve el mismo slice pero lee el controller
directamente, así que es una lectura imperativa: sirve en un click handler y no sirve en
un template.

## Variantes

**Mantené algunas filas extra renderizadas alrededor del viewport.** El overscan cambia
un poco de DOM por fluidez de scroll.

```js
$store.virtual.create(id, { count: 10000, estimateSize: 32, overscan: 8 });
```

**Scrollear a una fila.** `scrollToIndex` posiciona el contenedor; no cambia la selección.

```js
$store.virtual.scrollToIndex(id, 4500);
```

**Cambia los datos sin recrear la instancia.** Cuando tu lista llega de un fetch, actualiza
el conteo o las claves en vez de llamar a `create` de nuevo.

```js
$store.virtual.setCount(id, rows.length);
$store.virtual.setKeys(
  id,
  rows.map((r) => r.id)
);
```

**Medí filas que no tienen altura fija.** `measureItem` toma el tamaño real una vez que la
fila está en pantalla.

```js
$store.virtual.measureItem(id, index, element.offsetHeight);
```

## Referencia de la API

| Nombre                                        | Tipo     | Para qué sirve                                                                                                        |
| --------------------------------------------- | -------- | --------------------------------------------------------------------------------------------------------------------- |
| `$store.virtual.create(id, options?)`         | `method` | Crear una instancia. Options: `count`, `horizontal`, `estimateSize`, `overscan`, `gap`, `paddingStart`, `paddingEnd`. |
| `$store.virtual.destroy(id)` / `destroyAll()` | `method` | Desarmar instancias.                                                                                                  |
| `$store.virtual.bindScrollElement(id, el)`    | `method` | El elemento con scroll. Necesario.                                                                                    |
| `$store.virtual.getVirtualItems(id)`          | `method` | El slice visible, cada fila con un `index`. Lectura imperativa: en markup, iterá `instances[id].virtualItems`.        |
| `$store.virtual.getTotalSize(id)`             | `method` | El tamaño total scrolleable. Imperativo: para un template, `instances[id].totalSize`.                                 |
| `$store.virtual.scrollToIndex(id, index)`     | `method` | Scrollear el contenedor a una fila.                                                                                   |
| `$store.virtual.scrollToOffset(id, px)`       | `method` | Scrollear el contenedor a un offset absoluto.                                                                         |
| `$store.virtual.setCount(id, count)`          | `method` | Cambiar el conteo total de filas.                                                                                     |
| `$store.virtual.setKeys(id, keys)`            | `method` | Cambiar las claves de fila, para estabilidad de `:key`.                                                               |
| `$store.virtual.measureItem(id, index, size)` | `method` | Registrar una altura medida real.                                                                                     |
| `$store.virtual.listProps(id)`                | `method` | `role="list"` y los atributos del contenedor con scroll.                                                              |
| `$store.virtual.contentProps(id)`             | `method` | `data-virtual-total-size` del spacer interior. La altura la vinculás vos.                                             |
| `$store.virtual.itemProps(id, index)`         | `method` | `role="listitem"`, `aria-setsize`/`aria-posinset` y los offsets `data-virtual-*` de una fila.                         |
| `$store.virtual.instances`                    | store    | Registro reactivo de todas las instancias. La única superficie a la que un template se puede enlazar.                 |

## Directivas

| Nombre                  | Tipo        | Para qué sirve                                                                                                                       |
| ----------------------- | ----------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `x-virtual-scroll="id"` | `directiva` | Vincula el contenedor con scroll a la instancia cuyo id evalúa la expresión, y desvincula cuando Alpine saca ese elemento del árbol. |

La liberación es del elemento: se saca el listener de scroll y se suelta la referencia al
elemento, mientras que la instancia sigue en `$store.virtual.instances` y sigue
sirviendo `getVirtualItems()`. Una expresión que no sea un string no vincula nada. El
nombre de la directiva se configura con `directiveKey`.

:::caution[Dos mitades, y una de las dos es tuya]
`contentProps()` no pone una altura: publica `data-virtual-total-size`, y de ahí
vinculás vos la altura del spacer con `getTotalSize(id)`. Sacá ese binding y el
contenedor scrollea unos pocos píxeles; dejá la altura pero sacá `x-virtual-scroll` y
la barra queda completa mientras nada se mueve.
:::

## Opciones del plugin

```ts
virtualPlugin({ id: "app-virtual", storeKey: "listas", directiveKey: "virtual-scroll" });
```
