---
title: Arquitectura
---

El toolkit es un monorepo de 40 paquetes `@ailura/alpinejs-*` que comparten un mismo cañón
de controlador y puente hacia Alpine. Esta es la página de referencia de ese cañón: los
principios detrás de él, las reglas de capas, el ciclo de vida del controlador, la forma
de la factory del plugin, y cómo se genera y valida un paquete nuevo.

## Las cinco ideas centrales

1. **Los controladores manejan el estado; Alpine maneja la reactividad.** Un
   `BaseController` agnóstico del framework emite eventos `change` tipados; un
   `plugin.ts` finito los proyecta a un store o magic de Alpine.
2. **Un cañón por paquete.** Todos los plugins exportan `xxxPlugin(options)`, declaran
   un `packageName` literal, y registran con las guardas de `core`.
3. **Las guardas evitan colisiones silenciosas.** Si dos paquetes reclaman el mismo
   nombre de store, magic o directiva, el registro tira un `RegistrationError` en lugar
   de sobrescribir.
4. **SSR-safe por defecto.** Ningún paquete lee `window` o `document` en el momento de
   importar: pasan por `safeWindow()` y `safeDocument()`.
5. **Un solo bundle por paquete.** Una entrada ESM más tipos, con `publint`/`attw` y un
   presupuesto de tamaño por paquete.

## Las capas

Las capas fluyen hacia abajo: una capa solo importa de las que tiene debajo. `core` no
tiene peers del toolkit, que es lo que lo hace seguro de depended desde cualquier lado.

```
Foundation   core · ui · state-machine · testing · plugin-template
Primitivas   env · media · notify · selection · collection · child · scroll · calendar ·
             form · gesture · keyboard · history · timer · toast · transfer · permissions · geo · lang
Features     accordion · tabs · dialog · menu · tooltip · overlay · attention ·
             theme · sidebar · carousel · command · virtual
Data         query · query-adapter-alpine · query-adapter-zustand · query-adapter-nanostores · json-api
```

La página de inicio tiene el mismo mapa como cards navegables, una por capa.

### La capa Data tiene una familia de adapters, no un solo adapter

`@ailura/alpinejs-query` es el dueño del contrato `QueryStateAdapter` — `{ create(initial) →
{ get, set, destroy } }` — y el controller publica un snapshot de devtools nuevo en el
handle en cada cambio. Tres paquetes implementan ese contrato, y los tres registran la clave
`"query"`, así que podés cambiar uno por otro sin renombrar nada:

- `query-adapter-alpine` guarda el snapshot en una caja `Alpine.reactive`.
- `query-adapter-zustand` lo guarda en un store de `zustand/vanilla` por handle, y un
  creator de store inyectado vuelve ese store alcanzable para suscribirse desde afuera de
  Alpine.
- `query-adapter-nanostores` lo guarda en un `atom` de `nanostores` por handle, y un creator
  de store inyectado vuelve ese atom alcanzable de la misma manera.

Los tres son **sinks, no fuentes**: ninguno relee una entrada de la cache, y ninguno cambia
el `$store.query` registrado. Lo que los separa es el store, y por lo tanto lo que un host
puede observar. La caja de Alpine es la única a la que una plantilla se puede enlazar,
porque `Alpine.reactive` es el grafo de Alpine. Entre los otros dos, el `subscribe` de zustand
te da el slot `{ value }` entero para desenvolver, mientras que el `atom` de nanostores
guarda el snapshot mismo — sin wrapper, con un `subscribe` que además dispara una vez al
suscribirse, y con la dependencia peer más chica de las tres.

:::note[No todo lo que es un paquete tiene página de demo]
`query-adapter-nanostores` es un paquete real y publicado: es una carpeta en `packages/`, una
referencia de proyecto en el `tsconfig.json` raíz, y una página de este sitio. Todavía **no**
está en el catálogo de demo, que sigue contando 36 plugins de browser, porque su página de
demo y su entrada de catálogo están planeadas. El repo tiene 40 carpetas de paquetes y 36
entradas de catálogo: son dos números distintos y ninguno es un redondeo del otro.
:::

## Hechos de migración

Dos cosas sobre los viejos paquetes de `@ailuracode` conviene decirlas claras, porque la
prosa que los describía ya no es cierta:

- **`@ailuracode/alpine-query-kit` está retirado y no se va a volver a crear.** Se lo
  describía como la única implementación restante de `QueryStateAdapter`; esa frase es falsa,
  y el retiro está terminado y no pendiente: **las dos** superficies que tenía el paquete
  viejo tienen ahora una casa acá, y ninguna volvió como el paquete viejo:

  | Superficie vieja de `alpine-query-kit`              | Casa nueva                                                                      | Estado                                             |
  | --------------------------------------------------- | ------------------------------------------------------------------------------- | -------------------------------------------------- |
  | El panel de devtools                                | `@ailura/alpinejs-query/devtools` — `queryDevtoolsPlugin`, `mountQueryDevtools` | **En el árbol**, como subpath export real          |
  | El contrato de snapshot que leía el panel           | `QueryDevtoolsApi` en `$store.query.devtools`                                   | **En el árbol** — `getSnapshot()`, `subscribe(cb)` |
  | El backend de estado nanostores                     | `@ailura/alpinejs-query-adapter-nanostores`                                     | **En el árbol**, como paquete peer, no re-export   |
  | Los re-exports de `NanoStores` / `$nano` / `x-nano` | Nada — esos nombres son de `@nanostores/alpine`                                 | **No se arrastró**, a propósito                    |

  El panel es un porteo, no una copia: está reescrito para ser SSR-safe a través de
  `safeDocument()` / `safeWindow()` / `isBrowser()` de `@ailura/alpinejs-core/env` en vez del
  acceso crudo al DOM de antes, `queryDevtoolsPlugin` difiere a `alpine:initialized` con un
  listener que después puede sacar, lee la cache únicamente por `QueryDevtoolsApi`, y su
  pestaña **Edit** se habilita solo cuando la fuente sobre la que se montó expone `setData` —
  `QueryDevtoolsApi` en sí es read-only, así que una fuente con solo `{ devtools }` recibe la
  pestaña deshabilitada con el motivo impreso en vez de un botón que no hace nada. Sale desde
  su propio subpath, así que un bundle de producción que nunca lo importa no carga nada de él.

  Lo que **no** se arrastró es la forma de la dependencia, y ese es el punto. Este repo tiene
  **cero `dependencies` de runtime** en los 40 paquetes — todo runtime de terceros es
  `peerDependency` más devDependency, una entrada en `neverBundle`, y un `ignore` en
  `.size-limit.json`, exactamente como hace `carousel` con `embla-carousel`, y como hacen los
  otros dos adapters de query con `zustand` y `nanostores`. Así que `nanostores` no se metió
  adentro de `query`: se volvió un paquete más de la misma familia de adapters, y cada
  superficie de Alpine que el paquete viejo registraba ahora es de `query` o queda
  deliberadamente en manos de tu app.

- **`state-machine` es el sucesor del viejo `alpine-toggle`, y `alpine-toggle` no se va a
  volver a crear.** Es un hecho de migración, no una afirmación de feature: `state-machine`
  es un `MachineController` de N estados que está en el árbol, y el árbol no soporta ningún
  mapeo desde un `alpine-toggle` de origen más allá de la migración misma. Lo que el paquete
  viejo hacía y `MachineController` no, no está portado.

## El ciclo de vida del controlador

```
idle → mounted → destroyed
```

`mount()` es idempotente y solo corre una vez desde `idle`. `destroy()` también es
idempotente y además es final — después de él, toda mutación es un no-op silencioso.

## La factory del plugin

```ts
import { guardStore, guardMagic } from "@ailura/alpinejs-core/guards";

const packageName = "@ailura/alpinejs-accordion";

export function accordionPlugin(options = {}) {
  const controller = new AccordionController();
  const store = controller.toStore();

  return function registerAccordion(alpine) {
    guardStore(alpine, options.storeKey ?? "accordion", store, packageName);
    guardMagic(
      alpine,
      options.magicKey ?? "accordion",
      () => alpine.store("accordion"),
      packageName
    );
  };
}
```

**El magic sigue al store** — renombrar `storeKey` renombra los dos.

## Superficies clave por tipo

| Tipo      | Ejemplos                              | Notas                                               |
| --------- | ------------------------------------- | --------------------------------------------------- |
| store     | `$store.accordion`, `$store.theme`    | Snapshot reactivo sincronizado desde el controlador |
| magic     | `$timer.create(...)`, `$machine(...)` | Se construye por evaluación, instancias aisladas    |
| directiva | `x-child`, `x-gesture`                | Registrado con `guardDirective`, en kebab-case      |

## Agregar un paquete

```sh
pnpm run new:plugin -- my-plugin
```

Esto genera el andamiaje desde `plugin-template`, renombra los tokens y agrega la
referencia en tsconfig. La página de [plugin-template](/es/plugins/foundation/plugin-template)
tiene el checklist completo del cañón para dejar el paquete listo.

## Validación

```sh
pnpm typecheck   # tsc + vp run --recursive typecheck
pnpm build       # vp run --recursive build (vp pack por paquete)
pnpm test        # vitest + happy-dom
pnpm check       # lint + typecheck + tests
pnpm size        # size-limit per package
```

## Siguiente

- [Core](/es/plugins/foundation/core/) — el código del que sale todo esto.
- [Accordion](/es/plugins/features/accordion/) — un paquete completo para leer el patrón de punta a punta.
