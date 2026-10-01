# Canon — Superficie de instanciación

> Contrato normativo para **cómo se crea una instancia** de cualquier paquete del
> toolkit: desde el store de Alpine, desde una directiva, desde un magic, o desde
> TypeScript sin Alpine.
>
> **Status:** `ratified` — 2026-09-30 · enforceado por
> [`test/instantiation-canon.test.ts`](../test/instantiation-canon.test.ts)
> · aplica a los 10 paquetes multi-instancia de §1 · migración en curso, `tooltip`
> conforme como referencia (§9).

Este documento existe porque la auditoría del 2026-09-30 encontró **14 ejes de
divergencia** entre paquetes que resuelven el mismo problema. No eran bugs: cada
divergencia era defendible en su propio paquete. En conjunto eran la razón por la
que un consumidor tenía que aprender diez vocabularioos para leer diez plugins del
mismo toolkit.

`ARCHITECTURE.md` dice cómo se construye un paquete. Este dice **cómo se instancia
el estado que el paquete expone**. Los dos son canon; cuando discrepen, este manda
sobre el alcance de instanciación.

---

## 1. Qué paquetes cubre

Solo los que sostienen **más de una instancia viva a la vez**. Un paquete cuyo
store tiene un único estado no tiene superficie de instanciación y no aparece
aquí (ver `ARCHITECTURE.md` §11 para el resto).

| Paquete      | Unidad instanciable     | Directiva                              |
| ------------ | ----------------------- | -------------------------------------- |
| `form`       | un formulario           | —                                      |
| `collection` | una colección filtrable | —                                      |
| `accordion`  | un acordeón             | —                                      |
| `tabs`       | un juego de pestañas    | —                                      |
| `dialog`     | un diálogo              | `x-dialog="id"`                        |
| `menu`       | un menú                 | `x-menu="id"`, `x-menu.item="id:item"` |
| `tooltip`    | un tooltip              | `x-tooltip="id"`                       |
| `carousel`   | un carrusel             | `x-carousel="id"`                      |
| `virtual`    | una lista virtual       | `x-virtual-scroll="id"`                |
| `selection`  | una selección           | `x-selection`                          |

Los magics instanciables (`$timer`, `$machine`) se rigen por §6, que es un eje
distinto: no viven en un store.

---

## 2. Modelo interno

**R-INST-1 — Un controller, un registro.**

Un paquete multi-instancia tiene **un** `XController` y dentro un
`#instances: Record<string, Internal>`. El store expone ese registro.

```ts
export class TooltipController extends BaseController<TooltipEvents> {
  #instances: Record<string, Internal> = {};
}
```

**Por qué:** `destroy(id)` se vuelve una operación trivial y — más importante —
`destroy()` (sin argumentos) significa exactamente lo mismo en los diez paquetes.
Con el modelo alternativo (un controller por `id`) ese overload tiene que especializar
`destroy` para "una instancia" vs "el controller", y los dos modelos divergen en si
`create(id)` puede fallar o dejar basura si el id ya existe.

**R-INST-2 — Dos internals sancionados, un contrato externo.**

El modelo de R-INST-1 es el único canónico. El patrón "un controller por `id`" que
usan hoy `selection` y `collection` **está prohibido**: crea controllers montados que
el store no puede enumerar, y por eso `destroyAll()` no se puede implementar sin
recorrer un `Map<Element, …>` paralelo.

> **Nota de coste.** `selection` y `collection` tienen el patrón prohibido. Migrarlos
> es trabajo por sí solo y **no está hecho**; hasta que lo esté, ambos incumplen
> R-INST-1 y el validador los marca `WARN`, no `FAIL`. Ver §9.

---

## 3. Vocabulario del store

**R-INST-3 — Cinco miembros, ni uno más.**

```ts
export interface XStore {
  /** El registro. Proyección de solo lectura, alimentada por el sync. */
  readonly instances: Record<string, XInstance>;

  /** Crea la instancia. Re-llamar con el mismo id fusiona las opciones. */
  create(id: string, options?: XOptions): void;

  /** Destruye UNA instancia. Idempotente; id desconocido = no-op. */
  destroy(id: string): void;

  /** Destruye TODAS las instancias. */
  destroyAll(): void;

  /** Destruye el controller completo, incluidas las instancias. */
  destroy(): void;
}
```

**R-INST-4 — `instances`, nunca `groups`.**

El campo del registro se llama `instances` en los diez paquetes. `groups` queda
prohibido como nombre del registro.

> **Por qué, cuando `accordion` y `tabs` lo llaman group.** Un "grupo" de accordion
> es `{ mode, open, items }` — no un contenedor de grupos sino _la unidad misma_. Y
> el término colisiona dentro del mismo paquete: `collection` usa
> `instances` para el registro **y** `groups` para agrupar filas, así que la misma
> palabra significa dos cosas a 20 líneas de distancia. El nombre canónico es el que
> describe la función: una unidad registrada e independientemente direccionable es
> una **instancia**, sea un acordeón, un menú o un tooltip.
>
> `CollectionInstance.groups` (agrupación de filas) sí sobrevive: no es el registro,
> es un campo de una instancia.

**R-INST-5 — El sub-registro usa el mismo verbo, con el sustantivo del dominio.**

Los hijos de una instancia (items, tabs, campos) se registran con `create*` /
`destroy*`, nunca con `register*` / `unregister*`:

| Concepto               | Verbo canónico                 |
| ---------------------- | ------------------------------ |
| item de un acordeón    | `createItem` / `destroyItem`   |
| tab de un juego        | `createItem` / `destroyItem`   |
| item de un menú        | `createItem` / `destroyItem`   |
| campo de un formulario | `createField` / `destroyField` |

El **verbo** es uniforme; el **sustantivo** es del dominio. Un campo de formulario
no es un "item" genérico y nombrarlo `item` costaría más de lo que gana.

**R-INST-6 — `register` / `unregister` no existen.**

No hay alias. La rama `chore/drop-store-alias-magics` ya estableció la postura del
repo: un alias deprecado es deuda, no compatibilidad. El único `@deprecated` que
sobrevive en el árbol es un alias de _tipo_ (`permissions/types.ts:23`), y existe
por un nombre histórico, no por una API pública.

---

## 4. Tipos de la superficie

**R-INST-7 — Tres sufijos, y solo tres.**

| Sufijo         | Significado                     | Ejemplo           |
| -------------- | ------------------------------- | ----------------- |
| `XStore`       | lo que `Alpine.store` registra  | `MenuStore`       |
| `XInstance`    | la proyección de una instancia  | `MenuInstance`    |
| `XOptions`     | las opciones de creación        | `MenuOptions`     |
| `XItemOptions` | las opciones de un sub-registro | `MenuItemOptions` |

`XGroup`, `XGroupOptions`, `XInstanceOptions`, `XControllerConfig` y
`XControllerOptions` quedan prohibidos. En particular `XControllerConfig` (el nombre
actual de `menu`) miente: no configura el controller, configura una instancia.

**R-INST-8 — `XStore` no devuelve la instancia.**

`create(id, options)` devuelve `void`. Quien necesite el handle lo pide
explícitamente:

```ts
const inst = store.instances["user-menu"]; // proyección reactiva, solo lectura
```

El motivo es reactivo: el store es un proxy de Alpine y la proyección se reescribe
en cada `change`. Devolver el objeto del `create` entregaría una instantánea que se
pasa a obsoleta en el siguiente tick sin avisar. La excepción es la vista _plana_
(devolver `XInstance` sin proxy) y está en §6.

---

## 5. Directivas

**R-INST-9 — Una directiva crea; no enlaza.**

Si `x-tooltip="id"` aparece en el DOM, la instancia existe. La directiva llama a
`create(id, options)` y su `cleanup()` llama a `destroy(id)`. Ninguna directiva
puede requerir que el host haya registrado el id antes.

Esto elimina la clase de bug donde un `x-dialog="settings"` sin
`$store.dialog.register('settings', …)` enlaza listeners a un id inexistente y
falla en silencio hasta el primer click.

**R-INST-10 — El id es opcional y siempre se genera si falta.**

```html
<div x-tooltip>
  <!-- id generado -->
  <div x-tooltip="save-hint">
    <!-- id explícito -->
    <div x-tooltip="{ id: 'x', openDelay: 0 }"><!-- objeto con id opcional --></div>
  </div>
</div>
```

`selection` es hoy el único que cumple esto. El resto exige un string.

**R-INST-11 — El elemento expone su id: `data-<paquete>-id`.**

```ts
el.setAttribute("data-tooltip-id", id);
```

Sin esto, un `x-tooltip` sin id explícito es inaccesible desde el resto del
componente: las llamadas del store (`isOpen(id)`, `panelProps(id)`) necesitan un id
que el autor nunca escribió.

**R-INST-12 — La directiva nunca recibe dos argumentos.**

`x-menu.item="menuId:itemId"` codifica dos ids en un token separado por `:` porque
Alpine no pasa argumentos a una directiva. Es la razón de que exista el sub-registro
y no un `x-menu-item` separado.

---

## 6. Magics instanciables

Distinto eje: `$timer` y `$machine` no registran un store, **crean controllers**.

**R-INST-13 — Una magic instanciable es una llamada, no un método.**

```ts
$machine({ initial: 'idle', transitions: [...] })     // ✅ llamada directa
$timer.create({ duration: 1000 })                     // ❌
$timer({ duration: 1000 })                            // ✅
```

**Por qué la llamada directa gana.** `$machine` no necesita `.create`: no hay
ambigüedad sobre qué se crea, porque el argumento _es_ la configuración. La única
razón por la que `$timer` tiene métodos es que ofrece cuatro modos
(`create`/`countdown`/`countup`/`stopwatch`) que difieren en un literal — y eso es
un sobre de opciones, no cuatro APIs.

**R-INST-14 — El id lo pone la magic, y la vista lo expone.**

Las dos magics autogeneran un id vía `generateId` de `@ailura/alpinejs-core/ids`, y
la vista lo expone como `id` de solo lectura. `$machine` ya lo hace; `$timer` no.

**R-INST-15 — `dispose()`, siempre.**

El teardown de una instancia creada por magic se llama `dispose()` — nunca
`destroy()`, que en el store significa "todo el store". El nombre no se comparte.

**R-INST-16 — `cleanup()` es el único teardown que Alpine invoca.**

`Alpine.plugin()` descarta el valor de retorno del callback y Alpine 3.17 no expone
teardown global. El `cleanup()` de la directiva / del elemento que evaluó la
expresión lo encola en `el._x_cleanups` y `cleanupElement` lo drena al sacar el
elemento del árbol. Es la única razón por la que §5 es viable.

**R-INST-17 — `create` / `countdown` / `countup` / `stopwatch` se colapsan en una
forma con `mode`.**

```ts
$timer({ mode: "down", duration: 1000 }); // sustituye a $timer.countdown(...)
$timer({ mode: "up", limit: 1000 }); // sustituye a $timer.countup(...)
$timer({ mode: "stopwatch" }); // sustituye a $timer.stopwatch(...)
```

---

## 7. Montaje

**R-INST-18 — El store y la factory hacen `mount()`. El host nunca.**

```ts
const ctrl = createTooltipController(); // ya montado
ctrl.mount(); // sigue siendo legal: mount() es idempotente
```

Hoy la mitad de las factories hace `mount()` (env, lang, scroll, sidebar, media,
theme, attention) y la otra mitad no. Eso obliga al consumidor a saber la respuesta
—y por eso los README enseñan `ctrl.mount?.()`, con un optional chaining que
sugiere duda sobre algo que `BaseController` garantiza.

**R-INST-19 — `BaseController` conserva `mount()` explícito.**

R-INST-18 no elimina el método: lo cambia de _obligatorio_ a _opcional e
idempotente_. El ciclo `idle → mounted → destroyed` de `ARCHITECTURE.md` §4 no
cambia.

---

## 8. Nombres

**R-INST-20 — Una factory por paquete, con el nombre canónico.**

```ts
createXController(options?: XOptions): XController
```

Es el patrón mayoritario (25 paquetes). Se prohíben:

| Prohibido                                                    | Por qué                                                     |
| ------------------------------------------------------------ | ----------------------------------------------------------- |
| `createX` como duplicado de `createXController`              | dos nombres para el mismo cuerpo; 9 paquetes exportan ambos |
| `createX` **en vez de** `createXController`                  | invierte la mayoría sin ganar nada                          |
| un nombre ajeno (`createJsonApiClient`, `createNotifyMagic`) | no se puede adivinar por inspección                         |
| `export { createX as createXController } from "./plugin"`    | el símbolo no existe donde el nombre dice                   |

**R-INST-21 — `options` es el primer y único parámetro; el `id` viaja dentro.**

```ts
createTooltipController({ id: "nav", openDelay: 120 });
```

Se prohíben las firmas `createXController(id?: string)` (13 paquetes) y
`createXController(options?, id?)` (calendar). Con un id posicional, la sobrecarga
`createFormController(id)` vs `createFormController(options)` es indistinguible para
el lector.

**R-INST-22 — Una constante por clave registrada, siempre exportada.**

```ts
export const DEFAULT_TOOLTIP_STORE_KEY = "tooltip";
export const DEFAULT_TOOLTIP_MAGIC_KEY = "tooltip"; // alias, no literal
export const DEFAULT_TOOLTIP_DIRECTIVE_KEY = "tooltip";
```

- El sufijo es siempre `_STORE_KEY` / `_MAGIC_KEY` / `_DIRECTIVE_KEY`. `env` usa hoy
  `DEFAULT_ENV_KEY` (sin sufijo): prohibido.
- Cuando hay store, `DEFAULT_X_MAGIC_KEY = DEFAULT_X_STORE_KEY` (alias, no literal
  repetido). Cuando no hay store pero sí magic, la constante existe igual.
- `state-machine` no exporta ninguna y usa el literal `"machine"` inline
  (`plugin.ts:102`): prohibido.
- Paquetes con varias magics declaran una constante por magic
  (`DEFAULT_TRANSFER_CLIPBOARD_KEY` / `_SHARE_KEY` / `_EXPORT_KEY`).

**R-INST-23 — `CreateXOptions` es el nombre del sobre del plugin; `XOptions`, el de
la instancia.**

Hoy conviven cuatro prefijos: `CreateXOptions` (16 paquetes), `XPluginOptions` (10),
`PluginOptions` sin nombre (state-machine), y paquetes que usan los dos a la vez
(timer: `CreateTimerPluginOptions` + `CreateTimerOptions`).

```ts
CreateTooltipOptions; // { storeKey?, magicKey?, directiveKey?, id? }  → xTooltipPlugin()
TooltipOptions; // { openDelay?, closeDelay?, … }               → create(id, …)
```

**R-INST-24 — Un paquete expone una sola forma de registrar el store.**

`guardStore` + un store, o nada. `storeKey` y `magicKey` se resuelven siempre con
`resolvePluginKeys(options, DEFAULT_X_STORE_KEY, DEFAULT_X_MAGIC_KEY)`; nunca a mano.

---

## 9. Estado de conformidad

`test/instantiation-canon.test.ts` comprueba R-INST-3 a R-INST-24 leyendo los
`types.ts` y `index.ts` reales de cada paquete, no una lista escrita en el test.

| Regla                  | Paquetes conformes | Pendientes                                             |
| ---------------------- | ------------------ | ------------------------------------------------------ |
| R-INST-2 modelo        | 8 de 10            | selection, collection (un controller por `id`)         |
| R-INST-3/4 registro    | 9 de 10            | collection (`destroyAll`)                              |
| R-INST-5 sub-registro  | 4 de 4             | —                                                      |
| R-INST-7 sufijos       | 10 de 10           | —                                                      |
| R-INST-9..12 directiva | 6 de 6             | —                                                      |
| R-INST-13/14/17 magic  | 2 de 2             | —                                                      |
| R-INST-18 montaje      | 10 de 10           | —                                                      |
| R-INST-20/21 factory   | 35 de 37           | calendar (`options?, id?`), tabs (`createTabsStore()`) |
| R-INST-22 constantes   | 37 de 37           | —                                                      |

**Migrados.** `tooltip` primero, como paquete de referencia, y detrás `accordion`,
`tabs`, `form`, `menu`, `dialog`, `carousel`, `virtual`, `timer`, `env`,
`theme`, `media` y `json-api`:
`register`/`unregister` →
`create`/`destroy` con `destroyAll()`; `XGroup`/`XGroupOptions`/`XInstanceOptions`/
`XControllerConfig` → `XInstance`/`XOptions`; `groups` → `instances`; y la
directiva acepta un objeto, genera el id cuando falta, lo expone en
`data-<pkg>-id` y crea la instancia si no existe. En las factories: un nombre por
clase (`createXController`), sin duplicados, y un solo sobre de opciones con el
`id` dentro — `createXController({ id })`, nunca `createXController("id")`.

Cuatro defectos aparecieron al hacerlo y conviene que queden escritos:

- **La directiva no puede reemplazar la instancia.** `menu` corre la misma
  directiva en el trigger y en el panel. Cuando el segundo la ejecutaba,
  `create` sustituía el objeto y con él el `trigger` que el primero había
  enlazado — y `handleOutsideClick` usa ese campo para distinguir un click en el
  trigger de un click fuera. El síntoma era un trigger que abría el menú y nunca
  lo cerraba. Por eso la directiva **solo crea cuando falta**: `if
(!controller.hasInstance(id)) controller.create(id, options)`.
- **Un magic que devuelve un controller debe copiar toda la cadena de prototipos.**
  `StopwatchControllerImpl` extiende `TimerControllerImpl`, y el proxy reactivo
  copiaba los métodos de _un_ nivel: la vista de un cronómetro salía sin
  `start`, `pause`, `reset` ni `toggle`, y nunca se podía arrancar. Los docs lo
  resolvían desaconsejando el magic para cronómetros — tolerable mientras
  `stopwatch()` fuera un método aparte; al colapsar `$timer` en una llamada es la
  única forma de construir uno.
- **Una regla de conteo puede ser la regla equivocada.** "Una sola factory
  `createXController`" marcaba como fallo a `timer` y `attention`, que tienen dos
  y tres clases de controller legítimas. La regla que sí describe el defecto es
  _dos factories para la misma clase_, que es exactamente el duplicado que
  encontró la auditoría: `createMedia` y `createMediaController` construyendo la
  misma `MediaController`.
- **Un id generado debe recordarse.** Generarlo dentro del efecto produce un id
  nuevo en cada corrida, `id === bound` nunca se cumple, y cada escritura a
  `data-<pkg>-id` realimenta el observador de mutaciones que dispara el efecto.
  El id generado se guarda en una variable por elemento.

**Cómo se aplica sin bloquear el árbol.** El validador no tiene una lista de
paquetes exentos: tiene una lista de `(paquete, regla)` pendientes, y una violación
que **no** esté en esa lista falla. Eso invierte el problema de un gate: cerrar un
gap es borrar una línea, y abrir un _nuevo_ diverge — un paquete quega a
`tooltip.create` mañana es un fallo, no una nota.

Añadir una entrada a `KNOWN_GAPS` es una afirmación de que el hueco se entiende.
No se añade una para silenciar un fallo que no se ha leído.

---

## 10. Lo que este canon NO cubre

- **Scope de registro.** Nada está acotado a un subárbol del DOM. El aislamiento se
  consigue registrando el plugin dos veces con `storeKey` distintos, no con
  `<div x-data>` anidados. Ver `ARCHITECTURE.md` §5.2.
- **Paquetes singleton.** Sin superficie de instanciación; su `destroy()` es
  "host-owned teardown" y está documentado como tal en cada `types.ts`.
- **Infraestructura.** `core`, `ui`, `testing` no registran nada.
- **Los README.** 31 de 36 son placeholders con directivas inexistentes
  (`x-<paquete>:trigger`). Son un problema real y separado: un canon documentado
  sobre ejemplos falsos no es un canon. Ver `agents/README.template.md`.
