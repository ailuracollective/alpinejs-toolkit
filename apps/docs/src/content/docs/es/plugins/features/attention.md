---
title: Attention
---

@ailura/alpinejs-attention

Dos magics independientes para la atención de la pantalla: `$wakelock` mantiene la
pantalla encendida, y `$idle` te avisa cuando el usuario se alejó. Ninguno renderiza
nada; los dos están para cambiar lo que hace tu app.

## Instalar

```sh
pnpm add alpinejs @ailura/alpinejs-attention
```

## Registrar el plugin

Una vez, antes de `Alpine.start()`.

```ts
import Alpine from "alpinejs";
import attentionPlugin from "@ailura/alpinejs-attention";

Alpine.plugin(attentionPlugin());

Alpine.start();
```

Eso registra dos magics, `$wakelock` e `$idle`. No hay store: los dos son magics
sueltos que llamas directo.

## Ejemplo mínimo

Mantener la pantalla encendida mientras corre una tarea larga, y avisar cuando el
usuario vuelva.

```html
<div x-data>
  <p x-show="$wakelock.isSupported">
    Pantalla mantenida encendida: <span x-text="$wakelock.isActive"></span>
  </p>
  <p x-show="!$wakelock.isSupported">Este browser no tiene Wake Lock.</p>

  <p>Usuario: <span x-text="$idle.userState"></span></p>
</div>
```

`isSupported` e `isActive` son getters, no métodos. Leerlos en una expresión es toda la
API del lado de solo lectura.

## Descartar un error

`error` es el único campo escribible de las dos superficies. Asignarle es una
operación real: setea el error en el controller y la escritura sobrevive al próximo
cambio de estado en vez de ser pisada.

```html
<button @click="$wakelock.error = null" x-show="$wakelock.error">Cerrar</button>
<button @click="$idle.error = null" x-show="$idle.error">Cerrar</button>
```

Todos los demás campos expuestos (`isActive`, `isRequesting`, `isSupported`,
`userState`, `screenState`, `permission`, `threshold`, `isLoading`, `isWatching`,
`isIdle`) son estado reportado de solo lectura. Asignarles en un template no le
cambia nada al plugin: el próximo cambio de estado re-proyecta el valor real encima.

## Usar el wake lock

Pedir un wake lock tiene que ser desde un gesto del usuario, así que llamalo desde un
click.

```html
<button @click="$wakelock.request()" x-show="!$wakelock.isActive">
  Mantener la pantalla encendida
</button>
<button @click="$wakelock.release()" x-show="$wakelock.isActive">Dejarla dormir</button>
```

**Liberalo cuando dejes de necesitarlo.** Un wake lock que nunca se libera mantiene la
pantalla encendida de forma indefinida y descarga la batería.

```js
$wakelock.release();
```

## Usar la detección de inactividad

La detección de inactividad necesita un threshold y, en los browsers que lo exigen, un
permiso que el usuario tiene que conceder.

La detección necesita un threshold y, en los browsers que lo exigen, un permiso.

```js
$idle.start({ threshold: 60000 });
```

Los dos controles que la arrancan y la detienen:

```html
<button @click="$idle.requestPermission()">Habilitar detección de inactividad</button>
<button @click="$idle.stop()">Dejar de detectar</button>
```

:::caution[La detección de inactividad suele estar detrás de un prompt]
Los browsers condicionan la Idle Detection API con su propio permiso, y `start()`
nunca lo pide. Llamá primero a `requestPermission()` desde un gesto del usuario: si el
detector igual se niega, el mensaje queda en `$idle.error` e `isWatching` sigue en
`false`. En un browser sin Idle Detector, `start()` cae a un timer simple que reporta
`"active"` y pasa a `"idle"` cuando vence el threshold.
:::

## Referencia de la API

**`$wakelock`**

| Nombre                   | Tipo                 | Para qué sirve                                                                |
| ------------------------ | -------------------- | ----------------------------------------------------------------------------- |
| `$wakelock.error`        | store (escribible)   | El último mensaje de error, o `null`. Asignarlo lo descarta.                  |
| `$wakelock.isSupported`  | store (solo lectura) | Si el browser tiene la Wake Lock API.                                         |
| `$wakelock.isActive`     | store (solo lectura) | Si hay un lock tomado actualmente.                                            |
| `$wakelock.isRequesting` | store (solo lectura) | Si hay un `request()` en vuelo.                                               |
| `$wakelock.request()`    | método               | Tomar el lock. Debe llamarse desde un gesto.                                  |
| `$wakelock.release()`    | método               | Soltar el lock.                                                               |
| `$wakelock.destroy()`    | método               | Teardown que maneja el host: suelta el lock tomado. Nadie lo llama por usted. |

**`$idle`**

| Nombre                        | Tipo                 | Para qué sirve                                                                                            |
| ----------------------------- | -------------------- | --------------------------------------------------------------------------------------------------------- |
| `$idle.error`                 | store (escribible)   | El último mensaje de error, o `null`. Asignarlo lo descarta.                                              |
| `$idle.userState`             | store (solo lectura) | `"active"` o `"idle"`.                                                                                    |
| `$idle.screenState`           | store (solo lectura) | `"locked"` o `"unlocked"`.                                                                                |
| `$idle.threshold`             | store (solo lectura) | El threshold de inactividad configurado, en ms. Mínimo `60000`; lo que sea menor sube a ese valor.        |
| `$idle.permission`            | store (solo lectura) | El último resultado de `requestPermission()`, o `null` antes de pedirlo.                                  |
| `$idle.isSupported`           | store (solo lectura) | Si el browser tiene la Idle Detection API.                                                                |
| `$idle.isWatching`/`isActive` | store (solo lectura) | Si `start()` está corriendo. `isActive` es alias.                                                         |
| `$idle.isIdle`                | store (solo lectura) | Si `userState` es `"idle"`.                                                                               |
| `$idle.isLoading`             | store (solo lectura) | Si el detector real está arrancando.                                                                      |
| `$idle.start(options?)`       | método               | Empezar a detectar. Pasa `{ threshold }`.                                                                 |
| `$idle.stop()`                | método               | Dejar de detectar.                                                                                        |
| `$idle.requestPermission()`   | método               | Pedirle al usuario que permita la API.                                                                    |
| `$idle.destroy()`             | método               | Teardown que maneja el host: deja de detectar y limpia el timer de inactividad. Nadie lo llama por usted. |

## Opciones del plugin

```ts
attentionPlugin({ wakelockKey: "pantalla", idleKey: "ausente" });
```
