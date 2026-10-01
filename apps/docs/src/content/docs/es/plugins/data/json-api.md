---
title: Json Api
---

@ailura/alpinejs-json-api

Un cliente JSON:API tipado por schema, registrado como store. Declarás el schema una vez;
el plugin conoce los tipos de recurso, los attributes y las relaciones, y toma de la
llamada `include`, `fields`, `sort`, `page` y `filter`.

## Instalar

```sh
pnpm add alpinejs @ailura/alpinejs-core @ailura/alpinejs-json-api
```

## Registrar el plugin

Una vez, antes de `Alpine.start()`.

```ts
import Alpine from "alpinejs";
import jsonApiPlugin from "@ailura/alpinejs-json-api";

const schema = {
  articles: {
    attributes: {} as { title: string; body: string },
    relationships: { author: { type: "people" } },
  },
  people: {
    attributes: {} as { name: string },
  },
} as const;

Alpine.plugin(jsonApiPlugin({ schema, baseUrl: "https://api.example.com" }));

Alpine.start();
```

El schema y el base URL son **obligatorios**, y van a la factory. No hay un método del
store para configurarlos después.

## Ejemplo mínimo

Pedir un artículo con su autor.

```html
<div
  x-data="{
    article: null,
    async load() {
      this.article = await $store.jsonApi.findOne('articles', '1', {
        include: ['author'],
      });
    },
  }"
  x-init="load()"
>
  <span x-text="article?.data?.attributes?.title"></span>
</div>
```

`findOne()` es la llamada de un recurso y `findAll()` la de la lista. El viejo `get()` no
es la API: son esas dos. Las dos toman el tipo de recurso, el id en `findOne`, y un
objeto de query opcional. Lo que vuelve es el documento parseado, así que un recurso vive
en `document.data` y sus attributes en `document.data.attributes`.

## Qué es el schema, y qué no

El schema es un contrato de compilación. La clave de un recurso es el tipo que la API le
llama —`articles` va en la URL como `/articles`— y `attributes` tipa el payload que leés
y escribís. En runtime no lo lee nadie: el cliente nunca chequea un nombre de campo
contra él ni arma una petición a partir de él, así que un field que el schema no declara
no se detecta localmente. El servidor lo rechaza, y el error vuelve como error de
respuesta y no de validación, lo que te manda al schema en vez de a la llamada.

El `type` de una relación es el tipo de recurso _destino_, que es lo que
`relationships: { author: { type: "people" } }` quiere decir: este artículo tiene un autor
de tipo `people`.

El objeto de query de `findAll()` y `findOne()` es `include`, `fields`, `sort`, `page` y
`filter`:

```js
$store.jsonApi.findAll("articles", { include: ["author"], sort: ["-title"] });
```

:::caution[Hoy sólo llegan a la URL las options planas]
`include` y `sort` son arrays de nombres, así que llegan como `?include=author&sort=-title`
y un servidor los lee como espera. `fields`, `page` y `filter` son objetos, y el cliente
los agrega con `String(value)`, así que aterrizan como `?fields=[object Object]` en vez
del `fields[articles]=title` de JSON:API. Hasta que eso se serialice bien, armá esos
query params vos en el `baseUrl` o con un `fetcher` propio.
:::

:::caution[Las relaciones no se resuelven solas]
Una respuesta con `include` trae los recursos relacionados en `document.included`, y las
`relationships` del recurso siguen con sus identificadores en `data`. El cliente devuelve
el documento tal cual lo parseó: unir las dos cosas — leer
`relationships.author.data.id` y buscar ese id en `included`— es tarea de quien llama.
:::

## Escrituras

El cliente expone las cinco operaciones de JSON:API, y nada más. No hay un `request()`
genérico al que agarrarse cuando algo no encaja. Las escrituras toman un objeto payload
con `attributes` (y `relationships` opcional), nunca un bolso de attributes suelto.

```js
$store.jsonApi.create("articles", {
  attributes: { title: "Hola" },
  relationships: { author: { data: { type: "people", id: "9" } } },
});
$store.jsonApi.update("articles", "1", { attributes: { title: "Renombrado" } });
$store.jsonApi.delete("articles", "1");
```

## Referencia de la API

| Nombre                                     | Tipo   | Para qué sirve                        |
| ------------------------------------------ | ------ | ------------------------------------- |
| `$store.jsonApi.findAll(type, query?)`     | método | Pedir una colección.                  |
| `$store.jsonApi.findOne(type, id, query?)` | método | Pedir un recurso por id.              |
| `$store.jsonApi.create(type, payload)`     | método | POST de un recurso nuevo.             |
| `$store.jsonApi.update(type, id, payload)` | método | PATCH de un recurso existente.        |
| `$store.jsonApi.delete(type, id)`          | método | DELETE de un recurso.                 |
| `$store.jsonApi.schema`                    | store  | El schema que registraste.            |
| `$store.jsonApi.id`                        | store  | El id de la instancia del controller. |

En el store no hay `fetcher`, `headers` ni `phase`: la implementación de fetch y los
headers son options que pasás al registrar, no estado que se lea de vuelta.

## Eventos

El controller emite `request({ type, method, url })`,
`response({ type, method, url, ok, status })` y, ante un `findAll()` fallido,
`error({ errors, status })`. Son eventos del controller, no eventos del DOM, así que hay
que suscribirse a través de un cliente que construyas vos con `createJsonApiClient()`.
Toda respuesta que no sea 2xx tira; las otras cuatro llamadas lo reportan tirando.

## Opciones del plugin

```ts
jsonApiPlugin({ schema, baseUrl, storeKey: "api" });
```

| Opción     | Tipo                     | Default   | Propósito                                               |
| ---------- | ------------------------ | --------- | ------------------------------------------------------- |
| `schema`   | `JsonApiSchema`          | —         | Obligatorio. Los tipos de recurso.                      |
| `baseUrl`  | `string`                 | —         | Obligatorio. Prefijo de la URL de cada petición.        |
| `fetcher`  | `typeof fetch`           | `fetch`   | Cambiar el transporte, por ejemplo para tests o SSR.    |
| `headers`  | `Record<string, string>` | `{}`      | Se mergea sobre el `Accept`/`Content-Type` de JSON:API. |
| `storeKey` | `string`                 | `jsonApi` | Nombre del store.                                       |

Las peticiones salen con `Content-Type: application/vnd.api+json` y el `Accept`
correspondiente, exportado como `JSON_API_MEDIA_TYPE`.
