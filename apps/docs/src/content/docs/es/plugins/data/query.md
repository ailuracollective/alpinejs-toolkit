---
title: Query
---

@ailura/alpinejs-query

Una cache de queries con la forma de TanStack Query: fetch, observe, invalidate y
mutate, con `staleTime`, reintentos y un objeto de estado por clave. El plugin
maneja la cache; tú la llamas desde un componente.

## Instalar

```sh
pnpm add alpinejs @ailura/alpinejs-core @ailura/alpinejs-query
```

## Registrar el plugin

Una vez, antes de `Alpine.start()`.

```ts
import Alpine from "alpinejs";
import queryPlugin from "@ailura/alpinejs-query";

Alpine.plugin(queryPlugin());

Alpine.start();
```

Eso registra un store `query` y un magic `query`, así que todo lo de abajo vive en
`$store.query` o `$query`.

## Ejemplo mínimo

Cargar una lista una vez y renderizar su estado.

```html
<div
  x-data="{
    users: null,
    error: null,
    async load() {
      const key = ['users'];
      await $store.query.prefetch(key, () => fetch('/api/usuarios').then((r) => r.json()));
      const state = $store.query.get(key);
      this.users = state?.data ?? null;
      this.error = state?.error?.message ?? null;
    },
  }"
  x-init="load()"
>
  <p x-show="!users && !error">Cargando…</p>
  <p x-show="error" x-text="error" role="alert"></p>

  <ul>
    <template x-for="user in users ?? []" :key="user.id">
      <li x-text="user.name"></li>
    </template>
  </ul>

  <button @click="load()">Cargar</button>
</div>
```

Una clave es un array, y se compara por valor: `['users']` y `['users']` son la misma
entrada de cache, se arme como se arme el array. El método que lee el estado de vuelta
es `get()`, no `getQueryData()`. Devuelve el objeto de estado, o `undefined` para una
clave que nunca se pidió.

**Los flags viven en ese objeto de estado, no en el store.** El store no tiene un
`isPending(key)`; lo equivalente es `get(key)?.isPending`. El estado lleva `data`,
`error`, `status`, `fetchStatus`, `dataUpdatedAt`, `errorUpdatedAt`, `isPending`,
`isLoading`, `isFetching`, `isError`, `isSuccess`, `isStale` y `refetch()`.

Que `get()` devuelva `undefined` importa: una lectura `get(key).data` tira en el primer
render, antes de que se haya hecho ninguna petición.

:::caution[Las entradas son objetos planos, no proxies reactivos]
El store es una superficie de comandos: no guarda datos, solo métodos, y el estado
observable por query (`status`, `data`, `isPending`, …) vive en la entrada que devuelven
`get()` y `observe()`. Esa entrada es un objeto plano de getters, no un proxy reactivo,
así que una lectura `$store.query.get(['usuarios'])?.status` no registra ninguna
dependencia reactiva y por sí sola no vuelve a renderizar cuando la entrada cambia. Si la
vista tiene que actualizarse, guardá en el estado del componente lo que querés renderizar
—copiá de la entrada los campos que necesitás, como hace el ejemplo de arriba— y leé
desde ahí. El plugin no envuelve las entradas en `alpine.reactive`, y nada de esta
página cambia eso.
:::

## Invalidar vs recargar

Tres llamadas parecen "recargar", y ninguna se comporta igual.

`refetch()` sobre un objeto de estado siempre corre el fetcher de nuevo, aunque la
entrada siga fresca:

```js
$store.query.get(["usuarios"])?.refetch();
```

`invalidate(key?)` vuelve a correr el fetcher en segundo plano para una clave, una lista
de claves o — sin argumento— para todas las entradas. No devuelve nada y no se puede
esperar, así que un componente que renderiza desde su propio estado tiene que hacer la
lectura después, como hace el ejemplo de arriba.

`fetch(key, fn, options?)` es la única que dispara una petición sólo cuando la entrada
todavía no tiene datos: llamala de nuevo sobre una entrada que ya tuvo éxito y recibís
el estado sin una segunda petición. Usala para la primera carga; usá `refetch()` o
`invalidate()` para un refresh manual.

## Mutaciones

`mutate()` toma un único objeto de options y devuelve un handle, no una promesa, así el
estado se puede leer mientras corre la mutation.

```js
const mutation = $store.query.mutate({
  mutationFn: (variables) =>
    fetch("/api/usuarios", {
      method: "POST",
      body: JSON.stringify(variables),
    }).then((r) => r.json()),
  onError: (error) => console.error(error),
});

try {
  await mutation.mutate({ name: "Ada" });
  $store.query.invalidate(["usuarios"]);
} finally {
  mutation.reset();
}
```

Las options son `mutationFn` (obligatorio, `(variables) => Promise<data>`), más las
opcionales `onMutate(variables)`, `onSuccess(data, variables, context)`,
`onError(error, variables, context)` y
`onSettled(data, error, variables, context)`. El handle lleva `data`, `error`, `status`
(`idle` / `pending` / `error` / `success`), los flags `isIdle`, `isPending`, `isError` e
`isSuccess`, y dos métodos: `mutate(variables)` y `reset()`. No hay mutation key: una
llamada a `mutate()` es una mutation.

Invalidar después de escribir es lo que mantiene honesta la lista. Sin eso la mutation
termina bien y la lista sigue mostrando los datos viejos.

## Ajustar la cache

`defaultOptions` aplica a todas las queries, que es donde van `staleTime` y `retry` una
vez que conoces la forma de tus datos.

```ts
queryPlugin({
  defaultOptions: {
    queries: { staleTime: 30_000, retry: 3 },
  },
});
```

## Referencia de la API

| Nombre                                     | Tipo     | Para qué sirve                                                              |
| ------------------------------------------ | -------- | --------------------------------------------------------------------------- |
| `$store.query.fetch(key, fn, options?)`    | `method` | Dispara la petición si la entrada no tiene datos; devuelve el estado.       |
| `$store.query.observe(key, fn, options?)`  | `method` | Igual, más una vista viva que lleva el estado.                              |
| `$store.query.prefetch(key, fn, options?)` | `method` | Corre siempre el fetcher y lo espera.                                       |
| `$store.query.get(key)`                    | `method` | El objeto de estado: `data`, `status`, `error` y los flags, o `undefined`.  |
| `$store.query.setData(key, data)`          | `method` | Escribir en la cache a mano; `data` puede ser función del valor actual.     |
| `$store.query.invalidate(key?)`            | `method` | Recarga una clave, una lista de claves o todo. No se puede esperar.         |
| `$store.query.remove(key?)`                | `method` | Quitar una entrada, una lista de entradas o todas.                          |
| `$store.query.reset()`                     | método   | Vaciar la cache entera. No acepta argumento.                                |
| `$store.query.resetQueries(key?)`          | método   | Quitar una entrada, una lista de entradas o todas.                          |
| `$store.query.mutate(options)`             | método   | Correr una mutation; devuelve un handle de estado.                          |
| `$store.query.cancel(key)`                 | método   | Abortar la petición en vuelo de una clave.                                  |
| `$store.query.clearMutations()`            | método   | Está por paridad; no hay nada que limpiar.                                  |
| `$store.query.devtools`                    | store    | `getSnapshot()` y `subscribe(cb)`; ver [API de devtools](#api-de-devtools). |
| `$store.query.destroy()`                   | método   | Aborta todo lo que está en vuelo y desarma la cache.                        |

`observe()`, `fetch()` y `prefetch()` también aceptan un único objeto de definición —
`{ queryKey, queryFn, ...options }` — en vez de la forma posicional.

:::caution[Las claves se comparan por valor JSON, no por referencia]
Cada clave se serializa con `JSON.stringify`, así que un `['users', { page: 1 }]` nuevo
con el mismo contenido es la misma entrada de cache: podés armarlo inline, sin problema.
Lo que _no_ sobrevive el viaje es lo que `JSON.stringify` no puede representar de forma
estable: un `Date`, un `Map`, una función o un objeto cíclico dan una cadena distinta en
cada llamada, así que cada uno es una entrada distinta y la petición nunca para. Que las
claves se queden en valores JSON planos.
:::

## Eventos

El controller emite `change(key)`, `success(key, data)` y `error(key, error)`. Son
eventos del controller, no eventos del DOM: no se dispara nada en `window`, así que hay
que suscribirse a través de un controller que construyas vos.

## Opciones del plugin

```ts
queryPlugin({ storeKey: "cache", magicKey: "cacheQuery" });
```

| Opción     | Tipo     | Default | Propósito                                            |
| ---------- | -------- | ------- | ---------------------------------------------------- |
| `storeKey` | `string` | `query` | Nombre del store, alcanzable en `$store.<storeKey>`. |
| `magicKey` | `string` | `query` | Nombre del magic, alcanzable como `$<magicKey>`.     |

`magicKey` gana sobre `storeKey`. Si pasás sólo `storeKey`, el magic lo sigue, así que
una sola opción mueve el plugin entero fuera de un nombre colisionado:

```ts
queryPlugin({ storeKey: "cache" }); // $store.cache y $cache
```

Los dos nombres pasan por los guards de registro, así que un nombre que ya pertenece a
otro paquete lanza un error en vez de ser sobreescrito en silencio.

## API de devtools

`$store.query.devtools` es un contrato real, y es la mitad de la historia de devtools que
sale en el entry point principal:

```ts
const snapshot = $store.query.devtools.getSnapshot();
// { phase, entries, mutations } — valores planos, no getters

const stop = $store.query.devtools.subscribe((next) => {
  console.log(next.entries.length, "entries");
});

stop();
```

`getSnapshot()` es una lectura normal; `subscribe(cb)` llama de vuelta en cada cambio
relevante — una entrada que entra o sale de la cache, un fetch que se asienta, un
`setData()`, una mutation que se asienta — y `stop()` es idempotente. Es read-only: es una
ventana a la cache, no unHandle sobre ella.

### El panel

`@ailura/alpinejs-query/devtools` es el inspector estilizado de ese contrato, y **sale**
desde su propio subpath — un bundle de producción que nunca lo importa no carga nada de él.

```js
import { queryDevtoolsPlugin } from "@ailura/alpinejs-query/devtools";

Alpine.plugin(queryPlugin());
Alpine.plugin(queryDevtoolsPlugin({ position: "bottom", theme: "system" }));
```

`queryDevtoolsPlugin` difiere a `alpine:initialized`, porque `$store.query` no existe hasta
que Alpine bootea, y devuelve un cleanup que saca ese listener de nuevo. O montalo
directamente contra un controller, sin Alpine en el medio:

```js
import { mountQueryDevtools } from "@ailura/alpinejs-query/devtools";

const panel = mountQueryDevtools({ store: controller.toStore(), initialOpen: true });
// panel.open() / close() / toggle() / setToggleCorner() / getToggleCorner() / destroy()
```

Lo que obtenés: un toggle en una esquina y un panel `bottom` o `right`; una lista de Queries
y otra de Mutations con búsqueda, orden y filtro de alcance por fuente; un pane de detalle
con un visor de valor Tree / JSON / Edit; temas claro y oscuro que siguen el `data-theme`
del host, `.dark` o el esquema de color del sistema; y preferencias persistidas en
`localStorage`.

**El panel es un lector.** Renderiza `phase`, `entries` y `mutations` exactamente como los
define el contrato, y cada afordancia que ofrece y sí modifica — Refetch, Invalidate, Reset,
Remove, Reset cache, Clear mutations, Edit-and-apply — se prueba contra la fuente sobre la
que lo montaste. Una fuente que expone solo `devtools` no recibe botones de acción, y recibe
la pestaña **Edit** deshabilitada con el motivo impreso abajo. Un `QueryStore` completo
expone `setData()`, y eso es lo que enciende el editor: `QueryDevtoolsApi` en sí es
read-only y nunca se agranda para cargarlo.

El subpath es DOM-only por diseño y está guardado como manda el toolkit, así que el panel
entero es inerte bajo SSR en vez de tirar: llega al DOM por `safeDocument()` /
`safeWindow()` / `isBrowser()` de `@ailura/alpinejs-core/env`, y `mountQueryDevtools()` en
un proceso de Node devuelve un controller inerte en vez de tirar.
