---
title: Collection
---

@ailura/alpinejs-collection

Un store de colecciones: items más filtrado, ordenamiento, agrupamiento y paginación,
con el resultado ya calculado. El plugin maneja la query; tú renderizas la lista.

## Instalar

```sh
pnpm add alpinejs @ailura/alpinejs-collection
```

## Registrar el plugin

Una vez, antes de `Alpine.start()`.

```ts
import Alpine from "alpinejs";
import collectionPlugin from "@ailura/alpinejs-collection";

Alpine.plugin(collectionPlugin());

Alpine.start();
```

Eso registra un store `collection`, así que todo lo de abajo vive en `$store.collection`.

## Ejemplo mínimo

Una lista registrada, leída de vuelta desde el registro.

```html
<div x-data="{ cid: 'productos' }" x-init="$store.collection.create(cid, { items: productos })">
  <p>
    Registradas:
    <span x-text="Object.keys($store.collection.instances).join(', ') || 'ninguna'"></span>
  </p>

  <button @click="$store.collection.create('pedidos', { items: pedidos })">
    Registrar pedidos
  </button>
  <button @click="$store.collection.destroy(cid)">Dejar de registrar productos</button>
</div>
```

Hay exactamente dos métodos: `create()` y `destroy()`. El filtrado, el ordenamiento y la
paginación viven en el snapshot, no en el store, así que el store queda lo bastante chico
como para razonarlo.

## Un store, muchas colecciones

`instances` está indexado por el id que le pasaste a `create()`. Ese es el motivo por el
que existe el id: permite que un único store registrado lleve la lista de productos y la
de pedidos al mismo tiempo, cada una independiente.

```js
$store.collection.create("productos", {
  items: productos,
  filter: { match: (item, query) => byCategory(item, query) },
  sort: { compare: (a, b) => a.name.localeCompare(b.name), direction: "desc" },
});
```

Destruir es simétrico a crear, y es lo que hay que hacer cuando una vista se desmonta,
para que la instancia no sobreviva al componente que la creó.

```js
$store.collection.destroy("pedidos");
```

## Configurar la query

`create()` acepta las mismas opciones que le pasarías a una capa de datos: los items, y
opcionalmente un `filter`, un `sort`, un `group` y un `paginate`. `filter` y `sort` son
objetos, no funciones sueltas: `filter.match` es el matcher y `sort.compare` el
comparador — y `sort` no hace nada sin un `compare`.

```js
$store.collection.create("productos", {
  items,
  filter: { match: (item, query) => item.name.includes(query) },
  sort: { compare: (a, b) => a.name.localeCompare(b.name), direction: "asc" },
  paginate: { pageSize: 20 },
});
```

El snapshot de `instances` lleva el resultado filtrado, ordenado, agrupado y paginado.
Vincula a ese snapshot en vez de recalcularlo en el template, o una lista larga se
recalcula en cada render.

## Referencia de la API

| Nombre                                   | Tipo   | Para qué sirve                                                                                                                                |
| ---------------------------------------- | ------ | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `$store.collection.create(id, options?)` | método | Crear una instancia. Options: `items`, `getKey`, `initialKey`, `isDisabled`, `isHidden`, `filter`, `sort`, `group`, `paginate`, `wrap`, `id`. |
| `$store.collection.destroy(id)`          | método | Quitar una instancia.                                                                                                                         |
| `$store.collection.instances`            | store  | Registro reactivo, indexado por id, con un snapshot por instancia.                                                                            |

:::caution[Una instancia que creas y nunca destruyes sigue filtrando sus items]
`instances` es reactivo y de vida larga, así que una colección creada para una ruta que
ya no está montada mantiene vivo su snapshot. Creá en el mount y destruí en el teardown,
o la memoria crece una colección por navegación.
:::

## Opciones del plugin

```ts
collectionPlugin({ storeKey: "lists" });
```
