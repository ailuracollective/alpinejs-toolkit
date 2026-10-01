---
title: Query Adapter (Alpine)
---

@ailura/alpinejs-query-adapter-alpine

El registro alternativo del store de [Query](/es/plugins/data/query/): registra el
mismo store `query`, desde un controller nuevo, bajo el mismo nombre.

Es un puente finito, no un plugin propio: la superficie del store que le pasa a Alpine
la arma `QueryController.toStore()`, exactamente la misma que arma el paquete de Query.

## Instalar

```sh
pnpm add alpinejs @ailura/alpinejs-core @ailura/alpinejs-query @ailura/alpinejs-query-adapter-alpine
```

## Registrar el plugin

Esto reemplaza a `queryPlugin`. No instales los dos.

```ts
import Alpine from "alpinejs";
import { alpineStoreQueryPlugin } from "@ailura/alpinejs-query-adapter-alpine";

Alpine.plugin(alpineStoreQueryPlugin());

Alpine.start();
```

Todo lo de la página de [Query](/es/plugins/data/query/) funciona igual, porque la
superficie del store es la misma. Dos diferencias que conviene saber: este registro
reemplaza lo que haya bajo el nombre `query` en vez de tirar ante una colisión, y no
registra ningún magic, así que no hay `$query`: sólo `$store.query`.

## Para qué sirve el adapter

La cache de queries es agnóstica del almacenamiento: pide, deduplica y trackea el
staleness, y en algún lado tiene que guardar el resultado. Las entradas que devuelve son
objetos planos de getters, no proxies reactivos, así que un template que vincula un
resultado de query no registra ninguna dependencia y por sí solo no vuelve a renderizar:
es la misma advertencia que explica la página de Query.

Para eso está `createAlpineStoreAdapter`: te da una caja `Alpine.reactive` para un valor,
con `get()`, `set(value)` y un `destroy()` final, para que puedas meter un resultado vos
mismo dentro del grafo reactivo de Alpine.

```js
import { createAlpineStoreAdapter } from "@ailura/alpinejs-query-adapter-alpine";

const box = createAlpineStoreAdapter(Alpine).create(null);
box.set({ ok: true }); // un template vinculado a este valor vuelve a renderizar
box.destroy(); // final: desde acá get() devuelve undefined
```

El plugin de arriba no lo usa: registrá el plugin, o componé el adapter vos, no los dos.

## Las otras piezas que exporta

Junto al plugin, el paquete exporta la factory del plugin con sus otros nombres y el
adapter en sí.

| Export                     | Tipo    | Para qué sirve                             |
| -------------------------- | ------- | ------------------------------------------ |
| `alpineStoreQueryPlugin`   | función | El plugin que se instala.                  |
| `createQueryPlugin`        | función | La misma factory, con su nombre de build.  |
| `createAlpineStoreAdapter` | función | Construir el adapter.                      |
| `default`                  | función | `alpineStoreQueryPlugin`, con otro nombre. |

`createAlpineStoreAdapter(Alpine)` devuelve un adapter con un método, `create(initial)`,
que devuelve la caja `{ get, set, destroy }`.

## Qué adaptador elegir

Este es uno de tres adaptadores. Los tres implementan el mismo contrato
`QueryStateAdapter` y los tres registran la clave `"query"`, así que podés cambiar uno por
otro sin renombrar nada. Difieren en una sola cosa: qué puede hacer el store donde aterriza
el snapshot.

| Paquete                    | Store subyacente           | Valor que guarda   | Suscripción fuera de Alpine          |
| -------------------------- | -------------------------- | ------------------ | ------------------------------------ |
| `query-adapter-alpine`     | Una caja `Alpine.reactive` | `{ value }`        | No — leé la caja a través del handle |
| `query-adapter-zustand`    | Un store `zustand/vanilla` | `{ value }`        | Sí — con un `create` inyectado       |
| `query-adapter-nanostores` | Un `atom` de `nanostores`  | El snapshot entero | Sí — con un `create` inyectado       |

Este es el único adaptador al que una plantilla puede enlazarse, porque `Alpine.reactive`
es el propio grafo de Alpine: `$store.query` _es_ la caja. Ese es también su límite — nada
fuera de Alpine puede suscribirse a una caja reactiva, así que un panel de devtools, una
capa de persistencia o un test no pueden observar los snapshots que recibe este adaptador.
Si necesitás eso, usá el adaptador de
[zustand](/es/plugins/data/query-adapter-zustand/) o el de
[nanostores](/es/plugins/data/query-adapter-nanostores/), donde inyectás tu propio creador
de store y conservás el store.

## Referencia de la API

El store es el store de Query, documentado en la página de
[Query](/es/plugins/data/query/). Este paquete no agrega métodos propios.
