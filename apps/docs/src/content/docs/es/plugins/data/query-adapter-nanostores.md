---
title: Query Adapter (Nanostores)
---

@ailura/alpinejs-query-adapter-nanostores

Un `QueryStateAdapter` para la cache de [Query](/es/plugins/data/query/) que guarda cada
snapshot publicado en un `atom` de `nanostores`. `nanostores` es peer, así que el paquete
shippea el pegamento y cero bytes de nanostores, y un atom por handle es toda la
implementación.

Es el tercer miembro de la familia de adapters: mismo contrato que
[Query Adapter (Alpine)](/es/plugins/data/query-adapter-alpine/) y
[Query Adapter (Zustand)](/es/plugins/data/query-adapter-zustand/), distinto store detrás.
Elegilo cuando algo que está fuera de Alpine tiene que ver la cache a lo largo del tiempo —
un panel de devtools, un test del lado de Node, una capa de persistencia — y quieras la
dependencia más chica de las tres.

## Instalar

```sh
pnpm add alpinejs @ailura/alpinejs-core @ailura/alpinejs-query @ailura/alpinejs-query-adapter-nanostores nanostores
```

Los cuatro peers son obligatorios. `nanostores` en particular no es opcional: el adapter
importa `atom` en el scope del módulo, así que sin él el primer import de este paquete falla
al resolver — al buildear o al correr, y nada que ver con Alpine.

## Registrar el plugin

```ts
import Alpine from "alpinejs";
import {
  createQueryPlugin,
  nanostoresStoreAdapter,
} from "@ailura/alpinejs-query-adapter-nanostores";

Alpine.plugin(createQueryPlugin({ adapter: nanostoresStoreAdapter }));

Alpine.start();
```

Eso registra `$store.query` y **ningún magic** — acá no hay `$query`, y tampoco `$nano`. El
magic es de `queryPlugin()`, del paquete `@ailura/alpinejs-query`.

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

El adapter de este paquete es el backend que lo sostiene, en un solo slot: el valor mismo.
Un `atom`, no un `map` ni un wrapper `{ value }` — el handle publica un solo valor, y un
atom pelado ya es una caja observable viva.

El handle es un **sink, nunca una fuente**. Acá no se relee ninguna entrada de la cache, y
el `$store.query` registrado es idéntico haya adapter o no. Pasar uno no vuelve reactiva la
cache, no agrega un miembro al store, y no cambia los eventos ni el estado por query.

Leé el snapshot sin Alpine, desde el handle mismo:

```ts
import { nanostoresStoreAdapter } from "@ailura/alpinejs-query-adapter-nanostores";

const handle = nanostoresStoreAdapter.create({ phase: "idle", entries: [], mutations: [] });
handle.get(); // el valor inicial con el que se creó
handle.set({ phase: "mounted", entries: [{ key: ["todos"] }], mutations: [] });
handle.get().entries.length; // 1
handle.destroy();
handle.get(); // undefined — y destroy() de nuevo es no-op, no un throw
```

Los handles son independientes: `create()` aloca un atom nuevo por handle, así que dos
handles creados del mismo adapter no se pueden ver entre sí.

## Observar los snapshots desde afuera de Alpine

Ese ejemplo solo llega al `get()` del handle. Para que un snapshot sea _observable_, tiene
que viajar por un store que vos tengas — y por defecto el store es privado del handle.
`QueryStateHandle` es `{ get, set, destroy }` y no puede crecer con un miembro `subscribe`, y
el controller guarda el handle en un campo privado sin accessor. Por eso lo que se hace
alcanzable es el store: pasale tu propio creator a la factory del adapter y el atom es tuyo.

```ts
import Alpine from "alpinejs";
import { atom } from "nanostores";
import type { WritableAtom } from "nanostores";
import {
  createNanostoresStoreAdapter,
  createQueryPlugin,
} from "@ailura/alpinejs-query-adapter-nanostores";

const atoms: WritableAtom<unknown>[] = [];

const adapter = createNanostoresStoreAdapter({
  create: (initial) => {
    const store = atom(initial);
    atoms.push(store);
    return store;
  },
});

Alpine.plugin(createQueryPlugin({ adapter }));
Alpine.start();

// El controller creó su handle mientras corría el plugin, así que atoms[0] es el
// atom donde se escribe cada snapshot publicado.
const unsubscribe = atoms[0].subscribe((snapshot) => {
  const entries = (snapshot as { entries: unknown[] } | undefined)?.entries ?? [];
  console.log(entries.length, "entries in the cache");
});

// más tarde
atoms[0].get(); // el último snapshot, sin Alpine

// y cuando se desarma el panel
unsubscribe();
```

`create` se resuelve una vez por adapter, no por handle, así que un creator inyectado no se
puede cambiar por debajo de un handle que ya construyó. Inyectar uno solo cambia la
alocación — `get`, `set` y `destroy` son idénticos en los dos casos.

:::caution[El atom del singleton listo para usar es inalcanzable]
`nanostoresStoreAdapter` es `createNanostoresStoreAdapter()` sin opciones, así que no tiene
creator inyectado: los atoms que aloca pertenecen solo a sus handles, y el controller no
expone ningún accessor para el handle. Registrar el singleton te da snapshots a los que no te
podés suscribir. Armá el adapter con `createNanostoresStoreAdapter({ create })` cuando
observar sea el punto. Hasta que inyectes uno, la forma alcanzable de observar un snapshot
es `store.devtools.subscribe()`, que existe en el store registrado haya adapter o no.
:::

## Sin `$nano`, sin `x-nano`

Este paquete registra exactamente un nombre: la clave `$store` de `guardStore`. Ningún
magic, ninguna directiva. `$nano` y `x-nano` son de `@nanostores/alpine`, del que este
paquete deliberadamente no depende — este repo reclama cada nombre registrado como
`kind:name`, así que un paquete que re-exportara el plugin Alpine de otro, o que lo
registrara desde adentro de su propio callback, se quedaría con un nombre que este repo no
es dueño.

Si querés `$nano` en tu app, registralo vos:

```ts
import Alpine from "alpinejs";
import { NanoStores } from "@nanostores/alpine";
import {
  createQueryPlugin,
  nanostoresStoreAdapter,
} from "@ailura/alpinejs-query-adapter-nanostores";

const nanostores = new NanoStores();
Alpine.plugin((Alpine) => Alpine.magic("nano", nanostores));
Alpine.plugin(createQueryPlugin({ adapter: nanostoresStoreAdapter }));

Alpine.start();
```

## Referencia de la API

| Export                          | Descripción                                                                                                                                                                       | Tipo                                        |
| ------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------- |
| `createNanostoresStoreAdapter`  | `createNanostoresStoreAdapter(options?) => QueryStateAdapter` — factory pura, sin efecto lateral al importar. `options.create` es el creator de store del que se arma cada handle | `function`                                  |
| `NanostoresStoreAdapterOptions` | `{ create? }` — el argumento de arriba. `create` por defecto es el `atom` de nanostores                                                                                           | `type`                                      |
| `NanostoresStoreCreator`        | `<Value>(initial: Value) => WritableAtom<Value>` — el `atom` de nanostores lo satisface tal cual, y un creator inyectado devuelve un `WritableAtom` real, con `subscribe`         | `type`                                      |
| `nanostoresStoreAdapter`        | Un `createNanostoresStoreAdapter()` ya listo, para pasar directo como `adapter`. Sin configuración y sin creator inyectado                                                        | `const` (valor de tipo `QueryStateAdapter`) |
| `createQueryPlugin`             | `createQueryPlugin(options?) => (alpine) => void` — construye un `QueryController` con `defaultOptions` y `adapter`, y registra `toStore()` vía `guardStore`                      | `function`                                  |
| `nanostoresQueryPlugin`         | Segundo nombre de `createQueryPlugin`, con un tipo de opciones más angosto: no incluye `adapter` ni `defaultOptions`, así que pasar cualquiera de los dos es un error de tipo     | `function`                                  |
| `default`                       | `queryAdapterNanostores(options?)` — alias de `createQueryPlugin`                                                                                                                 | `function`                                  |
| `DEFAULT_QUERY_STORE_KEY`       | `"query"` — la clave `$store` por defecto. El mismo string que la constante propia de `@ailura/alpinejs-query`                                                                    | `const` (string literal)                    |
| `QueryRegisterOptions`          | `{ storeKey?, adapter?, defaultOptions? }`                                                                                                                                        | `type`                                      |

`QueryStateAdapter` y `QueryStateHandle` se **importan** de `@ailura/alpinejs-query` acá, no
se re-exportan: el contrato tiene un solo dueño, y el host que necesite el tipo lo importa
desde ahí. `atom` y `WritableAtom` también se importan de `nanostores` y nunca se
re-exportan — el barrel es solamente la superficie propia de este paquete.

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

No hay opción `registerNanoStores` ni adapter por defecto implícito: omití `adapter` y el
controller se queda con cada byte del estado adentro de sí, exactamente como cuando
registrás `queryPlugin()` de `@ailura/alpinejs-query`.

### `createNanostoresStoreAdapter`

| Opción   | Default                 | Efecto                                                                                                                                                               |
| -------- | ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `create` | el `atom` de nanostores | La función de la que se aloca el store de cada handle. Pasale la tuya para conservar el atom — y el `subscribe` que tiene. Cada handle sigue teniendo su propio atom |

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

La superficie completa, sus opciones y su contrato de devtools — incluido el panel
`@ailura/alpinejs-query/devtools` que ya está en el árbol — están en la página de
[Query](/es/plugins/data/query/). Este paquete no extiende nada de eso, ni lo envuelve, ni
lo altera.

## Evitar colisiones de nombres

Este paquete **no** toma la excepción que sí toma su hermano Alpine. Registra sin
`override`, así que un segundo registro de `"query"` tira `RegistrationError` en vez de
reemplazar en silencio al primero — y el primer controller sigue corriendo.

```ts
Alpine.plugin(createQueryPlugin({ storeKey: "cache" }));
// → $store.cache
```

Eso es lo que deja convivir a este paquete y a `queryPlugin()` de `@ailura/alpinejs-query`
en una misma app con nombres distintos. Con el mismo nombre no conviven.

## SSR

SSR-safe: no lee `window`/`document` al importar, y el registro no necesita ninguno de los
dos. `nanostores` no lleva framework ni el DOM, así que la mitad adapter de este paquete
importa y corre sin cambios en un proceso de Node. El `QueryController` se construye cuando
corre el callback del plugin, que es cuando lo llama el host.

## Qué adapter elegir

Los tres adapters implementan el mismo contrato `QueryStateAdapter` y los tres registran la
clave `"query"`, así que podés cambiar uno por otro sin renombrar nada. Difieren en
exactamente una cosa: qué puede hacer el host con el store donde aterriza el snapshot.

| Paquete                    | Store detrás del handle       | Valor que sostiene | Suscribirse desde afuera de Alpine |
| -------------------------- | ----------------------------- | ------------------ | ---------------------------------- |
| `query-adapter-alpine`     | Una caja `Alpine.reactive`    | `{ value }`        | No — leés la caja por el handle    |
| `query-adapter-zustand`    | Un store de `zustand/vanilla` | `{ value }`        | Sí — con un `create` inyectado     |
| `query-adapter-nanostores` | Un `atom` de `nanostores`     | El snapshot mismo  | Sí — con un `create` inyectado     |

Esa diferencia conviene explicitarla, porque es la única que hay:

- **Alpine** es el único cuyo store puede leer una plantilla. `Alpine.reactive` es el grafo
  de Alpine, así que un componente que lee la caja se re-renderiza cuando cambia el snapshot
  — y necesita Alpine en el medio para que pase.
- **zustand** entrega un `StoreApi` cuyo `subscribe` recibe el slot `{ value }` entero. Hay
  que desenvolver un nivel para llegar al snapshot.
- **nanostores** entrega un `WritableAtom` que guarda el snapshot directo, así que no hay
  wrapper que desenvolver. Su `subscribe` además dispara una vez al suscribirse, con el
  valor con el que se creó el store, más `init` para ese mismo valor y un `listen` de una
  sola función. Es la más chica de las tres dependencias peer, y su `atom` es el único de
  los tres al que una librería de UI se puede enlazar directo.

Los tres son sinks, no fuentes: ninguno vuelve reactiva la cache, y los tres dejan
`$store.query` igual.

## Limitaciones

- **El atom del singleton por defecto es inalcanzable; el inyectado no.** Mirá la
  advertencia de arriba.
- **`destroy()` es final e idempotente.** Después de que corre, `get()` devuelve
  `undefined` y `set()` se descarta — incluso una publicación tardía de un controller que se
  está desarmando — así que un handle liberado no se puede resucitar. Llamarlo dos veces es
  un no-op, no un throw.
- **El teardown es una binding de listener, no una llamada al store.** nanostores no tiene
  `destroy()`, así que el handle guarda exactamente un `listen` propio — que además mantiene
  el store montado, porque un store de nanostores sin listeners puede devolver `undefined` —
  y lo suelta al liberarse. Lo que vos hayas enganchado con `store.subscribe` lo desenganchás
  vos.
- **Un `subscribe` al atom dispara una vez al suscribirse** con el valor con el que se creó
  el handle. Es el comportamiento documentado de nanostores, no una publicación extra, y es
  la razón por la que un suscriptor ve el snapshot inicial como su primera llamada.
- **El snapshot se guarda por referencia, no con una copia profunda.** `set()` guarda
  exactamente lo que publicó el controller y `get()` devuelve ese mismo objeto. El snapshot
  se rearma desde cero en cada cambio, así que quien lo tiene nunca lo ve mutar por
  debajo — pero los arrays `key` de las entradas y los valores de `data` de adentro son
  objetos del caller.
- **El atom se escribe de a un valor.** Volver a publicar el _mismo_ objeto snapshot es un
  no-op para los suscriptores, porque nanostores compara con `Object.is` antes de notificar.
  El controller arma un snapshot nuevo en cada cambio, así que esto nunca oculta una
  transición real.
- **`subscribe()` es responsabilidad del consumidor.** El plugin no registra ningún listener
  de `change` y no cablea nada al adapter: el camino del snapshot es del controller, y el
  camino de la suscripción es del host.
- **Tres nombres, una función.** `createQueryPlugin`, el export por defecto
  (`queryAdapterNanostores`) y `nanostoresQueryPlugin` son el mismo código, y ni siquiera
  tienen el mismo tipo de parámetro: a `nanostoresQueryPlugin` le faltan `adapter` y
  `defaultOptions`, así que pasar cualquiera de los dos es un error de compilación.
- **`DEFAULT_QUERY_STORE_KEY` choca por nombre con la constante de `query`.** Las dos son
  `"query"`, las dos se exportan, y traer las dos a un mismo módulo necesita un alias.
- **Todavía no hay página de demo ni entrada en el catálogo.** El paquete está en el árbol y
  se publica, pero `apps/demo` no tiene una página para él, así que no está entre los 36
  plugins del catálogo de demo. Esta página de docs es el único lugar donde se puede mirar.
- **Ningún test cubre el plugin.** Los tests del paquete ejercitan solo el adapter.
