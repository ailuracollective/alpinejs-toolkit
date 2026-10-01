---
title: Core
---

@ailura/alpinejs-core

La infraestructura compartida sobre la que se construyen todos los demás paquetes: un
controlador base con ciclo de vida, una API de registro con guardas de colisión, acceso
seguro al entorno en SSR e identificadores monótonos.

Core **no** es un plugin de Alpine. No existe `Alpine.plugin(corePlugin())` ni hay
store. Se importa directamente, normalmente por subpath para pagar solo lo que usas.

## Instalar

```sh
pnpm add alpinejs @ailura/alpinejs-core
```

## El controlador base

Extendé `BaseController` y obtienes un emisor de eventos tipado, una pila de limpieza
LIFO y un ciclo de vida que arranca en `idle` y termina en `destroyed`.

```ts
import { BaseController } from "@ailura/alpinejs-core/controller";
import { generateId } from "@ailura/alpinejs-core/ids";

export class CounterController extends BaseController<{ change: [number] }> {
  readonly id = generateId("counter");
  #count = 0;

  get count() {
    return this.#count;
  }

  increment(): void {
    this.#count++;
    this.emit("change", this.#count);
  }

  // Corre una vez, en mount(). Cada paso de teardown entra por onCleanup(),
  // así destroy() los revierte en orden LIFO.
  protected setup(): void {
    this.onCleanup(() => {
      /* deshacer lo que cableó setup() */
    });
  }
}
```

`mount()` es idempotente y solo corre una vez desde `idle`. `destroy()` también es
idempotente y además es final: el controlador no vuelve a montarse.

Los hooks son `setup()` y `teardown()`, ambos protected y ambos no-op por defecto.
`destroy()` drena primero la pila de limpieza y después llama a `teardown()`.
`onCleanup()` es la única forma de registrar un paso — la pila no se descarta a mano, y
`on(event, listener)` registra su propio unsubscribe por usted.

## Guardas de colisión

`guardStore`, `guardMagic` y `guardDirective` son la forma en que un paquete reclama
un nombre. Si otro paquete ya lo posee, el registro tira un `RegistrationError` en
lugar de sobrescribirlo en silencio.

```ts
import { guardStore, guardMagic } from "@ailura/alpinejs-core/guards";

const packageName = "@ailura/alpinejs-accordion";

guardStore(alpine, "accordion", store, packageName);
guardMagic(alpine, "accordion", () => alpine.store("accordion"), packageName);
```

El `packageName` es un literal, no una cadena calculada, para que la guarda pueda
nombrar al dueño del error en el mensaje.

**Tomar un nombre a propósito** es posible y debería ser raro. `override: true` lo hace,
y es la razón para pensar dos veces antes de cambiar un store key por defecto.

```ts
guardStore(alpine, "accordion", store, packageName, { override: true });
```

`resetRegistrationTracking()` limpia los reclamos, que es lo que necesita el teardown de
los tests.

## Acceso seguro al entorno en SSR

Ningún paquete del toolkit lee `window` o `document` en el momento de importar. Estas
funciones devuelven `undefined` fuera del browser en lugar de tirar.

```ts
import { isBrowser, safeWindow, safeDocument, safeMatchMedia } from "@ailura/alpinejs-core/env";

if (isBrowser()) {
  safeDocument()?.querySelector("main");
}
```

## Ids y singletons

`generateId(prefix)` devuelve un id monótono en base 36, así un controlador puede
identificarse sin llevar su propio contador.

```ts
import { generateId } from "@ailura/alpinejs-core/ids";

generateId("counter"); // "counter-1", "counter-2", ...
```

`createSingleton(key, factory)` es por documento, que es lo que evita que las
instancias se filtren entre requests de SSR.

```ts
import { createSingleton } from "@ailura/alpinejs-core/singletons";

const store = createSingleton("app-store", () => createStore());
```

## Exports por subpath

Importa desde el subpath que necesitas, no desde el barril, para que quien consume no
arrastre toda la superficie.

| Subpath          | Aporta                                                                                                                                                                                                                                                                                                       |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `.`              | Todo, re-exportado.                                                                                                                                                                                                                                                                                          |
| `./controller`   | `BaseController`, `EventEmitter`, `CleanupStack`, `EventMap`.                                                                                                                                                                                                                                                |
| `./guards`       | `guardStore`, `guardMagic`, `guardDirective`, `resetRegistrationTracking`.                                                                                                                                                                                                                                   |
| `./env`          | `isBrowser`, `safeWindow`, `safeDocument`, `safeMatchMedia`.                                                                                                                                                                                                                                                 |
| `./ids`          | `generateId`, `resetIdCounter`.                                                                                                                                                                                                                                                                              |
| `./singletons`   | `createSingleton`, `releaseSingleton`, `clearAllSingletons`.                                                                                                                                                                                                                                                 |
| `./bridge`       | `bridgeControllerDirective`: conecta un controlador a una directiva de Alpine. Su teardown está ligado al elemento: pásalo al `cleanup()` de la directiva y Alpine lo ejecuta cuando el elemento se elimina del árbol. No existe bridge de store: un registro de store no tiene teardown que Alpine invoque. |
| `./sync`         | `syncRecordFromSnapshot`.                                                                                                                                                                                                                                                                                    |
| `./invariant`    | `invariant`.                                                                                                                                                                                                                                                                                                 |
| `./errors`       | `ToolkitError`, `RegistrationError`, `RegistrationKind`.                                                                                                                                                                                                                                                     |
| `./registration` | `resolvePluginKeys`, `resolveStoreKey`, `readAlpineStore`: los helpers de resolución de claves y de lectura tipada de store que usa cada factory de plugin.                                                                                                                                                  |
| `./constants`    | `LIFECYCLE_IDLE`, `LIFECYCLE_MOUNTED`, `LIFECYCLE_DESTROYED`, `EVENT_CHANGE`, `SOURCE_USER`, `SOURCE_INITIALIZATION`.                                                                                                                                                                                        |

:::caution[Importar desde `.` en código que publicas anula el propósito de los subpaths]
El barril existe por comodidad y para los tests. En código que publicas, importa desde
`@ailura/alpinejs-core/guards` y compañía: si no, un plugin que solo necesita una guarda
igual arrastra el controlador, el bridge y los singletons.
:::
