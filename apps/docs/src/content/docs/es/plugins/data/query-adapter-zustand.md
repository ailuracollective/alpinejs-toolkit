---
title: Query Adapter (Zustand)
---

@ailura/alpinejs-query-adapter-zustand

Un `QueryStateAdapter` para la cache de [Query](/es/plugins/data/query/) que guarda cada
snapshot publicado en un store de `zustand/vanilla`. `zustand` es peer, así que el paquete
shippea el pegamento y cero bytes de zustand, y un store por handle es toda la implementación.

Es uno de los tres miembros de la familia de adapters: mismo contrato que
[Query Adapter (Alpine)](/es/plugins/data/query-adapter-alpine/) y
[Query Adapter (Nanostores)](/es/plugins/data/query-adapter-nanostores/), distinto store
detrás. Elegilo cuando algo que está fuera de Alpine tiene que ver la cache a lo largo del
tiempo — un panel de devtools, un test del lado de Node, una capa de persistencia.

## Instalar

```sh
pnpm add alpinejs @ailura/alpinejs-core @ailura/alpinejs-query @ailura/alpinejs-query-adapter-zustand zustand
```

Los cuatro peers son obligatorios. `zustand` en particular no es opcional: el adapter importa
`zustand/vanilla` en el scope del módulo, así que sin él el primer import de este paquete
falla al resolver.

## Registrar el plugin

```ts
import Alpine from "alpinejs";
import { createQueryPlugin, zustandStoreAdapter } from "@ailura/alpinejs-query-adapter-zustand";

Alpine.plugin(createQueryPlugin({ adapter: zustandStoreAdapter }));

Alpine.start();
```

Eso registra `$store.query` y **ningún magic** — acá no hay `$query`. El magic es de
`queryPlugin()`, del paquete `@ailura/alpinejs-query`.

## Ejemplo mínimo

```html
<div x-data>
  <button @click="$store.query.invalidate(['articles'])">Reload</button>
  <span x-text="$store.query.get(['articles'])?.data?.length ?? 0"></span>
</div>
```

La superficie del store es el store de Query, documentado en la página de
[Query](/es/plugins/data/query/), y es byte a byte el mismo que registra `queryPlugin()`.
Pasar `adapter` cambia dónde se escriben los snapshots, no lo que el store puede hacer.

## Para qué sirve el sink

`@ailura/alpinejs-query` guarda cada entrada de la cache adentro de su propio
`QueryController`. En cada cambio relevante, el controller arma un **snapshot de devtools** —
`{ phase, entries, mutations }`, valores y no getters — y lo entrega al handle del adapter
con `set()`.

El adapter de este paquete es el backend que lo sostiene, en una sola clave: `{ value }`.

El handle es un **sink, nunca una fuente**. Acá no se relee ninguna entrada de la cache, y
el `$store.query` registrado es idéntico haya adapter o no. Pasar uno no vuelve reactiva la
cache, no agrega un miembro al store, y no cambia los eventos ni el estado por query.

Leé el snapshot sin Alpine, desde el handle mismo:

```ts
import { zustandStoreAdapter } from "@ailura/alpinejs-query-adapter-zustand";

const handle = zustandStoreAdapter.create({ phase: "idle", entries: [], mutations: [] });
handle.get(); // el valor inicial con el que se creó
handle.set({ phase: "mounted", entries: [{ key: ["todos"] }], mutations: [] });
handle.get().entries.length; // 1
handle.destroy();
handle.get(); // undefined — y destroy() de nuevo es no-op, no un throw
```

Los handles son independientes: `create()` aloca un store nuevo por handle, así que dos
handles creados del mismo adapter no se pueden ver entre sí.

## Observar los snapshots desde afuera de Alpine

Ese ejemplo solo llega al `get()` del handle. Para que un snapshot sea _observable_, tiene
que viajar por un store que vos tengas — y por defecto el store es privado del handle.
`QueryStateHandle` es `{ get, set, destroy }` y no puede crecer con un miembro `subscribe`, y
el controller guarda el handle en un campo privado sin accessor. Por eso lo que se hace
alcanzable es el store: pasale tu propio creator a la factory del adapter y el store es
tuyo.

```ts
import Alpine from "alpinejs";
import { createStore } from "zustand/vanilla";
import type { StoreApi } from "zustand/vanilla";
import {
  createQueryPlugin,
  createZustandStoreAdapter,
} from "@ailura/alpinejs-query-adapter-zustand";

const stores: StoreApi<{ value: unknown }>[] = [];

const adapter = createZustandStoreAdapter({
  create: (initializer) => {
    const store = createStore(initializer);
    stores.push(store);
    return store;
  },
});

Alpine.plugin(createQueryPlugin({ adapter }));
Alpine.start();

// El controller creó su handle mientras corría el plugin, así que stores[0] es
// el store donde se escribe cada snapshot publicado.
stores[0].subscribe((state) => {
  const snapshot = state.value as { entries: unknown[] } | undefined;
  console.log(snapshot?.entries.length ?? 0, "entries in the cache");
});

// más tarde
stores[0].getState().value; // el último snapshot, sin Alpine
```

`create` se resuelve una vez por adapter, no por handle, así que un creator inyectado no se
puede cambiar por debajo de un handle que ya construyó. Inyectar uno solo cambia la
alocación — `get`, `set` y `destroy` son idénticos en los dos casos.

:::caution[El store del singleton listo para usar es inalcanzable]
`zustandStoreAdapter` es `createZustandStoreAdapter()` sin opciones, así que no tiene creator
inyectado: los stores que aloca pertenecen solo a sus handles, y el controller no expone
ningún accessor para el handle. Registrar el singleton te da snapshots a los que no te
podés suscribir. Armá el adapter con `createZustandStoreAdapter({ create })` cuando observar
sea el punto. Hasta que inyectes uno, la forma alcanzable de observar un snapshot es
`store.devtools.subscribe()`, que existe en el store registrado haya adapter o no.
:::

## Referencia de la API

| Export                       | Descripción                                                                                                                                                                    | Tipo                                        |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------- |
| `createZustandStoreAdapter`  | `createZustandStoreAdapter(options?) => QueryStateAdapter` — factory pura, sin efecto lateral al importar. `options.create` es el creator de store del que se arma cada handle | `function`                                  |
| `ZustandStoreAdapterOptions` | `{ create? }` — el argumento de arriba. `create` por defecto es el `createStore` de zustand                                                                                    | `type`                                      |
| `ZustandStoreCreator`        | `(initializer: () => { value: unknown }) => StoreApi<{ value: unknown }>` — el `createStore` de zustand lo satisface tal cual                                                  | `type`                                      |
| `zustandStoreAdapter`        | Un `createZustandStoreAdapter()` ya listo, para pasar directo como `adapter`. Sin configuración y sin creator inyectado                                                        | `const` (valor de tipo `QueryStateAdapter`) |
| `createQueryPlugin`          | `createQueryPlugin(options?) => (alpine) => void` — construye un `QueryController` con `defaultOptions` y `adapter`, y registra `toStore()` vía `guardStore`                   | `function`                                  |
| `zustandStoreQueryPlugin`    | Segundo nombre de `createQueryPlugin`, con un tipo de opciones más angosto: no incluye `adapter` ni `defaultOptions`, así que pasar cualquiera de los dos es un error de tipo  | `function`                                  |
| `default`                    | `queryAdapterZustand(options?)` — alias de `createQueryPlugin`                                                                                                                 | `function`                                  |
| `DEFAULT_QUERY_STORE_KEY`    | `"query"` — la clave `$store` por defecto. El mismo string que la constante propia de `@ailura/alpinejs-query`                                                                 | `const` (string literal)                    |
| `QueryRegisterOptions`       | `{ storeKey?, adapter?, defaultOptions? }`                                                                                                                                     | `type`                                      |

`QueryStateAdapter` y `QueryStateHandle` se **importan** de `@ailura/alpinejs-query` acá, no
se re-exportan: el contrato tiene un solo dueño, y el host que necesite el tipo lo importa
desde ahí.

## Opciones del plugin

```ts
type QueryRegisterOptions = {
  storeKey?: string; //        default: DEFAULT_QUERY_STORE_KEY ("query")
  adapter?: QueryStateAdapter; // el backend de estado donde publica el controller
  defaultOptions?: unknown; //   se pasa tal cual como las QueryOptions del controller
};
```

| Opción           | Default   | Efecto                                                                                                                                                                                          |
| ---------------- | --------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `storeKey`       | `"query"` | La clave `$store`. Renombrarla es la única evasión de colisiones que ofrece este paquete                                                                                                        |
| `adapter`        | —         | Se le pasa a `new QueryController(undefined, defaultOptions, adapter)`. Es un sink; omitirlo no cambia nada del store registrado                                                                |
| `defaultOptions` | —         | Se le pasa al mismo constructor sin cambios, así que `{ staleTime: 30_000 }` funciona. Tipado `unknown`, así que nada lo valida y este paquete no re-exporta ningún tipo de opciones de `query` |

### `createZustandStoreAdapter`

| Opción   | Default                     | Efecto                                                                                                                                                                 |
| -------- | --------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `create` | el `createStore` de zustand | La función de la que se aloca el store de cada handle. Pasale la tuya para conservar el store — y el `subscribe` que tiene. Cada handle sigue teniendo su propio store |

## API del store

Lo que devuelva `QueryController.toStore()`, registrado por este paquete:

```js
$store.query.observe(["articles"], fetcher, { staleTime: 30_000 });
$store.query.get(["articles"]);
$store.query.invalidate(["articles"]);
$store.query.setData(["articles"], (list) => [...(list ?? []), created]);
$store.query.mutate({ mutationFn: (variables) => api.create(variables) });
$store.query.remove();
$store.query.destroy();
$store.query.devtools.getSnapshot(); // { phase, entries, mutations }
$store.query.devtools.subscribe((s) => console.log(s.entries.length));
```

La superficie completa, sus opciones y su contrato de devtools están en la página de
[Query](/es/plugins/data/query/). Este paquete no la extiende, la envuelve ni la altera.

## Evitar colisiones de nombres

Este paquete **no** toma la excepción que sí toma su hermano. Registra sin `override`, así
que un segundo registro de `"query"` tira `RegistrationError` en vez de reemplazar en
silencio al primero — y el primer controller sigue corriendo.

```ts
Alpine.plugin(createQueryPlugin({ storeKey: "cache" }));
// → $store.cache
```

Eso es lo que deja convivir a este paquete y a `queryPlugin()` de `@ailura/alpinejs-query`
en una misma app con nombres distintos. Con el mismo nombre no conviven.

## SSR

SSR-safe: no lee `window`/`document` al importar, y el registro no necesita ninguno de los
dos. `zustand/vanilla` no lleva React ni el DOM, así que la mitad adapter de este paquete
importa y corre sin cambios en un proceso de Node. El `QueryController` se construye
cuando corre el callback del plugin, que es cuando lo llama el host.

## Qué adapter elegir

Los tres adapters implementan el mismo contrato `QueryStateAdapter` y los tres registran la
clave `"query"`, así que podés cambiar uno por otro sin renombrar nada. Difieren en una sola
cosa: qué puede hacer el store donde aterriza el snapshot.

| Paquete                    | Store detrás                  | Valor que sostiene | Suscribirse desde afuera de Alpine |
| -------------------------- | ----------------------------- | ------------------ | ---------------------------------- |
| `query-adapter-alpine`     | Una caja `Alpine.reactive`    | `{ value }`        | No — leés la caja por el handle    |
| `query-adapter-zustand`    | Un store de `zustand/vanilla` | `{ value }`        | Sí — con un `create` inyectado     |
| `query-adapter-nanostores` | Un `atom` de `nanostores`     | El snapshot mismo  | Sí — con un `create` inyectado     |

Alpine es el único al que una plantilla se puede enlazar, porque `Alpine.reactive` es el
grafo de Alpine. Entre los dos observables, zustand te da un `StoreApi` cuyo `subscribe`
recibe el slot `{ value }` entero, mientras nanostores te da un `WritableAtom` que guarda el
snapshot mismo — sin wrapper que desenvolver, con un `subscribe` que además dispara una vez
al suscribirse, y con la dependencia peer más chica de las tres.

Los tres son sinks, no fuentes: ninguno de los tres vuelve reactiva la cache, y los tres
dejan `$store.query` igual.

## Limitaciones

- **El store del singleton por defecto es inalcanzable; el inyectado no.** Mirá la
  advertencia de arriba.
- **`destroy()` es final e idempotente.** Después de que corre, `get()` devuelve
  `undefined` y `set()` se descarta — incluso una publicación tardía de un controller que se
  está desarmando — así que un handle liberado no se puede resucitar. Llamarlo dos veces es
  un no-op, no un throw.
- **El snapshot se guarda por referencia, no con una copia profunda.** `set()` guarda
  exactamente lo que publicó el controller y `get()` devuelve ese mismo objeto. El snapshot
  se rearma desde cero en cada cambio, así que quien lo tiene nunca lo ve mutar por
  debajo — pero los arrays `key` de las entradas y los valores de `data` de adentro son
  objetos del caller.
- **`subscribe()` es responsabilidad del consumidor.** El plugin no registra ningún listener
  de `change` y no cablea nada al adapter: el camino del snapshot es del controller, y el
  camino de la suscripción es del host.
- **Tres nombres, una función.** `createQueryPlugin`, el export por defecto
  (`queryAdapterZustand`) y `zustandStoreQueryPlugin` son el mismo código, y ni siquiera
  tienen el mismo tipo de parámetro: a `zustandStoreQueryPlugin` le faltan `adapter` y
  `defaultOptions`, así que pasar cualquiera de los dos es un error de compilación.
- **`DEFAULT_QUERY_STORE_KEY` choca por nombre con la constante de `query`.** Las dos son
  `"query"`, las dos se exportan, y traer las dos a un mismo módulo necesita un alias.
- **Ningún test cubre el plugin.** Los tests del paquete ejercitan solo el adapter.
