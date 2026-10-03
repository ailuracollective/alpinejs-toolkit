---
title: Permissions
---

@ailura/alpinejs-permissions

Un registro de permisos del browser — geolocalización, notificaciones, cámara,
micrófono — detrás de funciones adaptadoras, para preguntar una vez y leer el estado en
todos lados.

## Instalar

```sh
pnpm add alpinejs @ailura/alpinejs-permissions
```

## Registrar el plugin

Una vez, antes de `Alpine.start()`.

```ts
import Alpine from "alpinejs";
import permissionsPlugin from "@ailura/alpinejs-permissions";

Alpine.plugin(permissionsPlugin());

Alpine.start();
```

Eso registra un store `permissions`, así que todo lo de abajo vive en
`$store.permissions`. El mismo objeto te lo entrega el magic `$permissions`.

## Ejemplo mínimo

Registrar un permiso, consultarlo y pedirlo desde un click.

```html
<div x-data>
  <p>
    Notificaciones:
    <span x-text="$store.permissions.registry.notifications?.permission ?? 'desconocido'"></span>
  </p>

  <button
    @click="$store.permissions.request('notifications')"
    :disabled="!$store.permissions.registry.notifications?.canRequest"
  >
    Permitir notificaciones
  </button>
</div>
```

Vinculá por `registry`, que es un registro reactivo de todos los permisos registrados.
`get(name)` devuelve el mismo snapshot para una lectura puntual, pero no pasa por el
registro reactivo, así que un template que se vincula a él no se vuelve a renderizar
cuando cambia. Llamar `query()` en cada render en vez de eso significa preguntarle al
browser en cada render, que es más lento y puede volver a disparar el prompt.

## Registrar lo que necesitas de antemano

`register()` toma un solo objeto adaptador — el nombre es una propiedad suya, no un
argumento aparte — y devuelve una función que lo da de baja de nuevo. El store puede
decirte si el pedido siquiera es posible antes de que ofrezcas el botón.

```js
const unregister = $store.permissions.register({
  name: "camera",
  isSupported: () => "mediaDevices" in navigator,
  getAvailability: () => "available",
  query: async () => (await navigator.permissions.query({ name: "camera" })).state,
  request: async () => {
    const stream = await navigator.mediaDevices.getUserMedia({ video: true });
    return { permission: "granted", result: stream };
  },
});
```

Los adaptadores también se le pueden pasar al plugin, que es donde los pone la mayoría
de las aplicaciones: `permissionsPlugin({ adapters: [cameraAdapter] })`. Registrar el
mismo nombre dos veces tira, así que elegí una de las dos formas.

Las dos formas también se pueden deshacer por nombre. `unregister(name)` descarta el
adaptador y saca su clave de `registry` en el acto, y devuelve si había algo que sacar,
así que un unregister doble es detectable:

```js
$store.permissions.unregister("camera"); // true, y registry.camera ya no está
```

## Observar revocaciones

Un usuario puede revocar un permiso desde la UI del browser mientras tu página está
abierta. `watch()` mantiene el store sincronizado en vez de dejarlo mostrando un
"permitido" viejo. Resuelve a la función que deja de mirar — no hay `unwatch()` en el
store.

```js
const stop = await $store.permissions.watch("camera");
```

Llamá a `stop()` cuando el componente se vaya, o el listener le sobrevive. Los
adaptadores solo se suscriben si implementan `subscribe()`; el que no lo hace te entrega
una función inerte que no libera nada.

## Preguntar sin leer el snapshot

Cuatro lecturas de conveniencia se apoyan sobre el estado que el registro ya sigue.
Ninguna es un modelo de permisos nuevo, y ninguna es reactiva: leen el controlador, igual
que `get()`. Llamalas desde un handler de eventos; para lo que un template se vincule,
seguí usando `registry[name]`.

```js
$permissions.can("camera"); // true solo si está concedido — nunca "puedo pedirlo"
$permissions.all(["camera", "microphone"]); // true solo si todas están concedidas
$permissions.any(["camera", "microphone"]); // true si al menos una
$permissions.when("camera", {
  granted: () => startPreview(),
  denied: () => showWhyNot(),
  prompt: () => showConsentHint(),
  unknown: () => showAskButton(),
});
```

`can()` responde "¿lo tengo?"; `canRequest` responde "¿puedo pedirlo?". Discrepan
justo cuando un permiso es pedible pero todavía no está concedido, y ese par es el que
sirve: ofrecé la affordance, dejá oculta la función que está detrás.

`when()` despacha sobre los mismos nombres de `PermissionState`, así que cada estado es
un handler y no hay tabla que aprender — solo corre el handler que corresponde. Un
nombre que no está registrado no tiene estado, así que no corre nada; no se reporta como
`unknown`.

`all([])` es `true` y `any([])` es `false`, y un nombre que no está registrado cuenta
como no concedido, así que un typo nunca abre una puerta.

## Referencia de la API

| Nombre                                       | Tipo   | Para qué sirve                                                                                                                   |
| -------------------------------------------- | ------ | -------------------------------------------------------------------------------------------------------------------------------- |
| `$store.permissions.registry`                | store  | Registro reactivo de todos los permisos registrados, por nombre.                                                                 |
| `$store.permissions.get(name)`               | método | El último snapshot conocido de un permiso, sin pegarle al browser.                                                               |
| `$store.permissions.can(name)`               | método | Si el permiso está concedido ahora. Nunca `canRequest`. No es reactiva.                                                          |
| `$store.permissions.when(name, handlers)`    | método | Corre solo el handler que corresponde al estado actual. No es reactiva.                                                          |
| `$store.permissions.all(names)`              | método | `true` solo si todos los permisos nombrados están concedidos; `all([])` es `true`.                                               |
| `$store.permissions.any(names)`              | método | `true` si al menos uno está concedido; `any([])` es `false`.                                                                     |
| `$store.permissions.query(name)`             | método | Preguntar al browser por el estado actual.                                                                                       |
| `$store.permissions.refresh(name)`           | método | Re-consultar un permiso — la misma llamada que `query()`.                                                                        |
| `$store.permissions.request(name, options?)` | método | Disparar el prompt. Llamar desde un gesto. `options` va al adaptador.                                                            |
| `$store.permissions.watch(name)`             | método | Mantener el estado sincronizado; resuelve a una función que deja de mirar.                                                       |
| `$store.permissions.register(adapter)`       | método | Declarar un permiso y cómo pedirlo. Devuelve una función para darlo de baja.                                                     |
| `$store.permissions.unregister(name)`        | método | Descartar un adaptador y su clave. Devuelve si había algo que descartar.                                                         |
| `$store.permissions.destroy()`               | método | Teardown a cargo del host: cancela cada suscripción de permiso y descarta los adaptadores registrados. Nadie lo llama por usted. |

Cada permiso registrado reporta `permission` (`granted`, `prompt`, `denied` o
`unknown`), `availability`, `requestState`, `canRequest`, `requiresUserGesture`, `error`
y `result`.

`requestState` es el ciclo de vida de un `request()`: `idle` → `requesting` →
`succeeded` o `failed`. Un pedido exitoso lo deja en `succeeded` hasta que el próximo
`query()` o `request()` lo mueve.

:::caution[`request()` fuera de un gesto de usuario falla como error de permiso]
El browser rechaza el prompt, y lo que vuelve parece que el usuario dijo que no. Un
botón que lo llama desde un hook de `mounted` va a quedar permanentemente denegado, y el
diagnóstico que ayuda es `error` en el snapshot. `requiresUserGesture` viene del
adaptador — `adapter.requiresUserGesture ?? true` — así que puede ser `false` para una
capacidad que no necesita click. Leelo en vez de asumir que siempre es `true`.
:::

:::caution[`register()` no se anuncia]
Un adaptador agregado con `register()` se lee desde `get(name)` al instante, pero solo
aparece en el `registry` reactivo cuando el próximo evento `change` corre la
proyección. `unregister()` sí se anuncia, así que su clave desaparece en el acto. Hasta
que las dos mitades coincidan, dispará un `query()` si necesitás que un adaptador recién
registrado aparezca de forma reactiva.
:::

## Opciones del plugin

```ts
permissionsPlugin({ storeKey: "perms", magicKey: "perm", adapters: [cameraAdapter] });
```
